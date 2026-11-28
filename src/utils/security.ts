/**
 * Role & permission helpers for the UI. These only decide what to SHOW. The database (RLS) is
 * what actually enforces access.
 */

import type { CalendarItem, Role, StoreTeamId, User } from '../types/inventory';

export const VALID_STORE_TEAM_IDS: StoreTeamId[] = [
  'purchases',
  'troops',
  'inventory',
  'calendar',
  'marketing',
  'budgeting',
];

const SYNTHETIC_EMAIL_SUFFIX = '@noemail.sps.local';

export function isSyntheticNoEmail(email?: string | null): boolean {
  return Boolean(email && email.trim().toLowerCase().endsWith(SYNTHETIC_EMAIL_SUFFIX));
}

export function getPublicUserEmail(email?: string | null): string | undefined {
  const clean = (email || '').trim().toLowerCase();
  if (!clean || isSyntheticNoEmail(clean)) return undefined;
  return clean;
}

export function buildSyntheticNoEmail(
  username?: string | null,
  phone?: string | null,
  fallbackId?: string
): string {
  const rawPart =
    normalizeUsername(username) ||
    normalizePhoneNumber(phone).replace(/[^a-zA-Z0-9]/g, '') ||
    (fallbackId ? fallbackId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) : '') ||
    String(Date.now());
  const safeSlug = rawPart.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 32) || 'user';
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${safeSlug}.${suffix}${SYNTHETIC_EMAIL_SUFFIX}`;
}

export function normalizeUsername(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function normalizePhoneNumber(raw?: string | null): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return '';
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0020') && digits.length >= 13) {
    return `0${digits.slice(4)}`;
  }
  if (digits.startsWith('20') && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  return cleaned.startsWith('+') ? `+${digits}` : digits;
}

export function getPhoneSearchVariants(raw?: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  const compact = trimmed.replace(/[\s\-().]/g, '');
  const digits = compact.replace(/\D/g, '');
  const set = new Set<string>();
  if (trimmed) set.add(trimmed);
  if (compact) set.add(compact);
  if (digits) {
    set.add(digits);
    set.add(`+${digits}`);
    if (digits.startsWith('00') && digits.length > 4) {
      set.add(digits.slice(2));
      set.add(`+${digits.slice(2)}`);
    }
    if (digits.startsWith('01') && digits.length === 11) {
      set.add(`20${digits.slice(1)}`);
      set.add(`+20${digits.slice(1)}`);
      set.add(`0020${digits.slice(1)}`);
    }
    if (digits.startsWith('201') && digits.length === 12) {
      set.add(`0${digits.slice(2)}`);
      set.add(`+${digits}`);
      set.add(`00${digits}`);
    }
    if (digits.startsWith('00201') && digits.length === 14) {
      set.add(`0${digits.slice(4)}`);
      set.add(digits.slice(2));
      set.add(`+${digits.slice(2)}`);
    }
  }
  return Array.from(set).filter((v) => v.length >= 4);
}

/**
 * Normalize raw role strings from DB into strict Role union
 */
export function normalizeRole(raw?: string | null): Role {
  const val = String(raw || '').trim().toLowerCase();
  if (
    val === 'full_admin' ||
    val === 'full-admin' ||
    val.includes('full_admin') ||
    val.includes('full access') ||
    val.includes('full-access')
  ) {
    return 'full_admin';
  }
  if (val === 'admin' || val.includes('admin')) return 'admin';
  if (val === 'leader' || val.includes('leader')) return 'leader';
  return 'worker';
}

export function isUserAdmin(user?: { role?: string; requestedRole?: string } | null): boolean {
  if (!user) return false;
  const role = String(user.role || '').trim().toLowerCase();
  const req = String(user.requestedRole || '').trim().toLowerCase();
  return (
    role === 'full_admin' ||
    role === 'admin' ||
    role.includes('admin') ||
    req === 'full_admin' ||
    req === 'admin' ||
    req.includes('admin')
  );
}

export function isUserLeader(user?: { role?: string; requestedRole?: string } | null): boolean {
  if (!user || isUserAdmin(user)) return false;
  const role = String(user.role || '').trim().toLowerCase();
  const req = String(user.requestedRole || '').trim().toLowerCase();
  return role === 'leader' || role.includes('leader') || req === 'leader' || req.includes('leader');
}

export function isUserStaff(user?: { role?: string; requestedRole?: string } | null): boolean {
  if (!user) return false;
  return !isUserAdmin(user) && !isUserLeader(user);
}

export function getUserAssignedTeams(
  user?: Pick<User, 'id' | 'assignedTeams'> | null
): StoreTeamId[] {
  if (!user) return [];
  return Array.isArray(user.assignedTeams) ? user.assignedTeams : [];
}

export function isExplicitFullAdmin(user?: User | null): boolean {
  if (!user || !isUserAdmin(user)) return false;
  const normRole = normalizeRole(user.role);
  const normReq = normalizeRole(user.requestedRole);
  return normRole === 'full_admin' || normReq === 'full_admin';
}

/**
 * Full-Access Admins see ALL pages across the store regardless of team assignments.
 * Regular Admins ('admin') and Staff ('worker') see pages strictly according to their assigned team(s).
 * Includes bootstrap safety when database has no explicit 'full_admin' yet.
 */
export function isFullAccessAdmin(user?: User | null, _allUsers?: User[]): boolean {
  // Only an explicit full_admin role from the database counts. (The old "no full_admin exists yet,
  // so any admin without teams is promoted" shortcut was removed: the first full_admin is created
  // with the SQL helper in the migration.) The real protection is RLS in the database.
  return isExplicitFullAdmin(user);
}

export function getEffectiveUserRole(user?: User | null, allUsers?: User[]): Role {
  if (!user) return 'worker';
  if (isUserLeader(user)) return 'leader';
  if (isFullAccessAdmin(user, allUsers)) return 'full_admin';
  if (isUserAdmin(user)) return 'admin';
  return 'worker';
}

const ALL_ADMIN_VIEWS = [
  'inventory',
  'bookings',
  'calendar',
  'board',
  'sourcing',
  'marketing',
  'budgeting',
  'analytics',
  'stock-approvals',
  'account-approvals',
  'add-product',
  'audit-log',
] as const;

export function getAllowedViewsForUser(user?: User | null, allUsers?: User[]): Set<string> {
  if (!user) return new Set();
  if (isUserLeader(user)) {
    return new Set(['inventory']);
  }
  if (isFullAccessAdmin(user, allUsers)) {
    return new Set<string>(ALL_ADMIN_VIEWS);
  }

  const isAdmin = isUserAdmin(user);
  const teams = getUserAssignedTeams(user);
  const allowed = new Set<string>(['inventory']);

  if (teams.length === 0) {
    if (!isAdmin) {
      allowed.add('worker-requests');
    }
    return allowed;
  }

  teams.forEach((team) => {
    switch (team) {
      case 'purchases':
        allowed.add('calendar');
        allowed.add('board');
        allowed.add('sourcing');
        break;
      case 'troops':
        allowed.add('bookings');
        allowed.add('calendar');
        allowed.add('board');
        break;
      case 'inventory':
        allowed.add('calendar');
        allowed.add('board');
        allowed.add('stock-approvals');
        allowed.add('add-product');
        break;
      case 'calendar':
        allowed.add('calendar');
        allowed.add('board');
        break;
      case 'marketing':
        allowed.add('calendar');
        allowed.add('board');
        allowed.add('marketing');
        break;
      case 'budgeting':
        allowed.add('bookings');
        allowed.add('calendar');
        allowed.add('board');
        allowed.add('analytics');
        allowed.add('budgeting');
        break;
      default:
        break;
    }
  });

  return allowed;
}

export function canUserAccessView(
  user: User | null | undefined,
  viewId: string,
  allUsers?: User[]
): boolean {
  if (!user) return false;
  return getAllowedViewsForUser(user, allUsers).has(viewId);
}

export function isUserMarketingMember(
  user?: Pick<User, 'id' | 'assignedTeams'> | null
): boolean {
  if (!user) return false;
  return getUserAssignedTeams(user).includes('marketing');
}

export function canEditProductMediaAndColors(user?: User | null): boolean {
  if (!user || isUserLeader(user)) return false;
  return isUserAdmin(user) || isUserMarketingMember(user);
}

export function getCalendarItemTeams(
  item?: Pick<CalendarItem, 'team' | 'teams' | 'isAllTeams'> | null
): { isAllTeams: boolean; teams: StoreTeamId[] } {
  if (!item) return { isAllTeams: false, teams: [] };
  if (item.isAllTeams || (item.team as unknown as string) === 'all') {
    return { isAllTeams: true, teams: [] };
  }
  const list: StoreTeamId[] = [];
  if (Array.isArray(item.teams)) {
    item.teams.forEach((t) => {
      if (VALID_STORE_TEAM_IDS.includes(t) && !list.includes(t)) {
        list.push(t);
      }
    });
  }
  if (item.team && VALID_STORE_TEAM_IDS.includes(item.team) && !list.includes(item.team)) {
    list.push(item.team);
  }
  return { isAllTeams: false, teams: list };
}

export function canUserSeeCalendarItem(
  user: User | null | undefined,
  item: Pick<CalendarItem, 'team' | 'teams' | 'isAllTeams' | 'createdById' | 'assignedToId'>,
  allUsers?: User[]
): boolean {
  if (!user) return false;
  if (isFullAccessAdmin(user, allUsers)) return true;

  const { isAllTeams, teams } = getCalendarItemTeams(item);
  if (isAllTeams) return true;

  const myTeams = getUserAssignedTeams(user);
  if (teams.length === 0) {
    return (
      myTeams.includes('calendar') ||
      item.createdById === user.id ||
      item.assignedToId === user.id
    );
  }

  return teams.some((t) => myTeams.includes(t));
}

/**
 * Orders (Client Bookings) belong to the Scout Fera2 team (team id 'troops').
 * - Who can START or EDIT an order: full_admin, or a member of Scout Fera2 (staff send a request,
 *   the team_admin of Scout Fera2 or a full_admin approves).
 * - Budgeting (and everybody else) can only LOOK at orders.
 */
export function canUserEditBookings(
  user?: User | null,
  allUsers?: User[]
): boolean {
  if (!user || isUserLeader(user)) return false;
  if (isFullAccessAdmin(user, allUsers)) return true;
  const t = getUserAssignedTeams(user);
  return t.includes('troops') || t.includes('budgeting'); // may send order / payment requests
}

/**
 * Who confirms a deposit / full payment (this is also the step that takes stock for the order):
 * full_admin, the team_admin of Scout Fera2 ('troops'), or the team_admin of Budgeting.
 * Staff only send a request.
 */
export function canUserConfirmPayments(
  user?: User | null,
  allUsers?: User[]
): boolean {
  if (!user || isUserLeader(user)) return false;
  if (isFullAccessAdmin(user, allUsers)) return true;
  if (!isUserAdmin(user)) return false;
  if (Array.isArray(user.adminTeams)) {
    return user.adminTeams.includes('troops') || user.adminTeams.includes('budgeting');
  }
  const teams = getUserAssignedTeams(user);
  return teams.includes('troops') || teams.includes('budgeting');
}

/**
 * Who can create / edit / delete an order directly (no request):
 * full_admin, or the team_admin of Scout Fera2 ('troops'). Same people approve staff requests.
 */
export function canUserManageOrders(
  user?: User | null,
  allUsers?: User[]
): boolean {
  if (!user || isUserLeader(user)) return false;
  if (isFullAccessAdmin(user, allUsers)) return true;
  if (!isUserAdmin(user)) return false;
  if (Array.isArray(user.adminTeams)) return user.adminTeams.includes('troops');
  return getUserAssignedTeams(user).includes('troops');
}

export function canUserManageTeamScope(
  user: User | null | undefined,
  teamScope: StoreTeamId,
  allUsers?: User[]
): boolean {
  if (!user || !isUserAdmin(user)) return false;
  if (isFullAccessAdmin(user, allUsers)) return true;
  // user_teams decides: team_admin only for the teams where this person has that role.
  if (Array.isArray(user.adminTeams)) return user.adminTeams.includes(teamScope);
  return getUserAssignedTeams(user).includes(teamScope);
}

export function getRoleDisplayName(role?: Role | string): string {
  const norm = normalizeRole(role);
  if (norm === 'full_admin') return 'Full-Access Admin';
  if (norm === 'admin') return 'Admin';
  if (norm === 'leader') return 'Scout Leader (Read-Only)';
  return 'Warehouse Staff';
}
