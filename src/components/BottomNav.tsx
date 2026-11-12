import React, { useState } from 'react';
import { User } from '../types/inventory';
import { Package, CheckSquare, Clock, PlusCircle, History, LogOut, X, Users, CalendarCheck, Plus, Sparkles, Bell, Send } from 'lucide-react';
import { isUserAdmin } from '../utils/security';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  sendTestNotification,
} from '../services/notificationService';

interface BottomNavProps {
  currentUser: User;
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  pendingCount: number;
  pendingStockCount?: number;
  pendingAccountsCount?: number;
  pendingAuditNotificationsCount?: number;
  approvalsTab?: 'stock' | 'staff';
  onSwitchRole?: () => void;
  onOpenAddProduct?: () => void;
  onOpenNewBooking?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentUser,
  activeView,
  onNavigate,
  onLogout,
  pendingCount,
  pendingStockCount = 0,
  pendingAccountsCount = 0,
  pendingAuditNotificationsCount = 0,
  approvalsTab = 'stock',
  onOpenAddProduct,
  onOpenNewBooking,
}) => {
  const isAdmin = isUserAdmin(currentUser);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showCreateChoiceSheet, setShowCreateChoiceSheet] = useState(false);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 md:hidden pb-safe shadow-lg">
      <div className="grid grid-cols-5 items-center h-16 px-1">
        {/* Tab 1: Inventory */}
        <button
          onClick={() => onNavigate('inventory')}
          className={`flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
            activeView === 'inventory' ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-5 h-5 mb-1" />
          <span className="text-[10px] tracking-tight">Stock</span>
        </button>

        {/* Tab 2: Accounts (Admin: Account Approvals & Staff List, Worker: Accounts) */}
        <button
          onClick={() => onNavigate(isAdmin ? 'account-approvals' : 'inventory')}
          className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
            activeView === 'account-approvals' || (activeView === 'approvals' && approvalsTab === 'staff')
              ? 'text-amber-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5 mb-1" />
            {isAdmin && pendingAccountsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] flex items-center justify-center bg-amber-500 text-slate-950 font-black text-[9px] rounded-full animate-pulse">
                {pendingAccountsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight">Accounts</span>
        </button>

        {/* Tab 3: Center Primary Action - Plus sign with 2 choices (New Item vs New Booking) */}
        <button
          onClick={() => setShowCreateChoiceSheet(true)}
          className="flex flex-col items-center justify-center min-h-[44px] py-1 text-amber-600 group"
          title="Create New Item or Booking"
        >
          <div className={`w-10 h-10 rounded-full ${isAdmin ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-sky-500 hover:bg-sky-600 text-white'} flex items-center justify-center shadow-md active:scale-95 transition-transform`}>
            <PlusCircle className="w-6 h-6 stroke-[2.2]" />
          </div>
        </button>

        {/* Tab 4: Stock Audit Log */}
        <button
          onClick={() => onNavigate('audit-log')}
          className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
            activeView === 'audit-log' ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <History className="w-5 h-5 mb-1" />
            {pendingAuditNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] flex items-center justify-center bg-rose-600 text-white font-black text-[9px] rounded-full animate-pulse">
                {pendingAuditNotificationsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight">Stock Audit</span>
        </button>

        {/* Tab 5: Account Profile & Menu */}
        <button
          onClick={() => setShowAccountSheet(true)}
          className="relative flex flex-col items-center justify-center min-h-[44px] py-1 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <div className="relative">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black text-white mb-0.5 shadow-xs"
              style={{ backgroundColor: currentUser.avatarColor || (isAdmin ? '#d97706' : '#0284c7') }}
            >
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {isAdmin && pendingAuditNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 flex items-center justify-center bg-rose-600 text-white font-black text-[8px] rounded-full animate-pulse">
                {pendingAuditNotificationsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight font-medium">Menu</span>
        </button>
      </div>

      {/* Mobile Account Bottom Sheet Modal */}
      {showAccountSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl p-5 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle for mobile */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-black text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: currentUser.avatarColor || (isAdmin ? '#d97706' : '#0284c7') }}
                >
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-900 truncate">
                    {currentUser.name}
                  </h3>
                  <p className="text-xs text-slate-500 truncate" title={currentUser.email}>
                    {currentUser.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAccountSheet(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Info */}
            <div className="py-2.5 flex items-center justify-between border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Account Role
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  isAdmin
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-sky-50 text-sky-900 border-sky-300'
                }`}
              >
                {isAdmin ? 'Warehouse Administrator' : 'Warehouse Staff'}
              </span>
            </div>

            {/* Quick Navigation Shortcuts in exact requested order:
                1. accounts
                2. stock audit
                3. client bookings & quotations
                4. stock adjustment approvals
                5. phone notifications & test alert
                6. log out
            */}
            <div className="py-2 space-y-1.5">
              {/* 1. Accounts */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountSheet(false);
                    onNavigate('account-approvals');
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 text-slate-900 font-bold text-xs hover:bg-amber-100/60 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-amber-700" />
                    <span>Account Approvals & Staff List</span>
                  </span>
                  {pendingAccountsCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[11px] rounded-full animate-pulse">
                      {pendingAccountsCount} pending
                    </span>
                  )}
                </button>
              )}

              {/* 2. Stock Audit */}
              <button
                type="button"
                onClick={() => {
                  setShowAccountSheet(false);
                  onNavigate('audit-log');
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <History className="w-4 h-4 text-slate-500" />
                  <span>Stock Audit Log</span>
                </span>
                {pendingAuditNotificationsCount > 0 && (
                  <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[11px] rounded-full animate-pulse">
                    {pendingAuditNotificationsCount} pending approval
                  </span>
                )}
              </button>

              {/* 3. Client Bookings & Quotations */}
              <button
                type="button"
                onClick={() => {
                  setShowAccountSheet(false);
                  onNavigate('bookings');
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 font-bold text-xs hover:bg-blue-100 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Client Bookings & Quotations</span>
                </span>
                <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">
                  New
                </span>
              </button>

              {/* 4. Stock Adjustment Approvals */}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountSheet(false);
                    onNavigate('stock-approvals');
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs hover:bg-slate-100 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                    <span>Stock Adjustment Approvals</span>
                  </span>
                  {pendingStockCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[11px] rounded-full">
                      {pendingStockCount}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountSheet(false);
                    onNavigate('worker-requests');
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs hover:bg-slate-100 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-sky-600" />
                    <span>My Adjustment Requests</span>
                  </span>
                  {pendingStockCount > 0 && (
                    <span className="px-2 py-0.5 bg-sky-500 text-white font-black text-[11px] rounded-full">
                      {pendingStockCount}
                    </span>
                  )}
                </button>
              )}

              {/* 5. Phone Notifications & Test Alert */}
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
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-950 font-bold text-xs hover:bg-amber-500/20 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <span>Phone Notifications & Test Alert</span>
                </span>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-md">
                  Send Test
                </span>
              </button>
            </div>

            {/* Red Logout Button */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowAccountSheet(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 transition-all cursor-pointer shadow-xs"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile + Action Prompt Sheet: New Item vs New Booking */}
      {showCreateChoiceSheet && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowCreateChoiceSheet(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl p-5 animate-in slide-in-from-bottom duration-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto sm:hidden" />

            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Create New Action</h3>
                <p className="text-xs text-slate-500">What would you like to add?</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateChoiceSheet(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Two Choices */}
            <div className="grid grid-cols-1 gap-3 py-1">
              {/* Option 1: New Item / Product */}
              <button
                type="button"
                onClick={() => {
                  setShowCreateChoiceSheet(false);
                  if (onOpenAddProduct) {
                    onOpenAddProduct();
                  } else {
                    onNavigate('add-product');
                  }
                }}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/50 hover:from-amber-100 hover:to-orange-100/60 border border-amber-200/90 text-left transition-all active:scale-98 flex items-center gap-3.5 shadow-2xs group"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Package className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-slate-900 flex items-center justify-between">
                    <span>New Item / Product</span>
                    <span className="text-[10px] font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-full">
                      Stock
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Add new apparel model, colors, size matrix & prices
                  </p>
                </div>
              </button>

              {/* Option 2: New Client Booking */}
              <button
                type="button"
                onClick={() => {
                  setShowCreateChoiceSheet(false);
                  if (onOpenNewBooking) {
                    onOpenNewBooking();
                  } else {
                    onNavigate('bookings');
                  }
                }}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/50 hover:from-blue-100 hover:to-indigo-100/60 border border-blue-200/90 text-left transition-all active:scale-98 flex items-center gap-3.5 shadow-2xs group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <CalendarCheck className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-slate-900 flex items-center justify-between">
                    <span>New Client Booking</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Create bulk client order, quotation & workshop sheet
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCreateChoiceSheet(false)}
                className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-600 hover:bg-rose-100 active:bg-rose-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
