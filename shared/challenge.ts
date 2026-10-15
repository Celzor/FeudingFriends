export function challengeTarget(seed: number, step: number) {
  let n = (seed + Math.imul(step + 1, 2654435761)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 2246822507);
  return (n >>> 0) % 9;
}
