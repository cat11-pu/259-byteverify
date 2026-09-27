// opset.js：指令对栈深的净变化与执行前所需最小栈深
// push 加深一层；pop 减一；add 减一（弹出两个操作数、压回一个结果）；jump 不变。
export function depthEffect(op) {
  if (op === "push") return 1;
  if (op === "pop") return -1;
  if (op === "add") return -1;
  return 0;
}

export function needsDepth(op) {
  if (op === "pop") return 1;
  if (op === "add") return 2;
  return 0;
}
