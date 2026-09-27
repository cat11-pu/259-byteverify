// verifyrun.js：按验证预算验函数并留账（基线：一律给空表）
import { depthEffect, needsDepth } from "./opset.js";

export function step(spec) {
  return { state: spec.state, verified: [], rejected: [], verified_count: 0,
           pending_before: 0, pending_ids: [], judged: 0, judged_bound: 0 };
}

export function close(spec) {
  return { state: spec.state, catchup: 0 };
}
