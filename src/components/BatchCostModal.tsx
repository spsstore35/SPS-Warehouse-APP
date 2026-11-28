import React, { useMemo, useState } from 'react';
import type {
  ProductionBatch,
  BatchStageAssignment,
  BatchCostLine,
  CustomStageDefinition,
  OperationStageKey,
  Vendor,
} from '../types/inventory';
import { getStageMeta } from '../utils/sourcing';

interface Props {
  batch: ProductionBatch;
  allBatches: ProductionBatch[];
  stages: OperationStageKey[];
  customStages?: Record<string, CustomStageDefinition>;
  vendors: Vendor[];
  canEdit: boolean;
  onSave: (batch: ProductionBatch) => void;
  onClose: () => void;
}

const dayMs = 86400000;
const daysBetween = (a?: string, b?: string): number | null => {
  if (!a || !b) return null;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / dayMs);
  return Number.isFinite(d) && d >= 0 ? d : null;
};
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString();

export function stageTotal(a: BatchStageAssignment | undefined, qty: number): number {
  if (!a) return 0;
  if (a.costLines && a.costLines.length > 0) return a.costLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  if (typeof a.totalCost === 'number' && a.totalCost >= 0) return a.totalCost;
  if (typeof a.cost === 'number') return a.cost * Math.max(1, qty);
  return 0;
}

export function batchSummary(b: ProductionBatch, stages: OperationStageKey[]) {
  const total = stages.reduce((s, k) => s + stageTotal(b.stageAssignments?.[k], b.quantity), 0);
  const starts = stages.map((k) => b.stageAssignments?.[k]?.startedAt).filter(Boolean) as string[];
  const ends = stages
    .map((k) => b.stageAssignments?.[k]?.endedAt || b.stageAssignments?.[k]?.completedAt?.slice(0, 10))
    .filter(Boolean) as string[];
  let days: number | null = null;
  if (starts.length && ends.length) days = daysBetween([...starts].sort()[0], [...ends].sort().slice(-1)[0]);
  const perUnit = b.quantity > 0 ? total / b.quantity : 0;
  return { total, perUnit, days };
}

