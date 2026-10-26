import React, { useState } from 'react';
import { AuditLogEntry } from '../types/inventory';
import { History, ShieldCheck, UserCheck } from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const [filter, setFilter] = useState<string>('all');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.action === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Inventory Audit & Activity Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Complete traceability of all stock adjustments, worker submissions, and master catalog edits.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
            filter === 'all' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Activity ({logs.length})
        </button>
        <button
          onClick={() => setFilter('request_approved')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
            filter === 'request_approved'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Approved Adjustments
        </button>
        <button
          onClick={() => setFilter('stock_adjusted')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
            filter === 'stock_adjusted'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Direct Adjustments
        </button>
        <button
          onClick={() => setFilter('product_created')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
            filter === 'product_created'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Catalog Additions
        </button>
      </div>

      {/* Timeline List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-md mx-auto my-8 shadow-sm">
          <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-900">No logs recorded yet</h3>
          <p className="text-xs text-slate-500 mt-1">Actions performed will appear here automatically.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm">
          {filteredLogs.map((log) => {
            const isAdmin = log.actorRole === 'admin';

            return (
              <div key={log.id} className="p-4 sm:p-5 flex items-start gap-3.5 hover:bg-slate-50/70 transition-colors">
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    isAdmin
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-sky-50 text-sky-800 border border-sky-200'
                  }`}
                >
                  {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-sm font-bold text-slate-900">{log.summary}</h4>
                    <span className="text-[11px] font-mono font-medium text-slate-400">
                      {new Date(log.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>

                  {log.details && (
                    <p className="text-xs text-slate-600 mt-1 font-medium">{log.details}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                    <span className="font-bold text-slate-700">{log.actorName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{log.actorRole} Authority</span>
                    {log.productName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-600 font-semibold truncate">{log.productName}</span>
                      </>
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
