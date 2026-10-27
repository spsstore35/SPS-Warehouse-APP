import React, { useState } from 'react';
import { AuditLogEntry, Product } from '../types/inventory';
import { History, ShieldCheck, UserCheck, ChevronRight, Image as ImageIcon, Eye } from 'lucide-react';
import { ActivityDetailModal } from './ActivityDetailModal';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
  products?: Product[];
  onViewProduct?: (productId: string) => void;
  onClearLogs?: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  logs,
  products = [],
  onViewProduct,
}) => {
  const [filter, setFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.action === filter;
  });

  const selectedProduct = selectedLog
    ? products.find((p) => p.id === selectedLog.productId || p.name === selectedLog.productName)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Inventory Audit & Activity Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Complete traceability of all stock adjustments, additions, and master catalog changes. Click any entry to view full breakdown.
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
          onClick={() => setFilter('request_approved')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
            filter === 'request_approved'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Approved Requests
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
            const matchedProduct = products.find(
              (p) => p.id === log.productId || p.name === log.productName
            );
            const itemImage = log.productImage || matchedProduct?.image || matchedProduct?.images?.[0];

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="p-4 sm:p-5 flex items-start gap-3.5 hover:bg-amber-50/40 cursor-pointer transition-all group"
                title="Click to view detailed breakdown"
              >
                {/* Product thumbnail or role icon */}
                {itemImage ? (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-xs flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform">
                    <img
                      src={itemImage}
                      alt={log.productName || 'Garment'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      isAdmin
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-sky-50 text-sky-800 border border-sky-200'
                    }`}
                  >
                    {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                      {log.summary}
                    </h4>
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
                    <p className="text-xs text-slate-600 mt-1 font-medium line-clamp-2">
                      {log.details}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-bold text-slate-700">{log.actorName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{log.actorRole} Authority</span>
                      {log.productName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-600 font-semibold truncate max-w-[140px] sm:max-w-xs">
                            {log.productName}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 opacity-90 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0">
                      <Eye className="w-3 h-3 text-amber-600" />
                      <span className="hidden sm:inline">View Breakdown</span>
                      <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Activity Modal */}
      {selectedLog && (
        <ActivityDetailModal
          log={selectedLog}
          product={selectedProduct}
          onClose={() => setSelectedLog(null)}
          onViewProduct={onViewProduct}
        />
      )}
    </div>
  );
};
