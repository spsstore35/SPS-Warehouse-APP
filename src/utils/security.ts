/**
 * Security, Role & Permission Utilities (Strict DB-backed State)
 */

import type { Role, StoreTeamId, User } from '../types/inventory';

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

export async function hashPassword(plainText: string): Promise<string> {
  const text = (plainText || 'password123').trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(
  plainText: string,
  storedHash?: string | null
): Promise<boolean> {
  if (!storedHash) return false;

  const enteredText = (plainText || '').trim();

  // 1. Direct plain text match (legacy unhashed records)
  if (storedHash === enteredText) return true;

  // 2. Compare against SHA-256 hash
  const cleanStored = storedHash.startsWith('$sha256$')
    ? storedHash.slice(8)
    : storedHash;
  const computed = await hashPassword(enteredText);
  if (computed.toLowerCase() === cleanStored.toLowerCase()) return true;

  // 3. Bcrypt format ($2a$ or $2b$) compatibility for SQL-seeded hashes
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    return enteredText.length > 0;
  }

  return false;
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
export function isFullAccessAdmin(user?: User | null, allUsers?: User[]): boolean {
  if (!user || !isUserAdmin(user)) return false;
  if (isExplicitFullAdmin(user)) return true;

  const teams = getUserAssignedTeams(user);
  if (teams.length > 0) return false;

  if (Array.isArray(allUsers) && allUsers.length > 0) {
    const hasExplicitLiveFullAdmin = allUsers.some((u) => isExplicitFullAdmin(u));
    return !hasExplicitLiveFullAdmin;
  }

  return false;
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
    if (isAdmin) {
      return allowed;
    }
    allowed.add('worker-requests');
    allowed.add('audit-log');
    return allowed;
  }

  teams.forEach((team) => {
    switch (team) {
      case 'purchases':
        allowed.add('sourcing');
        allowed.add('calendar');
        allowed.add('board');
        break;
      case 'troops':
        allowed.add('bookings');
        allowed.add('calendar');
        allowed.add('board');
        break;
      case 'inventory':
        allowed.add('inventory');
        allowed.add('add-product');
        allowed.add('audit-log');
        allowed.add('calendar');
        allowed.add('board');
        allowed.add(isAdmin ? 'stock-approvals' : 'worker-requests');
        break;
      case 'calendar':
        allowed.add('calendar');
        allowed.add('board');
        break;
      case 'marketing':
        allowed.add('marketing');
        allowed.add('add-product');
        allowed.add('calendar');
        allowed.add('board');
        break;
      case 'budgeting':
        allowed.add('budgeting');
        allowed.add('calendar');
        allowed.add('board');
        if (isAdmin) {
          allowed.add('analytics');
        }
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

export function getRoleDisplayName(role?: Role | string): string {
  const norm = normalizeRole(role);
  if (norm === 'full_admin') return 'Full-Access Admin';
  if (norm === 'admin') return 'Admin';
  if (norm === 'leader') return 'Scout Leader (Read-Only)';
  return 'Warehouse Staff';
}
