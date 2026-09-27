// verifyrun.js：按验证预算验函数并留账，收尾不限预算清账
import { depthEffect, needsDepth } from "./opset.js";

const DUP_CODE = "E_DUPLICATE_FUNCTION";
const BAD_EVENT_CODE = "E_BAD_EVENT";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// 跨轮状态里的四份账：verified/rejected/pending/applied；
// records 是内部底稿，按事件 id 记录已判定的函数与结论，便于收尾后按提交序归位。
function cloneState(source) {
  const state = source || {};
  return {
    verified: Array.isArray(state.verified) ? state.verified.slice() : [],
    rejected: Array.isArray(state.rejected) ? state.rejected.map(function (row) { return [row[0], row[1]]; }) : [],
    pending: Array.isArray(state.pending) ? state.pending.map(function (row) { return [row[0], row[1], row[2]]; }) : [],
    applied: Array.isArray(state.applied) ? state.applied.slice() : [],
    records: Array.isArray(state.records) ? state.records.map(function (row) {
      return { id: row.id, name: row.name, ok: row.ok, reason: row.reason };
    }) : []
  };
}

// 已判定名单按事件 id 归序重建（单轮与拆两轮才能收敛到同一收尾态）。
function rebuild(state) {
  const ordered = state.records.slice().sort(function (a, b) {
    const ia = typeof a.id === "number" ? a.id : 0;
    const ib = typeof b.id === "number" ? b.id : 0;
    return ia - ib;
  });
  state.verified = ordered.filter(function (row) { return row.ok; }).map(function (row) { return row.name; });
  state.rejected = ordered.filter(function (row) { return !row.ok; }).map(function (row) { return [row.name, row.reason]; });
}

function knownNames(state) {
  const names = {};
  state.verified.forEach(function (name) { names[name] = true; });
  state.rejected.forEach(function (row) { names[row[0]] = true; });
  state.pending.forEach(function (row) { names[row[0]] = true; });
  return names;
}

function validEvent(event) {
  return event && typeof event === "object"
    && event.kind === "task"
    && typeof event.name === "string" && event.name.length > 0
    && Array.isArray(event.code);
}

// 按指令线性走栈深：深度不够记 E_STACK_UNDERFLOW；
// 跳转目标越界记 E_BAD_JUMP；走完栈深不归零记 E_STACK_LEFT。
// 三条都算被拒，不抛错。
function judgeCode(code) {
  let depth = 0;
  for (let i = 0; i < code.length; i += 1) {
    const instr = code[i] || {};
    const op = instr.op;
    if (depth < needsDepth(op)) return { ok: false, reason: "E_STACK_UNDERFLOW" };
    if (op === "jump") {
      const to = instr.to;
      if (typeof to !== "number" || to < 0 || to >= code.length) {
        return { ok: false, reason: "E_BAD_JUMP" };
      }
    }
    depth += depthEffect(op);
  }
  if (depth !== 0) return { ok: false, reason: "E_STACK_LEFT" };
  return { ok: true, reason: null };
}

// 入参：state（跨轮状态）、events（task 带 name 与 code）、budget（整批共用的验证预算）。
// 每处理一条事件都花掉一次预算（无论通过还是被拒）；预算用尽后，
// 剩余函数连指令一起压在待验证账上，带入下一轮。
export function step(spec) {
  spec = spec || {};
  const state = cloneState(spec.state);
  const events = Array.isArray(spec.events) ? spec.events : [];
  let budget = Number.isFinite(spec.budget) ? spec.budget : 0;
  const dupCode = spec.duplicate_error_code || DUP_CODE;
  const eventCode = spec.event_error_code || BAD_EVENT_CODE;

  const verifiedNow = [];
  const rejectedNow = [];
  let judged = 0;

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const eventId = event && event.id;

    // 重放幂等：同一事件已处理过，跳过且不报错、不再花预算。
    if (typeof eventId !== "undefined" && state.applied.indexOf(eventId) !== -1) continue;

    if (!validEvent(event)) throw fail(eventCode, "非法事件");

    // 重复提交：函数名已在通过名单、拒绝名单或账上（本轮新判定的也算）。
    const seen = knownNames(state);
    if (seen[event.name]) throw fail(dupCode, "重复提交的函数 " + event.name);

    if (budget <= 0) {
      state.pending.push([event.name, event.code, eventId]);
      continue;
    }

    budget -= 1;
    judged += 1;
    const result = judgeCode(event.code);
    state.records.push({ id: eventId, name: event.name, ok: result.ok, reason: result.reason });
    if (typeof eventId !== "undefined") state.applied.push(eventId);
    if (result.ok) verifiedNow.push(event.name);
    else rejectedNow.push([event.name, result.reason]);
    rebuild(state);
  }

  return {
    state: state,
    verified: verifiedNow,
    rejected: rejectedNow,
    verified_count: judged,
    pending_before: state.pending.length,
    pending_ids: state.pending.map(function (row) { return row[0]; }),
    judged: judged,
    judged_bound: events.length
  };
}

// 收尾：不限预算，把账里的函数全部验完，返回补齐条数。
export function close(spec) {
  spec = spec || {};
  const state = cloneState(spec.state);

  let catchup = 0;
  const ledger = state.pending.slice();
  state.pending = [];
  ledger.forEach(function (row) {
    const name = row[0];
    const code = row[1];
    const id = row[2];
    const result = judgeCode(Array.isArray(code) ? code : []);
    state.records.push({ id: id, name: name, ok: result.ok, reason: result.reason });
    if (typeof id !== "undefined" && state.applied.indexOf(id) === -1) state.applied.push(id);
    catchup += 1;
  });
  rebuild(state);

  return { state: state, catchup: catchup };
}
