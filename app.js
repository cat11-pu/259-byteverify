// app.js：渲染结果
import { depthEffect, needsDepth } from "./opset.js";
import { step, close } from "./verifyrun.js";

export function render(spec) {
  const events = spec.events || [];
  const half = Math.ceil(events.length / 2);
  const first = step(spec);
  const closed = close(Object.assign({}, spec, { state: first.state }));
  const r1 = step(Object.assign({}, spec, { events: events.slice(0, half) }));
  const r2 = step(Object.assign({}, spec, { state: r1.state, events: events.slice(half) }));
  const closedTwo = close(Object.assign({}, spec, { state: r2.state }));
  const replay = step(Object.assign({}, spec, { state: closed.state }));
  const wide = step(Object.assign({}, spec, { budget: spec.budget + 2 }));
  const full = step(Object.assign({}, spec, { budget: events.length + 2 }));
  const fullClosed = close(Object.assign({}, spec, { state: full.state }));
  const fingerprint = function (state) {
    return JSON.stringify({
      verified: state.verified, rejected: state.rejected.map(function (row) { return row.join(":"); }),
      pending: state.pending.map(function (row) { return row[0]; }), applied: state.applied.length
    });
  };
  return { verified: closed.state.verified, rejected: closed.state.rejected,
           verified_first: first.verified_count, verified_wide: wide.verified_count,
           pair_differs: first.verified_count !== wide.verified_count,
           pending_before: first.pending_before, pending_ids: first.pending_ids,
           catchup: closed.catchup, pending_after: closed.state.pending.length,
           mid_differs: fingerprint(r2.state) !== fingerprint(first.state),
           closed_equal: fingerprint(closedTwo.state) === fingerprint(closed.state),
           replay_new: replay.verified_count, judged: first.judged, judged_bound: first.judged_bound,
           full_diff: fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1,
           count: events.length, tail: depthEffect("push") + needsDepth("pop") };
}
