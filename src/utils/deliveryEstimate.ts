import type { ProductionBatch } from '../types/inventory';

const dayMs = 86400000;
const diffDays = (a?: string, b?: string): number | null => {
  if (!a || !b) return null;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / dayMs);
  return Number.isFinite(d) && d >= 0 ? d : null;
};

/** Days one finished batch took: from the Steps & costs dates when logged, else batch start to stock-in. */
export function batchActualDays(b: ProductionBatch): { days: number; fromSteps: boolean } | null {
  const a = Object.values(b.stageAssignments || {});
  const starts = a.map((x) => x?.startedAt).filter(Boolean) as string[];
  const ends = a.map((x) => x?.endedAt || x?.completedAt?.slice(0, 10)).filter(Boolean) as string[];
  if (starts.length && ends.length) {
    const d = diffDays([...starts].sort()[0], [...ends].sort().slice(-1)[0]);
    if (d !== null && d > 0) return { days: d, fromSteps: true };
  }
  if (b.status === 'completed' && b.completedAt) {
    const d = diffDays(b.createdAt.slice(0, 10), b.completedAt.slice(0, 10));
    if (d !== null && d > 0) return { days: d, fromSteps: false };
  }
  return null;
}

export interface DurationEstimate {
  count: number;
  avg: number;
  max: number;
  fromSteps: boolean; // true when every sample came from logged Steps & costs dates
}

/** History of finished batches of the same item (same size first, else any size of the item). */
export function estimateProductionDays(
  batches: ProductionBatch[],
  productId: string,
  variantId?: string
): DurationEstimate | null {
  const done = batches.filter((b) => b.productId === productId && b.status === 'completed');
  const pick = (list: ProductionBatch[]) =>
    list.map(batchActualDays).filter(Boolean) as { days: number; fromSteps: boolean }[];
  let samples = variantId ? pick(done.filter((b) => b.variantId === variantId)) : [];
  if (samples.length === 0) samples = pick(done);
  if (samples.length === 0) return null;
  const days = samples.map((x) => x.days);
  return {
    count: samples.length,
    avg: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
    max: Math.max(...days),
    fromSteps: samples.every((x) => x.fromSteps),
  };
}

export const addDaysIso = (days: number): string =>
  new Date(Date.now() + days * dayMs).toISOString().slice(0, 10);
