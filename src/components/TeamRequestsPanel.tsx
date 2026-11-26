import React, { useMemo, useState } from 'react';
import { Check, X, Clock, ShieldCheck, MessageSquare, ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import { StoreTeamId, TeamChangeRequest, User } from '../types/inventory';
import { canUserManageTeamScope, getUserAssignedTeams, isFullAccessAdmin, isUserAdmin } from '../utils/security';

interface TeamRequestsPanelProps {
  currentUser: User;
  users?: User[];
  teamScopes: StoreTeamId[];
  requests: TeamChangeRequest[];
  onApproveRequest: (req: TeamChangeRequest, adminNote?: string) => void;
  onRejectRequest: (req: TeamChangeRequest, adminNote?: string) => void;
  title?: string;
}

const TEAM_LABELS: Record<StoreTeamId, string> = {
  purchases: 'Purchases & Sourcing',
  troops: 'Teams & Delivery',
  inventory: 'Inventory',
  calendar: 'Calendar & Tasks',
  marketing: 'Marketing & Offers',
  budgeting: 'Budgeting & Liquidity',
};

export const TeamRequestsPanel: React.FC<TeamRequestsPanelProps> = ({
  currentUser,
  users = [],
  teamScopes,
  requests,
  onApproveRequest,
  onRejectRequest,
  title,
}) => {
  const isAdmin = isUserAdmin(currentUser);
  const fullAdmin = isFullAccessAdmin(currentUser, users);
  const myTeams = getUserAssignedTeams(currentUser);

  const [expanded, setExpanded] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const relevantRequests = useMemo(() => {
    const scopeSet = new Set(teamScopes);
    return requests.filter((r) => {
      if (!scopeSet.has(r.teamScope)) return false;
      if (fullAdmin) return true;
      if (isAdmin) {
        return myTeams.includes(r.teamScope) || canUserManageTeamScope(currentUser, r.teamScope, users);
      }
      // Staff see their own submitted requests + team requests they submitted
      return r.requestedById === currentUser.id || myTeams.includes(r.teamScope);
    });
  }, [requests, teamScopes, fullAdmin, isAdmin, myTeams, currentUser, users]);

  const pendingList = useMemo(
    () => relevantRequests.filter((r) => r.status === 'pending'),
    [relevantRequests]
  );

  const historyList = useMemo(
    () => relevantRequests.filter((r) => r.status !== 'pending').slice(0, 10),
    [relevantRequests]
  );

  // Nothing to show if no requests at all for this section
  if (relevantRequests.length === 0) return null;

  const canReviewReq = (req: TeamChangeRequest) =>
    isAdmin && (fullAdmin || canUserManageTeamScope(currentUser, req.teamScope, users));

  return (
    <div
      className={`rounded-2xl border shadow-xs overflow-hidden transition-all ${
        pendingList.length > 0
          ? isAdmin
            ? 'bg-amber-50/70 border-amber-300'
            : 'bg-sky-50/70 border-sky-200'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-white/80 border-b border-slate-200/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              pendingList.length > 0
                ? isAdmin
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <Inbox className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                {title || (isAdmin ? 'Staff Change Requests Queue' : 'My Team Change Requests')}
              </h3>
              {pendingList.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                    isAdmin ? 'bg-amber-500 text-slate-950' : 'bg-sky-600 text-white'
                  }`}
                >
                  {pendingList.length} pending
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {isAdmin
                ? 'Review additions, edits, or deletions requested by team staff before applying.'
                : 'Staff requests stay pending until a Team Admin or Full Admin approves them.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {historyList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((p) => !p)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-600 transition-colors"
            >
              {showHistory ? 'Hide History' : `History (${historyList.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-3 sm:p-4 space-y-2.5">
          {pendingList.length === 0 && !showHistory && (
            <div className="text-xs text-slate-500 font-medium py-1">
              No pending requests right now. Click &ldquo;History&rdquo; to view past decisions.
            </div>
          )}

          {pendingList.map((req) => {
            const canAct = canReviewReq(req);
            return (
              <div
                key={req.id}
                className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${
                          req.actionType === 'delete'
                            ? 'bg-rose-100 text-rose-800'
                            : req.actionType === 'create'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {req.actionType}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {TEAM_LABELS[req.teamScope] || req.teamScope}
                      </span>
                      <span className="text-xs font-black text-slate-900 truncate">
                        {req.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{req.summary}</p>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>Requested by <strong className="text-slate-600">{req.requestedByName}</strong></span>
                      <span>•</span>
                      <span>{new Date(req.requestedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {!canAct && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      Awaiting Admin Approval
                    </span>
                  )}
                </div>

                {canAct && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={noteById[req.id] || ''}
                        onChange={(e) =>
                          setNoteById((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        placeholder="Optional admin note..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-400 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onApproveRequest(req, noteById[req.id])}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve &amp; Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectRequest(req, noteById[req.id])}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {showHistory && historyList.length > 0 && (
            <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Recent Decisions
              </div>
              {historyList.map((req) => (
                <div
                  key={req.id}
                  className="bg-slate-50 rounded-xl border border-slate-200/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 truncate">{req.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">{req.summary}</div>
                    {req.adminNote && (
                      <div className="text-[11px] text-slate-600 mt-0.5 italic">
                        Admin note: &ldquo;{req.adminNote}&rdquo;
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        req.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {req.status}
                    </span>
                    {req.reviewedByName && (
                      <span className="text-[10px] text-slate-400">by {req.reviewedByName}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
