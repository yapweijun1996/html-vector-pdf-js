export type YieldStrategy = 'raf' | 'timeout';

export interface YieldConfig {
  yieldEveryNodes?: number;
  yieldEveryMs?: number;
  strategy?: YieldStrategy;
}

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const yieldOnce = async (strategy: YieldStrategy): Promise<void> => {
  if (typeof window === 'undefined') return;
  if (strategy === 'raf' && typeof window.requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    return;
  }
  await new Promise<void>((resolve) => window.setTimeout(() => resolve(), 0));
};

export const createYieldController = (cfg?: YieldConfig): ((tick?: number) => Promise<void>) => {
  const yieldEveryNodes = Math.max(1, cfg?.yieldEveryNodes ?? 250);
  const yieldEveryMs = Math.max(0, cfg?.yieldEveryMs ?? 16);
  const strategy: YieldStrategy = cfg?.strategy ?? 'raf';

  let lastYieldAt = nowMs();
  return async (tick?: number): Promise<void> => {
    const t = typeof tick === 'number' ? tick : 0;
    if (t > 0 && t % yieldEveryNodes !== 0) return;
    const elapsed = nowMs() - lastYieldAt;
    if (elapsed < yieldEveryMs) return;
    lastYieldAt = nowMs();
    await yieldOnce(strategy);
  };
};

