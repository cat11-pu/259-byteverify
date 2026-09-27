// opset.js：指令效果与跳转校验（基线：一律给零、一律放行）
export function depthEffect(op) {
  return 0;
}

export function needsDepth(op) {
  return 0;
}
