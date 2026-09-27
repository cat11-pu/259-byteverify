// opset.js：指令对栈深的净变化与所需最小栈深
export function depthEffect(op) {
  if (op === "push") return 1;
  if (op === "pop" || op === "add") return -1;
  return 0;
}

export function needsDepth(op) {
  if (op === "pop") return 1;
  if (op === "add") return 2;
  return 0;
}
