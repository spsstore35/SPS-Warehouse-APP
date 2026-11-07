import React, { useState, useEffect } from 'react';
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
  MessageCircle,
} from 'lucide-react';

interface BookingsViewProps {
  bookings: Booking[];
  currentUser: User;
  onOpenNewBookingModal: () => void;
  onOpenPrintModal: (booking: Booking, docType: 'quotation' | 'production') => void;
  onAdvanceStatus: (bookingId: string, nextStatus: BookingStatus) => void;
  onDeleteBooking: (bookingId: string) => void;
  onUpdateBooking?: (booking: Booking) => void;
  onLogActivity?: (log: any) => void;
  onShowToast?: (message: string, log?: any) => void;
  initialSelectedBookingId?: string | null;
  onClearSelectedBookingId?: () => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  bookings,
  currentUser,
  onOpenNewBookingModal,
  onOpenPrintModal,
  onAdvanceStatus,
  onDeleteBooking,
  onUpdateBooking,
  onLogActivity,
  onShowToast,
  initialSelectedBookingId,
  onClearSelectedBookingId,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(initialSelectedBookingId || null);

  useEffect(() => {
    if (initialSelectedBookingId) {
      setSelectedBookingId(initialSelectedBookingId);
    }
  }, [initialSelectedBookingId]);
  const [waLanguage, setWaLanguage] = useState<'en' | 'ar'>('en');
  const [pendingPctChange, setPendingPctChange] = useState<number | null>(null);
  const [showConfirmDepositModal, setShowConfirmDepositModal] = useState<boolean>(false);

