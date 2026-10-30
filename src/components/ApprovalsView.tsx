import React, { useState } from 'react';
import { AdjustmentRequest, User, Role, Product } from '../types/inventory';
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
} from 'lucide-react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface ApprovalsViewProps {
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
  onCreateUserDirectly?: (data: {
    name: string;
    email: string;
    password?: string;
    role: Role;
  }) => Promise<{ success: boolean; error?: string }> | any;
  onApproveProduct?: (productId: string) => void;
  onRejectProduct?: (productId: string, note?: string) => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
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
  onCreateUserDirectly,
  onApproveProduct,
  onRejectProduct,
}) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'staff' | 'items'>(initialTab);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'all' | 'pending' | 'active'>('all');
  const [staffRoleFilter, setStaffRoleFilter] = useState<'all' | 'worker' | 'admin'>('all');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Sync tab whenever initialTab changes from outside navigation
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Direct Create Account Without Approval Modal State
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('worker');
  const [createError, setCreateError] = useState('');
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleConfirmDeleteUser = () => {
    if (!userToDelete || !onDeleteUser) return;
    onDeleteUser(userToDelete.id);
    setUserToDelete(null);
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const filteredRequests = requests.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

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

      // Role filtering (all / worker / admin)
      if (staffRoleFilter === 'worker') {
        const isWorker = u.role === 'worker' || (u.status === 'pending' && u.requestedRole === 'worker');
        if (!isWorker) return false;
      }
      if (staffRoleFilter === 'admin') {
        const isAdmin = u.role === 'admin' || (u.status === 'pending' && u.requestedRole === 'admin');
        if (!isAdmin) return false;
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
              Warehouse Admin Approvals
            </h1>
            {(pendingRequests.length > 0 || pendingUsers.length > 0 || pendingProducts.length > 0) && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
                {pendingRequests.length + pendingUsers.length + pendingProducts.length} Action Needed
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Review and authorize staff account registrations, new item catalog additions, and physical stock adjustments.
          </p>
        </div>
      </div>

      {/* Main Switcher: Stock Adjustments vs Staff Registrations vs New Item Submissions */}
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

      {/* TAB 1: STOCK ADJUSTMENT REQUESTS */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Sub filter tabs */}
          <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full shadow-sm">
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                filter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({pendingRequests.length})
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
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-md mx-auto my-6 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No requests in this queue</h3>
              <p className="text-xs text-slate-500 mt-1">
                {filter === 'pending'
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
                    className={`bg-white border rounded-2xl p-4 sm:p-5 transition-all shadow-sm ${
                      isPending ? 'border-amber-400 ring-1 ring-amber-400/20' : 'border-slate-200'
                    }`}
                  >
                    {/* Header info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center text-xs font-bold border border-sky-200">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900">{req.workerName}</span>
                          <span className="text-[11px] text-slate-500 ml-2 font-medium">
                            {new Date(req.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
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
                              {(req.size === 'Standard' || req.size === 'One Size') &&
                              (req.colorName === 'Standard' || req.colorName === 'Default' || req.colorName === 'N/A')
                                ? 'Standard Item'
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
      {activeTab === 'staff' && (
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Floor Staff Access Filter Card */}
              <button
                type="button"
                onClick={() => setStaffRoleFilter((prev) => (prev === 'worker' ? 'all' : 'worker'))}
                className={`p-3.5 rounded-2xl flex items-start gap-3 text-left transition-all cursor-pointer ${
                  staffRoleFilter === 'worker'
                    ? 'bg-sky-50/90 border-2 border-sky-500 shadow-md ring-2 ring-sky-400/25'
                    : 'bg-white hover:bg-sky-50/50 border border-slate-200 hover:border-sky-300 shadow-xs'
                }`}
                title="Click to filter by Floor Staff"
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
                      Floor Staff Access
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                        staffRoleFilter === 'worker'
                          ? 'bg-sky-600 text-white'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {staffRoleFilter === 'worker'
                        ? '✓ Active Filter'
                        : `Staff (${allStaffUsers.filter((u) => u.role === 'worker' || u.requestedRole === 'worker').length})`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed font-medium">
                    Can browse garments, count stock, submit new garments (pending Admin approval), and submit stock adjustment requests with verification notes.
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-bold text-sky-700">
                    {staffRoleFilter === 'worker' ? '• Click to reset' : '• Click to filter staff'}
                  </span>
                </div>
              </button>

              {/* Admin Authority Access Filter Card */}
              <button
                type="button"
                onClick={() => setStaffRoleFilter((prev) => (prev === 'admin' ? 'all' : 'admin'))}
                className={`p-3.5 rounded-2xl flex items-start gap-3 text-left transition-all cursor-pointer ${
                  staffRoleFilter === 'admin'
                    ? 'bg-amber-50/90 border-2 border-amber-500 shadow-md ring-2 ring-amber-400/25'
                    : 'bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 shadow-xs'
                }`}
                title="Click to filter by Admin Authority"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    staffRoleFilter === 'admin'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-100 border border-amber-200 text-amber-800'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                      Admin Authority Access
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                        staffRoleFilter === 'admin'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {staffRoleFilter === 'admin'
                        ? '✓ Active Filter'
                        : `Admin (${allStaffUsers.filter((u) => u.role === 'admin' || u.requestedRole === 'admin').length})`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed font-medium">
                    Full warehouse control: direct stock overrides, approving or rejecting submissions, managing categories, and deleting items, sizes, or accounts.
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-bold text-amber-700">
                    {staffRoleFilter === 'admin' ? '• Click to reset' : '• Click to filter admins'}
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
                    ? `No ${staffRoleFilter === 'worker' ? 'Floor Staff' : 'Admin Authority'} accounts match this selection`
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
                              user.requestedRole === 'admin' || user.role === 'admin'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-sky-50 text-sky-800 border-sky-300'
                            }`}
                          >
                            {user.requestedRole === 'admin' || user.role === 'admin'
                              ? 'Admin Authority'
                              : 'Floor Staff'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Registered: {new Date(user.createdAt || Date.now()).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Actions / Status */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {isCurrentUser ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>Logged In (Current User)</span>
                          </span>
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
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Header Policy Banner */}
          <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl flex items-start gap-3">
            <Package className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 font-medium space-y-1">
              <div className="font-bold text-slate-900 text-sm">
                Staff Item Submissions ({pendingProducts.length} Pending Review)
              </div>
              <p className="text-slate-600 leading-relaxed">
                When floor staff add new apparel or products with sizes & initial quantities, they wait here. Review the sizes, quantities, and thresholds, then click <strong>Approve & Publish to Catalog</strong> to make the item active in the live inventory catalog.
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
                All staff product submissions have been reviewed and published. When floor staff add new items, they will appear here.
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
                              {prod.createdByName || 'Floor Staff'}
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
                  REQUESTED ROLE / POSITION:
                </label>
                <div className="grid grid-cols-2 gap-2">
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
                      <span>Warehouse Staff</span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 mt-1">
                      Count and inspect stock
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewUserRole('admin')}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      newUserRole === 'admin'
                        ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      <span>Warehouse Admin</span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 mt-1">
                      Approvals & management
                    </div>
                  </button>
                </div>
              </div>

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


    </div>
  );
};
