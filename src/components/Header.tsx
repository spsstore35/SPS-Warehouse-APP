import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types/inventory';
import { LogOut, Bell, Users, CheckSquare, Package, PlusCircle, History } from 'lucide-react';
import { isUserAdmin } from '../utils/security';

interface HeaderProps {
  currentUser: User;
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  pendingCount: number;
  pendingStockCount?: number;
  pendingAccountsCount?: number;
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
  approvalsTab = 'stock',
}) => {
  const isAdmin = isUserAdmin(currentUser);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 md:gap-6 h-14 md:h-16">
          {/* Left spacer on mobile to keep centered brand perfectly balanced with right avatar */}
          <div className="w-9 sm:w-10 md:hidden shrink-0" aria-hidden="true" />

          {/* Zone 1: Brand title & logo (centered on mobile, left on desktop) */}
          <div className="flex items-center justify-center md:justify-start gap-2.5 sm:gap-3 flex-1 md:flex-none">
            <button
              onClick={() => onNavigate('inventory')}
              className="flex items-center gap-2 sm:gap-2.5 text-base sm:text-lg md:text-xl font-black tracking-tight text-slate-900 whitespace-nowrap text-left hover:text-amber-700 transition-colors"
            >
              <img
                src="/assets/aistudio/SPS_LOGO_3443b8ef.jpg"
                alt="SPS Logo"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain bg-white border border-slate-200 shadow-xs"
              />
              <span>SPS Warehouse</span>
            </button>
            <span
              className={`hidden sm:inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                isAdmin
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-sky-50 text-sky-900 border-sky-300'
              }`}
            >
              {isAdmin ? 'Admin Portal' : 'Floor Staff'}
            </span>
          </div>

          {/* Zone 2: Navigation Links (desktop) */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-semibold text-slate-600">
            <button
              onClick={() => onNavigate('inventory')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'inventory' ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-0.5' : ''
              }`}
            >
              Inventory Catalog
            </button>

            {isAdmin ? (
              <>
                {/* 1. Dedicated Stock Approvals */}
                <button
                  onClick={() => onNavigate('stock-approvals')}
                  className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    activeView === 'approvals' && approvalsTab === 'stock'
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
                    activeView === 'approvals' && approvalsTab === 'staff'
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
            ) : (
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

            <button
              onClick={() => onNavigate('audit-log')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'audit-log' ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-0.5' : ''
              }`}
            >
              Stock Audit Log
            </button>
          </nav>

          {/* Zone 3: Interactive User Profile Avatar (without mobile alert icons) */}
          <div className="flex items-center justify-end shrink-0">
            {/* Clickable User Avatar Initial with Popover Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 hover:opacity-95 cursor-pointer select-none"
                style={{ backgroundColor: currentUser.avatarColor || (isAdmin ? '#d97706' : '#0284c7') }}
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
                      style={{ backgroundColor: currentUser.avatarColor || (isAdmin ? '#d97706' : '#0284c7') }}
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
                          : 'bg-sky-50 text-sky-900 border-sky-300'
                      }`}
                    >
                      {isAdmin ? 'Warehouse Administrator' : 'Warehouse Staff'}
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

                    {isAdmin && (
                      <>
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
                    </button>
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
