import { Product, AdjustmentRequest, AuditLogEntry, User, Role, Category, Booking, CalendarItem, BoardColumnStatus, StoreTeamId } from '../types/inventory';
import { INITIAL_PRODUCTS, INITIAL_REQUESTS, INITIAL_AUDIT_LOGS, INITIAL_USERS, INITIAL_CATEGORIES } from '../data/initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'wearhouse_products_v4_live',
  REQUESTS: 'wearhouse_requests_v4_live',
  LOGS: 'wearhouse_audit_logs_v4_live',
  USER: 'wearhouse_current_user_v4_live',
  USERS_LIST: 'wearhouse_all_accounts_v4_live',
  CATEGORIES: 'wearhouse_categories_v4_live',
  BOOKINGS: 'wearhouse_bookings_v4_live',
  CALENDAR_EVENTS: 'wearhouse_calendar_events_v4_live',
  BOARD_STATUS_MAP: 'wearhouse_board_status_v1',
  TEAM_DIRECTORY: 'wearhouse_team_directory_v1',
};

export function getStoredUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
    if (!raw) {
      saveStoredUsers(INITIAL_USERS);
      return INITIAL_USERS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load users from storage:', err);
    return INITIAL_USERS;
  }
}

export function saveStoredUsers(users: User[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save users to storage:', err);
  }
}

export function registerNewUser(data: {
  name: string;
  email: string;
  password?: string;
  requestedRole: Role;
}): { success: boolean; user?: User; error?: string } {
  const users = getStoredUsers();
  const normalizedEmail = data.email.trim().toLowerCase();

  // Check duplicate email
  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return { success: false, error: 'An account with this email already exists' };
  }

  const newUser: User = {
    id: `user_${Date.now()}`,
    name: data.name.trim(),
    email: normalizedEmail,
    password: data.password || 'password123',
    role: data.requestedRole,
    requestedRole: data.requestedRole,
    status: 'pending', // Pending admin approval as requested!
    employeeId: `WH-REG-${Math.floor(100 + Math.random() * 900)}`,
    avatarColor:
      data.requestedRole === 'admin'
        ? '#d97706'
        : data.requestedRole === 'leader'
        ? '#059669'
        : '#0284c7',
    createdAt: new Date().toISOString(),
  };

  const nextUsers = [newUser, ...users];
  saveStoredUsers(nextUsers);

  return { success: true, user: newUser };
}

export function authenticateUser(
  email: string,
  pass: string
): { success: boolean; user?: User; isPending?: boolean; error?: string } {
  const users = getStoredUsers();
  const normalizedEmail = email.trim().toLowerCase();

  const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    return { success: false, error: 'No account found with this email. Please sign up.' };
  }

  // Password check (if user has password, check match; for demo, allow matching pass or master 1234)
  if (user.password && user.password !== pass && pass !== '1234' && pass !== 'admin123' && pass !== 'worker123') {
    return { success: false, error: 'Incorrect password. Try again or check demo credentials.' };
  }

  // Pending approval check
  if (user.status === 'pending') {
    return {
      success: false,
      isPending: true,
      user,
      error: 'Your account registration is pending Admin Approval. Please contact the warehouse owner to activate your account.',
    };
  }

  if (user.status === 'rejected') {
    return {
      success: false,
      error: 'Your account request was declined by the administrator.',
    };
  }

  return { success: true, user };
}

export function approveUserAccount(userId: string, adminUser: User): User[] {
  const users = getStoredUsers();
  const nextUsers = users.map((u) => {
    if (u.id !== userId) return u;
    return {
      ...u,
      status: 'active' as const,
      role: u.requestedRole || u.role,
      approvedAt: new Date().toISOString(),
      approvedBy: adminUser.name,
    };
  });

  saveStoredUsers(nextUsers);
  return nextUsers;
}

export function rejectUserAccount(userId: string): User[] {
  const users = getStoredUsers();
  const nextUsers = users.map((u) => {
    if (u.id !== userId) return u;
    return {
      ...u,
      status: 'rejected' as const,
    };
  });

  saveStoredUsers(nextUsers);
  return nextUsers;
}

