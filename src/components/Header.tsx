import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types/inventory';
import { LogOut, Bell, Users, CheckSquare, Package, PlusCircle, History, CalendarCheck, BarChart3, CalendarDays, Kanban } from 'lucide-react';
import { isUserAdmin, isUserLeader } from '../utils/security';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  sendTestNotification,
} from '../services/notificationService';

interface HeaderProps {
  currentUser: User;
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  pendingCount: number;
  pendingStockCount?: number;
  pendingAccountsCount?: number;
  pendingBookingsCount?: number;
  pendingAuditNotificationsCount?: number;
  approvalsTab?: 'stock' | 'staff';
  onSwitchRole?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeView,
  onNavigate,
  onLogout,
  pendingCount,
  pendingStockCount = 0,
  pendingAccountsCount = 0,
  pendingBookingsCount = 0,
  pendingAuditNotificationsCount = 0,
  approvalsTab = 'stock',
}) => {
  const isAdmin = isUserAdmin(currentUser);
  const isLeader = isUserLeader(currentUser);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [canSlideLeft, setCanSlideLeft] = useState(false);
  const [canSlideRight, setCanSlideRight] = useState(false);

  const updateNavScrollState = () => {
    const el = navRef.current;
    if (!el) return;
    setCanSlideLeft(el.scrollLeft > 4);
    setCanSlideRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const slideNav = (direction: 'left' | 'right') => {
    const el = navRef.current;
    if (!el) return;
    const step = Math.max(180, Math.round(el.clientWidth * 0.55));
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  };

  useEffect(() => {
    updateNavScrollState();
    const el = navRef.current;
    if (!el) return;
    const onResize = () => updateNavScrollState();
    window.addEventListener('resize', onResize);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
    };
  }, [activeView, isAdmin, isLeader, pendingBookingsCount, pendingStockCount, pendingAccountsCount, pendingAuditNotificationsCount]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 md:gap-4 h-14 md:h-16">
          {/* Left spacer on mobile to keep centered brand perfectly balanced with right avatar */}
          <div className="w-9 sm:w-10 md:hidden shrink-0" aria-hidden="true" />

          {/* Zone 1: Brand title & logo (centered on mobile, left on desktop) */}
          <div className="flex items-center justify-center md:justify-start gap-2 sm:gap-2.5 flex-1 md:flex-none shrink-0">
            <button
              onClick={() => onNavigate('inventory')}
              className="flex items-center gap-2 sm:gap-2.5 text-base sm:text-lg md:text-xl font-black tracking-tight text-slate-900 whitespace-nowrap text-left hover:text-amber-700 transition-colors shrink-0"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-white shadow-2xs border border-slate-200/90 flex items-center justify-center p-0.5 shrink-0">
                <img
                  src="/sps-logo.png"
                  alt="SPS Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span>SPS Warehouse</span>
            </button>
            <span
              className={`hidden sm:inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
                isAdmin
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : isLeader
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-sky-50 text-sky-900 border-sky-300'
              }`}
            >
              {isAdmin ? 'Admin Portal' : isLeader ? 'Leader View' : 'Staff'}
            </span>
          </div>

          {/* Zone 2: Horizontal Sliding Navigation Links (desktop/tablet) */}
          <div className="hidden md:flex items-center gap-1 flex-1 min-w-0">
            {canSlideLeft && (
              <button
                type="button"
                onClick={() => slideNav('left')}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 transition-colors"
                title="Slide pages left"
                aria-label="Slide navigation left"
              >
                <span className="text-xs font-black leading-none" aria-hidden="true">‹</span>
              </button>
            )}

            <nav
              ref={navRef}
              onScroll={updateNavScrollState}
              className="flex items-center gap-4 lg:gap-5 overflow-x-auto scrollbar-none scroll-smooth py-1.5 px-1 flex-1 min-w-0 text-sm font-semibold text-slate-600"
            >
              <button
                onClick={() => onNavigate('inventory')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                  activeView === 'inventory' ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-0.5' : ''
                }`}
              >
                Inventory Catalog
              </button>

              {!isLeader && (
                <button
                  onClick={() => onNavigate('bookings')}
                  className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    activeView === 'bookings'
                      ? 'text-blue-700 font-bold border-b-2 border-blue-600 pb-0.5'
                      : ''
                  }`}
                  title="Client bookings, quotations and deposit tracking"
                >
                  <CalendarCheck className="w-4 h-4 text-blue-600" />
                  <span>Bookings</span>
                  {pendingBookingsCount > 0 && (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.2 bg-blue-600 text-white font-bold text-[11px] rounded-full min-w-[18px]">
                      {pendingBookingsCount}
                    </span>
                  )}
                </button>
              )}

              {!isLeader && (
                <button
                  onClick={() => onNavigate('calendar')}
                  className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    activeView === 'calendar'
                      ? 'text-blue-700 font-bold border-b-2 border-blue-600 pb-0.5'
                      : ''
                  }`}
                  title="Store calendar events, tasks, and mobile calendar sync"
                >
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  <span>Calendar</span>
                </button>
              )}

              {!isLeader && (
                <button
                  onClick={() => onNavigate('board')}
                  className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    activeView === 'board'
                      ? 'text-blue-700 font-bold border-b-2 border-blue-600 pb-0.5'
                      : ''
                  }`}
                  title="Team Board (Upcoming, In Progress, Done) & People Directory"
                >
                  <Kanban className="w-4 h-4 text-indigo-600" />
                  <span>Team Board</span>
                </button>
              )}

              {isAdmin && (
                <>
                  <button
                    onClick={() => onNavigate('analytics')}
                    className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      activeView === 'analytics'
                        ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-0.5'
                        : ''
                    }`}
                    title="Admin sales analytics, branch demand & production aggregator"
                  >
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    <span>Analytics</span>
                  </button>

                  {/* 1. Dedicated Stock Approvals */}
                  <button
                    onClick={() => onNavigate('stock-approvals')}
                    className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      activeView === 'stock-approvals' || (activeView === 'approvals' && approvalsTab !== 'staff')
                        ? 'text-amber-800 font-bold border-b-2 border-amber-600 pb-0.5'
                        : ''
                    }`}
                    title="Review pending inventory stock changes"
                  >
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                    <span>Stock Approvals</span>
                    {pendingStockCount > 0 && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold text-[11px] rounded-full min-w-[18px]">
                        {pendingStockCount}
                      </span>
                    )}
                  </button>

                  {/* 2. Dedicated Accounts Approval Front & Center */}
                  <button
                    onClick={() => onNavigate('account-approvals')}
                    className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      activeView === 'account-approvals' || (activeView === 'approvals' && approvalsTab === 'staff')
                        ? 'text-amber-800 font-bold border-b-2 border-amber-600 pb-0.5'
                        : ''
                    }`}
                    title="Approve staff registration accounts"
                  >
                    <Users className="w-4 h-4 text-amber-600" />
                    <span>Account Approvals</span>
                    {pendingAccountsCount > 0 ? (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold text-[11px] rounded-full min-w-[18px] animate-pulse">
                        {pendingAccountsCount}
                      </span>
                    ) : null}
                  </button>

                  {/* 3. Add New Item */}
                  <button
                    onClick={() => onNavigate('add-product')}
                    className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                      activeView === 'add-product' ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-0.5' : ''
                    }`}
                  >
                    Add New Item
                  </button>
                </>
              )}

              {!isAdmin && !isLeader && (
                <>
                  <button
                    onClick={() => onNavigate('worker-requests')}
                    className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      activeView === 'worker-requests' ? 'text-sky-800 font-bold border-b-2 border-sky-600 pb-0.5' : ''
                    }`}
                  >
                    <span>My Adjustment Requests</span>
                    {pendingStockCount > 0 && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.2 bg-sky-500 text-white font-bold text-[11px] rounded-full min-w-[18px]">
                        {pendingStockCount}
                      </span>
                    )}
                  </button>

                  {/* Staff can also submit new items */}
                  <button
                    onClick={() => onNavigate('add-product')}
                    className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                      activeView === 'add-product' ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-0.5' : ''
                    }`}
                  >
                    + Add New Item
                  </button>
                </>
              )}

              {!isLeader && (
                <button
                  onClick={() => onNavigate('audit-log')}
                  className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    activeView === 'audit-log' ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-0.5' : ''
                  }`}
                >
                  <span>Stock Audit Log</span>
                  {pendingAuditNotificationsCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow-xs">
                      {pendingAuditNotificationsCount}
                    </span>
                  )}
                </button>
              )}
            </nav>

            {canSlideRight && (
              <button
                type="button"
                onClick={() => slideNav('right')}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 transition-colors"
                title="Slide pages right"
                aria-label="Slide navigation right"
              >
                <span className="text-xs font-black leading-none" aria-hidden="true">›</span>
              </button>
            )}
          </div>

          {/* Zone 3: Interactive User Profile Avatar (always pinned right, never clipped) */}
          <div className="flex items-center justify-end shrink-0">
            {/* Clickable User Avatar Initial with Popover Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 hover:opacity-95 cursor-pointer select-none"
                style={{ backgroundColor: currentUser.avatarColor || (isAdmin ? '#d97706' : isLeader ? '#059669' : '#0284c7') }}
                title={`${currentUser.name} - Click for profile & navigation`}
                aria-label="User account menu"
                aria-expanded={isProfileOpen}
              >
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </button>

              {/* Popover Card */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-2xl py-3 px-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* User Profile Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: currentUser.avatarColor || (isAdmin ? '#d97706' : isLeader ? '#059669' : '#0284c7') }}
                    >
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-slate-900 truncate">
                        {currentUser.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5" title={currentUser.email}>
                        {currentUser.email}
                      </div>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className="py-2.5 px-0.5 flex items-center justify-between border-b border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Role
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        isAdmin
                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                          : isLeader
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          : 'bg-sky-50 text-sky-900 border-sky-300'
                      }`}
                    >
                      {isAdmin ? 'Warehouse Administrator' : isLeader ? 'Scout Leader (Read-Only)' : 'Warehouse Staff'}
                    </span>
                  </div>

                  {/* Fast Navigation Links */}
                  <div className="py-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onNavigate('inventory');
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-slate-500" />
                        <span>Inventory Catalog</span>
                      </span>
                    </button>

                    {!isLeader && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            onNavigate('calendar');
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-900 bg-blue-50/70 hover:bg-blue-100/70 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                            <span>Calendar &amp; Tasks</span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            onNavigate('board');
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-950 bg-indigo-50/70 hover:bg-indigo-100/70 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Kanban className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Team Board &amp; People</span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            onNavigate('add-product');
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>{isAdmin ? 'Add New Item' : 'Submit New Item'}</span>
                          </span>
                        </button>
                      </>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            onNavigate('analytics');
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-900 bg-emerald-50/70 hover:bg-emerald-100/70 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Analytics & Production</span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            onNavigate('account-approvals');
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-amber-600" />
                            <span>Account Approvals</span>
                          </span>
                          {pendingAccountsCount > 0 && (
                            <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full animate-pulse">
                              {pendingAccountsCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            onNavigate('stock-approvals');
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                            <span>Stock Approvals</span>
                          </span>
                          {pendingStockCount > 0 && (
                            <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full">
                              {pendingStockCount}
                            </span>
                          )}
                        </button>
                      </>
                    )}

                    {!isLeader && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            onNavigate('audit-log');
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <History className="w-3.5 h-3.5 text-slate-500" />
                            <span>Stock Audit Log</span>
                          </span>
                          {pendingAuditNotificationsCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow-xs">
                              {pendingAuditNotificationsCount}
                            </span>
                          )}
                        </button>

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
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-900 bg-amber-50/60 hover:bg-amber-100/60 transition-colors"
                          title="Send a live test alert to your phone"
                        >
                          <span className="flex items-center gap-2">
                            <Bell className="w-3.5 h-3.5 text-amber-600" />
                            <span>Phone Alerts & Test</span>
                          </span>
                          <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                            Test Alert
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
                        setIsProfileOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 transition-all cursor-pointer shadow-xs"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
