import React from 'react';
import { AdjustmentRequest, User } from '../types/inventory';
import { Clock, CheckCircle2, XCircle, ArrowRight, PlusCircle } from 'lucide-react';

interface WorkerRequestsViewProps {
  requests: AdjustmentRequest[];
  currentUser: User;
  onNavigateToCatalog: () => void;
}

export const WorkerRequestsView: React.FC<WorkerRequestsViewProps> = ({
  requests,
  currentUser,
  onNavigateToCatalog,
}) => {
  const workerRequests = requests.filter(
    (r) => r.workerId === currentUser.id || r.workerName === currentUser.name
  );
  const displayRequests = workerRequests.length > 0 ? workerRequests : requests;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            My Stock Count Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Track the status of your physical inventory count changes submitted for Admin approval.
          </p>
        </div>

        <button
          onClick={onNavigateToCatalog}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-all min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Stock Adjustment</span>
        </button>
      </div>

      {displayRequests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-md mx-auto my-8 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3 border border-sky-100">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Count Requests Yet</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Browse the inventory catalog and submit an adjustment when you encounter discrepancies or damaged stock.
          </p>
          <button
            onClick={onNavigateToCatalog}
            className="px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-bold shadow-sm"
          >
            Go to Catalog
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayRequests.map((req) => {
            const isPending = req.status === 'pending';
            const isApproved = req.status === 'approved';
            const isRejected = req.status === 'rejected';
            const isStandardItem =
              (req.size === 'Standard' || req.size === 'One Size') &&
              (req.colorName === 'Standard' || req.colorName === 'Default' || req.colorName === 'N/A');

            return (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
              >
                {/* Product & Variant */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {req.productImage ? (
                      <img
                        src={req.productImage}
                        alt={req.productName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">Item</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{req.productName}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      {!isStandardItem && (
                        <span
                          className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: req.colorHex }}
                        />
                      )}
                      <span className="text-xs text-slate-700 font-semibold">
                        {isStandardItem ? 'Standard Item' : `Size ${req.size} · ${req.colorName}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Reason: <span className="text-slate-800 font-medium">{req.reason}</span>
                    </div>
                  </div>
                </div>

                {/* Count and Status */}
                <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-400">{req.currentQuantity}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-mono text-base font-black text-slate-900">
                        {req.requestedQuantity}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                          req.delta > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {req.delta > 0 ? `+${req.delta}` : req.delta}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(req.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {isPending && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-xs font-bold text-amber-800">
                        <Clock className="w-4 h-4 animate-pulse text-amber-600" />
                        <span>Pending Admin</span>
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Approved</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-xs font-bold text-rose-800">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>Rejected</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