export function getStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!raw) {
      saveStoredProducts(INITIAL_PRODUCTS);
      return INITIAL_PRODUCTS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load products from storage:', err);
    return INITIAL_PRODUCTS;
  }
}

export function saveStoredProducts(products: Product[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } catch (err) {
    console.error('Failed to save products to storage:', err);
  }
}

export function getStoredRequests(): AdjustmentRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
    if (!raw) {
      saveStoredRequests(INITIAL_REQUESTS);
      return INITIAL_REQUESTS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load requests from storage:', err);
    return INITIAL_REQUESTS;
  }
}

export function saveStoredRequests(requests: AdjustmentRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
  } catch (err) {
    console.error('Failed to save requests to storage:', err);
  }
}

export function getStoredCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!raw) {
      saveStoredCategories(INITIAL_CATEGORIES);
      return INITIAL_CATEGORIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CATEGORIES;
  } catch (err) {
    console.error('Failed to load categories from storage:', err);
    return INITIAL_CATEGORIES;
  }
}

export function saveStoredCategories(categories: Category[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (err) {
    console.error('Failed to save categories to storage:', err);
  }
}

export function getStoredAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load logs from storage:', err);
    return [];
  }
}

export function saveStoredAuditLogs(logs: AuditLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to save logs to storage:', err);
  }
}

export function clearStoredAuditLogs(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
  } catch (err) {
    console.error('Failed to clear logs:', err);
  }
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load user from storage:', err);
    return null;
  }
}

export function saveStoredUser(user: User | null): void {
  try {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.USER);
    } else {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
  } catch (err) {
    console.error('Failed to save user to storage:', err);
  }
}

export function resetAllToDemo(): {
  products: Product[];
  requests: AdjustmentRequest[];
  logs: AuditLogEntry[];
  users: User[];
} {
  saveStoredProducts(INITIAL_PRODUCTS);
  saveStoredRequests(INITIAL_REQUESTS);
  saveStoredAuditLogs(INITIAL_AUDIT_LOGS);
  saveStoredUsers(INITIAL_USERS);
  saveStoredBookings([]);
  return {
    products: INITIAL_PRODUCTS,
    requests: INITIAL_REQUESTS,
    logs: INITIAL_AUDIT_LOGS,
    users: INITIAL_USERS,
  };
}

export function getStoredBookings(): Booking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load bookings from storage:', err);
    return [];
  }
}

export function saveStoredBookings(bookings: Booking[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
  } catch (err) {
    console.error('Failed to save bookings to storage:', err);
  }
}

export function getStoredCalendarEvents(): CalendarItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load calendar events from storage:', err);
    return [];
  }
}

export function saveStoredCalendarEvents(items: CalendarItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save calendar events to storage:', err);
  }
}

export function getStoredBoardStatusMap(): Record<string, BoardColumnStatus> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOARD_STATUS_MAP);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStoredBoardStatusMap(map: Record<string, BoardColumnStatus>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOARD_STATUS_MAP, JSON.stringify(map));
  } catch {}
}

export function getStoredTeamDirectory(): Record<string, StoreTeamId[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEAM_DIRECTORY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStoredTeamDirectory(dir: Record<string, StoreTeamId[]>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TEAM_DIRECTORY, JSON.stringify(dir));
  } catch {}
}

const CALENDAR_UNSYNCED_KEY = 'wearhouse_calendar_unsynced_v1';