export default function BatchCostModal({ batch, allBatches, stages, customStages, vendors, canEdit, onSave, onClose }: Props) {
  const workStages = stages.filter((k) => k !== 'stock_in');
  const [draft, setDraft] = useState<Record<string, BatchStageAssignment>>(() =>
    JSON.parse(JSON.stringify(batch.stageAssignments || {}))
  );
  const [qty, setQty] = useState<number>(batch.quantity);

  const setStage = (k: string, patch: Partial<BatchStageAssignment>) =>
    setDraft((d) => ({ ...d, [k]: { ...(d[k] || {}), ...patch } }));
  const addLine = (k: string, kind: BatchCostLine['kind']) =>
    setStage(k, {
      costLines: [
        ...((draft[k]?.costLines as BatchCostLine[]) || []),
        { id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind, label: '', amount: 0 },
      ],
    });
  const setLine = (k: string, id: string, patch: Partial<BatchCostLine>) =>
    setStage(k, { costLines: (draft[k]?.costLines || []).map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const delLine = (k: string, id: string) =>
    setStage(k, { costLines: (draft[k]?.costLines || []).filter((l) => l.id !== id) });

  const live: ProductionBatch = { ...batch, quantity: qty, stageAssignments: draft };
  const sum = useMemo(() => batchSummary(live, workStages), [draft, qty]);

  const previous = useMemo(() => {
    const same = allBatches
      .filter(
        (b) =>
          b.id !== batch.id &&
          b.productId === batch.productId &&
          (b.variantId || '') === (batch.variantId || '') &&
          b.createdAt < batch.createdAt
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const withCost = same.find((b) => batchSummary(b, workStages).total > 0);
    return withCost ? { b: withCost, s: batchSummary(withCost, workStages) } : null;
  }, [allBatches, batch.id]);

  const save = () => {
    const out: Record<string, BatchStageAssignment> = {};
    Object.entries(draft).forEach(([k, a]) => {
      const lines = (a.costLines || []).filter((l) => (l.label || '').trim() || Number(l.amount) > 0);
      const next: BatchStageAssignment = { ...a, costLines: lines };
      if (lines.length > 0) {
        next.totalCost = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
        delete next.cost; // the stage total is now the sum of its lines
      }
      out[k] = next;
    });
    onSave({ ...batch, quantity: Math.max(1, Math.round(qty)), stageAssignments: out });
  };

  const inp = 'px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100';

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/60 p-3 overflow-y-auto">
      <div className="w-full max-w-3xl my-4 rounded-3xl bg-white p-4 sm:p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-black text-slate-900">Steps &amp; costs: {batch.batchCode}</div>
            <div className="text-[11px] text-slate-500">
              {canEdit ? 'Log each step: dates, what was bought, transport, cost, notes.' : 'View only. The Purchases admin or the owner edits this.'}
            </div>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-200 text-xs font-black text-slate-900">
            Close
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-slate-600 font-bold">Total cost</div>
            <div className="font-mono font-black text-base text-slate-900">{fmt(sum.total)} EGP</div>
          </div>
          <div>
            <div className="text-slate-600 font-bold">Finished pieces</div>
            <input
              type="number"
              min={1}
              disabled={!canEdit}
              value={qty || ''}
              onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
              className={`${inp} w-24 font-mono font-black`}
            />
          </div>
          <div>
            <div className="text-slate-600 font-bold">Cost per piece</div>
            <div className="font-mono font-black text-base text-emerald-800">{fmt(sum.perUnit)} EGP</div>
          </div>
          <div>
            <div className="text-slate-600 font-bold">Total days</div>
            <div className="font-mono font-black text-base text-slate-900">{sum.days === null ? '-' : sum.days}</div>
          </div>
        </div>

        {previous ? (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <div className="font-black text-slate-900">Compare with the previous batch of this item ({previous.b.batchCode}, {previous.b.quantity} pcs)</div>
            {(() => {
              const dPer = sum.perUnit - previous.s.perUnit;
              const dTot = sum.total - previous.s.total;
              const dDays = sum.days !== null && previous.s.days !== null ? sum.days - previous.s.days : null;
              const col = (n: number) => (n > 0 ? 'text-rose-700' : n < 0 ? 'text-emerald-700' : 'text-slate-700');
              const sign = (n: number) => (n > 0 ? '+' : '');
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                  <div>
                    Per piece: {fmt(previous.s.perUnit)} to {fmt(sum.perUnit)}{' '}
                    <b className={col(dPer)}>({sign(dPer)}{fmt(dPer)})</b>
                  </div>
                  <div>
                    Total: {fmt(previous.s.total)} to {fmt(sum.total)}{' '}
                    <b className={col(dTot)}>({sign(dTot)}{fmt(dTot)})</b>
                  </div>
                  <div>
                    Days: {previous.s.days ?? '-'} to {sum.days ?? '-'}{' '}
                    {dDays !== null && <b className={col(dDays)}>({sign(dDays)}{dDays})</b>}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="text-[11px] text-slate-500">No earlier batch of this item with costs to compare yet.</div>
        )}

        <div className="space-y-3">
          {workStages.map((k) => {
            const a = draft[k] || {};
            const meta = getStageMeta(k, customStages);
            const dur = daysBetween(a.startedAt, a.endedAt || a.completedAt?.slice(0, 10));
            const lines = (a.costLines as BatchCostLine[]) || [];
            const stageSum = stageTotal(a, qty);
            return (
              <div key={k} className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-sm text-slate-900">{meta.label}</div>
                  <div className="font-mono text-xs font-black text-emerald-800">{fmt(stageSum)} EGP</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-bold text-slate-700">
                  <label>
                    Vendor
                    <select disabled={!canEdit} value={a.vendorId || ''} onChange={(e) => setStage(k, { vendorId: e.target.value || undefined })} className={`${inp} w-full mt-0.5 font-normal`}>
                      <option value="">-</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Started
                    <input type="date" disabled={!canEdit} value={a.startedAt || ''} onChange={(e) => setStage(k, { startedAt: e.target.value || undefined })} className={`${inp} w-full mt-0.5 font-normal`} />
                  </label>
                  <label>
                    Finished
                    <input type="date" disabled={!canEdit} value={a.endedAt || a.completedAt?.slice(0, 10) || ''} onChange={(e) => setStage(k, { endedAt: e.target.value || undefined })} className={`${inp} w-full mt-0.5 font-normal`} />
                  </label>
                  <div>
                    Took
                    <div className="mt-1 font-mono text-xs text-slate-900">{dur === null ? '-' : `${dur} day(s)`}</div>
                  </div>
                </div>
                <input
                  disabled={!canEdit}
                  value={a.notes || ''}
                  onChange={(e) => setStage(k, { notes: e.target.value })}
                  placeholder="Notes for this step"
                  className={`${inp} w-full`}
                />
                <div className="space-y-1.5">
                  {lines.map((l) => (
                    <div key={l.id} className="grid grid-cols-12 gap-1.5 items-center">
                      <select disabled={!canEdit} value={l.kind} onChange={(e) => setLine(k, l.id, { kind: e.target.value as BatchCostLine['kind'] })} className={`${inp} col-span-3 sm:col-span-2`}>
                        <option value="purchase">Bought</option>
                        <option value="transport">Transport</option>
                        <option value="other">Other</option>
                      </select>
                      <input disabled={!canEdit} value={l.label} onChange={(e) => setLine(k, l.id, { label: e.target.value })} placeholder={l.kind === 'transport' ? 'e.g. Uber' : 'What was bought'} className={`${inp} col-span-5 sm:col-span-3`} />
                      {l.kind === 'transport' ? (
                        <>
                          <input disabled={!canEdit} value={l.from || ''} onChange={(e) => setLine(k, l.id, { from: e.target.value })} placeholder="From" className={`${inp} col-span-6 sm:col-span-2`} />
                          <input disabled={!canEdit} value={l.to || ''} onChange={(e) => setLine(k, l.id, { to: e.target.value })} placeholder="To" className={`${inp} col-span-6 sm:col-span-2`} />
                        </>
                      ) : (
                        <input disabled={!canEdit} value={l.note || ''} onChange={(e) => setLine(k, l.id, { note: e.target.value })} placeholder="Note" className={`${inp} col-span-12 sm:col-span-4`} />
                      )}
                      <input type="number" min={0} disabled={!canEdit} value={l.amount || ''} onChange={(e) => setLine(k, l.id, { amount: Math.max(0, Number(e.target.value) || 0) })} placeholder="EGP" className={`${inp} col-span-4 sm:col-span-2 font-mono text-right`} />
                      {canEdit && (
                        <button type="button" onClick={() => delLine(k, l.id)} className="col-span-2 sm:col-span-1 text-rose-600 text-xs font-black">
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <div className="flex gap-3 text-[11px] font-black text-emerald-700">
                      <button type="button" onClick={() => addLine(k, 'purchase')} className="underline">+ Bought</button>
                      <button type="button" onClick={() => addLine(k, 'transport')} className="underline">+ Transport</button>
                      <button type="button" onClick={() => addLine(k, 'other')} className="underline">+ Other</button>
                    </div>
                  )}
                  {!canEdit && lines.length === 0 && <div className="text-[11px] text-slate-400">No cost lines logged.</div>}
                </div>
              </div>
            );
          })}
        </div>

        {canEdit && (
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={onClose} className="py-2.5 rounded-xl bg-slate-200 text-slate-900 font-black text-xs min-h-[44px]">
              Cancel
            </button>
            <button type="button" onClick={save} className="py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs min-h-[44px]">
              Save steps &amp; costs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
