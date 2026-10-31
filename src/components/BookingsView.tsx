import React, { useState } from 'react';
import { Booking, BookingStatus, User } from '../types/inventory';
import {
  CalendarCheck,
  Plus,
  Search,
  Filter,
  FileText,
  Factory,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  DollarSign,
  Package,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check,
  Trash2,
  X,
  Printer,
} from 'lucide-react';

interface BookingsViewProps {
  bookings: Booking[];
  currentUser: User;
  onOpenNewBookingModal: () => void;
  onOpenPrintModal: (booking: Booking, docType: 'quotation' | 'production') => void;
  onAdvanceStatus: (bookingId: string, nextStatus: BookingStatus) => void;
  onDeleteBooking: (bookingId: string) => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  bookings,
  currentUser,
  onOpenNewBookingModal,
  onOpenPrintModal,
  onAdvanceStatus,
  onDeleteBooking,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');

  // Filter bookings
  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      b.clientName.toLowerCase().includes(q) ||
      b.bookingNumber.toLowerCase().includes(q) ||
      b.clientPhone.toLowerCase().includes(q) ||
      b.items.some((it) => it.productName.toLowerCase().includes(q) || it.productSku.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Count by status
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const preparingCount = bookings.filter((b) => b.status === 'preparing').length;
  const deliveredCount = bookings.filter((b) => b.status === 'delivered').length;
  const doneCount = bookings.filter((b) => b.status === 'done').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
              Client Bookings & Quotations
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Bulk orders, 50% deposit policy workflows & workshop sheets
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenNewBookingModal}
          className="w-full sm:w-auto px-5 py-3 sm:py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ New Client Booking</span>
        </button>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs space-y-3">
        {/* Horizontal Scrollable Status Tabs on Mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none -mx-1 px-1">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Orders ({bookings.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Pending Deposit ({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('preparing')}
            className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'preparing'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-900 hover:bg-blue-100'
            }`}
          >
            <Factory className="w-3.5 h-3.5 shrink-0" />
            <span>In Preparation ({preparingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('delivered')}
            className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'delivered'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-900 hover:bg-purple-100'
            }`}
          >
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span>Delivered ({deliveredCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('done')}
            className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'done'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Completed ({doneCount})</span>
          </button>
        </div>

        {/* Search Bar with Instant Clear */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name, booking #, or item name..."
            className="w-full pl-10 pr-9 py-2.5 sm:py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-900 shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 50% Policy Explanatory Note */}
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs">
              <strong>Deposit Rule:</strong> Stock is reserved and deducted <em>only</em> when status advances from <strong>Pending</strong> to <strong>Preparing</strong> upon receiving the 50% deposit.
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-800 font-bold shrink-0">
            {filteredBookings.length} order{filteredBookings.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Bookings List Cards */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 text-center shadow-xs">
          <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No client bookings found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {searchQuery
              ? 'No bookings match your current search query.'
              : 'There are no client bookings in this status yet. Click "+ New Client Booking" or click "Booking" on any item card to create one.'}
          </p>
          <button
            type="button"
            onClick={onOpenNewBookingModal}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            Create First Booking
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((b) => {
            const totalUnits = b.items.reduce((acc, it) => acc + it.quantity, 0);
            const totalDeficit = b.items.reduce((acc, it) => acc + it.deficitQuantity, 0);

            return (
              <div
                key={b.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md transition-all overflow-hidden"
              >
                {/* Header Row: Info & Badges */}
                <div className="p-3.5 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="font-mono font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg bg-slate-900 text-white shadow-xs shrink-0">
                      {b.bookingNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 flex flex-wrap items-center gap-2">
                        <span>{b.clientName}</span>
                        {b.clientPhone && b.clientPhone !== 'N/A' && (
                          <a
                            href={`tel:${b.clientPhone}`}
                            className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/60"
                          >
                            <Phone className="w-3 h-3 text-blue-500" />
                            <span>{b.clientPhone}</span>
                          </a>
                        )}
                      </h3>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Created {new Date(b.createdAt).toLocaleDateString()} by{' '}
                        <strong className="text-slate-700">{b.createdByName}</strong> ({b.createdByRole})
                      </div>
                    </div>
                  </div>

                  {/* Badges on Top Right */}
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                        b.status === 'pending'
                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                          : b.status === 'preparing'
                          ? 'bg-blue-50 text-blue-900 border-blue-300'
                          : b.status === 'delivered'
                          ? 'bg-purple-50 text-purple-900 border-purple-300'
                          : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      {b.status === 'pending' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                      {b.status === 'preparing' && <Factory className="w-3.5 h-3.5 text-blue-600" />}
                      {b.status === 'delivered' && <Package className="w-3.5 h-3.5 text-purple-600" />}
                      {b.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>
                        {b.status === 'pending'
                          ? 'Awaiting 50% Deposit'
                          : b.status === 'preparing'
                          ? 'In Preparation (Stock Deducted)'
                          : b.status === 'delivered'
                          ? 'Delivered (Awaiting Final 50%)'
                          : 'Completed & Fully Paid'}
                      </span>
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold border ${
                        b.depositPaid
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {b.depositPaid ? '50% Deposit Paid' : 'Deposit Unpaid'}
                    </span>
                  </div>
                </div>

                {/* Card Body: Items breakdown and Financials */}
                <div className="p-3.5 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5">
                  {/* Left: Garments Breakdown */}
                  <div className="md:col-span-7 space-y-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>Order Items ({b.items.length} items, {totalUnits} total units)</span>
                      {totalDeficit > 0 && (
                        <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">
                          {totalDeficit} units to workshop
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {b.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 truncate">{it.productName}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="font-mono text-amber-700 font-bold">{it.productSku}</span>
                              <span>•</span>
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-slate-300 inline-block shrink-0"
                                style={{ backgroundColor: it.colorHex }}
                              />
                              <span>{it.colorName}</span>
                              <span>•</span>
                              <span className="font-mono font-bold text-slate-800 bg-white px-1.5 rounded border border-slate-200">
                                Size {it.size}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-slate-900">
                              {it.quantity} pcs @ {it.unitPrice.toFixed(2)} EGP
                            </div>
                            <div className="text-[10px] font-mono mt-0.5">
                              {it.deficitQuantity > 0 ? (
                                <span className="text-rose-700 font-bold">
                                  Deficit: {it.deficitQuantity} to make
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold">Stock reserved</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {b.notes && (
                      <div className="text-xs text-slate-600 bg-amber-50/60 border border-amber-200/70 rounded-xl p-2.5">
                        <strong className="text-amber-900">Notes: </strong>
                        <span>{b.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Financial & Payment Status */}
                  <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-mono font-bold text-slate-800">{b.subtotal.toFixed(2)} EGP</span>
                      </div>

                      {b.discount > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Discount:</span>
                          <span className="font-mono font-bold">-{b.discount.toFixed(2)} EGP</span>
                        </div>
                      )}

                      <div className="pt-1.5 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                        <span>Total Order Price:</span>
                        <span className="font-mono text-blue-900 font-black">{b.total.toFixed(2)} EGP</span>
                      </div>

                      <div className="pt-2 border-t border-dashed border-slate-300 space-y-1">
                        <div className="flex justify-between font-bold text-amber-950 text-xs">
                          <span>50% Required Advance:</span>
                          <span className="font-mono text-amber-900 font-black">
                            {b.depositRequired.toFixed(2)} EGP
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>50% Due on Handover:</span>
                          <span className="font-mono">
                            {(b.total - b.depositRequired).toFixed(2)} EGP
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stock Deduction Status Alert */}
                    <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                      {b.inventoryDeducted ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                          <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                          <span>Warehouse stock deducted & reserved</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-800 font-semibold">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>Pending deposit: Warehouse stock untouched</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer: Responsive Mobile & Desktop Layout */}
                <div className="p-3 sm:p-4 bg-slate-100/80 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Document Print Buttons */}
                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenPrintModal(b, 'quotation')}
                      className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span>Quotation PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenPrintModal(b, 'production')}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Factory className="w-3.5 h-3.5 shrink-0" />
                      <span>Workshop Sheet</span>
                    </button>
                  </div>

                  {/* Lifecycle Transitions & Delete */}
                  <div className="flex items-center gap-2">
                    {/* Advance to Preparing */}
                    {b.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => onAdvanceStatus(b.id, 'preparing')}
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                        title="Confirms 50% deposit received and deducts stock"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                        <span>Confirm 50% Deposit & Prepare Stock</span>
                      </button>
                    )}

                    {/* Advance to Delivered */}
                    {b.status === 'preparing' && (
                      <button
                        type="button"
                        onClick={() => onAdvanceStatus(b.id, 'delivered')}
                        className="flex-1 sm:flex-none px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                        title="Mark order as ready and delivered to client"
                      >
                        <Package className="w-3.5 h-3.5 shrink-0" />
                        <span>Mark Order as Delivered</span>
                      </button>
                    )}

                    {/* Advance to Done */}
                    {b.status === 'delivered' && (
                      <button
                        type="button"
                        onClick={() => onAdvanceStatus(b.id, 'done')}
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                        title="Receive remaining 50% payment and complete booking"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                        <span>Receive Final 50% & Complete</span>
                      </button>
                    )}

                    {/* Cancel / Delete booking */}
                    {(isAdmin || b.createdById === currentUser.id) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove booking ${b.bookingNumber}?`)) {
                            onDeleteBooking(b.id);
                          }
                        }}
                        className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors shrink-0"
                        title="Delete booking"
                        aria-label="Delete booking"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
