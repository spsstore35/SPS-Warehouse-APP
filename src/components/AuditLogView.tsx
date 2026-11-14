import React, { useState, useMemo, useEffect } from 'react';
import { AuditLogEntry, Product, Booking } from '../types/inventory';
import { formatAuditLogReason } from '../utils/auditReason';
import {
  History,
  ShieldCheck,
  UserCheck,
  User,
  ShoppingBag,
  Package,
  ChevronRight,
  ChevronLeft,
  Calendar,
  RotateCcw,
  Sparkles,
  Eye,
  CalendarDays,
  Bell,
  ArrowRight,
} from 'lucide-react';
import { ActivityDetailModal } from './ActivityDetailModal';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  sendTestNotification,
} from '../services/notificationService';

const ITEMS_PER_PAGE = 10;

interface AuditLogViewProps {
  logs: AuditLogEntry[];
  products?: Product[];
  bookings?: Booking[];
  pendingAuditNotificationsCount?: number;
  onViewProduct?: (productId: string) => void;
  onViewBooking?: (bookingNumberOrId: string) => void;
  onClearLogs?: () => void;
}

const toDateKey = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
};

const getTodayKey = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatFriendlyDate = (dateKey: string): string => {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const todayKey = getTodayKey();

  const formatted = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (dateKey === todayKey) {
    return `Today (${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`;
  }

  // Check yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (dateKey === yesterdayKey) {
    return `Yesterday (${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`;
  }

  return formatted;
};