  // Helper to format clean WhatsApp URL with localized message & quotation details
  const formatPhoneForWhatsApp = (rawPhone: string): string => {
    let digits = rawPhone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0020')) {
      digits = digits.slice(2);
    } else if (digits.startsWith('20')) {
      // standard international format
    } else if (digits.startsWith('01')) {
      // Egyptian mobile with leading 0
      digits = '20' + digits.slice(1);
    } else if (digits.length === 10 && digits.startsWith('1')) {
      digits = '20' + digits;
    }
    return digits;
  };

  const getWhatsAppUrl = (
    phone: string,
    clientName: string,
    lang: 'en' | 'ar',
    booking?: Booking | null
  ) => {
    const cleanPhone = formatPhoneForWhatsApp(phone);
    if (!cleanPhone) return '#';

    let itemsSummary = '';
    if (booking && booking.items && booking.items.length > 0) {
      itemsSummary = booking.items
        .map(
          (it, idx) =>
            `${idx + 1}. ${it.productName} (${it.size} / ${it.colorName}) - ${it.quantity} pcs @ ${it.unitPrice.toFixed(0)} EGP = ${it.totalPrice.toFixed(0)} EGP`
        )
        .join('\n');
    }

    const depositPct = booking
      ? (booking.depositPercentage ?? (booking.depositRate ? Math.round(booking.depositRate * 100) : 50))
      : 50;
    const depositAmount = booking
      ? Math.round((booking.total * depositPct) / 100)
      : 0;
    const remainingAmount = booking
      ? Math.max(0, booking.total - depositAmount)
      : 0;

    const textEn = `Hello ${clientName}, this is SPS Warehouse Store (Saint Paul Scouts).
We have prepared your official Quotation for Order #${booking?.bookingNumber || ''}:

📋 ORDER SPECIFICATIONS:
${itemsSummary || 'Standard apparel booking.'}

💰 Total Order Value: ${booking?.total.toFixed(2) || '0.00'} EGP
💵 Advance Deposit (${depositPct}%): ${depositAmount.toFixed(2)} EGP
📦 Remaining Balance on Delivery: ${remainingAmount.toFixed(2)} EGP

We are sending you the formal 1-page Quotation PDF attached. This is our official store number to stay in touch until your order is delivered.`;

    const textAr = `أهلاً ${clientName}، ده رقم ستور كشافة القديس بولس الكشفية.
تم تجهيز عرض الأسعار الرسمي (Quotation) لطلبك #${booking?.bookingNumber || ''}:

📋 تفاصيل الأصناف والكميات:
${itemsSummary || 'طلب ملابس كشفية.'}

💰 إجمالي الطلب: ${booking?.total.toFixed(2) || '0.00'} جنيه
💵 المقدم المطلوب (${depositPct}%): ${depositAmount.toFixed(2)} جنيه
📦 المتبقي عند الاستلام: ${remainingAmount.toFixed(2)} جنيه

مرفق مع حضرتك ملف الـ (Quotation PDF) الرسمي للتأكيد، وده الرقم الرسمي للتواصل ومتابعة طلبك حتى الاستلام.`;

    const message = lang === 'ar' ? textAr : textEn;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

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
  const activeDepositPct = activeBooking
    ? (activeBooking.depositPercentage ?? (activeBooking.depositRate ? Math.round(activeBooking.depositRate * 100) : 50))
    : 50;
  const activeRemainingPct = Math.max(0, 100 - activeDepositPct);

  // Count by status
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const preparingCount = bookings.filter((b) => b.status === 'preparing').length;
  const deliveredCount = bookings.filter((b) => b.status === 'delivered').length;
  const doneCount = bookings.filter((b) => b.status === 'done').length;

  const handleUpdateDepositPct = (pct: number) => {
    if (!activeBooking) return;
    if (isAdmin) {
      // Immediate update for Admin
      const depositRequired = Math.round((activeBooking.total * pct) / 100);
      const updated: Booking = {
        ...activeBooking,
        depositPercentage: pct,
        depositRate: pct / 100,
        depositRequired,
        pendingDepositPercentage: undefined,
        pendingDepositPercentageBy: undefined,
        pendingDepositPercentageAt: undefined,
        updatedAt: new Date().toISOString(),
      };
      if (onUpdateBooking) {
        onUpdateBooking(updated);
      }
      const adminLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'booking_updated',
        actorName: currentUser.name || 'Admin',
        actorRole: 'admin',
        bookingId: activeBooking.id,
        bookingNumber: activeBooking.bookingNumber,
        bookingItems: activeBooking.items,
        reason: `Deposit Terms Updated - Order #${activeBooking.bookingNumber}`,
        summary: `Admin updated upfront deposit terms to ${pct}% for Order #${activeBooking.bookingNumber}`,
        details: `Updated required deposit to ${pct}% (${depositRequired} EGP) for "${activeBooking.clientName}".`,
      };
      if (onLogActivity) onLogActivity(adminLog);
      if (onShowToast) onShowToast(`Deposit terms updated to ${pct}% for Order #${activeBooking.bookingNumber}.`, adminLog);
    } else {
      // Staff request submitted for admin approval
      const updated: Booking = {
        ...activeBooking,
        pendingDepositPercentage: pct,
        pendingDepositPercentageBy: currentUser.name || 'Floor Staff',
        pendingDepositPercentageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (onUpdateBooking) {
        onUpdateBooking(updated);
      }
      const staffReqLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'booking_updated',
        actorName: currentUser.name || 'Floor Staff',
        actorRole: currentUser.role,
        bookingId: activeBooking.id,
        bookingNumber: activeBooking.bookingNumber,
        bookingItems: activeBooking.items,
        reason: `Staff Request: Change Deposit - Order #${activeBooking.bookingNumber}`,
        summary: `Staff (${currentUser.name}) requested changing deposit terms to ${pct}% for Order #${activeBooking.bookingNumber}`,
        details: `Order #${activeBooking.bookingNumber} (${activeBooking.clientName}): Staff requested changing upfront deposit from ${activeDepositPct}% to ${pct}% (${Math.round((activeBooking.total * pct) / 100)} EGP). Awaiting Admin Approval.`,
      };
      if (onLogActivity) onLogActivity(staffReqLog);
      if (onShowToast) onShowToast(`Staff deposit change request submitted for Order #${activeBooking.bookingNumber}. Awaiting Admin Approval.`, staffReqLog);
    }
  };

  const handleApprovePendingDepositPct = () => {
    if (!activeBooking || !activeBooking.pendingDepositPercentage || !isAdmin) return;
    const pct = activeBooking.pendingDepositPercentage;
    const depositRequired = Math.round((activeBooking.total * pct) / 100);
    const updated: Booking = {
      ...activeBooking,
      depositPercentage: pct,
      depositRate: pct / 100,
      depositRequired,
      pendingDepositPercentage: undefined,
      pendingDepositPercentageBy: undefined,
      pendingDepositPercentageAt: undefined,
      updatedAt: new Date().toISOString(),
    };
    if (onUpdateBooking) {
      onUpdateBooking(updated);
    }
    const approveLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'booking_updated',
      actorName: currentUser.name || 'Admin',
      actorRole: 'admin',
      bookingId: activeBooking.id,
      bookingNumber: activeBooking.bookingNumber,
      bookingItems: activeBooking.items,
      reason: `Admin Approved Deposit Terms - Order #${activeBooking.bookingNumber}`,
      summary: `Admin approved staff deposit terms request: ${pct}% for Order #${activeBooking.bookingNumber}`,
      details: `Admin confirmed deposit change to ${pct}% (${depositRequired} EGP) requested by ${activeBooking.pendingDepositPercentageBy || 'Staff'}.`,
    };
    if (onLogActivity) onLogActivity(approveLog);
    if (onShowToast) onShowToast(`Approved deposit terms: ${pct}% for Order #${activeBooking.bookingNumber}.`, approveLog);
  };

  const handleRejectPendingDepositPct = () => {
    if (!activeBooking || !isAdmin) return;
    const prevPendingPct = activeBooking.pendingDepositPercentage;
    const updated: Booking = {
      ...activeBooking,
      pendingDepositPercentage: undefined,
      pendingDepositPercentageBy: undefined,
      pendingDepositPercentageAt: undefined,
      updatedAt: new Date().toISOString(),
    };
    if (onUpdateBooking) {
      onUpdateBooking(updated);
    }
    const declineLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'booking_updated',
      actorName: currentUser.name || 'Admin',
      actorRole: 'admin',
      bookingId: activeBooking.id,
      bookingNumber: activeBooking.bookingNumber,
      bookingItems: activeBooking.items,
      reason: `Admin Declined Deposit Terms Request - Order #${activeBooking.bookingNumber}`,
      summary: `Admin declined staff deposit terms request (${prevPendingPct}%) for Order #${activeBooking.bookingNumber}`,
      details: `Admin declined request to change deposit to ${prevPendingPct}%. Terms maintained at current rate.`,
    };
    if (onLogActivity) onLogActivity(declineLog);
    if (onShowToast) onShowToast(`Declined deposit change request for Order #${activeBooking.bookingNumber}.`, declineLog);
  };

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
              Bulk orders, advance deposit workflows & workshop sheets
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
            const bDepositPct = b.depositPercentage ?? (b.depositRate ? Math.round(b.depositRate * 100) : 50);

            return (
              <div
                key={b.id}
                onClick={() => setSelectedBookingId(b.id)}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 shadow-xs hover:shadow-md transition-all cursor-pointer p-3.5 sm:p-5 group active:scale-[0.99]"
              >
                {/* Header & Content Row */}
                <div className="flex flex-col gap-3">
                  {/* Top: Serial Pill, Client Name, Phone, and Right Arrow */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <span className="font-mono font-black text-xs sm:text-sm px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-900 text-white shadow-xs shrink-0 tracking-wide">
                        {b.bookingNumber}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {b.clientName}
                          </h3>
                          {b.clientPhone && b.clientPhone !== 'N/A' && (
                            <span
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] sm:text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 transition-colors"
                            >
                              <MessageCircle className="w-3 h-3 text-emerald-600" />
                              <a
                                href={getWhatsAppUrl(b.clientPhone, b.clientName, waLanguage)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline font-bold"
                                title="Chat with client on WhatsApp"
                              >
                                {b.clientPhone}
                              </a>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                          Created {new Date(b.createdAt).toLocaleDateString()} by{' '}
                          <strong className="text-slate-700">{b.createdByName}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Prominent Arrow Button */}
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 group-hover:bg-blue-600 text-slate-600 group-hover:text-white flex items-center justify-center transition-all shadow-2xs group-hover:translate-x-0.5 shrink-0">
                      <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                    </div>
                  </div>

                  {/* Middle / Bottom Row: Status Badges & Financials (Fully Visible on Mobile) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                    {/* Status badges */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span
                        className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                          b.status === 'pending'
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : b.status === 'preparing'
                            ? 'bg-blue-50 text-blue-900 border-blue-300'
                            : b.status === 'delivered'
                            ? 'bg-purple-50 text-purple-900 border-purple-300'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {b.status === 'pending' && <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />}
                        {b.status === 'preparing' && <Factory className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600" />}
                        {b.status === 'delivered' && <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-600" />}
                        {b.status === 'done' && <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />}
                        <span>
                          {b.status === 'pending'
                            ? (bDepositPct === 100 ? 'AWAITING FULL PAYMENT' : `AWAITING ${bDepositPct}% DEPOSIT`)
                            : b.status === 'preparing'
                            ? 'IN PREPARATION'
                            : b.status === 'delivered'
                            ? 'DELIVERED'
                            : 'COMPLETED'}
                        </span>
                      </span>

                      <span
                        className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold border ${
                          b.status === 'done' || b.depositPaid
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {b.status === 'done'
                          ? '✓ 100% Fully Settled'
                          : b.depositPaid
                          ? (bDepositPct === 100 ? '✓ 100% Paid' : `✓ ${bDepositPct}% Paid`)
                          : 'Deposit Unpaid'}
                      </span>

                      {b.pendingDepositPercentage && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Req {b.pendingDepositPercentage}% Pending</span>
                        </span>
                      )}
                    </div>

                    {/* Total Amount & Items Count - Visible on both Mobile & Desktop */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-xl">
                      <div className="text-[11px] sm:text-xs text-slate-500 font-medium">
                        {b.items.length} {b.items.length === 1 ? 'item' : 'items'} • <span className="font-bold text-slate-700">{totalUnits} pcs</span>
                      </div>
                      <div className="font-mono font-black text-sm sm:text-base text-blue-900">
                        {b.total.toFixed(2)} EGP
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DEDICATED FULL DETAILS MODAL WITH 0.75X SCALE AS REQUESTED */}
      {activeBooking && (
        <div
          className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-hidden print:hidden animate-in fade-in duration-150"
          onClick={() => setSelectedBookingId(null)}
        >
          <div
            className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl bg-white sm:rounded-3xl border-0 sm:border sm:border-slate-200/90 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header: High Contrast, Compact, Non-cluttered */}
            <div className="p-3.5 sm:p-5 bg-slate-950 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <span className="font-mono font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 shadow-xs shrink-0 tracking-wide">
                  {activeBooking.bookingNumber}
                </span>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-black text-white truncate">
                    {activeBooking.clientName}
                  </h2>
                  <div className="text-[11px] sm:text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                    <span>Created {new Date(activeBooking.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="text-slate-300">by {activeBooking.createdByName}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white flex items-center justify-center transition-colors shrink-0"
                title="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Modal Body: Smooth Single Scroll Container */}
            <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 text-sm bg-slate-50/50">
              {/* Status and Milestones Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                    Current Order Status
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                        activeBooking.status === 'pending'
                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                          : activeBooking.status === 'preparing'
                          ? 'bg-blue-50 text-blue-900 border-blue-300'
                          : activeBooking.status === 'delivered'
                          ? 'bg-purple-50 text-purple-900 border-purple-300'
                          : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      {activeBooking.status === 'pending' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                      {activeBooking.status === 'preparing' && <Factory className="w-3.5 h-3.5 text-blue-600" />}
                      {activeBooking.status === 'delivered' && <Package className="w-3.5 h-3.5 text-purple-600" />}
                      {activeBooking.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>
                        {activeBooking.status === 'pending'
                          ? (activeDepositPct === 100 ? 'Awaiting Full Payment (100%)' : `Awaiting ${activeDepositPct}% Deposit`)
                          : activeBooking.status === 'preparing'
                          ? 'In Preparation (Stock Reserved)'
                          : activeBooking.status === 'delivered'
                          ? 'Delivered (Awaiting Balance)'
                          : 'Order Completed'}
                      </span>
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                        activeBooking.status === 'done' || activeBooking.depositPaid
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {activeBooking.status === 'done'
                        ? '✓ 100% Fully Settled (Order Completed)'
                        : activeBooking.depositPaid
                        ? (activeDepositPct === 100 ? '✓ 100% Paid' : `✓ ${activeDepositPct}% Paid`)
                        : 'Deposit Unpaid'}
                    </span>
                  </div>
                </div>

                {activeBooking.clientPhone && activeBooking.clientPhone !== 'N/A' && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {/* Language Switcher for WhatsApp message template */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setWaLanguage('en')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                          waLanguage === 'en'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                        title="Use English template"
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaLanguage('ar')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                          waLanguage === 'ar'
                            ? 'bg-white text-emerald-800 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                        title="Use Arabic template"
                      >
                        عربي
                      </button>
                    </div>

                    {/* WhatsApp Action Button with Quotation Details & auto-open PDF */}
                    <button
                      type="button"
                      onClick={() => {
                        const url = getWhatsAppUrl(
                          activeBooking.clientPhone,
                          activeBooking.clientName,
                          waLanguage,
                          activeBooking
                        );
                        window.open(url, '_blank', 'noopener,noreferrer');
                        onOpenPrintModal(activeBooking, 'quotation');
                      }}
                      className="px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
                      title={`Send ${waLanguage === 'ar' ? 'Arabic' : 'English'} quotation message on WhatsApp & open PDF to attach`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp & Open Quotation PDF</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action Cards: Quotation PDF & Workshop Sheet */}
              <div className="space-y-2.5">
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                  Print & Production Documents
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenPrintModal(activeBooking, 'quotation')}
                    className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-left shadow-md active:scale-[0.99] transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white flex items-center gap-1.5">
                          <span>Quotation PDF</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 uppercase font-mono font-bold">1 Page</span>
                        </div>
                        <div className="text-[11px] text-blue-100 mt-0.5">
                          Client invoice & {activeDepositPct === 100 ? 'full payment' : `${activeDepositPct}% deposit`} breakdown
                        </div>
                      </div>
                    </div>
                    <Printer className="w-4 h-4 text-blue-200 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenPrintModal(activeBooking, 'production')}
                    className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold text-left shadow-md active:scale-[0.99] transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center shrink-0">
                        <Factory className="w-5 h-5 text-slate-950" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-950 flex items-center gap-1.5">
                          <span>Workshop Sheet</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 uppercase font-mono font-bold">Deficit</span>
                        </div>
                        <div className="text-[11px] text-amber-950/80 mt-0.5">
                          Cutting & tailoring manufacturing quota
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-amber-900 group-hover:translate-x-0.5 transition-transform stroke-[2.5]" />
                  </button>
                </div>

                {/* Selectable Upfront Advance Payment Buttons (50%, 70%, 100%) - Hidden in Delivery and Completed states as requested */}
                {activeBooking.status !== 'delivered' && activeBooking.status !== 'done' && (
                  <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span>Upfront Advance Payment Terms:</span>
                      </span>
                      <span className="font-mono text-[11px] font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        {activeDepositPct === 100 ? '100% Full Payment' : `${activeDepositPct}% Deposit`}
                      </span>
                    </div>

                    {/* Admin Approval Card for Pending Staff Request */}
                    {activeBooking.pendingDepositPercentage && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-in fade-in">
                        <div className="min-w-0">
                          <div className="font-black text-amber-950 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Staff Request: Change Deposit to {activeBooking.pendingDepositPercentage}%</span>
                          </div>
                          <div className="text-[11px] text-amber-800 mt-0.5">
                            Requested by <strong>{activeBooking.pendingDepositPercentageBy || 'Floor Staff'}</strong> • Current terms: {activeDepositPct}%
                          </div>
                        </div>

                        {isAdmin ? (
                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                            <button
                              type="button"
                              onClick={handleApprovePendingDepositPct}
                              className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-lg shadow-xs flex items-center justify-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Approve {activeBooking.pendingDepositPercentage}%</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleRejectPendingDepositPct}
                              className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 font-bold text-xs rounded-lg transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300 shrink-0">
                            ⏳ Awaiting Admin Approval
                          </span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      {[50, 70, 100].map((pct) => {
                        const isPendingThis = activeBooking.pendingDepositPercentage === pct;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              if (pct !== activeDepositPct) {
                                setPendingPctChange(pct);
                              }
                            }}
                            className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center border active:scale-95 ${
                              activeDepositPct === pct
                                ? 'bg-slate-900 text-amber-400 border-slate-900 shadow-sm ring-2 ring-slate-900/20'
                                : isPendingThis
                                ? 'bg-amber-50 text-amber-900 border-amber-400 ring-2 ring-amber-300'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <span>{pct === 100 ? '100% Full' : `${pct}% Deposit`}</span>
                            <span className="text-[10px] font-mono font-medium opacity-85 mt-0.5">
                              {((activeBooking.total * pct) / 100).toFixed(0)} EGP
                            </span>
                            {isPendingThis && (
                              <span className="text-[9px] font-bold text-amber-700 mt-0.5 uppercase tracking-wide">
                                Pending Admin
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Status Workflow Action Button */}
                {activeBooking.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => setShowConfirmDepositModal(true)}
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                    <span>
                      {activeDepositPct === 100
                        ? 'Confirm Full Payment (100%) & Reserve Stock'
                        : `Confirm ${activeDepositPct}% Deposit & Reserve Stock`}
                    </span>
                  </button>
                )}

                {activeBooking.status === 'preparing' && (
                  <button
                    type="button"
                    onClick={() => onAdvanceStatus(activeBooking.id, 'delivered')}
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md shadow-purple-600/20 transition-all"
                  >
                    <Package className="w-5 h-5" />
                    <span>
                      {activeDepositPct === 100
                        ? 'Mark Order as Delivered & Completed'
                        : `Mark Order as Delivered (Awaiting Final ${activeRemainingPct}%)`}
                    </span>
                  </button>
                )}

                {activeBooking.status === 'delivered' && (
                  <button
                    type="button"
                    onClick={() => onAdvanceStatus(activeBooking.id, 'done')}
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    <span>
                      {activeDepositPct === 100
                        ? 'Complete Order'
                        : `Receive Final ${activeRemainingPct}% Balance & Complete Order`}
                    </span>
                  </button>
                )}
              </div>

              {/* Order Items List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700">
                    Ordered Apparel Items ({activeBooking.items.length})
                  </h4>
                  <span className="text-xs text-slate-500 font-mono font-bold">
                    Total: {activeBooking.items.reduce((s, it) => s + it.quantity, 0)} units
                  </span>
                </div>

                <div className="space-y-2.5">
                  {activeBooking.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                            {it.productName}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-600">
                            <span className="font-mono text-amber-800 font-bold">{it.productSku}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1.5 font-bold">
                              <span
                                className="w-3 h-3 rounded-full border border-slate-300 inline-block shrink-0 shadow-2xs"
                                style={{ backgroundColor: it.colorHex }}
                              />
                              <span>{it.colorName}</span>
                            </span>
                            <span>•</span>
                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-xs">
                              Size: {it.size}
                            </span>
                          </div>
                        </div>

                        {it.deficitQuantity > 0 ? (
                          <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg shrink-0 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Deficit: {it.deficitQuantity}</span>
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg shrink-0 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>In Stock</span>
                          </div>
                        )}
                      </div>

                      {/* Line pricing and pieces breakdown: Clear, bold badges */}
                      <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-950 font-black">
                            <span className="font-mono text-sm text-blue-700">{it.quantity}</span>
                            <span className="text-[11px] font-bold text-blue-900 uppercase">pcs</span>
                          </span>
                          <span className="text-slate-600 font-medium">
                            @ <span className="font-mono font-black text-slate-900">{it.unitPrice.toFixed(2)}</span> EGP / piece
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400 font-semibold uppercase">Total:</span>
                          <span className="font-mono font-black text-sm text-blue-950 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            {it.totalPrice.toFixed(2)} EGP
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation Box */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-2.5 shadow-2xs text-sm">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Gross Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {activeBooking.subtotal.toFixed(2)} EGP
                  </span>
                </div>

                {activeBooking.discount > 0 && (
                  <div className="flex justify-between text-xs text-rose-600 font-bold">
                    <span>Discount:</span>
                    <span className="font-mono">-{activeBooking.discount.toFixed(2)} EGP</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-between text-base sm:text-lg font-black text-slate-900">
                  <span>Total Order Value:</span>
                  <span className="font-mono text-blue-900">{activeBooking.total.toFixed(2)} EGP</span>
                </div>

                <div className="pt-2.5 border-t border-dashed border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200">
                    <div className="text-xs font-bold text-amber-900">
                      {activeDepositPct === 100 ? '100% Full Payment Required' : `${activeDepositPct}% Advance Deposit Required`}
                    </div>
                    <div className="text-base font-black font-mono text-amber-950 mt-0.5">
                      {activeBooking.depositRequired.toFixed(2)} EGP
                    </div>
                    <div className="text-[11px] font-bold text-amber-800 mt-1">
                      Status: {activeBooking.status === 'done' ? '✓ 100% FULLY PAID & SETTLED' : activeBooking.depositPaid ? '✓ RECEIVED & CONFIRMED' : (activeDepositPct === 100 ? '⏳ PENDING FULL PAYMENT' : `⏳ PENDING ${activeDepositPct}% PAYMENT`)}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-100/90 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-700">
                      {activeBooking.status === 'done' ? 'Remaining Balance' : activeDepositPct === 100 ? 'Remaining Balance' : `${activeRemainingPct}% Balance (Due on Handover)`}
                    </div>
                    <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                      {activeBooking.status === 'done' ? '0.00 EGP' : `${Math.max(0, activeBooking.total - activeBooking.depositRequired).toFixed(2)} EGP`}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {activeBooking.status === 'done' ? 'Fully settled upon order completion' : activeDepositPct === 100 ? 'Fully settled upfront' : 'Payable on physical receipt'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {activeBooking.notes && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
                  <strong className="text-amber-900 font-bold">Booking Notes: </strong>
                  <span>{activeBooking.notes}</span>
                </div>
              )}

              {/* Delete Booking Option - Admins Only, and Hidden Once Delivered or Completed */}
              {isAdmin && activeBooking.status !== 'delivered' && activeBooking.status !== 'done' && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete booking ${activeBooking.bookingNumber}?`)) {
                        onDeleteBooking(activeBooking.id);
                        setSelectedBookingId(null);
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Booking Record</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer: Sticky Bottom Bar with Safe Inset on Mobile */}
            <div className="p-3 sm:p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 pb-safe">
              <button
                type="button"
                onClick={() => onOpenPrintModal(activeBooking, 'quotation')}
                className="sm:hidden flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Quotation PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedBookingId(null)}
                className="flex-1 sm:flex-none sm:ml-auto px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors text-center shadow-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CONFIRM CHANGING ADVANCE DEPOSIT PERCENTAGE (50% <-> 70% <-> 100%) */}
      {pendingPctChange !== null && activeBooking && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <DollarSign className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                {isAdmin
                  ? `Update Deposit to ${pendingPctChange === 100 ? '100% Full Payment' : `${pendingPctChange}% Advance Deposit`}?`
                  : `Request Deposit Change to ${pendingPctChange === 100 ? '100% Full Payment' : `${pendingPctChange}% Advance Deposit`}?`}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isAdmin ? (
                  <>
                    Are you sure you want to change the upfront advance deposit for booking{' '}
                    <strong className="text-slate-900 font-mono">{activeBooking.bookingNumber}</strong> from{' '}
                    <span className="font-bold text-amber-700">{activeDepositPct}%</span> to{' '}
                    <span className="font-bold text-blue-700">{pendingPctChange}%</span>?
                  </>
                ) : (
                  <>
                    As a staff member, your request to adjust the upfront deposit for booking{' '}
                    <strong className="text-slate-900 font-mono">{activeBooking.bookingNumber}</strong> to{' '}
                    <span className="font-bold text-blue-700">{pendingPctChange}%</span> will be submitted to Administrators for approval.
                  </>
                )}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Total Order Value:</span>
                <span className="font-mono font-bold text-slate-900">{activeBooking.total.toFixed(2)} EGP</span>
              </div>
              <div className="flex justify-between text-blue-900 font-bold">
                <span>New {pendingPctChange === 100 ? 'Payment Required' : 'Deposit Required'}:</span>
                <span className="font-mono text-sm">{((activeBooking.total * pendingPctChange) / 100).toFixed(2)} EGP</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Remaining Balance (on delivery):</span>
                <span className="font-mono font-bold text-slate-900">
                  {Math.max(0, activeBooking.total - (activeBooking.total * pendingPctChange) / 100).toFixed(2)} EGP
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingPctChange(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUpdateDepositPct(pendingPctChange);
                  setPendingPctChange(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs shadow-md transition-all"
              >
                {isAdmin ? `Yes, Update to ${pendingPctChange}%` : 'Submit Request for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM CLIENT PAYMENT RECEIVED (PREVENTS ACCIDENTAL CLICKS) */}
      {showConfirmDepositModal && activeBooking && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Confirm Client Payment Received?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure that the client has paid the money and you want to click this button?
              </p>
            </div>

            <div className="bg-emerald-50/80 rounded-2xl p-3.5 border border-emerald-200 text-xs space-y-2 text-emerald-950">
              <div className="flex justify-between">
                <span className="text-emerald-800 font-semibold">Client Name:</span>
                <span className="font-bold">{activeBooking.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800 font-semibold">Total Order:</span>
                <span className="font-mono font-bold">{activeBooking.total.toFixed(2)} EGP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800 font-semibold">
                  Amount Received ({activeDepositPct}%):
                </span>
                <span className="font-mono font-black text-sm text-emerald-900">
                  {activeBooking.depositRequired.toFixed(2)} EGP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800 font-semibold">Remaining Balance:</span>
                <span className="font-mono font-bold">
                  {Math.max(0, activeBooking.total - activeBooking.depositRequired).toFixed(2)} EGP
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              Confirming will transition this order to <strong>In Preparation</strong> and lock warehouse stock for this booking.
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmDepositModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmDepositModal(false);
                  onAdvanceStatus(activeBooking.id, 'preparing');
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Yes, Confirm Payment Received</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