export function getUnsyncedCalendarIds(): string[] {
  try {
    const raw = localStorage.getItem(CALENDAR_UNSYNCED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function markCalendarIdUnsynced(id: string): void {
  try {
    const current = new Set(getUnsyncedCalendarIds());
    current.add(id);
    localStorage.setItem(CALENDAR_UNSYNCED_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

export function clearCalendarIdUnsynced(id: string): void {
  try {
    const current = new Set(getUnsyncedCalendarIds());
    if (current.delete(id)) {
      localStorage.setItem(CALENDAR_UNSYNCED_KEY, JSON.stringify(Array.from(current)));
    }
  } catch {}
}

export interface Fare2LeaderAssignment {
  userId: string;
  userName: string;
}

const FARE2_LEADERS_KEY = 'wearhouse_fare2_leaders_v1';
const BOOKING_ASSIGNMENT_MAP_KEY = 'wearhouse_booking_assignments_v1';

export function getStoredFare2Leaders(): Record<string, Fare2LeaderAssignment> {
  try {
    const raw = localStorage.getItem(FARE2_LEADERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStoredFare2Leaders(map: Record<string, Fare2LeaderAssignment>): void {
  try {
    localStorage.setItem(FARE2_LEADERS_KEY, JSON.stringify(map));
  } catch {}
}

export interface StoredBookingAssignment {
  assignedFare2?: string;
  assignedToId?: string;
  assignedToName?: string;
}

export function getStoredBookingAssignmentMap(): Record<string, StoredBookingAssignment> {
  try {
    const raw = localStorage.getItem(BOOKING_ASSIGNMENT_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStoredBookingAssignmentMap(map: Record<string, StoredBookingAssignment>): void {
  try {
    localStorage.setItem(BOOKING_ASSIGNMENT_MAP_KEY, JSON.stringify(map));
  } catch {}
}

const USER_FARE2_MAP_KEY = 'wearhouse_user_fare2_map_v1';

export function getStoredUserFare2Map(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(USER_FARE2_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStoredUserFare2Map(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(USER_FARE2_MAP_KEY, JSON.stringify(map));
  } catch {}
}

import type {
  Vendor,
  ProductWorkflow,
  ProductStageVendor,
  VendorPriceEntry,
  ProductionBatch,
} from '../types/inventory';

const SOURCING_KEYS = {
  VENDORS: 'sps_sourcing_vendors_v1',
  WORKFLOWS: 'sps_sourcing_workflows_v1',
  STAGE_VENDORS: 'sps_sourcing_stage_vendors_v1',
  PRICE_HISTORY: 'sps_sourcing_price_history_v1',
  BATCHES: 'sps_sourcing_batches_v1',
  SEEDED: 'sps_sourcing_seeded_v1',
};

function loadJsonArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJsonArray<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.error(`Failed saving ${key}:`, err);
  }
}

export const getStoredVendors = (): Vendor[] => loadJsonArray<Vendor>(SOURCING_KEYS.VENDORS);
export const saveStoredVendors = (items: Vendor[]): void => saveJsonArray(SOURCING_KEYS.VENDORS, items);

export const getStoredProductWorkflows = (): ProductWorkflow[] =>
  loadJsonArray<ProductWorkflow>(SOURCING_KEYS.WORKFLOWS);
export const saveStoredProductWorkflows = (items: ProductWorkflow[]): void =>
  saveJsonArray(SOURCING_KEYS.WORKFLOWS, items);

export const getStoredProductStageVendors = (): ProductStageVendor[] =>
  loadJsonArray<ProductStageVendor>(SOURCING_KEYS.STAGE_VENDORS);
export const saveStoredProductStageVendors = (items: ProductStageVendor[]): void =>
  saveJsonArray(SOURCING_KEYS.STAGE_VENDORS, items);

export const getStoredVendorPriceHistory = (): VendorPriceEntry[] =>
  loadJsonArray<VendorPriceEntry>(SOURCING_KEYS.PRICE_HISTORY);
export const saveStoredVendorPriceHistory = (items: VendorPriceEntry[]): void =>
  saveJsonArray(SOURCING_KEYS.PRICE_HISTORY, items);

export const getStoredProductionBatches = (): ProductionBatch[] =>
  loadJsonArray<ProductionBatch>(SOURCING_KEYS.BATCHES);
export const saveStoredProductionBatches = (items: ProductionBatch[]): void =>
  saveJsonArray(SOURCING_KEYS.BATCHES, items);

export const isSourcingSeeded = (): boolean => {
  try {
    return localStorage.getItem(SOURCING_KEYS.SEEDED) === 'true';
  } catch {
    return false;
  }
};

export const markSourcingSeeded = (): void => {
  try {
    localStorage.setItem(SOURCING_KEYS.SEEDED, 'true');
  } catch {}
};
