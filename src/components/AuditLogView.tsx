import React, { useState, useMemo } from 'react';
import { AuditLogEntry, Product, Booking } from '../types/inventory';
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
} from 'lucide-react';
import { ActivityDetailModal } from './ActivityDetailModal';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  sendTestNotification,
} from '../services/notificationService';

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
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Day-by-Day Navigator Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrevDay}
              className="p-2 sm:px-3 sm:py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Prev Day</span>
            </button>

            {/* Interactive Date Picker & Formatted Day Label */}
            <div className="relative flex items-center bg-amber-50/70 border border-amber-200/90 rounded-xl px-3 py-1.5 gap-2.5 shadow-xs hover:border-amber-400 transition-colors">
              <Calendar className="w-4 h-4 text-amber-700 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
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
              className="p-2 sm:px-3 sm:py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
              title="Next Day"
            >
              <span className="hidden sm:inline">Next Day</span>
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>

            {/* Quick jump to Today */}
            <button
              onClick={handleJumpToToday}
              className={`px-3 py-2 border rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 ${
                selectedDate === todayKey && isDayFilterEnabled
                  ? 'bg-amber-500 border-amber-600 text-slate-950 font-black'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Today
            </button>
          </div>

          {/* Right: Mode Switch (Day View vs All Dates) */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <button
              onClick={() => setIsDayFilterEnabled(false)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                !isDayFilterEnabled
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              All Dates ({logs.length})
            </button>
            <button
              onClick={() => setIsDayFilterEnabled(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                isDayFilterEnabled
                  ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>By Date</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/10 font-bold">
                {countForSelectedDate}
              </span>
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
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm">
          {filteredLogs.map((log) => {
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

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="p-4 sm:p-5 flex items-start gap-3.5 hover:bg-amber-50/40 cursor-pointer transition-all group"
                title="Click to view detailed breakdown"
              >
                {/* Product thumbnail or specialized action icon */}
                {isOrder ? (
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 shrink-0 shadow-xs flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                  </div>
                ) : isAccount ? (
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shrink-0 shadow-xs flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform">
                    <UserCheck className="w-5 h-5 text-purple-600" />
                  </div>
                ) : hasProductImage ? (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-xs flex items-center justify-center mt-0.5 group-hover:scale-105 transition-transform">
                    <img
                      src={itemImage}
                      alt={log.productName || 'Garment'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center mt-0.5 ${
                      isAdmin
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-sky-50 text-sky-800 border border-sky-200'
                    }`}
                  >
                    {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
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
          bookings={bookings}
          onClose={() => setSelectedLog(null)}
          onViewProduct={onViewProduct}
          onViewBooking={onViewBooking}
        />
      )}
    </div>
  );
};
