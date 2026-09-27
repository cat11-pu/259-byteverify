import assert from "node:assert";
import { depthEffect, needsDepth } from "../opset.js";
import { step, close } from "../verifyrun.js";
import { render } from "../app.js";

const base = {
  budget: 2,
  state: { verified: [], rejected: [], pending: [], applied: [] },
  events: [],
  duplicate_error_code: "E_DUPLICATE_FUNCTION", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("depthEffect returns a number", () => {
  assert.strictEqual(typeof depthEffect("push"), "number");
});

check("needsDepth returns a number", () => {
  assert.strictEqual(typeof needsDepth("pop"), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
