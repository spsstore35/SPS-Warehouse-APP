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
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

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

  // Active booking for details modal (keeps updated if status changes)
  const activeBooking = bookings.find((b) => b.id === selectedBookingId) || null;

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
      </div>

      {/* Bookings List Cards matching exact screenshot layout with Arrow */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 text-center shadow-xs">
          <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No client bookings found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {searchQuery
              ? 'No bookings match your current search query.'
              : 'There are no client bookings in this status yet. Click "+ New Client Booking" to create one.'}
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
        <div className="space-y-3">
          {filteredBookings.map((b) => {
            const totalUnits = b.items.reduce((acc, it) => acc + it.quantity, 0);

            return (
              <div
                key={b.id}
                onClick={() => setSelectedBookingId(b.id)}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 shadow-xs hover:shadow-md transition-all cursor-pointer p-4 sm:p-5 group"
              >
                {/* Header Row matching user's exact screenshot image_3ad9d3df.png */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Ref Pill, Client Name, Phone, Creator */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span className="font-mono font-black text-xs sm:text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white shadow-xs shrink-0 tracking-wide">
                      {b.bookingNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                          {b.clientName}
                        </h3>
                        {b.clientPhone && b.clientPhone !== 'N/A' && (
                          <span
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-semibold text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/60"
                          >
                            <Phone className="w-3 h-3 text-blue-500" />
                            <a href={`tel:${b.clientPhone}`} className="hover:underline">
                              {b.clientPhone}
                            </a>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Created {new Date(b.createdAt).toLocaleDateString()} by{' '}
                        <strong className="text-slate-700">{b.createdByName}</strong> ({b.createdByRole})
                      </div>
                    </div>
                  </div>

                  {/* Right: Badges, Amount & Right Arrow */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${
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
                            ? 'AWAITING 50% DEPOSIT'
                            : b.status === 'preparing'
                            ? 'IN PREPARATION'
                            : b.status === 'delivered'
                            ? 'DELIVERED'
                            : 'COMPLETED'}
                        </span>
                      </span>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          b.depositPaid
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {b.depositPaid ? '50% Deposit Paid' : 'Deposit Unpaid'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <div className="font-mono font-black text-sm text-slate-900">
                          {b.total.toFixed(2)} EGP
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {b.items.length} items • {totalUnits} pcs
                        </div>
                      </div>

                      {/* Prominent Arrow Button */}
                      <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-blue-600 text-slate-600 group-hover:text-white flex items-center justify-center transition-all shadow-2xs group-hover:translate-x-0.5">
                        <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DEDICATED FULL DETAILS MODAL WITH LARGE CLEAR TYPOGRAPHY */}
      {activeBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto"
          onClick={() => setSelectedBookingId(null)}
        >
          <div
            className="w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-4 sm:my-8 animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-sm sm:text-base px-3 py-1 rounded-lg bg-white/10 text-amber-300 border border-white/15">
                  {activeBooking.bookingNumber}
                </span>
                <div>
                  <h2 className="text-base sm:text-xl font-black">{activeBooking.clientName}</h2>
                  <div className="text-xs text-slate-300">
                    Created {new Date(activeBooking.createdAt).toLocaleDateString()} by {activeBooking.createdByName}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable with Large, High-Contrast Typography */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Status and Milestones Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs uppercase tracking-wider font-bold text-slate-500">
                    Current Order Status
                  </div>
                  <div className="text-base font-black text-slate-900 mt-0.5 flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                        activeBooking.status === 'pending'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : activeBooking.status === 'preparing'
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : activeBooking.status === 'delivered'
                          ? 'bg-purple-100 text-purple-900 border-purple-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      {activeBooking.status === 'pending'
                        ? 'Awaiting 50% Deposit'
                        : activeBooking.status === 'preparing'
                        ? 'In Preparation (Stock Deducted)'
                        : activeBooking.status === 'delivered'
                        ? 'Delivered (Awaiting Final 50%)'
                        : 'Order Completed'}
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        activeBooking.depositPaid
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      {activeBooking.depositPaid ? '✓ 50% Paid' : 'Pending Payment'}
                    </span>
                  </div>
                </div>

                {activeBooking.clientPhone && activeBooking.clientPhone !== 'N/A' && (
                  <a
                    href={`tel:${activeBooking.clientPhone}`}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call {activeBooking.clientPhone}</span>
                  </a>
                )}
              </div>

              {/* Action Buttons: Print Documents & Advance Workflow */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenPrintModal(activeBooking, 'quotation')}
                  className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span>Quotation PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPrintModal(activeBooking, 'production')}
                  className="p-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                >
                  <Factory className="w-4 h-4" />
                  <span>Workshop Sheet</span>
                </button>

                {activeBooking.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => onAdvanceStatus(activeBooking.id, 'preparing')}
                    className="col-span-2 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm 50% Deposit & Reserve Stock</span>
                  </button>
                )}

                {activeBooking.status === 'preparing' && (
                  <button
                    type="button"
                    onClick={() => onAdvanceStatus(activeBooking.id, 'delivered')}
                    className="col-span-2 p-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                  >
                    <Package className="w-4 h-4" />
                    <span>Mark Order as Delivered</span>
                  </button>
                )}

                {activeBooking.status === 'delivered' && (
                  <button
                    type="button"
                    onClick={() => onAdvanceStatus(activeBooking.id, 'done')}
                    className="col-span-2 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Receive Final 50% & Complete</span>
                  </button>
                )}
              </div>

              {/* Order Items List with Large Legible Font */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-base font-black text-slate-900">
                    Ordered Apparel Items ({activeBooking.items.length})
                  </h4>
                  <span className="text-xs text-slate-500 font-mono font-bold">
                    Total: {activeBooking.items.reduce((s, it) => s + it.quantity, 0)} units
                  </span>
                </div>

                <div className="space-y-3">
                  {activeBooking.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="text-base font-black text-slate-900">{it.productName}</div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600">
                          <span className="font-mono text-amber-800 font-bold">{it.productSku}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1.5 font-bold">
                            <span
                              className="w-3 h-3 rounded-full border border-slate-300 inline-block"
                              style={{ backgroundColor: it.colorHex }}
                            />
                            <span>{it.colorName}</span>
                          </span>
                          <span>•</span>
                          <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            Size: {it.size}
                          </span>
                        </div>
                      </div>

                      <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
                        <div className="text-base font-black font-mono text-slate-900">
                          {it.quantity} pcs @ {it.unitPrice.toFixed(2)} EGP
                        </div>
                        <div className="text-xs font-mono font-bold text-blue-900 mt-0.5">
                          Line Total: {it.totalPrice.toFixed(2)} EGP
                        </div>
                        {it.deficitQuantity > 0 ? (
                          <div className="text-xs text-rose-600 font-bold mt-1">
                            Deficit: {it.deficitQuantity} to manufacture
                          </div>
                        ) : (
                          <div className="text-xs text-emerald-700 font-semibold mt-1">
                            Stock in warehouse
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {activeBooking.subtotal.toFixed(2)} EGP
                  </span>
                </div>

                {activeBooking.discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Discount:</span>
                    <span className="font-mono">-{activeBooking.discount.toFixed(2)} EGP</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-between text-lg font-black text-slate-900">
                  <span>Total Order Value:</span>
                  <span className="font-mono text-blue-900">{activeBooking.total.toFixed(2)} EGP</span>
                </div>

                <div className="pt-3 border-t border-dashed border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="text-xs font-bold text-amber-800">50% Advance Deposit Required</div>
                    <div className="text-base font-black font-mono text-amber-950 mt-0.5">
                      {activeBooking.depositRequired.toFixed(2)} EGP
                    </div>
                    <div className="text-[11px] font-bold text-amber-700 mt-1">
                      Status: {activeBooking.depositPaid ? 'RECEIVED & CONFIRMED' : 'PENDING 50% PAYMENT'}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-700">50% Balance (Due on Handover)</div>
                    <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                      {(activeBooking.total - activeBooking.depositRequired).toFixed(2)} EGP
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Payable on physical receipt</div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {activeBooking.notes && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950">
                  <strong className="text-amber-900">Booking Notes: </strong>
                  <span>{activeBooking.notes}</span>
                </div>
              )}

              {/* Delete Booking Option */}
              {(isAdmin || activeBooking.createdById === currentUser.id) && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete booking ${activeBooking.bookingNumber}?`)) {
                        onDeleteBooking(activeBooking.id);
                        setSelectedBookingId(null);
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Booking Record</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
