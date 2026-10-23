import { useState, useEffect, useCallback } from 'react';
import {
  MenuItem,
  MenuCategory,
  SystemSettings,
  RestaurantTable,
  OrderRound,
  Bill,
  DiningSession,
  OrderItemKitchenStatus,
  OrderStatus,
  PaymentMethod,
  StaffUser
} from '../types/index.ts';

const TOKEN_KEY = 'hqc_staff_token';
const USER_KEY = 'hqc_staff_user';

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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  // Public
  getMenu: () => request<{ settings: SystemSettings; categories: MenuCategory[]; menuItems: MenuItem[] }>('/api/menu'),
  getTable: (tableId: string) => request<{ table: RestaurantTable; activeSession: DiningSession | null }>(`/api/tables/${tableId}`),
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
  }) => request<{ success: boolean; order: OrderRound; bill: Bill; message: string }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getTableVerification: (tableId: string, token?: string) =>
    request<{ table: RestaurantTable; isTokenValid: boolean; hasTokenConfigured: boolean; activeSession: any }>(
      `/api/tables/${tableId}${token ? `?token=${encodeURIComponent(token)}` : ''}`
    ),
  getOrder: (id: string) => request<OrderRound>(`/api/orders/${id}`),
  getSession: (id: string) => request<{ session: DiningSession; rounds: OrderRound[]; bill: Bill | null }>(`/api/session/${id}`),
  getTableOrders: (tableId: string) => request<{ session: DiningSession | null; rounds: OrderRound[]; bill: Bill | null }>(`/api/tables/${tableId}/orders`),

  // Auth
  login: (credential: string) => request<{ success: boolean; token: string; user: StaffUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ credential })
  }),
  getDemoStaffAccounts: () => request<StaffUser[]>('/api/auth/staff-accounts'),
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
  removeDiscount: (billId: string) => request<{ success: boolean; bill: Bill }>(`/api/counter/bills/${billId}/discount`, {
    method: 'DELETE'
  }),
  recordPayment: (billId: string, payment: { method: PaymentMethod; amount: number; reference?: string }) =>
    request<{ success: boolean; bill: Bill; payment: any; message: string }>(`/api/counter/bills/${billId}/payment`, {
      method: 'POST',
      body: JSON.stringify(payment)
    }),
  closeSession: (sessionId: string) => request<{ success: boolean; session: DiningSession; message: string }>(`/api/counter/sessions/${sessionId}/close`, {
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
  deleteMenuItem: (id: string) => request<{ success: boolean; message: string }>(`/api/admin/menu/${id}`, {
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
  deleteAdminTable: (id: string) => request<{ success: boolean; message: string }>(`/api/admin/tables/${id}`, {
    method: 'DELETE'
  }),
  regenerateTableToken: (tableId: string) => request<{ success: boolean; table: RestaurantTable }>(`/api/admin/tables/${tableId}/regenerate-token`, {
    method: 'POST'
  }),
  regenerateAllTableTokens: () => request<{ success: boolean; tables: RestaurantTable[] }>('/api/admin/tables/regenerate-all-tokens', {
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
  deleteAdminStaff: (id: string) => request<{ success: boolean; message: string }>(`/api/admin/staff/${id}`, {
    method: 'DELETE'
  }),

  getReports: () => request<{
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

/**
 * Hook to listen to real-time events via Server-Sent Events (SSE)
 */
export function useRealTimeEvents(onEvent?: (event: string, data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      try {
        eventSource = new EventSource('/api/events');

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        const eventNames = [
          'order_created',
          'item_status_updated',
          'order_status_updated',
          'bill_updated',
          'payment_recorded',
          'table_closed',
          'table_moved',
          'menu_updated',
          'menu_availability_changed',
          'menu_item_deleted'
        ];

        eventNames.forEach(name => {
          eventSource?.addEventListener(name, (e: MessageEvent) => {
            try {
              const data = JSON.parse(e.data);
              onEvent?.(name, data);
            } catch (err) {
              console.error('Failed to parse SSE payload', err);
            }
          });
        });

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource?.close();
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [onEvent]);

  return { isConnected };
}
