import { Product, AdjustmentRequest, AuditLogEntry, User, Role } from '../types/inventory';
import { INITIAL_PRODUCTS, INITIAL_REQUESTS, INITIAL_AUDIT_LOGS, INITIAL_USERS } from '../data/initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'wearhouse_products_v4_live',
  REQUESTS: 'wearhouse_requests_v4_live',
  LOGS: 'wearhouse_audit_logs_v4_live',
  USER: 'wearhouse_current_user_v4_live',
  USERS_LIST: 'wearhouse_all_accounts_v4_live',
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
    avatarColor: data.requestedRole === 'admin' ? '#d97706' : '#0284c7',
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

export function getStoredAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!raw) {
      saveStoredAuditLogs(INITIAL_AUDIT_LOGS);
      return INITIAL_AUDIT_LOGS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load logs from storage:', err);
    return INITIAL_AUDIT_LOGS;
  }
}

export function saveStoredAuditLogs(logs: AuditLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to save logs to storage:', err);
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
  return {
    products: INITIAL_PRODUCTS,
    requests: INITIAL_REQUESTS,
    logs: INITIAL_AUDIT_LOGS,
    users: INITIAL_USERS,
  };
}
