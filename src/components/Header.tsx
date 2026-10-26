import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types/inventory';
import { LogOut, Bell } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  pendingCount: number;
  onSwitchRole?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeView,
  onNavigate,
  onLogout,
  pendingCount,
}) => {
  const isAdmin = currentUser.role === 'admin';
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
        <div className="flex items-center justify-between gap-4 md:gap-8 h-14 md:h-16">
          {/* Zone 1: Brand title, one line wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('inventory')}
              className="flex items-center gap-2.5 text-lg md:text-xl font-black tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left hover:text-amber-700 transition-colors"
            >
              <img
                src="/assets/aistudio/SPS_LOGO_3443b8ef.jpg"
                alt="SPS Logo"
                className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 shadow-xs"
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

          {/* Zone 2: 4 clean nav links (desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <button
              onClick={() => onNavigate('inventory')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'inventory' ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-0.5' : ''
              }`}
            >
              Inventory Catalog
            </button>

            {isAdmin ? (
              <button
                onClick={() => onNavigate('approvals')}
                className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeView === 'approvals' ? 'text-amber-800 font-bold border-b-2 border-amber-600 pb-0.5' : ''
                }`}
              >
                <span>Stock Approvals</span>
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold text-[11px] rounded-full min-w-[18px]">
                    {pendingCount}
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={() => onNavigate('worker-requests')}
                className={`relative hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activeView === 'worker-requests' ? 'text-sky-800 font-bold border-b-2 border-sky-600 pb-0.5' : ''
                }`}
              >
                <span>My Adjustment Requests</span>
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 bg-sky-500 text-white font-bold text-[11px] rounded-full min-w-[18px]">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => onNavigate('add-product')}
                className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                  activeView === 'add-product' ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-0.5' : ''
                }`}
              >
                Add New Item
              </button>
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

          {/* Zone 3: Mobile alert & Interactive User Profile Avatar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Pending Alert Icon for Mobile */}
            {isAdmin && pendingCount > 0 && (
              <button
                onClick={() => onNavigate('approvals')}
                className="md:hidden relative p-2 text-amber-700 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                title={`${pendingCount} requests waiting`}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
              </button>
            )}

            {/* Clickable User Avatar Initial with Popover Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 hover:opacity-95 cursor-pointer select-none"
                style={{ backgroundColor: currentUser.avatarColor || (isAdmin ? '#d97706' : '#0284c7') }}
                title={`${currentUser.name} - Click for profile`}
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
                  <div className="py-2.5 px-0.5 flex items-center justify-between">
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
