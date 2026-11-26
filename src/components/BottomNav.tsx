import React, { useState } from 'react';
import { User } from '../types/inventory';
import { Package, CheckSquare, Clock, PlusCircle, History, LogOut, X, Users, CalendarCheck, Bell, BarChart3, CalendarDays, Kanban, Factory, Megaphone, Wallet } from 'lucide-react';
import {
  isUserAdmin,
  isUserLeader,
  canUserAccessView,
  getUserAssignedTeams,
  isFullAccessAdmin,
} from '../utils/security';
import { STORE_TEAMS } from './CalendarView';
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
  users?: User[];
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
  users = [],
  onOpenAddProduct,
  onOpenNewBooking,
}) => {
  const isAdmin = isUserAdmin(currentUser);
  const isLeader = isUserLeader(currentUser);
  const userTeams = getUserAssignedTeams(currentUser);
  const fullAccessAdmin = isFullAccessAdmin(currentUser, users);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showCreateChoiceSheet, setShowCreateChoiceSheet] = useState(false);

  const canAnalytics = canUserAccessView(currentUser, 'analytics', users);
  const canBookings = canUserAccessView(currentUser, 'bookings', users);
  const canCalendar = canUserAccessView(currentUser, 'calendar', users);
  const canBoard = canUserAccessView(currentUser, 'board', users);
  const canSourcing = canUserAccessView(currentUser, 'sourcing', users);
  const canMarketing = canUserAccessView(currentUser, 'marketing', users);
  const canBudgeting = canUserAccessView(currentUser, 'budgeting', users);
  const canAudit = canUserAccessView(currentUser, 'audit-log', users);
  const canAddProduct = canUserAccessView(currentUser, 'add-product', users);
  const canAccountApprovals = canUserAccessView(currentUser, 'account-approvals', users);
  const canStockApprovals = canUserAccessView(currentUser, 'stock-approvals', users);
  const canWorkerRequests = canUserAccessView(currentUser, 'worker-requests', users);

  // Primary quick tab (Tab 2)
  const primaryTab = canAnalytics
    ? { view: 'analytics', label: 'Analytics', icon: 'analytics' as const, activeClass: 'text-emerald-700' }
    : canBookings
    ? { view: 'bookings', label: 'Orders', icon: 'bookings' as const, activeClass: 'text-blue-700' }
    : canSourcing
    ? { view: 'sourcing', label: 'Sourcing', icon: 'sourcing' as const, activeClass: 'text-amber-700' }
    : canMarketing
    ? { view: 'marketing', label: 'Marketing', icon: 'marketing' as const, activeClass: 'text-rose-700' }
    : canBudgeting
    ? { view: 'budgeting', label: 'Budgeting', icon: 'budgeting' as const, activeClass: 'text-emerald-700' }
    : { view: 'calendar', label: 'Calendar', icon: 'calendar' as const, activeClass: 'text-blue-700' };

  // Secondary quick tab (Tab 4) - Calendar & Tasks in place of Stock Audit
  const secondaryTab = canCalendar
    ? { view: 'calendar', label: 'Calendar & Tasks', icon: 'calendar' as const }
    : canBoard
    ? { view: 'board', label: 'Team Board', icon: 'board' as const }
    : canAudit
    ? { view: 'audit-log', label: 'Stock Audit', icon: 'audit' as const }
    : { view: 'inventory', label: 'Catalog', icon: 'inventory' as const };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 md:hidden pb-safe shadow-lg">
      {isLeader ? (
        <div className="grid grid-cols-2 items-center h-16 px-2">
          <button
            onClick={() => onNavigate('inventory')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
              activeView === 'inventory' ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-5 h-5 mb-1" />
            <span className="text-[10px] tracking-tight">Catalog & Prices</span>
          </button>

          <button
            onClick={() => setShowAccountSheet(true)}
            className="relative flex flex-col items-center justify-center min-h-[44px] py-1 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black text-white mb-0.5 shadow-xs"
              style={{ backgroundColor: currentUser.avatarColor || '#059669' }}
            >
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'L'}
            </div>
            <span className="text-[10px] tracking-tight font-medium">Account</span>
          </button>
        </div>
      ) : (
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

          {/* Tab 2: Primary Team Page */}
          <button
            onClick={() => onNavigate(primaryTab.view)}
            className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
              activeView === primaryTab.view
                ? `${primaryTab.activeClass} font-bold`
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {primaryTab.icon === 'analytics' && <BarChart3 className="w-5 h-5 mb-1" />}
            {primaryTab.icon === 'bookings' && <CalendarCheck className="w-5 h-5 mb-1" />}
            {primaryTab.icon === 'sourcing' && <Factory className="w-5 h-5 mb-1" />}
            {primaryTab.icon === 'marketing' && <Megaphone className="w-5 h-5 mb-1" />}
            {primaryTab.icon === 'budgeting' && <Wallet className="w-5 h-5 mb-1" />}
            {primaryTab.icon === 'calendar' && <CalendarDays className="w-5 h-5 mb-1" />}
            <span className="text-[10px] tracking-tight">{primaryTab.label}</span>
          </button>

          {/* Tab 3: Center Primary Action - Plus sign with allowed creation actions */}
          <button
            onClick={() => setShowCreateChoiceSheet(true)}
            className="flex flex-col items-center justify-center min-h-[44px] py-1 text-amber-600 group"
            title="Create New Action"
          >
            <div className={`w-10 h-10 rounded-full ${isAdmin ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-sky-500 hover:bg-sky-600 text-white'} flex items-center justify-center shadow-md active:scale-95 transition-transform`}>
              <PlusCircle className="w-6 h-6 stroke-[2.2]" />
            </div>
          </button>

          {/* Tab 4: Audit Log or Calendar */}
          <button
            onClick={() => onNavigate(secondaryTab.view)}
            className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
              activeView === secondaryTab.view ? 'text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              {secondaryTab.icon === 'audit' && <History className="w-5 h-5 mb-1" />}
              {secondaryTab.icon === 'calendar' && <CalendarDays className="w-5 h-5 mb-1" />}
              {secondaryTab.icon === 'board' && <Kanban className="w-5 h-5 mb-1" />}
              {secondaryTab.icon === 'inventory' && <Package className="w-5 h-5 mb-1" />}
              {secondaryTab.icon === 'audit' && pendingAuditNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] flex items-center justify-center bg-rose-600 text-white font-black text-[9px] rounded-full animate-pulse">
                  {pendingAuditNotificationsCount}
                </span>
              )}
            </div>
            <span className="text-[9.5px] sm:text-[10px] leading-tight text-center tracking-tight">{secondaryTab.label}</span>
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
              {((canAccountApprovals && pendingAccountsCount > 0) ||
                (canAudit && pendingAuditNotificationsCount > 0)) && (
                <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 flex items-center justify-center bg-rose-600 text-white font-black text-[8px] rounded-full">
                  {(canAccountApprovals ? pendingAccountsCount : 0) +
                    (canAudit ? pendingAuditNotificationsCount : 0)}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight font-medium">Menu</span>
          </button>
        </div>
      )}

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
                  style={{ backgroundColor: currentUser.avatarColor || (isAdmin ? '#d97706' : isLeader ? '#059669' : '#0284c7') }}
                >
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-900 truncate">
                    {currentUser.name}
                  </h3>
                  <p
                    className="text-xs text-slate-500 truncate"
                    title={currentUser.email || currentUser.phone || currentUser.username || ''}
                  >
                    {currentUser.email || (currentUser.username ? `@${currentUser.username}` : currentUser.phone || '')}
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

            {/* Role & Team Scope Info */}
            <div className="py-2.5 space-y-1.5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Account Role
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    fullAccessAdmin
                      ? 'bg-amber-100 text-amber-950 border-amber-400'
                      : isAdmin
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : isLeader
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-sky-50 text-sky-900 border-sky-300'
                  }`}
                >
                  {fullAccessAdmin
                    ? 'Full-Access Admin'
                    : isAdmin
                    ? 'Admin (Team-Scoped)'
                    : isLeader
                    ? 'Scout Leader (Read-Only)'
                    : 'Warehouse Staff'}
                </span>
              </div>
              {!isLeader && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider">
                    Access
                  </span>
                  <span className="font-bold text-slate-700 text-right truncate">
                    {fullAccessAdmin
                      ? userTeams.length > 0
                        ? `All Pages · ${userTeams
                            .map((tid) => STORE_TEAMS.find((t) => t.id === tid)?.shortLabel || tid)
                            .join(', ')}`
                        : 'All Pages (Full Access)'
                      : userTeams.length > 0
                      ? userTeams
                          .map((tid) => STORE_TEAMS.find((t) => t.id === tid)?.shortLabel || tid)
                          .join(', ')
                      : isAdmin
                      ? 'No Team (Inventory Only)'
                      : 'No Team Assigned'}
                  </span>
                </div>
              )}
            </div>

            <div className="py-2 space-y-1.5 max-h-[52vh] overflow-y-auto">
              {isLeader ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountSheet(false);
                    onNavigate('inventory');
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 font-bold text-xs hover:bg-emerald-100 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Package className="w-4 h-4 text-emerald-700" />
                    <span>Browse Catalog & Prices</span>
                  </span>
                </button>
              ) : (
                <>
                  {canBookings && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountSheet(false);
                        onNavigate('bookings');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 font-bold text-xs hover:bg-blue-100 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <CalendarCheck className="w-4 h-4 text-blue-600" />
                        <span>Client Bookings &amp; Quotations</span>
                      </span>
                    </button>
                  )}

                  {canCalendar && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountSheet(false);
                        onNavigate('calendar');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 font-bold text-xs hover:bg-indigo-100 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <CalendarDays className="w-4 h-4 text-indigo-600" />
                        <span>Calendar &amp; Tasks</span>
                      </span>
                    </button>
                  )}

                  {canBoard && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountSheet(false);
                        onNavigate('board');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 font-bold text-xs hover:bg-blue-100 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Kanban className="w-4 h-4 text-blue-600" />
                        <span>Team Board &amp; People</span>
                      </span>
                    </button>
                  )}

                  {canAnalytics && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountSheet(false);
                        onNavigate('analytics');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 font-bold text-xs hover:bg-emerald-100 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <BarChart3 className="w-4 h-4 text-emerald-700" />
                        <span>Analytics &amp; Production</span>
                      </span>
                    </button>
                  )}

                  {canSourcing && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountSheet(false);
                        onNavigate('sourcing');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 font-bold text-xs hover:bg-amber-100 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Factory className="w-4 h-4 text-amber-600" />
                        <span>Sourcing &amp; Operations</span>
                      </span>
                    </button>
                  )}

                  {canBudgeting && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountSheet(false);
                        onNavigate('budgeting');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 font-bold text-xs hover:bg-emerald-100 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Wallet className="w-4 h-4 text-emerald-700" />
                        <span>Store Budgeting &amp; Liquidity</span>
                      </span>
                    </button>
                  )}

                  {canMarketing && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountSheet(false);
                        onNavigate('marketing');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-950 font-bold text-xs hover:bg-rose-100 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Megaphone className="w-4 h-4 text-rose-600" />
                        <span>Marketing &amp; Offers</span>
                      </span>
                    </button>
                  )}

                  {canStockApprovals && (
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
                  )}

                  {canWorkerRequests && (
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

                  {canAudit && (
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
                  )}

                  {canAccountApprovals && (
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
                        <span>Account Approvals &amp; Staff List</span>
                      </span>
                      {pendingAccountsCount > 0 && (
                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[11px] rounded-full animate-pulse">
                          {pendingAccountsCount} pending
                        </span>
                      )}
                    </button>
                  )}

                  {/* Phone Notifications & Test Alert */}
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
                      <span>Phone Notifications &amp; Test Alert</span>
                    </span>
                    <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-md">
                      Send Test
                    </span>
                  </button>
                </>
              )}
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

            <div className="grid grid-cols-1 gap-3 py-1">
              {canAddProduct && (
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
              )}

              {canBookings && (
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
              )}

              {canCalendar && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateChoiceSheet(false);
                    onNavigate('calendar');
                  }}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50/50 hover:from-emerald-100 hover:to-teal-100/60 border border-emerald-200/90 text-left transition-all active:scale-98 flex items-center gap-3.5 shadow-2xs group"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <CalendarDays className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-slate-900 flex items-center justify-between">
                      <span>Store Calendar &amp; Tasks</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      View &amp; add scheduled events, tasks &amp; phone calendar exports
                    </p>
                  </div>
                </button>
              )}

              {!canAddProduct && !canBookings && !canCalendar && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-center">
                  Your current account access is limited to your assigned Store Team workspace.
                </div>
              )}
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
