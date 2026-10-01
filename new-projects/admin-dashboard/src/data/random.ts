// Seeded generator: the same seed always produces the same workspace,
// so saved changes can be replayed on top of an identical base.
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  const chance = (probability: number) => next() < probability;
  const weighted = <T,>(items: readonly T[], weights: readonly number[]) => {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  };
  // Approximately normal, clamped to three deviations.
  const gauss = (mean: number, deviation: number) => {
    const u = next() + next() + next() + next() - 2;
    return mean + (u / 0.8165) * deviation;
  };
  const poisson = (lambda: number) => {
    if (lambda > 40) return Math.max(0, Math.round(gauss(lambda, Math.sqrt(lambda))));
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= next();
    } while (p > limit);
    return k - 1;
  };
  return { next, int, pick, chance, weighted, gauss, poisson };
}

export type Random = ReturnType<typeof createRandom>;