const shiftDate = (dateKey: string, deltaDays: number): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  const newD = String(date.getDate()).padStart(2, '0');
  return `${newY}-${newM}-${newD}`;
};

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  logs,
  products = [],
  bookings = [],
  pendingAuditNotificationsCount = 0,
  onViewProduct,
  onViewBooking,
}) => {
  const [filter, setFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Date filtering state
  const todayKey = useMemo(() => getTodayKey(), []);

  // Determine initial date: if logs have entries for today, use today, otherwise use the date of the most recent log
  const initialDate = useMemo(() => {
    if (logs.length > 0) {
      const datesWithLogs = logs.map((l) => toDateKey(l.timestamp)).filter(Boolean);
      if (datesWithLogs.includes(todayKey)) return todayKey;
      return datesWithLogs[0] || todayKey;
    }
    return todayKey;
  }, [logs, todayKey]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [isDayFilterEnabled, setIsDayFilterEnabled] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset to page 1 when filters or date change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, selectedDate, isDayFilterEnabled]);

  // Set of dates that have at least one log
  const datesWithActivity = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      const k = toDateKey(log.timestamp);
      if (k) set.add(k);
    });
    return set;
  }, [logs]);

  // Filter logs by action AND date
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Action filter
      if (filter !== 'all' && log.action !== filter) {
        return false;
      }
      // Date filter
      if (isDayFilterEnabled && selectedDate) {
        const logDateKey = toDateKey(log.timestamp);
        if (logDateKey !== selectedDate) {
          return false;
        }
      }
      return true;
    });
  }, [logs, filter, isDayFilterEnabled, selectedDate]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLogs, safeCurrentPage]);

  // Count total logs on the selected date (regardless of action filter)
  const countForSelectedDate = useMemo(() => {
    return logs.filter((l) => toDateKey(l.timestamp) === selectedDate).length;
  }, [logs, selectedDate]);

  const selectedProduct = selectedLog
    ? products.find((p) => p.id === selectedLog.productId || p.name === selectedLog.productName)
    : undefined;

  const handlePrevDay = () => {
    setSelectedDate((curr) => shiftDate(curr, -1));
    setIsDayFilterEnabled(true);
  };

  const handleNextDay = () => {
    setSelectedDate((curr) => shiftDate(curr, 1));
    setIsDayFilterEnabled(true);
  };

  const handleJumpToToday = () => {
    setSelectedDate(todayKey);
    setIsDayFilterEnabled(true);
  };

  const handleJumpToLatestActive = () => {
    if (logs.length > 0) {
      const latest = toDateKey(logs[0]?.timestamp);
      if (latest) {
        setSelectedDate(latest);
        setIsDayFilterEnabled(true);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Inventory Audit & Activity Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Complete day-by-day traceability of all stock adjustments, additions, and master catalog changes.
          </p>
        </div>
      </div>

      {/* Pending Approval Alert Banner: Staff Requested Deposit Percentage Change */}
      {pendingAuditNotificationsCount > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border-2 border-amber-400 text-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center text-sm font-black shrink-0 animate-pulse shadow-xs">
              {pendingAuditNotificationsCount}
            </span>
            <div>
              <div className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <span>Action Requires Admin Approval</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider">
                  {pendingAuditNotificationsCount} Pending
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Staff member requested changing the upfront deposit percentage on a client order. Review and approve or decline in Bookings.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={async () => {
                const perm = getNotificationPermissionState();
                if (perm !== 'granted') {
                  const res = await requestNotificationPermission();
                  if (res === 'granted') {
                    await sendTestNotification();
                  }
                } else {
                  await sendTestNotification();
                }
              }}
              className="flex-1 sm:flex-none px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Test notification alert on your phone"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Test Phone Alert</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const pendingBooking = bookings.find((b) => Boolean(b.pendingDepositPercentage));
                if (pendingBooking && onViewBooking) {
                  onViewBooking(pendingBooking.bookingNumber || pendingBooking.id);
                }
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors text-center cursor-pointer"
            >
              Review in Bookings &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Day-by-Day Date Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Day-by-Day Navigator Controls */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full lg:w-auto">
            <button
              onClick={handlePrevDay}
              className="p-2.5 sm:px-3 sm:py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Prev Day</span>
            </button>

            {/* Interactive Date Picker & Formatted Day Label */}
            <div className="relative flex-1 sm:flex-none flex items-center justify-center sm:justify-start bg-amber-50/70 border border-amber-200/90 rounded-xl px-3 py-1.5 gap-2 shadow-xs hover:border-amber-400 transition-colors">
              <Calendar className="w-4 h-4 text-amber-700 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 truncate">
                  {formatFriendlyDate(selectedDate)}
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setIsDayFilterEnabled(true);
                    }
                  }}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleNextDay}
              className="p-2.5 sm:px-3 sm:py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0"
              title="Next Day"
            >
              <span className="hidden sm:inline">Next Day</span>
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Right: Mode Switch (Today vs All Dates) */}
          <div className="grid grid-cols-2 sm:flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto border border-slate-200">
            <button
              type="button"
              onClick={handleJumpToToday}
              className={`px-3 py-2 sm:py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                isDayFilterEnabled && selectedDate === todayKey
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Today</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDayFilterEnabled(false)}
              className={`px-3 py-2 sm:py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center ${
                !isDayFilterEnabled
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All Dates ({logs.length})</span>
            </button>
          </div>
        </div>

        {/* Informative Sub-bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 font-medium">
            {isDayFilterEnabled ? (
              <>
                <span>
                  Showing{' '}
                  <strong className="text-slate-900 font-bold">{countForSelectedDate}</strong>{' '}
                  {countForSelectedDate === 1 ? 'activity' : 'activities'} on{' '}
                  <strong className="text-slate-900 font-bold">{formatFriendlyDate(selectedDate)}</strong>
                </span>
                {datesWithActivity.has(selectedDate) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Activity Recorded
                  </span>
                )}
              </>
            ) : (
              <span>
                Showing complete audit history across all dates (
                <strong className="text-slate-900 font-bold">{logs.length}</strong> total events)
              </span>
            )}
          </div>

          {/* Quick jump to latest if current date has 0 records */}
          {isDayFilterEnabled && countForSelectedDate === 0 && logs.length > 0 && (
            <button
              onClick={handleJumpToLatestActive}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Jump to most recent active date ({formatFriendlyDate(toDateKey(logs[0]?.timestamp))})
            </button>
          )}
        </div>
      </div>

      {/* Action Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
            filter === 'all'
              ? 'bg-amber-500 text-slate-950 font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Types ({filteredLogs.length})
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
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto my-6 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3 text-amber-700">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-900">
            {isDayFilterEnabled
              ? `No activities on ${formatFriendlyDate(selectedDate)}`
              : 'No activities found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {isDayFilterEnabled
              ? `There were no stock changes or events recorded on this date under "${filter === 'all' ? 'All Types' : filter}".`
              : 'Actions performed across the warehouse will appear here automatically.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {isDayFilterEnabled && (
              <button
                onClick={() => setIsDayFilterEnabled(false)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs"
              >
                View All Dates ({logs.length} total)
              </button>
            )}
            {selectedDate !== todayKey && (
              <button
                onClick={handleJumpToToday}
                className="px-3.5 py-1.5 bg-amber-500 text-slate-950 font-black rounded-xl text-xs hover:bg-amber-400 transition-colors shadow-xs"
              >
                Jump to Today
              </button>
            )}
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                Reset Type Filter
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm">
            {paginatedLogs.map((log) => {
              const isAdmin = log.actorRole === 'admin';
              const matchedProduct = products.find(
                (p) => p.id === log.productId || p.name === log.productName
              );
              const itemImage = log.productImage || matchedProduct?.image || matchedProduct?.images?.[0];

              const isOrder =
                Boolean(log.bookingNumber) ||
                Boolean(log.bookingId) ||
                log.action?.includes('booking') ||
                /booking|order|sps-/i.test(`${log.summary || ''} ${log.details || ''}`);

              const isAccount =
                log.action === 'account_deleted' ||
                log.action === 'account_updated' ||
                /role|permission|user|account|worker to admin|admin to worker/i.test(
                  `${log.summary || ''} ${log.details || ''}`
                );

              const hasProductImage = !isOrder && !isAccount && Boolean(itemImage);
              const hasStockDiff =
                !isOrder &&
                !isAccount &&
                log.oldQuantity !== undefined &&
                log.oldQuantity !== null &&
                log.newQuantity !== undefined &&
                log.newQuantity !== null;
              const diffDelta =
                log.delta !== undefined && log.delta !== null
                  ? log.delta
                  : hasStockDiff
                  ? Number(log.newQuantity) - Number(log.oldQuantity)
                  : undefined;
              const formattedSize =
                !log.variantSize || log.variantSize === 'One Size' || log.variantSize === 'Standard' || log.variantSize === 'Standard Size'
                  ? 'Standard Size'
                  : log.variantSize === 'Multiple Sizes'
                  ? 'Multiple Sizes'
                  : `Size ${log.variantSize}`;
              const friendlyReason = formatAuditLogReason(log);

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="p-3.5 sm:p-5 flex items-start gap-3 sm:gap-4 hover:bg-amber-50/40 active:bg-amber-50/60 cursor-pointer transition-all group"
                  title="Click to view detailed breakdown"
                >
                  {/* Product thumbnail or specialized action icon */}
                  {isOrder ? (
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 shrink-0 shadow-xs flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform">
                      <ShoppingBag className="w-5 h-5 text-blue-600" />
                    </div>
                  ) : isAccount ? (
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shrink-0 shadow-xs flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform">
                      <UserCheck className="w-5 h-5 text-purple-600" />
                    </div>
                  ) : hasProductImage ? (
                    <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-xs flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform">
                      <img
                        src={itemImage}
                        alt={log.productName || 'Item'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl shrink-0 flex items-center justify-center mt-0.5 ${
                        isAdmin
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-sky-50 text-sky-800 border border-sky-200'
                      }`}
                    >
                      {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-amber-800 transition-colors leading-snug">
                        {log.summary}
                      </h4>
                      <span className="text-[10px] sm:text-[11px] font-mono font-medium text-slate-400 shrink-0">
                        {new Date(log.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Visual Stock Diff Pills when numeric quantities are recorded */}
                    {hasStockDiff && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {log.variantSize && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] sm:text-[11px] font-bold text-slate-800">
                            <span>{formattedSize}</span>
                            {log.variantColor && log.variantColor !== 'Standard' && (
                              <span className="text-slate-500 font-medium">· {log.variantColor}</span>
                            )}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-mono shadow-2xs">
                          <span className="text-slate-400 line-through font-bold">{log.oldQuantity}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-900 font-black">{log.newQuantity}</span>
                          <span className="text-slate-500 font-sans text-[10px]">units</span>
                        </span>

                        {diffDelta !== undefined && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-mono font-black ${
                              diffDelta > 0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : diffDelta < 0
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {diffDelta > 0 ? `+${diffDelta} Added` : diffDelta < 0 ? `${diffDelta} Removed` : '0 Change'}
                          </span>
                        )}

                        {log.totalQuantityAfter !== undefined && log.totalQuantityAfter !== null && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] sm:text-[11px] font-mono font-bold text-amber-900">
                            Total: {log.totalQuantityAfter} units
                            {log.totalQuantityBefore !== undefined && log.totalQuantityBefore !== null
                              ? ` (from ${log.totalQuantityBefore})`
                              : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {log.details && (
                      <p className="text-xs text-slate-600 font-medium line-clamp-2 leading-relaxed">
                        {log.details}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-bold text-slate-700">{log.actorName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold text-[10px] capitalize">
                          {log.actorRole === 'admin' ? 'Admin' : 'Staff'}
                        </span>
                        {friendlyReason && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-800 font-semibold truncate max-w-[180px] sm:max-w-xs">
                              {friendlyReason}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 opacity-90 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 ml-auto">
                        <Eye className="w-3.5 h-3.5 text-amber-600" />
                        <span>View Breakdown</span>
                        <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls (10 logs per page) */}
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
              Showing{' '}
              <strong className="text-slate-900 font-bold">
                {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredLogs.length)}
              </strong>{' '}
              of <strong className="text-slate-900 font-bold">{filteredLogs.length}</strong> logs{' '}
              <span className="text-slate-400">({ITEMS_PER_PAGE} per page)</span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-slate-700 flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                  .filter((pageNum) => {
                    if (totalPages <= 7) return true;
                    return (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      Math.abs(pageNum - safeCurrentPage) <= 1
                    );
                  })
                  .map((pageNum, idx, arr) => {
                    const prevPage = arr[idx - 1];
                    const showEllipsis = prevPage && pageNum - prevPage > 1;
                    return (
                      <React.Fragment key={pageNum}>
                        {showEllipsis && (
                          <span className="px-1.5 text-xs text-slate-400 font-bold">…</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-w-[34px] h-8 px-2.5 rounded-xl text-xs font-mono font-bold transition-all ${
                            safeCurrentPage === pageNum
                              ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-2 ring-amber-400/40'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-slate-700 flex items-center gap-1 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Activity Modal */}
      {selectedLog && (
        <ActivityDetailModal
          log={selectedLog}
          product={selectedProduct}
          bookings={bookings}
          onClose={() => setSelectedLog(null)}
          onViewProduct={onViewProduct}
          onViewBooking={onViewBooking}
        />
      )}
    </div>
  );
};
