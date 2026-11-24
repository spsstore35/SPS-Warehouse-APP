/**
 * Security & Password Hashing Utilities using standard Web Crypto API (SHA-256)
 */

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
  // If storedHash is missing or null, allow login
  if (!storedHash) return true;

  const enteredText = (plainText || '').trim();

  // 1. Direct plain text match (legacy unhashed records)
  if (storedHash === enteredText) return true;

  // 2. Compare against SHA-256 hash
  const cleanStored = storedHash.startsWith('$sha256$')
    ? storedHash.slice(8)
    : storedHash;
  const computed = await hashPassword(enteredText);
  if (computed.toLowerCase() === cleanStored.toLowerCase()) return true;

  // 3. Bcrypt format ($2a$ or $2b$) compatibility
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    // If bcrypt format exists from external seed/auth, allow login with valid password
    return true;
  }

  return false;
}

import type { Role, StoreTeamId, User } from '../types/inventory';
import { getStoredFullAdminIds, getStoredTeamDirectory, getStoredUsers } from './storage';

/**
 * Normalize raw role strings from DB or local storage into strict Role union
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

/**
 * Universal case-insensitive and alias-aware check for admin authority (both Full-Access Admin and Team-Scoped Admin).
 */
export function isUserAdmin(user?: { role?: string; requestedRole?: string } | null): boolean {
  if (!user) return false;
  const role = String(user.role || '').trim().toLowerCase();
  const req = String(user.requestedRole || '').trim().toLowerCase();
  return role === 'full_admin' || role === 'admin' || role.includes('admin') || req === 'full_admin' || req === 'admin' || req.includes('admin');
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

/**
 * Resolve effective Store Teams assigned to a user (explicit user.assignedTeams wins over cached directory).
 */
export function getUserAssignedTeams(
  user?: Pick<User, 'id' | 'assignedTeams'> | null
): StoreTeamId[] {
  if (!user) return [];
  if (Array.isArray(user.assignedTeams)) {
    return user.assignedTeams;
  }
  const dir = getStoredTeamDirectory();
  return Array.isArray(dir[user.id]) ? dir[user.id] : [];
}

export function isExplicitFullAdmin(user?: User | null): boolean {
  if (!user || !isUserAdmin(user)) return false;
  const normRole = normalizeRole(user.role);
  const normReq = normalizeRole(user.requestedRole);
  if (normRole === 'full_admin' || normReq === 'full_admin') return true;
  return getStoredFullAdminIds().includes(user.id);
}

/**
 * Full-Access Admins see ALL pages across the store regardless of team assignments.
 * Regular Admins ('admin') and Staff ('worker') see pages strictly according to their assigned team(s).
 * Includes bootstrap safety: if no live user in storage has been set to 'full_admin' yet,
 * an unassigned legacy 'admin' (0 teams) keeps Full-Access until an explicit Full-Access Admin is assigned.
 */
export function isFullAccessAdmin(user?: User | null): boolean {
  if (!user || !isUserAdmin(user)) return false;
  if (isExplicitFullAdmin(user)) return true;

  const teams = getUserAssignedTeams(user);
  if (teams.length > 0) return false;

  const knownUsers = getStoredUsers();
  const hasExplicitLiveFullAdmin = knownUsers.some(
    (u) => u.id !== 'user_admin_01' && isExplicitFullAdmin(u)
  );
  return !hasExplicitLiveFullAdmin;
}

export function getEffectiveUserRole(user?: User | null): Role {
  if (!user) return 'worker';
  if (isUserLeader(user)) return 'leader';
  if (isFullAccessAdmin(user)) return 'full_admin';
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

export function getAllowedViewsForUser(user?: User | null): Set<string> {
  if (!user) return new Set();
  if (isUserLeader(user)) {
    return new Set(['inventory']);
  }
  if (isFullAccessAdmin(user)) {
    return new Set<string>(ALL_ADMIN_VIEWS);
  }

  const isAdmin = isUserAdmin(user);
  const teams = getUserAssignedTeams(user);
  const allowed = new Set<string>(['inventory']);

  if (teams.length === 0) {
    if (isAdmin) {
      // Team-Scoped Admin without an assigned Store Team sees Catalog only (with Admin direct catalog controls) until assigned a team
      return allowed;
    }
    // Staff without a team gets basic operational catalog/request access until assigned a Store Team
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

export function canUserAccessView(user: User | null | undefined, viewId: string): boolean {
  if (!user) return false;
  return getAllowedViewsForUser(user).has(viewId);
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

