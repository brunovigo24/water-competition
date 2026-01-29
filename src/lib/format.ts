export function mlToLiters(ml: number) {
  return ml / 1000;
}

export function formatLiters(liters: number) {
  if (!Number.isFinite(liters)) return "0.00L";
  return `${liters.toFixed(2)}L`;
}

