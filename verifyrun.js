// verifyrun.js：按验证预算验函数并留账
import { depthEffect, needsDepth } from "./opset.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

// 按指令线性走栈深，返回拒绝原因或 null（通过）
function verifyCode(code) {
  let depth = 0;
  for (let pc = 0; pc < code.length; pc += 1) {
    const ins = code[pc] || {};
    const op = ins.op;
    if (depth < needsDepth(op)) return "E_STACK_UNDERFLOW";
    if (op === "jump" && (!Number.isInteger(ins.to) || ins.to < 0 || ins.to >= code.length)) {
      return "E_BAD_JUMP";
    }
    depth += depthEffect(op);
  }
  if (depth !== 0) return "E_STACK_LEFT";
  return null;
}

function copyState(source) {
  const src = source || {};
  return {
    verified: (src.verified || []).slice(),
    rejected: (src.rejected || []).slice(),
    pending: (src.pending || []).slice(),
    applied: (src.applied || []).slice()
  };
}

// 名单与账按名字排序，保证拆轮与整批的收尾态一致
function canonicalize(state) {
  state.verified.sort();
  state.rejected.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  return state;
}

function knownName(state, name) {
  return state.verified.indexOf(name) !== -1
    || state.pending.some(function (row) { return row[0] === name; })
    || state.rejected.some(function (row) { return row[0] === name; });
}

export function step(spec) {
  const dupCode = spec.duplicate_error_code || "E_DUPLICATE_FUNCTION";
  const badEventCode = spec.event_error_code || "E_BAD_EVENT";
  const events = spec.events || [];
  if (!Array.isArray(events)) fail(badEventCode, "events must be an array");
  let budget = typeof spec.budget === "number" ? spec.budget : 0;
  const state = copyState(spec.state);
  const verified = [];
  const rejected = [];
  let judged = 0;
  for (const event of events) {
    if (!event || typeof event !== "object" || event.kind !== "task"
        || typeof event.name !== "string" || !Array.isArray(event.code)) {
      fail(badEventCode, "bad event");
    }
    if (event.id !== undefined && state.applied.indexOf(event.id) !== -1) continue;
    if (knownName(state, event.name)) fail(dupCode, "duplicate function " + event.name);
    if (judged < budget) {
      judged += 1;
      const reason = verifyCode(event.code);
      if (reason) {
        state.rejected.push([event.name, reason]);
        rejected.push([event.name, reason]);
      } else {
        state.verified.push(event.name);
        verified.push(event.name);
      }
    } else {
      state.pending.push([event.name, event.code]);
    }
    state.applied.push(event.id);
  }
  canonicalize(state);
  return { state: state, verified: verified, rejected: rejected, verified_count: judged,
           pending_before: state.pending.length,
           pending_ids: state.pending.map(function (row) { return row[0]; }),
           judged: judged, judged_bound: events.length };
}

export function close(spec) {
  const state = copyState(spec.state);
  let catchup = 0;
  while (state.pending.length > 0) {
    const row = state.pending.shift();
    catchup += 1;
    const reason = verifyCode(row[1]);
    if (reason) state.rejected.push([row[0], reason]);
    else state.verified.push(row[0]);
  }
  canonicalize(state);
  return { state: state, catchup: catchup };
}
