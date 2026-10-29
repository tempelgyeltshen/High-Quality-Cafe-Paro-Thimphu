import { useState, useEffect, useRef } from 'react';
import {
  MenuItem,
  MenuCategory,
  SystemSettings,
  RestaurantTable,
  OrderRound,
  Bill,
  DiningSession,
  OrderHistoryRecord,
  OrderHistorySummary,
  OrderItemKitchenStatus,
  OrderStatus,
  PaymentMethod,
  StaffUser
} from '../types/index.ts';

const TOKEN_KEY = 'hqc_staff_token';
const USER_KEY = 'hqc_staff_user';
const ANON_ORDER_TOKENS_KEY = 'hqc_anon_tracking_tokens';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StaffUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: StaffUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Privacy-preserving local order tracking keys:
 * Stores ONLY random cryptographic trk_... tokens on this browser — zero personal identity.
 */
export function getStoredAnonymousOrderTokens(): string[] {
  const raw = localStorage.getItem(ANON_ORDER_TOKENS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === 'string' && t.startsWith('trk_')).slice(0, 20);
  } catch {
    return [];
  }
}

export function saveAnonymousOrderToken(trackingToken?: string | null): string[] {
  if (!trackingToken || !trackingToken.startsWith('trk_')) {
    return getStoredAnonymousOrderTokens();
  }
  const existing = getStoredAnonymousOrderTokens();
  const updated = [trackingToken, ...existing.filter(t => t !== trackingToken)].slice(0, 20);
  localStorage.setItem(ANON_ORDER_TOKENS_KEY, JSON.stringify(updated));
  return updated;
}

export function clearAnonymousOrderTokens(): void {
  localStorage.removeItem(ANON_ORDER_TOKENS_KEY);
}

export async function downloadProtectedCsv(endpoint: string, fallbackFilename: string): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fallbackFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

interface RequestOptions extends RequestInit {
  skipStaffAuth?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { skipStaffAuth = false, ...fetchOptions } = options;
  const token = skipStaffAuth ? null : getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...fetchOptions,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  // ==========================================
  // ISOLATED GUEST-ONLY ENDPOINTS (Zero Staff Privileges)
  // ==========================================
  getGuestMenu: () =>
    request<{ settings: SystemSettings; categories: MenuCategory[]; menuItems: MenuItem[] }>('/api/menu', {
      skipStaffAuth: true
    }),

  getTableVerification: (tableId: string, token?: string) =>
    request<{
      table: RestaurantTable;
      isTokenValid: boolean;
      hasTokenConfigured: boolean;
      activeSession: DiningSession | null;
    }>(`/api/tables/${encodeURIComponent(tableId)}${token ? `?token=${encodeURIComponent(token)}` : ''}`, {
      skipStaffAuth: true
    }),

  getGuestTableOrders: (tableId: string, token: string) =>
    request<{ session: DiningSession | null; rounds: OrderRound[]; bill: Bill | null }>(
      `/api/tables/${encodeURIComponent(tableId)}/orders?token=${encodeURIComponent(token)}`,
      { skipStaffAuth: true }
    ),

