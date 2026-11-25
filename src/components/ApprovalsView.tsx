import React, { useState } from 'react';
import { AdjustmentRequest, User, Role, Product, StoreTeamId } from '../types/inventory';
import { STORE_TEAMS } from './CalendarView';
import { SCOUT_FERA2_LIST, getScoutFare2Meta } from '../utils/scoutFera2';
import {
  Check,
  X,
  CheckSquare,
  Clock,
  ArrowRight,
  UserCheck,
  MessageSquare,
  Users,
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  ShieldCheck,
  Package,
  Trash2,
  Tag,
  Boxes,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ShieldAlert,
  Eye,
} from 'lucide-react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { isFullAccessAdmin, normalizeRole } from '../utils/security';

interface ApprovalsViewProps {
  mode?: 'stock' | 'accounts' | 'both';
  requests: AdjustmentRequest[];
  users: User[];
  currentUser: User;
  pendingProducts?: Product[];
  initialTab?: 'stock' | 'staff' | 'items';
  onRefreshFromDb?: () => void;
  onApprove: (requestId: string, adminNote?: string) => void;
  onReject: (requestId: string, adminNote?: string) => void;
  onApproveUser: (userId: string) => void;
  onRejectUser: (userId: string) => void;
  onDeleteUser?: (userId: string) => void;
  onUpdateUserRole?: (userId: string, newRole: Role) => Promise<void> | void;
  onUpdateUserTeams?: (
    userId: string,
    assignedTeams: StoreTeamId[],
    assignedFare2: string[]
  ) => Promise<void> | void;
  onCreateUserDirectly?: (data: {
    name: string;
    email: string;
    password?: string;
    role: Role;
    assignedTeams?: StoreTeamId[];
  }) => Promise<{ success: boolean; error?: string }> | any;
  onApproveProduct?: (productId: string) => void;
  onRejectProduct?: (productId: string, note?: string) => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  mode = 'both',
  requests,
  users,
  currentUser,
  pendingProducts = [],
  initialTab = 'stock',
  onRefreshFromDb,
  onApprove,
  onReject,
  onApproveUser,
  onRejectUser,
  onDeleteUser,
  onUpdateUserRole,
  onUpdateUserTeams,
  onCreateUserDirectly,
  onApproveProduct,
  onRejectProduct,
}) => {
  const effectiveInitialTab =
    mode === 'stock'
      ? initialTab === 'staff'
        ? 'stock'
        : initialTab
      : mode === 'accounts'
      ? 'staff'
      : initialTab;

  const [activeTab, setActiveTab] = useState<'stock' | 'staff' | 'items'>(effectiveInitialTab);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'all' | 'pending' | 'active'>('all');
  const [staffRoleFilter, setStaffRoleFilter] = useState<'all' | 'full_admin' | 'admin' | 'worker' | 'leader'>('all');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Sync tab whenever initialTab or mode changes
  React.useEffect(() => {
    if (initialTab) {
      if (mode === 'stock') {
        setActiveTab(initialTab === 'staff' ? 'stock' : initialTab);
      } else if (mode === 'accounts') {
        setActiveTab('staff');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [initialTab, mode]);

  // Direct Create Account Without Approval Modal State
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('worker');
  const [newUserTeams, setNewUserTeams] = useState<StoreTeamId[]>([]);
  const [createError, setCreateError] = useState('');
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToEditRole, setUserToEditRole] = useState<User | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<Role>('worker');
  const [newSelectedTeams, setNewSelectedTeams] = useState<StoreTeamId[]>([]);
  const [newSelectedFare2, setNewSelectedFare2] = useState<string[]>([]);
  const [originalEditTeams, setOriginalEditTeams] = useState<StoreTeamId[]>([]);
  const [originalEditFare2, setOriginalEditFare2] = useState<string[]>([]);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const getRoleDisplayName = (r: Role): string =>
    r === 'full_admin'
      ? 'Full-Access Admin'
      : r === 'admin'
      ? 'Admin (Team-Scoped)'
      : r === 'leader'
      ? 'Scout Leader'
      : 'Staff';

  const getRoleBadgeClass = (r: Role): string =>
    r === 'full_admin'
      ? 'bg-amber-500/15 text-amber-950 border-amber-400'
      : r === 'admin'
      ? 'bg-amber-50 text-amber-800 border-amber-300'
      : r === 'leader'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
      : 'bg-sky-50 text-sky-800 border-sky-300';

  const openEditAccountModal = (user: User) => {
    const resolvedTeams = Array.isArray(user.assignedTeams) ? user.assignedTeams : [];
    const resolvedFare2 = Array.isArray(user.assignedFare2) ? user.assignedFare2 : [];
    setUserToEditRole(user);
    setNewSelectedRole(isFullAccessAdmin(user, users) ? 'full_admin' : normalizeRole(user.role));
    setNewSelectedTeams(resolvedTeams);
    setNewSelectedFare2(resolvedFare2);
    setOriginalEditTeams(resolvedTeams);
    setOriginalEditFare2(resolvedFare2);
    setShowEditConfirmModal(false);
  };

  const handleConfirmDeleteUser = () => {
    if (!userToDelete || !onDeleteUser) return;
    onDeleteUser(userToDelete.id);
    setUserToDelete(null);
  };

  // Helper date functions for Stock Approvals Day-by-Day filter
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

  // Stock Approvals date filtering state
  const todayKey = React.useMemo(() => getTodayKey(), []);
  const initialStockDate = React.useMemo(() => {
    if (requests.length > 0) {
      const datesWithRequests = requests.map((r) => toDateKey(r.createdAt)).filter(Boolean);
      if (datesWithRequests.includes(todayKey)) return todayKey;
      return datesWithRequests[0] || todayKey;
    }
    return todayKey;
  }, [requests, todayKey]);

  const [selectedStockDate, setSelectedStockDate] = useState<string>(initialStockDate);
  const [isStockDayFilterEnabled, setIsStockDayFilterEnabled] = useState<boolean>(false);

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const filteredRequests = requests.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (isStockDayFilterEnabled && selectedStockDate) {
      if (toDateKey(r.createdAt) !== selectedStockDate) return false;
    }
    return true;
  });

  const countForSelectedStockDate = React.useMemo(() => {
    return requests.filter((r) => toDateKey(r.createdAt) === selectedStockDate).length;
  }, [requests, selectedStockDate]);

  const pendingUsers = users.filter((u) => u.status === 'pending');

  // Include all accounts with currentUser always present and sorted right at the top
  const allStaffUsers = React.useMemo(() => {
    const list = [...users];
    if (
      currentUser &&
      !list.some(
        (u) => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase()
      )
    ) {
      list.unshift(currentUser);
    }
    return list.sort((a, b) => {
      const aIsCurrent =
        currentUser &&
        (a.id === currentUser.id || a.email.toLowerCase() === currentUser.email.toLowerCase());
      const bIsCurrent =
        currentUser &&
        (b.id === currentUser.id || b.email.toLowerCase() === currentUser.email.toLowerCase());
      if (aIsCurrent) return -1;
      if (bIsCurrent) return 1;
      return 0;
    });
  }, [users, currentUser]);

  const filteredStaffUsers = React.useMemo(() => {
    return allStaffUsers.filter((u) => {
      // Status filtering (all / pending / active)
      if (staffStatusFilter === 'pending' && u.status !== 'pending') return false;
      if (staffStatusFilter === 'active' && u.status !== 'active') return false;

      // Role filtering (all / full_admin / admin / worker / leader)
      if (staffRoleFilter === 'worker') {
        const isWorker = u.role === 'worker' || (u.status === 'pending' && u.requestedRole === 'worker');
        if (!isWorker) return false;
      }
      if (staffRoleFilter === 'leader') {
        const isLeader = u.role === 'leader' || (u.status === 'pending' && u.requestedRole === 'leader');
        if (!isLeader) return false;
      }
      if (staffRoleFilter === 'full_admin') {
        const isFull =
          isFullAccessAdmin(u, users) ||
          (u.status === 'pending' && normalizeRole(u.requestedRole) === 'full_admin');
        if (!isFull) return false;
      }
      if (staffRoleFilter === 'admin') {
        const isRegularAdmin =
          (normalizeRole(u.role) === 'admin' && !isFullAccessAdmin(u, users)) ||
          (u.status === 'pending' && normalizeRole(u.requestedRole) === 'admin' && !isFullAccessAdmin(u, users));
        if (!isRegularAdmin) return false;
      }

      return true;
    });
  }, [allStaffUsers, staffStatusFilter, staffRoleFilter]);

  const handleConfirmReject = (requestId: string) => {
    onReject(requestId, rejectNote.trim() || undefined);
    setRejectingId(null);
    setRejectNote('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {mode === 'accounts' ? 'Staff Account Approvals' : 'Warehouse Stock Approvals'}
            </h1>
            {mode === 'accounts' ? (
              pendingUsers.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 animate-pulse">
                  {pendingUsers.length} Action Required
                </span>
              )
            ) : (
              (pendingRequests.length > 0 || pendingProducts.length > 0) && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
                  {pendingRequests.length + pendingProducts.length} Action Needed
                </span>
              )
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            {mode === 'accounts'
              ? 'Review and authorize staff account registrations, manage account status, and assign user roles.'
              : 'Review and authorize physical stock adjustments and new item catalog additions.'}
          </p>
        </div>
      </div>

      {/* Main Switcher: Stock Adjustments vs New Item Submissions (Stock Approvals Page) */}
      {mode !== 'accounts' && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'stock'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-amber-500" />
            <span>Stock Adjustments Queue</span>
            {pendingRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                {pendingRequests.length}
              </span>
            )}
          </button>

          {mode === 'both' && (
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'staff'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4 text-amber-500" />
              <span>Staff Registrations & Account Approvals</span>
              {pendingUsers.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black animate-pulse">
                  {pendingUsers.length} Pending
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'items'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Package className="w-4 h-4 text-amber-500" />
            <span>New Item Submissions</span>
            {pendingProducts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black animate-pulse">
                {pendingProducts.length} Pending
              </span>
            )}
          </button>
        </div>
      )}

      {/* TAB 1: STOCK ADJUSTMENT REQUESTS */}
      {mode !== 'accounts' && activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Day-by-Day Date Navigation Bar ("agyeb el haga bel ayam") */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Day-by-Day Navigator Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStockDate((curr) => shiftDate(curr, -1));
                    setIsStockDayFilterEnabled(true);
                  }}
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
                      {formatFriendlyDate(selectedStockDate)}
                    </span>
                    <input
                      type="date"
                      value={selectedStockDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedStockDate(e.target.value);
                          setIsStockDayFilterEnabled(true);
                        }
                      }}
                      className="bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStockDate((curr) => shiftDate(curr, 1));
                    setIsStockDayFilterEnabled(true);
                  }}
                  className="p-2 sm:px-3 sm:py-2 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                  title="Next Day"
                >
                  <span className="hidden sm:inline">Next Day</span>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              {/* Today vs All Dates Selector */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start lg:self-auto border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStockDate(todayKey);
                    setIsStockDayFilterEnabled(true);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                    isStockDayFilterEnabled && selectedStockDate === todayKey
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Today</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsStockDayFilterEnabled(false)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    !isStockDayFilterEnabled
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>All Dates ({requests.length})</span>
                </button>
              </div>
            </div>

            {isStockDayFilterEnabled && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>
                  Showing stock adjustments on <strong>{formatFriendlyDate(selectedStockDate)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsStockDayFilterEnabled(false)}
                  className="text-amber-800 hover:underline font-bold text-[11px]"
                >
                  Show All Dates
                </button>
              </div>
            )}
          </div>

          {/* Sub filter tabs */}
          <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full shadow-xs">
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                filter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({requests.filter((r) => r.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                filter === 'approved'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Approved ({requests.filter((r) => r.status === 'approved').length})
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                filter === 'rejected'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rejected ({requests.filter((r) => r.status === 'rejected').length})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({requests.length})
            </button>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-md mx-auto my-6 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No requests in this queue</h3>
              <p className="text-xs text-slate-500 mt-1">
                {isStockDayFilterEnabled
                  ? `No stock adjustments found on ${formatFriendlyDate(selectedStockDate)}.`
                  : filter === 'pending'
                  ? 'All worker stock adjustments have been reviewed and approved.'
                  : 'No historical requests found matching this filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredRequests.map((req) => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';

                return (
                  <div
                    key={req.id}
                    className={`bg-white border rounded-2xl p-4 sm:p-5 transition-all shadow-xs ${
                      isPending ? 'border-amber-400 ring-1 ring-amber-400/20' : 'border-slate-200'
                    }`}
                  >
                    {/* Header info with prominent Date and Time badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 gap-2.5">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center text-xs font-bold border border-sky-200 shrink-0">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{req.workerName}</span>
                          <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>
                              {new Date(req.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="self-start sm:self-auto">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Awaiting Your Approval</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Approved & Applied</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold">
                            <X className="w-3.5 h-3.5 text-rose-600" />
                            <span>Rejected (Stock Unchanged)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Main Request Content */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-5 flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {req.productImage ? (
                            <img
                              src={req.productImage}
                              alt={req.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400">Item</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{req.productName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            {!(
                              (req.size === 'Standard' || req.size === 'One Size') &&
                              (req.colorName === 'Standard' || req.colorName === 'Default' || req.colorName === 'N/A')
                            ) && (
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                                style={{ backgroundColor: req.colorHex }}
                              />
                            )}
                            <span className="text-xs text-slate-700 font-bold">
                              {!req.size || req.size === 'Standard' || req.size === 'One Size'
                                ? (req.colorName && req.colorName !== 'Standard' && req.colorName !== 'Default' && req.colorName !== 'N/A'
                                    ? `Standard Size · ${req.colorName}`
                                    : 'Standard Size')
                                : `Size ${req.size} · ${req.colorName}`}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Reason: <span className="text-slate-800 font-semibold">{req.reason}</span>
                          </div>
                        </div>
                      </div>

                      {/* Quantity Delta breakdown */}
                      <div className="md:col-span-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-[10px] uppercase font-bold text-slate-500">
                          Stock Count Change
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="font-mono text-base font-bold text-slate-500">
                            {req.currentQuantity}
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <div className="font-mono text-lg font-black text-slate-900">
                            {req.requestedQuantity}
                          </div>
                          <span
                            className={`text-xs font-mono font-black px-2 py-0.5 rounded ml-auto ${
                              req.delta > 0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {req.delta > 0 ? `+${req.delta}` : req.delta}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="md:col-span-4 flex flex-col justify-between h-full space-y-3">
                        {req.workerNote && (
                          <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-start gap-1.5 font-medium">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="italic line-clamp-2">"{req.workerNote}"</span>
                          </div>
                        )}

                        {isPending && (
                          <div className="flex items-center gap-2">
                            {rejectingId === req.id ? (
                              <div className="w-full space-y-2">
                                <input
                                  type="text"
                                  value={rejectNote}
                                  onChange={(e) => setRejectNote(e.target.value)}
                                  placeholder="Reason for rejection (optional)..."
                                  className="w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                                />
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleConfirmReject(req.id)}
                                    className="flex-1 py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
                                  >
                                    Confirm Reject
                                  </button>
                                  <button
                                    onClick={() => setRejectingId(null)}
                                    className="py-1.5 px-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => onApprove(req.id)}
                                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm min-h-[44px]"
                                >
                                  <Check className="w-4 h-4 stroke-[2.5]" />
                                  <span>Approve Stock</span>
                                </button>

                                <button
                                  onClick={() => setRejectingId(req.id)}
                                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-bold flex items-center justify-center gap-1 transition-colors min-h-[44px]"
                                >
                                  <X className="w-4 h-4" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STAFF & ADMIN ACCOUNT REGISTRATIONS */}
      {(mode === 'accounts' || (mode === 'both' && activeTab === 'staff')) && (
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Staff Accounts & Authorizations</h3>
                {pendingUsers.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                    {pendingUsers.length} Action Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Authorize pending registrations or create new staff accounts with immediate active access.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setNewUserName('');
                  setNewUserEmail('');
                  setNewUserPassword('');
                  setNewUserRole('worker');
                  setNewUserTeams([]);
                  setCreateError('');
                  setShowCreateUserModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-sm transition-all min-h-[40px] shrink-0"
              >
                <UserPlus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Add Account (No Approval Needed)</span>
              </button>
            </div>
          </div>

          {/* Pending Registrations Notice Banner if any are waiting */}
          {pendingUsers.length > 0 && (
            <div className="p-4 bg-amber-500/10 border-2 border-amber-400 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
                  <Users className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    {pendingUsers.length} Staff Registration{pendingUsers.length > 1 ? 's' : ''} Awaiting Approval
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    Review and click <strong>Approve Account</strong> below to grant immediate access to log into the warehouse.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStaffStatusFilter('pending')}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-colors shrink-0 whitespace-nowrap"
              >
                View Pending ({pendingUsers.length})
              </button>
            </div>
          )}

          {/* Staff Sub-filter tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full shadow-sm">
            <button
              onClick={() => setStaffStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                staffStatusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Staff ({allStaffUsers.length})
            </button>

            <button
              onClick={() => setStaffStatusFilter('pending')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                staffStatusFilter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Pending Approvals</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                staffStatusFilter === 'pending' ? 'bg-slate-950 text-amber-300' : 'bg-amber-100 text-amber-900'
              }`}>
                {pendingUsers.length}
              </span>
            </button>

            <button
              onClick={() => setStaffStatusFilter('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                staffStatusFilter === 'active'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active & Approved ({allStaffUsers.filter((u) => u.status === 'active').length})
            </button>
          </div>

          {/* Warehouse Access Roles & Permissions (Interactive Filter Cards) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Filter by Warehouse Access Level:
              </span>
              {staffRoleFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStaffRoleFilter('all')}
                  className="text-xs font-bold text-amber-800 hover:text-amber-900 hover:underline cursor-pointer"
                >
                  Show All Roles ({allStaffUsers.length})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {/* Full-Access Admin Filter Card */}
              <button
                type="button"
                onClick={() => setStaffRoleFilter((prev) => (prev === 'full_admin' ? 'all' : 'full_admin'))}
                className={`p-3.5 rounded-2xl flex items-start gap-3 text-left transition-all cursor-pointer ${
                  staffRoleFilter === 'full_admin'
                    ? 'bg-amber-50/95 border-2 border-amber-500 shadow-md ring-2 ring-amber-400/25'
                    : 'bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 shadow-xs'
                }`}
                title="Click to filter by Full-Access Admin"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    staffRoleFilter === 'full_admin'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-amber-100 border border-amber-300 text-amber-800'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                      Full-Access Admin
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                        staffRoleFilter === 'full_admin'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {staffRoleFilter === 'full_admin'
                        ? '✓ Active'
                        : `(${allStaffUsers.filter((u) => isFullAccessAdmin(u, users) || normalizeRole(u.requestedRole) === 'full_admin').length})`}
                    </span>
                  </div>
                  <p className="hidden sm:block text-[11px] text-slate-600 mt-1 leading-relaxed font-medium">
                    Sees <strong>all pages</strong> across the store plus full approvals, account management &amp; direct edits.
                  </p>
                  <span className="hidden sm:inline-block mt-2 text-[10px] font-bold text-amber-800">
                    {staffRoleFilter === 'full_admin' ? '• Click to reset' : '• Click to filter'}
                  </span>
                </div>
              </button>

              {/* Team-Scoped Admin Filter Card */}
              <button
                type="button"
                onClick={() => setStaffRoleFilter((prev) => (prev === 'admin' ? 'all' : 'admin'))}
                className={`p-3.5 rounded-2xl flex items-start gap-3 text-left transition-all cursor-pointer ${
                  staffRoleFilter === 'admin'
                    ? 'bg-orange-50/90 border-2 border-orange-500 shadow-md ring-2 ring-orange-400/25'
                    : 'bg-white hover:bg-orange-50/40 border border-slate-200 hover:border-orange-300 shadow-xs'
                }`}
                title="Click to filter by Team-Scoped Admin"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    staffRoleFilter === 'admin'
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-orange-100 border border-orange-200 text-orange-800'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-orange-950 uppercase tracking-wider">
                      Admin
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                        staffRoleFilter === 'admin'
                          ? 'bg-orange-600 text-white'
                          : 'bg-orange-100 text-orange-900'
                      }`}
                    >
                      {staffRoleFilter === 'admin'
                        ? '✓ Active'
                        : `(${allStaffUsers.filter((u) => normalizeRole(u.role) === 'admin' && !isFullAccessAdmin(u, users)).length})`}
                    </span>
                  </div>
                  <p className="hidden sm:block text-[11px] text-slate-600 mt-1 leading-relaxed font-medium">
                    Admin controls &amp; approvals (more than Staff), scoped to pages for their assigned Store Team(s).
                  </p>
                  <span className="hidden sm:inline-block mt-2 text-[10px] font-bold text-orange-800">
                    {staffRoleFilter === 'admin' ? '• Click to reset' : '• Click to filter'}
                  </span>
                </div>
              </button>

              {/* Staff Access Filter Card */}
              <button
                type="button"
                onClick={() => setStaffRoleFilter((prev) => (prev === 'worker' ? 'all' : 'worker'))}
                className={`p-3.5 rounded-2xl flex items-start gap-3 text-left transition-all cursor-pointer ${
                  staffRoleFilter === 'worker'
                    ? 'bg-sky-50/90 border-2 border-sky-500 shadow-md ring-2 ring-sky-400/25'
                    : 'bg-white hover:bg-sky-50/50 border border-slate-200 hover:border-sky-300 shadow-xs'
                }`}
                title="Click to filter by Staff"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    staffRoleFilter === 'worker'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-sky-100 border border-sky-200 text-sky-700'
                  }`}
                >
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-sky-950 uppercase tracking-wider">
                      Staff Access
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                        staffRoleFilter === 'worker'
                          ? 'bg-sky-600 text-white'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {staffRoleFilter === 'worker'
                        ? '✓ Active'
                        : `(${allStaffUsers.filter((u) => u.role === 'worker' || u.requestedRole === 'worker').length})`}
                    </span>
                  </div>
                  <p className="hidden sm:block text-[11px] text-slate-600 mt-1 leading-relaxed font-medium">
                    Count stock, create orders &amp; submit requests for Admin approval, scoped to assigned Store Team(s).
                  </p>
                  <span className="hidden sm:inline-block mt-2 text-[10px] font-bold text-sky-700">
                    {staffRoleFilter === 'worker' ? '• Click to reset' : '• Click to filter'}
                  </span>
                </div>
              </button>

              {/* Scout Leader Read-Only Access Filter Card */}
              <button
                type="button"
                onClick={() => setStaffRoleFilter((prev) => (prev === 'leader' ? 'all' : 'leader'))}
                className={`p-3.5 rounded-2xl flex items-start gap-3 text-left transition-all cursor-pointer ${
                  staffRoleFilter === 'leader'
                    ? 'bg-emerald-50/90 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-400/25'
                    : 'bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 shadow-xs'
                }`}
                title="Click to filter by Scout Leader"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    staffRoleFilter === 'leader'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-100 border border-emerald-200 text-emerald-700'
                  }`}
                >
                  <Eye className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                      Leader View
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                        staffRoleFilter === 'leader'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {staffRoleFilter === 'leader'
                        ? '✓ Active'
                        : `(${allStaffUsers.filter((u) => u.role === 'leader' || u.requestedRole === 'leader').length})`}
                    </span>
                  </div>
                  <p className="hidden sm:block text-[11px] text-slate-600 mt-1 leading-relaxed font-medium">
                    Strict read-only access to browse the uniform catalog and prices only.
                  </p>
                  <span className="hidden sm:inline-block mt-2 text-[10px] font-bold text-emerald-700">
                    {staffRoleFilter === 'leader' ? '• Click to reset' : '• Click to filter'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Staff Accounts List */}
          <div className="space-y-3">
            {filteredStaffUsers.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">
                  {staffRoleFilter !== 'all'
                    ? `No ${
                        staffRoleFilter === 'full_admin'
                          ? 'Full-Access Admin'
                          : staffRoleFilter === 'admin'
                          ? 'Team-Scoped Admin'
                          : staffRoleFilter === 'worker'
                          ? 'Staff'
                          : 'Scout Leader'
                      } accounts match this selection`
                    : staffStatusFilter === 'pending'
                    ? 'No pending account approvals'
                    : 'No staff accounts match this filter'}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {staffRoleFilter !== 'all'
                    ? 'Try clearing the role filter or changing the status filter above.'
                    : staffStatusFilter === 'pending'
                    ? 'All user registration requests have been reviewed and approved.'
                    : 'Add staff members directly or have workers register from the login screen.'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {staffRoleFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setStaffRoleFilter('all')}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
                    >
                      Show All Roles
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCreateUserModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create Account Now</span>
                  </button>
                </div>
              </div>
            ) : (
              filteredStaffUsers.map((user) => {
                const isCurrentUser =
                  currentUser &&
                  (user.id === currentUser.id ||
                    user.email.toLowerCase() === currentUser.email.toLowerCase());
                const isPending = user.status === 'pending';
                const isActive = user.status === 'active';
                const isRejected = user.status === 'rejected';

                return (
                  <div
                    key={user.id}
                    className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isCurrentUser
                        ? 'border-amber-300 bg-amber-50/30 ring-1 ring-amber-400/30'
                        : isPending
                        ? 'border-amber-400 ring-1 ring-amber-400/20'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* User details */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm"
                        style={{ backgroundColor: user.avatarColor || (isCurrentUser ? '#d97706' : '#0284c7') }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900">{user.name}</h4>
                          {isCurrentUser && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 border border-slate-700 shadow-xs">
                              You (Current Account)
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isFullAccessAdmin(user, users) || normalizeRole(user.requestedRole) === 'full_admin'
                                ? 'bg-amber-500/15 text-amber-950 border-amber-400'
                                : normalizeRole(user.role) === 'admin' || normalizeRole(user.requestedRole) === 'admin'
                                ? 'bg-orange-50 text-orange-900 border-orange-300'
                                : user.role === 'leader' || user.requestedRole === 'leader'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-sky-50 text-sky-800 border-sky-300'
                            }`}
                          >
                            {isFullAccessAdmin(user, users) || normalizeRole(user.requestedRole) === 'full_admin'
                              ? 'Full-Access Admin'
                              : normalizeRole(user.role) === 'admin' || normalizeRole(user.requestedRole) === 'admin'
                              ? 'Admin (Team-Scoped)'
                              : user.role === 'leader' || user.requestedRole === 'leader'
                              ? 'Scout Leader'
                              : 'Staff'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Registered: {new Date(user.createdAt || Date.now()).toLocaleDateString()}
                        </div>
                        {(() => {
                          const userTeams = Array.isArray(user.assignedTeams) ? user.assignedTeams : [];
                          const userF2 = Array.isArray(user.assignedFare2) ? user.assignedFare2 : [];
                          const userIsFullAdmin = isFullAccessAdmin(user, users);
                          const isUnassignedRegularAdmin =
                            normalizeRole(user.role) === 'admin' && !userIsFullAdmin && userTeams.length === 0;
                          if (
                            userTeams.length === 0 &&
                            userF2.length === 0 &&
                            !userIsFullAdmin &&
                            !isUnassignedRegularAdmin
                          ) {
                            return null;
                          }
                          return (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {userIsFullAdmin && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border bg-amber-50 text-amber-900 border-amber-300">
                                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                                  <span>All Pages Unlocked</span>
                                </span>
                              )}
                              {isUnassignedRegularAdmin && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border bg-orange-50 text-orange-900 border-orange-300">
                                  <ShieldAlert className="w-3 h-3 text-orange-600" />
                                  <span>No Team Assigned (Catalog Only)</span>
                                </span>
                              )}
                              {userTeams.map((tid) => {
                                const tm = STORE_TEAMS.find((t) => t.id === tid);
                                if (!tm) return null;
                                return (
                                  <span
                                    key={tid}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${tm.chipClass}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${tm.dotClass}`} />
                                    <span>{tm.shortLabel}</span>
                                  </span>
                                );
                              })}
                              {userF2.map((fid) => {
                                const fm = getScoutFare2Meta(fid);
                                if (!fm) return null;
                                return (
                                  <span
                                    key={fid}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${fm.chipClass}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${fm.dotClass}`} />
                                    <span>{fm.label}</span>
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Actions / Status */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {isCurrentUser ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {onUpdateUserRole && user.role !== 'full_admin' && isFullAccessAdmin(user, users) && (
                            <button
                              type="button"
                              onClick={() => onUpdateUserRole(user.id, 'full_admin')}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black shadow-2xs transition-colors"
                              title="Explicitly lock your account as Full-Access Admin"
                            >
                              Confirm Full-Access Admin
                            </button>
                          )}
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>Logged In (Current User)</span>
                          </span>
                          {(onUpdateUserTeams || onUpdateUserRole) && (
                            <button
                              type="button"
                              onClick={() => openEditAccountModal(user)}
                              className="p-2 text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-colors shadow-2xs"
                              title="Edit Role, Store Teams & Scout Fera2"
                            >
                              <Edit3 className="w-4 h-4 text-amber-600" />
                            </button>
                          )}
                        </div>
                      ) : isPending ? (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => onApproveUser(user.id)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
                          >
                            <Check className="w-4 h-4 stroke-[2.5]" />
                            <span>Approve Account</span>
                          </button>
                          <button
                            onClick={() => onRejectUser(user.id)}
                            className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors min-h-[40px]"
                          >
                            <X className="w-4 h-4" />
                            <span>Decline</span>
                          </button>
                        </div>
                      ) : isActive ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Active & Approved</span>
                          </span>
                          {(onUpdateUserRole || onUpdateUserTeams) && (
                            <button
                              type="button"
                              onClick={() => openEditAccountModal(user)}
                              className="p-2 text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-colors shadow-2xs"
                              title="Edit Account Role & Team Assignments"
                            >
                              <Edit3 className="w-4 h-4 text-amber-600" />
                            </button>
                          )}
                          {onDeleteUser && (
                            <button
                              onClick={() => setUserToDelete(user)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors"
                              title="Delete Account (Admin Only)"
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold">
                            <X className="w-3.5 h-3.5 text-rose-600" />
                            <span>Declined</span>
                          </span>
                          {(onUpdateUserRole || onUpdateUserTeams) && (
                            <button
                              type="button"
                              onClick={() => openEditAccountModal(user)}
                              className="p-2 text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-colors shadow-2xs"
                              title="Edit Account Role & Team Assignments"
                            >
                              <Edit3 className="w-4 h-4 text-amber-600" />
                            </button>
                          )}
                          {onDeleteUser && (
                            <button
                              onClick={() => setUserToDelete(user)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: NEW ITEM SUBMISSIONS AWAITING ADMIN APPROVAL */}
      {mode !== 'accounts' && activeTab === 'items' && (
        <div className="space-y-4">
          {/* Header Policy Banner */}
          <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl flex items-start gap-3">
            <Package className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 font-medium space-y-1">
              <div className="font-bold text-slate-900 text-sm">
                Staff Item Submissions ({pendingProducts.length} Pending Review)
              </div>
              <p className="text-slate-600 leading-relaxed">
                When staff add new apparel or products with sizes & initial quantities, they wait here. Review the sizes, quantities, and thresholds, then click <strong>Approve & Publish to Catalog</strong> to make the item active in the live inventory catalog.
              </p>
            </div>
          </div>

          {/* Pending Products List */}
          {pendingProducts.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <Package className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">
                No items awaiting approval
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All staff product submissions have been reviewed and published. When staff add new items, they will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-white border-2 border-amber-300/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 transition-all hover:border-amber-400"
                >
                  {/* Item Summary Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-inner">
                        {prod.image || (prod.images && prod.images[0]) ? (
                          <img
                            src={prod.image || prod.images![0]}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Package className="w-7 h-7" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-black font-mono text-slate-500 uppercase tracking-wider">
                            SKU: {prod.sku}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Pending Admin Review
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {prod.category || 'Unassigned'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            {prod.targetAudience || 'Unisex'}
                          </span>
                        </div>

                        <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                          {prod.name}
                        </h3>

                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>
                            Submitted by:{' '}
                            <strong className="text-slate-800">
                              {prod.createdByName || 'Staff'}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>{new Date(prod.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 sm:self-center shrink-0">
                      {onRejectProduct && (
                        <button
                          type="button"
                          onClick={() => onRejectProduct(prod.id)}
                          className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs border border-slate-200 hover:border-rose-300 transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                        >
                          <X className="w-4 h-4 text-rose-600" />
                          <span>Decline</span>
                        </button>
                      )}

                      {onApproveProduct && (
                        <button
                          type="button"
                          onClick={() => onApproveProduct(prod.id)}
                          className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 min-h-[40px]"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Approve & Publish to Catalog</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Variant Stock Matrix Preview */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Configured Variants ({prod.variants.length})
                      </span>
                      <span className="text-xs font-black font-mono text-slate-900">
                        Total Stock: {prod.totalQuantity} units
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {prod.variants.map((v) => (
                        <div
                          key={v.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-bold text-slate-900 truncate">
                              Size {v.size}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                              {v.colorHex && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-slate-300 inline-block shrink-0"
                                  style={{ backgroundColor: v.colorHex }}
                                />
                              )}
                              <span>{v.colorName || 'Standard'}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-black font-mono text-slate-900">
                              {v.quantity} units
                            </div>
                            {v.minThreshold !== undefined && v.minThreshold !== null && (
                              <div className="text-[10px] text-amber-700 font-semibold">
                                alert ≤ {v.minThreshold}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Add Staff Account</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    No Approval Needed
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Create an active staff or admin account directly with immediate sign-in authorization.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCreateError('');
                if (!newUserName.trim()) {
                  setCreateError('Please enter full name');
                  return;
                }
                if (!newUserEmail.trim()) {
                  setCreateError('Please enter email address');
                  return;
                }
                if (!newUserPassword || newUserPassword.length < 4) {
                  setCreateError('Password must be at least 4 characters');
                  return;
                }

                setIsSubmittingNewUser(true);
                if (onCreateUserDirectly) {
                  const res = await onCreateUserDirectly({
                    name: newUserName,
                    email: newUserEmail,
                    password: newUserPassword,
                    role: newUserRole,
                    assignedTeams: newUserRole === 'leader' ? [] : newUserTeams,
                  });
                  if (res && res.success === false) {
                    setCreateError(res.error || 'Failed to create user');
                    setIsSubmittingNewUser(false);
                    return;
                  }
                }
                setIsSubmittingNewUser(false);
                setShowCreateUserModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  FULL NAME *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. Myriam Joseph"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  EMAIL ADDRESS *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="enter your email"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  PASSWORD *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Role Choice */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  SYSTEM ROLE &amp; PAGE ACCESS:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewUserRole('worker')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      newUserRole === 'worker'
                        ? 'border-sky-500 bg-sky-50 text-sky-950 font-bold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-sky-600" />
                      <span>Staff</span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 mt-1">
                      Team-scoped pages, requests &amp; orders
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewUserRole('admin')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      newUserRole === 'admin'
                        ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-orange-600" />
                      <span>Admin (Team-Scoped)</span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 mt-1">
                      Approvals &amp; admin controls for assigned team(s)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewUserRole('full_admin')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      newUserRole === 'full_admin'
                        ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      <span>Full-Access Admin</span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 mt-1">
                      All pages + full admin approvals
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewUserRole('leader')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      newUserRole === 'leader'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Scout Leader</span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 mt-1">
                      Read-only catalog &amp; prices
                    </div>
                  </button>
                </div>
              </div>

              {newUserRole !== 'leader' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      ASSIGN STORE TEAMS {newUserRole === 'full_admin' ? '(OPTIONAL)' : '(CONTROLS VISIBLE PAGES)'}:
                    </label>
                    {newUserTeams.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewUserTeams([])}
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {STORE_TEAMS.map((team) => {
                      const active = newUserTeams.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() =>
                            setNewUserTeams((prev) =>
                              prev.includes(team.id)
                                ? prev.filter((id) => id !== team.id)
                                : [...prev, team.id]
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between gap-1 transition-colors cursor-pointer ${
                            active ? team.activeButtonClass : team.chipClass
                          }`}
                        >
                          <span className="truncate">{team.shortLabel}</span>
                          {active && <Check className="w-3 h-3 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewUser}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 min-h-[42px]"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Create Active Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Staff User Account Deletion */}
      <ConfirmDeleteModal
        isOpen={!!userToDelete}
        title="Delete Staff Account"
        itemTitle={userToDelete?.name}
        message={`Are you sure you want to delete the account for "${userToDelete?.name}" (${userToDelete?.email})?`}
        details="This staff member will be permanently removed and will no longer be able to log in or submit stock adjustments."
        confirmLabel="Yes, Delete"
        cancelLabel="No, Cancel"
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />

      {/* Yellow Edit Modal: Edit Account Role & Store Team / Scout Fera2 Assignments */}
      {userToEditRole && (() => {
        const isEditingCurrentUser =
          currentUser &&
          (userToEditRole.id === currentUser.id ||
            userToEditRole.email.toLowerCase() === currentUser.email.toLowerCase());
        const hasTroopsTeam = newSelectedTeams.includes('troops');

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Edit Account Role &amp; Teams
                    </h3>
                    <p className="text-xs text-slate-500 font-medium truncate max-w-[280px]">
                      {userToEditRole.name} • {userToEditRole.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUserToEditRole(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Section 1: System Role */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Assign System Role &amp; Permissions:
                  </label>
                  {isEditingCurrentUser && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      Current Admin Locked
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={Boolean(isEditingCurrentUser)}
                    onClick={() => setNewSelectedRole('worker')}
                    className={`p-3 rounded-xl border-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      newSelectedRole === 'worker'
                        ? 'border-sky-500 bg-sky-50/70 text-sky-950 ring-2 ring-sky-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-sky-600" />
                      <span>Staff</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Submit stock edits &amp; orders for Admin approval; sees team pages only.
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(isEditingCurrentUser && userToEditRole.role === 'full_admin')}
                    onClick={() => setNewSelectedRole('admin')}
                    className={`p-3 rounded-xl border-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      newSelectedRole === 'admin'
                        ? 'border-orange-500 bg-orange-50/70 text-orange-950 ring-2 ring-orange-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-orange-600" />
                      <span>Admin (Team-Scoped)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Approvals &amp; admin controls (more than Staff), strictly for assigned team pages.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewSelectedRole('full_admin')}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      newSelectedRole === 'full_admin'
                        ? 'border-amber-500 bg-amber-50/80 text-amber-950 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      <span>Full-Access Admin</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Full Admin controls &amp; sees <strong>ALL pages</strong> across the store.
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(isEditingCurrentUser)}
                    onClick={() => setNewSelectedRole('leader')}
                    className={`p-3 rounded-xl border-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      newSelectedRole === 'leader'
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Scout Leader</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Read-only view of catalog items &amp; prices only.
                    </div>
                  </button>
                </div>
              </div>

              {/* Section 2: Store Teams Assignment (6 Teams) */}
              {newSelectedRole !== 'leader' && (
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Assign Store Teams (6 Teams):
                    </label>
                    {newSelectedTeams.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewSelectedTeams([]);
                          setNewSelectedFare2([]);
                        }}
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        Clear Teams
                      </button>
                    )}
                  </div>

                  {newSelectedRole === 'full_admin' ? (
                    <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 text-[11px] text-amber-950">
                      <strong>Full-Access Admin:</strong> Always sees <strong>ALL pages</strong> across the store, even if linked to specific Store Teams below for Team Board tasks.
                    </div>
                  ) : newSelectedRole === 'admin' ? (
                    <div className="p-2.5 rounded-xl border border-orange-200 bg-orange-50/70 text-[11px] text-orange-950">
                      {newSelectedTeams.length === 0 ? (
                        <>
                          <strong>Team-Scoped Admin:</strong> No team assigned yet — only Inventory Catalog will appear until assigned to 1+ Store Team(s).
                        </>
                      ) : (
                        <>
                          <strong>Team-Scoped Admin:</strong> Has Admin controls &amp; approvals, and sees pages strictly for the selected {newSelectedTeams.length} team(s).
                        </>
                      )}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STORE_TEAMS.map((team) => {
                      const active = newSelectedTeams.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => {
                            setNewSelectedTeams((prev) => {
                              const next = prev.includes(team.id)
                                ? prev.filter((id) => id !== team.id)
                                : [...prev, team.id];
                              if (team.id === 'troops' && prev.includes('troops')) {
                                setNewSelectedFare2([]);
                              }
                              return next;
                            });
                          }}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
                            active ? team.activeButtonClass : team.chipClass
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                active ? 'bg-white' : team.dotClass
                              }`}
                            />
                            <span className="truncate">{team.shortLabel}</span>
                          </span>
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 3: Scout Fera2 Sub-Teams (Appears when Scout Fera2 is selected) */}
              {newSelectedRole !== 'leader' && hasTroopsTeam && (
                <div className="space-y-2.5 p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-emerald-950 uppercase tracking-wider block">
                      Assign Scout Fera2 (from the 6 Fera2):
                    </label>
                    {newSelectedFare2.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewSelectedFare2([])}
                        className="text-[11px] font-bold text-emerald-800 hover:underline"
                      >
                        Clear Fera2
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SCOUT_FERA2_LIST.map((f) => {
                      const active = newSelectedFare2.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setNewSelectedFare2((prev) =>
                              prev.includes(f.id)
                                ? prev.filter((id) => id !== f.id)
                                : [...prev, f.id]
                            );
                          }}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
                            active ? f.activeButtonClass : f.chipClass
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                active ? 'bg-white' : f.dotClass
                              }`}
                            />
                            <span className="truncate">{f.label}</span>
                          </span>
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditConfirmModal(false);
                    setUserToEditRole(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdatingRole}
                  onClick={() => {
                    if (!userToEditRole) return;
                    const effectiveRole = isEditingCurrentUser
                      ? newSelectedRole === 'full_admin' || newSelectedRole === 'admin'
                        ? newSelectedRole
                        : userToEditRole.role
                      : newSelectedRole;
                    const roleChanged = effectiveRole !== userToEditRole.role;
                    const finalTeams = effectiveRole === 'leader' ? [] : newSelectedTeams;
                    const finalFare2 =
                      effectiveRole !== 'leader' && finalTeams.includes('troops')
                        ? newSelectedFare2
                        : [];

                    const teamsChanged =
                      originalEditTeams.length !== finalTeams.length ||
                      originalEditTeams.some((id) => !finalTeams.includes(id));
                    const fare2Changed =
                      originalEditFare2.length !== finalFare2.length ||
                      originalEditFare2.some((id) => !finalFare2.includes(id));

                    if (!roleChanged && !teamsChanged && !fare2Changed) {
                      setUserToEditRole(null);
                      return;
                    }
                    setShowEditConfirmModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs flex items-center gap-1.5 min-h-[40px] transition-all"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isUpdatingRole ? 'Saving...' : 'Save Account Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Modal for Account Role / Team / Scout Fera2 Changes (Green Yes / Red No) */}
      {userToEditRole && showEditConfirmModal && (() => {
        const isEditingCurrentUser =
          currentUser &&
          (userToEditRole.id === currentUser.id ||
            userToEditRole.email.toLowerCase() === currentUser.email.toLowerCase());
        const effectiveRole = isEditingCurrentUser
          ? newSelectedRole === 'full_admin' || newSelectedRole === 'admin'
            ? newSelectedRole
            : userToEditRole.role
          : newSelectedRole;
        const roleChanged = effectiveRole !== userToEditRole.role;

        const finalTeams: StoreTeamId[] = effectiveRole === 'leader' ? [] : newSelectedTeams;
        const finalFare2: string[] =
          effectiveRole !== 'leader' && finalTeams.includes('troops') ? newSelectedFare2 : [];

        const addedTeams = finalTeams.filter((id) => !originalEditTeams.includes(id));
        const removedTeams = originalEditTeams.filter((id) => !finalTeams.includes(id));
        const keptTeams = originalEditTeams.filter((id) => finalTeams.includes(id));
        const teamsChanged = addedTeams.length > 0 || removedTeams.length > 0;

        const addedFare2 = finalFare2.filter((id) => !originalEditFare2.includes(id));
        const removedFare2 = originalEditFare2.filter((id) => !finalFare2.includes(id));
        const fare2Changed = addedFare2.length > 0 || removedFare2.length > 0;

        const getTeamObj = (id: StoreTeamId) => STORE_TEAMS.find((t) => t.id === id);
        const formatTeamLabels = (ids: StoreTeamId[]) =>
          ids
            .map((id) => getTeamObj(id)?.label || id)
            .join(', ');
        const formatFare2Labels = (ids: string[]) =>
          ids
            .map((id) => getScoutFare2Meta(id)?.label || id)
            .join(', ');

        const handleConfirmAccountChanges = async () => {
          setIsUpdatingRole(true);
          try {
            if (onUpdateUserRole && roleChanged) {
              await onUpdateUserRole(userToEditRole.id, effectiveRole);
            }
            if (onUpdateUserTeams) {
              await onUpdateUserTeams(userToEditRole.id, finalTeams, finalFare2);
            }
            setShowEditConfirmModal(false);
            setUserToEditRole(null);
          } finally {
            setIsUpdatingRole(false);
          }
        };

        return (
          <div className="fixed inset-0 z-[130] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <h3 className="text-base font-black text-slate-900">
                    Confirm Account Changes
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditConfirmModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
                {/* 1. System Role Change Summary */}
                {roleChanged && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900">
                      Are you sure you want to change{' '}
                      <span className="text-blue-700">{userToEditRole.name}</span> from{' '}
                      <span className="underline decoration-slate-300 underline-offset-2">
                        {getRoleDisplayName(userToEditRole.role)}
                      </span>{' '}
                      to{' '}
                      <span className="underline decoration-slate-300 underline-offset-2">
                        {getRoleDisplayName(effectiveRole)}
                      </span>
                      ?
                    </p>
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${getRoleBadgeClass(
                          userToEditRole.role
                        )}`}
                      >
                        {getRoleDisplayName(userToEditRole.role)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${getRoleBadgeClass(
                          effectiveRole
                        )}`}
                      >
                        {getRoleDisplayName(effectiveRole)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Store Teams Change Summary */}
                {teamsChanged && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900">
                      {originalEditTeams.length > 0 &&
                      removedTeams.length === 0 &&
                      addedTeams.length > 0 ? (
                        <>
                          Are you sure you want to add{' '}
                          <span className="text-blue-700">{userToEditRole.name}</span> to{' '}
                          <span className="underline decoration-slate-300 underline-offset-2">
                            {formatTeamLabels(addedTeams)}
                          </span>
                          ?
                        </>
                      ) : originalEditTeams.length === 0 && addedTeams.length > 0 ? (
                        <>
                          Are you sure you want to add{' '}
                          <span className="text-blue-700">{userToEditRole.name}</span> to{' '}
                          <span className="underline decoration-slate-300 underline-offset-2">
                            {formatTeamLabels(addedTeams)}
                          </span>
                          ?
                        </>
                      ) : finalTeams.length === 0 ? (
                        <>
                          Are you sure you want to remove{' '}
                          <span className="text-blue-700">{userToEditRole.name}</span> from{' '}
                          <span className="underline decoration-slate-300 underline-offset-2">
                            {formatTeamLabels(originalEditTeams)}
                          </span>
                          ?
                        </>
                      ) : (
                        <>
                          Are you sure you want to change{' '}
                          <span className="text-blue-700">{userToEditRole.name}</span> from{' '}
                          <span className="underline decoration-slate-300 underline-offset-2">
                            {formatTeamLabels(originalEditTeams)}
                          </span>{' '}
                          to{' '}
                          <span className="underline decoration-slate-300 underline-offset-2">
                            {formatTeamLabels(finalTeams)}
                          </span>
                          ?
                        </>
                      )}
                    </p>

                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                      {originalEditTeams.length > 0 &&
                      removedTeams.length === 0 &&
                      addedTeams.length > 0 ? (
                        <>
                          <div className="text-xs font-bold text-amber-900">
                            {userToEditRole.name} is already assigned to{' '}
                            {formatTeamLabels(keptTeams)}. Adding them to{' '}
                            {formatTeamLabels(addedTeams)} means they will now be in{' '}
                            <span className="font-black">{finalTeams.length} teams</span>.
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {keptTeams.map((id) => {
                              const tm = getTeamObj(id);
                              if (!tm) return null;
                              return (
                                <span
                                  key={id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${tm.chipClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${tm.dotClass}`} />
                                  {tm.shortLabel}
                                </span>
                              );
                            })}
                            <span className="text-xs font-black text-amber-700">+</span>
                            {addedTeams.map((id) => {
                              const tm = getTeamObj(id);
                              if (!tm) return null;
                              return (
                                <span
                                  key={id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${tm.chipClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${tm.dotClass}`} />
                                  {tm.shortLabel}
                                </span>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {originalEditTeams.length > 0 ? (
                            originalEditTeams.map((id) => {
                              const tm = getTeamObj(id);
                              if (!tm) return null;
                              return (
                                <span
                                  key={id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${tm.chipClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${tm.dotClass}`} />
                                  {tm.shortLabel}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[11px] font-bold text-slate-500">No team</span>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                          {finalTeams.length > 0 ? (
                            finalTeams.map((id) => {
                              const tm = getTeamObj(id);
                              if (!tm) return null;
                              return (
                                <span
                                  key={id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${tm.chipClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${tm.dotClass}`} />
                                  {tm.shortLabel}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[11px] font-bold text-rose-700">No teams</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Scout Fera2 Change Summary */}
                {fare2Changed && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900">
                      {originalEditFare2.length > 0 && finalFare2.length > 0 ? (
                        <>
                          Are you sure you want to change Scout Fera2 for{' '}
                          <span className="text-blue-700">{userToEditRole.name}</span> from{' '}
                          <span className="underline decoration-slate-300 underline-offset-2">
                            {formatFare2Labels(originalEditFare2)}
                          </span>{' '}
                          to{' '}
                          <span className="underline decoration-slate-300 underline-offset-2">
                            {formatFare2Labels(finalFare2)}
                          </span>
                          ?
                        </>
                      ) : finalFare2.length > 0 ? (
                        <>
                          Are you sure you want to assign{' '}
                          <span className="text-blue-700">{userToEditRole.name}</span> to Scout
                          Fera2:{' '}
                          <span className="underline decoration-slate-300 underline-offset-2">
                            {formatFare2Labels(finalFare2)}
                          </span>
                          ?
                        </>
                      ) : (
                        <>
                          Are you sure you want to remove Scout Fera2 (
                          <span className="underline decoration-slate-300 underline-offset-2">
                            {formatFare2Labels(originalEditFare2)}
                          </span>
                          ) from <span className="text-blue-700">{userToEditRole.name}</span>?
                        </>
                      )}
                    </p>
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center gap-1.5">
                      {originalEditFare2.length > 0 ? (
                        originalEditFare2.map((fid) => {
                          const fm = getScoutFare2Meta(fid);
                          if (!fm) return null;
                          return (
                            <span
                              key={fid}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${fm.chipClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${fm.dotClass}`} />
                              {fm.label}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500">None</span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
                      {finalFare2.length > 0 ? (
                        finalFare2.map((fid) => {
                          const fm = getScoutFare2Meta(fid);
                          if (!fm) return null;
                          return (
                            <span
                              key={fid}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${fm.chipClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${fm.dotClass}`} />
                              {fm.label}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[11px] font-bold text-rose-700">None</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isUpdatingRole}
                    onClick={() => setShowEditConfirmModal(false)}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs transition-colors"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    disabled={isUpdatingRole}
                    onClick={handleConfirmAccountChanges}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-colors"
                  >
                    {isUpdatingRole ? 'Saving...' : 'Yes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
