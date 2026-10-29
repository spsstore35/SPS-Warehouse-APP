import React, { useState } from 'react';
import { User } from '../types/inventory';
import { Package, CheckSquare, Clock, PlusCircle, History, LogOut, X, Users } from 'lucide-react';
import { isUserAdmin } from '../utils/security';

interface BottomNavProps {
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

export const BottomNav: React.FC<BottomNavProps> = ({
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
  const [showAccountSheet, setShowAccountSheet] = useState(false);

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

        {/* Tab 2: Stock Approvals (Admin) or Requests (Worker) */}
        {isAdmin ? (
          <button
            onClick={() => onNavigate('stock-approvals')}
            className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
              activeView === 'approvals' && approvalsTab === 'stock'
                ? 'text-amber-700 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <CheckSquare className="w-5 h-5 mb-1" />
              {pendingStockCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] flex items-center justify-center bg-amber-500 text-slate-950 font-black text-[9px] rounded-full">
                  {pendingStockCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Stock Appr</span>
          </button>
        ) : (
          <button
            onClick={() => onNavigate('worker-requests')}
            className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
              activeView === 'worker-requests' ? 'text-sky-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Clock className="w-5 h-5 mb-1" />
              {pendingStockCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] flex items-center justify-center bg-sky-500 text-white font-black text-[9px] rounded-full">
                  {pendingStockCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Requests</span>
          </button>
        )}

        {/* Tab 3: Center Primary Action - Add New Item */}
        <button
          onClick={() => onNavigate('add-product')}
          className="flex flex-col items-center justify-center min-h-[44px] py-1 text-amber-600 group"
          title={isAdmin ? 'Add New Item' : 'Submit New Item'}
        >
          <div className={`w-10 h-10 rounded-full ${isAdmin ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-sky-500 hover:bg-sky-600 text-white'} flex items-center justify-center shadow-md active:scale-95 transition-transform`}>
            <PlusCircle className="w-6 h-6 stroke-[2.2]" />
          </div>
        </button>

        {/* Tab 4: Account Approvals (Admin) or Audit Log (Worker) */}
        {isAdmin ? (
          <button
            onClick={() => onNavigate('account-approvals')}
            className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
              activeView === 'approvals' && approvalsTab === 'staff'
                ? 'text-amber-700 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Users className="w-5 h-5 mb-1" />
              {pendingAccountsCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] flex items-center justify-center bg-amber-500 text-slate-950 font-black text-[9px] rounded-full animate-pulse">
                  {pendingAccountsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Accounts</span>
          </button>
        ) : (
          <button
            onClick={() => onNavigate('audit-log')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors ${
              activeView === 'audit-log' ? 'text-sky-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-5 h-5 mb-1" />
            <span className="text-[10px] tracking-tight">Audit Log</span>
          </button>
        )}

        {/* Tab 5: Account Profile & Menu */}
        <button
          onClick={() => setShowAccountSheet(true)}
          className="flex flex-col items-center justify-center min-h-[44px] py-1 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black text-white mb-0.5 shadow-xs"
            style={{ backgroundColor: currentUser.avatarColor || (isAdmin ? '#d97706' : '#0284c7') }}
          >
            {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
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

            {/* Quick Navigation Shortcuts */}
            <div className="py-2 space-y-1.5">
              {isAdmin && (
                <>
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
                </>
              )}

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
    </nav>
  );
};
