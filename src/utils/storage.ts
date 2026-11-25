import { User } from '../types/inventory';

const USER_SESSION_KEY = 'wearhouse_current_user_v4_live';

const LEGACY_ENTITY_CACHE_KEYS = [
  'wearhouse_products_v4_live',
  'wearhouse_requests_v4_live',
  'wearhouse_audit_logs_v4_live',
  'wearhouse_all_accounts_v4_live',
  'wearhouse_categories_v4_live',
  'wearhouse_bookings_v4_live',
  'wearhouse_calendar_events_v4_live',
  'wearhouse_board_status_v1',
  'wearhouse_team_directory_v1',
  'wearhouse_calendar_unsynced_v1',
  'wearhouse_fare2_leaders_v1',
  'wearhouse_booking_assignments_v1',
  'wearhouse_user_fare2_map_v1',
  'sps_sourcing_vendors_v1',
  'sps_sourcing_workflows_v1',
  'sps_sourcing_stage_vendors_v1',
  'sps_sourcing_price_history_v1',
  'sps_sourcing_batches_v1',
  'sps_sourcing_seeded_v1',
  'sps_marketing_offers_v1',
  'sps_booking_stock_check_map_v1',
  'sps_budget_profiles_v1',
  'sps_budget_expenses_v1',
  'sps_budget_settings_v1',
  'sps_scout_seasons_v1',
  'sps_full_access_admins_v1',
  'sps_others_folders',
  'sps_others_deleted_folders',
];

export function clearLegacyLocalEntityCaches(): void {
  try {
    LEGACY_ENTITY_CACHE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch (err) {
    console.warn('Notice clearing legacy local entity caches:', err);
  }
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load session user from storage:', err);
    return null;
  }
}

export function saveStoredUser(user: User | null): void {
  try {
    if (!user) {
      localStorage.removeItem(USER_SESSION_KEY);
    } else {
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
    }
  } catch (err) {
    console.error('Failed to save session user to storage:', err);
  }
}