  createGuestOrder: (payload: {
    tableId?: string;
    tableToken?: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      selectedCustomizations?: Array<{ groupId: string; optionId: string }>;
      specialInstructions?: string;
    }>;
    customerNote?: string;
    idempotencyKey?: string;
  }) =>
    request<{ success: boolean; order: OrderRound; trackingToken?: string; bill: Bill; message: string }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipStaffAuth: true
    }),

  trackAnonymousOrders: (tokens: string[]) =>
    request<{ orders: OrderRound[] }>('/api/orders/track', {
      method: 'POST',
      body: JSON.stringify({ tokens }),
      skipStaffAuth: true
    }),

  // ==========================================
  // GENERAL / STAFF-AWARE ENDPOINTS
  // ==========================================
  getMenu: () =>
    request<{ settings: SystemSettings; categories: MenuCategory[]; menuItems: MenuItem[] }>('/api/menu'),

  getTable: (tableId: string, token?: string) =>
    request<{ table: RestaurantTable; activeSession: DiningSession | null }>(
      `/api/tables/${encodeURIComponent(tableId)}${token ? `?token=${encodeURIComponent(token)}` : ''}`
    ),

  createOrder: (payload: {
    tableId: string;
    tableToken?: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      selectedCustomizations?: Array<{ groupId: string; optionId: string }>;
      specialInstructions?: string;
    }>;
    customerNote?: string;
    idempotencyKey?: string;
  }) =>
    request<{ success: boolean; order: OrderRound; bill: Bill; message: string }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getOrder: (id: string, token?: string) =>
    request<OrderRound>(`/api/orders/${encodeURIComponent(id)}${token ? `?token=${encodeURIComponent(token)}` : ''}`),

  getSession: (id: string, token?: string) =>
    request<{ session: DiningSession; rounds: OrderRound[]; bill: Bill | null }>(
      `/api/session/${encodeURIComponent(id)}${token ? `?token=${encodeURIComponent(token)}` : ''}`
    ),

  getTableOrders: (tableId: string, token?: string) =>
    request<{ session: DiningSession | null; rounds: OrderRound[]; bill: Bill | null }>(
      `/api/tables/${encodeURIComponent(tableId)}/orders${token ? `?token=${encodeURIComponent(token)}` : ''}`
    ),

  // Auth
  login: (input: string | { username?: string; pin: string }) => {
    const body = typeof input === 'string' ? { credential: input } : input;
    return request<{ success: boolean; token: string; user: StaffUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
      skipStaffAuth: true
    });
  },
  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST'
    }),
  getStaffAccounts: () => request<StaffUser[]>('/api/auth/staff-accounts'),
  getMe: () => request<StaffUser>('/api/auth/me'),

  // Kitchen
  getKitchenTickets: () => request<OrderRound[]>('/api/kitchen/tickets'),
  updateKitchenItemStatus: (orderId: string, itemId: string, status: OrderItemKitchenStatus, rejectionReason?: string) =>
    request<{ success: boolean; order: OrderRound; bill: Bill | null }>(`/api/kitchen/orders/${orderId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectionReason })
    }),
  updateOrderStatus: (orderId: string, status: OrderStatus) =>
    request<{ success: boolean; order: OrderRound }>(`/api/kitchen/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  // Counter / Cashier
  getCounterBills: () => request<{ bills: Bill[]; tables: RestaurantTable[]; orders: OrderRound[] }>('/api/counter/bills'),
  getBillDetails: (billId: string) => request<{ bill: Bill; rounds: OrderRound[] }>(`/api/counter/bills/${billId}`),
  applyDiscount: (billId: string, discount: { name: string; type: 'percentage' | 'fixed'; value: number; reason: string }) =>
    request<{ success: boolean; bill: Bill }>(`/api/counter/bills/${billId}/discount`, {
      method: 'POST',
      body: JSON.stringify(discount)
    }),
  removeDiscount: (billId: string) =>
    request<{ success: boolean; bill: Bill }>(`/api/counter/bills/${billId}/discount`, {
      method: 'DELETE'
    }),
  recordPayment: (billId: string, payment: { method: PaymentMethod; amount: number; reference?: string }) =>
    request<{ success: boolean; bill: Bill; payment: any; message: string }>(`/api/counter/bills/${billId}/payment`, {
      method: 'POST',
      body: JSON.stringify(payment)
    }),
  closeSession: (sessionId: string) =>
    request<{ success: boolean; session: DiningSession; message: string }>(`/api/counter/sessions/${sessionId}/close`, {
      method: 'POST'
    }),
  moveSession: (sessionId: string, targetTableId: string) =>
    request<{ success: boolean; session: DiningSession; message: string }>(`/api/counter/sessions/${sessionId}/move`, {
      method: 'POST',
      body: JSON.stringify({ targetTableId })
    }),
  addOrderFromCounter: (tableId: string, items: any[], note?: string) =>
    request<{ success: boolean; order: OrderRound; bill: Bill }>(`/api/counter/tables/${tableId}/add-order`, {
      method: 'POST',
      body: JSON.stringify({ items, note })
    }),

  // Admin
  saveMenuItem: (item: Partial<MenuItem>) => {
    if (item.id && !item.id.startsWith('new_')) {
      return request<{ success: boolean; item: MenuItem }>(`/api/admin/menu/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(item)
      });
    }
    return request<{ success: boolean; item: MenuItem }>('/api/admin/menu', {
      method: 'POST',
      body: JSON.stringify(item)
    });
  },
  toggleMenuItemAvailability: (id: string, isAvailable: boolean, soldOut: boolean) =>
    request<{ success: boolean; item: MenuItem }>(`/api/admin/menu/${id}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable, soldOut })
    }),
  deleteMenuItem: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/menu/${id}`, {
      method: 'DELETE'
    }),
  getTablesWithQR: () => request<Array<RestaurantTable & { qrUrl: string; qrCodeDataUrl: string }>>('/api/admin/tables-with-qr'),
  saveAdminTable: (table: Partial<RestaurantTable>) => {
    if (table.id && !table.id.startsWith('new_')) {
      return request<{ success: boolean; table: RestaurantTable }>(`/api/admin/tables/${table.id}`, {
        method: 'PUT',
        body: JSON.stringify(table)
      });
    }
    return request<{ success: boolean; table: RestaurantTable }>('/api/admin/tables', {
      method: 'POST',
      body: JSON.stringify(table)
    });
  },
  deleteAdminTable: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/tables/${id}`, {
      method: 'DELETE'
    }),
  regenerateTableToken: (tableId: string) =>
    request<{ success: boolean; table: RestaurantTable }>(`/api/admin/tables/${tableId}/regenerate-token`, {
      method: 'POST'
    }),
  regenerateAllTableTokens: () =>
    request<{ success: boolean; tables: RestaurantTable[] }>('/api/admin/tables/regenerate-all-tokens', {
      method: 'POST'
    }),

  // Staff accounts management (Admin only)
  getAdminStaff: () => request<StaffUser[]>('/api/admin/staff'),
  saveAdminStaff: (user: Partial<StaffUser>) => {
    if (user.id && !user.id.startsWith('new_')) {
      return request<{ success: boolean; user: StaffUser }>(`/api/admin/staff/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify(user)
      });
    }
    return request<{ success: boolean; user: StaffUser }>('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify(user)
    });
  },
  deleteAdminStaff: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/staff/${id}`, {
      method: 'DELETE'
    }),

  // Complete Order History (Strictly GM & Admin Only)
  getCompleteOrderHistory: (filters?: {
    status?: string;
    tableId?: string;
    search?: string;
    dateRange?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters?.tableId && filters.tableId !== 'all') params.set('tableId', filters.tableId);
    if (filters?.search?.trim()) params.set('search', filters.search.trim());
    if (filters?.dateRange && filters.dateRange !== 'all') params.set('dateRange', filters.dateRange);
    const qs = params.toString();
    return request<{ orders: OrderHistoryRecord[]; summary: OrderHistorySummary }>(
      `/api/admin/orders${qs ? `?${qs}` : ''}`
    );
  },

  updateAdminOrderStatus: (orderId: string, status: OrderStatus) =>
    request<{ success: boolean; order: OrderRound; bill: Bill | null }>(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  getReports: () =>
    request<{
      summary: {
        totalOrders: number;
        totalCollectedSales: number;
        totalOutstandingBalance: number;
        totalDiscountsGiven: number;
        paidBillsCount: number;
        openBillsCount: number;
      };
      popularDishes: Array<{ id: string; name: string; quantity: number; revenue: number }>;
      categoryBreakdown: Array<{ categoryId: string; categoryName: string; revenue: number }>;
    }>('/api/admin/reports'),
  getAuditLogs: () => request<{ generalLogs: any[]; priceLogs: any[] }>('/api/admin/audit-logs'),
  updateSettings: (updates: Partial<SystemSettings>) =>
    request<{ success: boolean; settings: SystemSettings }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),
};

export type RealTimeConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disabled';

/**
 * Scoped real-time SSE hook — strictly separates Guest / Anonymous Tracker vs. Authenticated Staff streams
 */
export function useRealTimeEvents(
  onEvent?: (event: string, data: any) => void,
  options: {
    scope: 'guest' | 'staff' | 'disabled';
    staffToken?: string | null;
    tableId?: string | null;
    tableToken?: string | null;
    trackingTokensKey?: string;
    onReconnect?: () => void;
  } = { scope: 'guest' }
) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<RealTimeConnectionState>(
    options.scope === 'disabled' ? 'disabled' : 'connecting'
  );
  const { scope, staffToken, tableId, tableToken, trackingTokensKey = '', onReconnect } = options;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    if (scope === 'disabled') {
      setIsConnected(false);
      setConnectionState('disabled');
      return;
    }
    if (scope === 'staff' && !staffToken) {
      setIsConnected(false);
      setConnectionState('disabled');
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isDisposed = false;
    let hadDisconnect = false;
    let hasConnectedOnce = false;

    setConnectionState('connecting');

    const params = new URLSearchParams();
    if (scope === 'staff' && staffToken) {
      params.set('staffToken', staffToken);
    } else if (scope === 'guest') {
      if (tableId && tableToken) {
        params.set('tableId', tableId);
        params.set('tableToken', tableToken);
      }
      if (trackingTokensKey) {
        params.set('trackingTokens', trackingTokensKey);
      }
    }
    const queryStr = params.toString();
    const url = `/api/events${queryStr ? `?${queryStr}` : ''}`;

    const scheduleReconnect = () => {
      if (isDisposed) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        if (!isDisposed) connect();
      }, 3000);
    };

    const connect = () => {
      if (isDisposed) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        hadDisconnect = true;
        setIsConnected(false);
        setConnectionState('reconnecting');
        scheduleReconnect();
        return;
      }

      try {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          if (isDisposed) return;
          setIsConnected(true);
          setConnectionState('connected');
          if (hadDisconnect && hasConnectedOnce) {
            hadDisconnect = false;
            onReconnectRef.current?.();
          } else {
            hadDisconnect = false;
          }
          hasConnectedOnce = true;
        };

        const eventNames = [
          'order_created',
          'item_status_updated',
          'order_status_updated',
          'bill_updated',
          'payment_recorded',
          'table_closed',
          'table_moved',
          'tables_updated',
          'table_deleted',
          'menu_updated',
          'menu_availability_changed',
          'menu_item_deleted',
          'settings_updated'
        ];

        eventNames.forEach(name => {
          eventSource?.addEventListener(name, (e: MessageEvent) => {
            try {
              const data = JSON.parse(e.data);
              onEventRef.current?.(name, data);
            } catch (err) {
              console.error('Failed to parse SSE payload', err);
            }
          });
        });

        eventSource.onerror = () => {
          if (isDisposed) return;
          hadDisconnect = true;
          setIsConnected(false);
          setConnectionState('reconnecting');
          eventSource?.close();
          eventSource = null;
          scheduleReconnect();
        };
      } catch {
        if (isDisposed) return;
        hadDisconnect = true;
        setIsConnected(false);
        setConnectionState('reconnecting');
        scheduleReconnect();
      }
    };

    const handleOffline = () => {
      if (isDisposed) return;
      hadDisconnect = true;
      setIsConnected(false);
      setConnectionState('reconnecting');
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    const handleOnline = () => {
      if (isDisposed) return;
      hadDisconnect = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      connect();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);
    }

    connect();

    return () => {
      isDisposed = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      }
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [scope, staffToken, tableId, tableToken, trackingTokensKey]);

  return { isConnected, connectionState };
}
