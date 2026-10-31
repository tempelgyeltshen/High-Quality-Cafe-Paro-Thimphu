import React, { useState, useEffect, useCallback } from 'react';
import {
  api,
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
  getStoredAnonymousOrderTokens,
  saveAnonymousOrderToken,
  clearAnonymousOrderTokens,
  useRealTimeEvents
} from './lib/api.ts';
import { soundService } from './lib/audio.ts';
import {
  MenuItem,
  MenuCategory,
  SystemSettings,
  RestaurantTable,
  OrderRound,
  Bill,
  StaffUser,
  OrderItemKitchenStatus,
  OrderStatus,
  PaymentMethod
} from './types/index.ts';
import { Navbar } from './components/Navbar.tsx';
import { CustomerMenu } from './components/CustomerMenu.tsx';
import { KitchenDisplay } from './components/KitchenDisplay.tsx';
import { CounterConsole } from './components/CounterConsole.tsx';
import { AdminHub } from './components/AdminHub.tsx';
import { TableQRManagement } from './components/TableQRManagement.tsx';
import { AcceptanceTestModal } from './components/AcceptanceTestModal.tsx';
import { StaffLoginView } from './components/StaffLoginView.tsx';
import { AccessDeniedView } from './components/AccessDeniedView.tsx';
import { AlertOrderNotification } from './components/KitchenOrderAlert.tsx';

type AppView = 'customer' | 'kitchen' | 'counter' | 'admin' | 'tables' | 'staff_login' | 'restricted';

const DEFAULT_SETTINGS: SystemSettings = {
  restaurantName: 'High Quality Cafe',
  tagline: 'Paro, Bhutan · Open 24/7',
  operatingHours: '24 Hours / 7 Days a Week',
  currency: 'Nu.',
  currencySymbol: 'Nu.',
  taxRate: 0.05,
  serviceChargeRate: 0.10,
  allowGuestOrdering: true,
  kitchenAudioAlert: false,
  showPricesOnCustomerMenu: true,
  address: 'High Quality Cafe, Paro Town, Paro, Bhutan',
  phone: '+975 8 271234'
};

function mergeUniqueOrders(lists: OrderRound[][]): OrderRound[] {
  const map = new Map<string, OrderRound>();
  for (const list of lists) {
    for (const order of list) {
      map.set(order.id, order);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function parseRouteFromLocation(): {
  view: AppView;
  attemptedPath: string;
  tableParam: string | null;
  tokenParam: string | null;
} {
  if (typeof window === 'undefined') {
    return { view: 'customer', attemptedPath: '/', tableParam: null, tokenParam: null };
  }

  const urlParams = new URLSearchParams(window.location.search);
  const rawTable = urlParams.get('table');
  const rawToken = urlParams.get('token');
  const tableParam = rawTable ? rawTable.trim().toUpperCase() : null;
  const tokenParam = rawToken ? rawToken.trim() : null;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  // Scanning a QR code or visiting the storefront opens ONLY the anonymous guest-facing menu
  if (tableParam || tokenParam || path === '/' || path === '/menu') {
    return {
      view: 'customer',
      attemptedPath: path,
      tableParam,
      tokenParam
    };
  }

  if (path === '/staff' || path === '/login') {
    return { view: 'staff_login', attemptedPath: path, tableParam: null, tokenParam: null };
  }
  if (path === '/kitchen') {
    return { view: 'kitchen', attemptedPath: path, tableParam: null, tokenParam: null };
  }
  if (path === '/counter') {
    return { view: 'counter', attemptedPath: path, tableParam: null, tokenParam: null };
  }
  // /admin, /orders, and /order-history route to the GM & Admin Order History Console (blocked for unauthorized users)
  if (path === '/admin' || path === '/orders' || path === '/order-history') {
    return { view: 'admin', attemptedPath: path, tableParam: null, tokenParam: null };
  }
  if (path === '/tables') {
    return { view: 'tables', attemptedPath: path, tableParam: null, tokenParam: null };
  }

  // Block manual URL guessing for any unknown or internal-sounding paths (/reports, /settings, /users, /dashboard, etc.)
  return { view: 'restricted', attemptedPath: path, tableParam: null, tokenParam: null };
}

export default function App() {
  const initialRoute = parseRouteFromLocation();

  const [currentView, setCurrentView] = useState<AppView>(initialRoute.view);
  const [attemptedPath, setAttemptedPath] = useState<string>(initialRoute.attemptedPath);
  const [pendingStaffView, setPendingStaffView] = useState<AppView | null>(null);

  // Isolated Anonymous Guest & Table QR State
  const [attemptedTableId, setAttemptedTableId] = useState<string | null>(initialRoute.tableParam);
  const [currentTableToken, setCurrentTableToken] = useState<string | null>(initialRoute.tokenParam);
  const [verifiedGuestTable, setVerifiedGuestTable] = useState<RestaurantTable | null>(null);
  const [isTableTokenValidated, setIsTableTokenValidated] = useState<boolean>(false);
  const [anonymousTrackingTokens, setAnonymousTrackingTokens] = useState<string[]>(() =>
    getStoredAnonymousOrderTokens()
  );
  const [guestSessionOrders, setGuestSessionOrders] = useState<OrderRound[]>([]);

  // Staff State (Used ONLY on separated staff routes; verified against /api/auth/me before mounting consoles)
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(() =>
    getStoredToken() ? getStoredUser() : null
  );
  const [isVerifyingAuth, setIsVerifyingAuth] = useState<boolean>(() =>
    Boolean(
      initialRoute.view !== 'customer' &&
        initialRoute.view !== 'staff_login' &&
        initialRoute.view !== 'restricted' &&
        getStoredToken()
    )
  );
  const [incomingKitchenAlerts, setIncomingKitchenAlerts] = useState<AlertOrderNotification[]>([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [liveOrderSignal, setLiveOrderSignal] = useState(0);

  // Shared Menu Catalog & Staff Operational Data
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<OrderRound[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoadingStaffOrders, setIsLoadingStaffOrders] = useState<boolean>(false);

  const isGuestMode = currentView === 'customer';

  // Keep route state synced with browser Back / Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRouteFromLocation();
      setCurrentView(parsed.view);
      setAttemptedPath(parsed.attemptedPath);
      setAttemptedTableId(parsed.tableParam);
      setCurrentTableToken(parsed.tokenParam);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Role Permission Guard: Only GM ('manager') and Admin ('admin') can access 'admin' (Complete Order History & Reports)
  const isViewPermitted = useCallback((view: AppView, user: StaffUser | null): boolean => {
    if (view === 'customer' || view === 'staff_login') return true;
    if (view === 'restricted') return false;
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'manager') return true;
    if (view === 'kitchen') return user.role === 'kitchen';
    if (view === 'counter') return user.role === 'cashier';
    return false;
  }, []);

  const getPermittedViewForRole = (user: StaffUser | null): AppView => {
    if (!user) return 'customer';
    if (user.role === 'kitchen') return 'kitchen';
    if (user.role === 'cashier') return 'counter';
    return 'admin';
  };

  // ==========================================
  // ISOLATED ANONYMOUS GUEST DATA LOADER (Zero Staff Calls)
  // ==========================================
  const loadGuestData = useCallback(async () => {
    try {
      const menuData = await api.getGuestMenu();
      if (menuData) {
        setSettings(menuData.settings);
        setCategories(menuData.categories);
        setMenuItems(menuData.menuItems);
      }

      let tableOrders: OrderRound[] = [];
      if (attemptedTableId) {
        try {
          const verification = await api.getTableVerification(
            attemptedTableId,
            currentTableToken || undefined
          );
          if (verification.isTokenValid && currentTableToken) {
            setVerifiedGuestTable(verification.table);
            setIsTableTokenValidated(true);
            const tableOrdersRes = await api.getGuestTableOrders(
              verification.table.id,
              currentTableToken
            );
            tableOrders = tableOrdersRes.rounds || [];
          } else {
            setVerifiedGuestTable(null);
            setIsTableTokenValidated(false);
          }
        } catch {
          setVerifiedGuestTable(null);
          setIsTableTokenValidated(false);
        }
      } else {
        setVerifiedGuestTable(null);
        setIsTableTokenValidated(false);
      }

      // Privately fetch any orders placed on this device via per-order cryptographic trackingTokens
      let trackedOrders: OrderRound[] = [];
      const storedTokens = getStoredAnonymousOrderTokens();
      if (storedTokens.length > 0) {
        try {
          const trackedRes = await api.trackAnonymousOrders(storedTokens);
          trackedOrders = trackedRes.orders || [];
        } catch {
          trackedOrders = [];
        }
      }

      setGuestSessionOrders(mergeUniqueOrders([tableOrders, trackedOrders]));
    } catch (err) {
      console.error('Failed to load guest menu', err);
    }
  }, [attemptedTableId, currentTableToken]);

  // ==========================================
  // AUTHENTICATED STAFF DATA LOADER (Role-Scoped)
  // ==========================================
  const loadStaffData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      clearStoredAuth();
      setCurrentUser(null);
      setIsVerifyingAuth(false);
      return;
    }

    setIsLoadingStaffOrders(true);
    try {
      const verifiedStaff = await api.getMe();
      setCurrentUser(verifiedStaff);
      setStoredAuth(token, verifiedStaff);
      setIsVerifyingAuth(false);

      const menuData = await api.getMenu();
      if (menuData) {
        setSettings(menuData.settings);
        setCategories(menuData.categories);
        setMenuItems(menuData.menuItems);
      }

      if (verifiedStaff.role === 'kitchen') {
        const tickets = await api.getKitchenTickets();
        setOrders(tickets);
      } else if (
        verifiedStaff.role === 'cashier' ||
        verifiedStaff.role === 'manager' ||
        verifiedStaff.role === 'admin'
      ) {
        const counterData = await api.getCounterBills();
        setBills(counterData.bills);
        setTables(counterData.tables);
        setOrders(counterData.orders);
      }
    } catch {
      clearStoredAuth();
      setCurrentUser(null);
      setIsVerifyingAuth(false);
    } finally {
      setIsLoadingStaffOrders(false);
    }
  }, []);

  useEffect(() => {
    if (isGuestMode) {
      loadGuestData();
    } else if (currentView !== 'staff_login' && currentView !== 'restricted') {
      loadStaffData();
    }
  }, [isGuestMode, currentView, loadGuestData, loadStaffData]);

  // ==========================================
  // SCOPED REAL-TIME SSE HANDLER
  // ==========================================
  const handleRealTimeEvent = useCallback(
    (event: string, data: any) => {
      if (event === 'menu_updated') {
        setMenuItems(prev => {
          const idx = prev.findIndex(m => m.id === data.item.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = data.item;
            return copy;
          }
          return [...prev, data.item];
        });
        return;
      }
      if (event === 'menu_availability_changed') {
        setMenuItems(prev => prev.map(m => (m.id === data.item.id ? data.item : m)));
        return;
      }
      if (event === 'menu_item_deleted') {
        setMenuItems(prev => prev.filter(m => m.id !== data.id));
        return;
      }
      if (event === 'settings_updated' && data.settings) {
        setSettings(data.settings);
        return;
      }

      // Guest Mode: ONLY update own verified table's orders OR own tracked anonymous orders
      // (Server SSE already restricts delivery strictly to matching tableToken or trackingToken)
      if (isGuestMode) {
        if (event === 'order_created' && data.order) {
          const isOwnVerifiedTable =
            isTableTokenValidated &&
            verifiedGuestTable &&
            verifiedGuestTable.id !== 'TAKEAWAY' &&
            data.order.tableId === verifiedGuestTable.id;

          setGuestSessionOrders(prev => {
            const alreadyTracked = prev.some(o => o.id === data.order.id);
            if (!isOwnVerifiedTable && !alreadyTracked) return prev;
            if (alreadyTracked) return prev.map(o => (o.id === data.order.id ? data.order : o));
            return [data.order, ...prev];
          });
        } else if (
          (event === 'item_status_updated' || event === 'order_status_updated') &&
          data.order
        ) {
          setGuestSessionOrders(prev =>
            prev.some(o => o.id === data.order.id)
              ? prev.map(o => (o.id === data.order.id ? data.order : o))
              : prev
          );
        } else if (
          event === 'table_closed' &&
          isTableTokenValidated &&
          verifiedGuestTable &&
          data.tableId === verifiedGuestTable.id
        ) {
          setGuestSessionOrders(prev => prev.filter(o => o.tableId !== verifiedGuestTable.id));
        }
        return;
      }

      // Authenticated Staff Mode ONLY
      if (!currentUser) return;

      if (event === 'order_created') {
        setLiveOrderSignal(s => s + 1);
        if (settings.kitchenAudioAlert) {
          soundService.playNewOrderChime();
        }
        if (
          data.order &&
          (currentUser.role === 'kitchen' ||
            currentUser.role === 'admin' ||
            currentUser.role === 'manager')
        ) {
          setIncomingKitchenAlerts(prev => [
            {
              id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              order: data.order,
              receivedAt: Date.now()
            },
            ...prev
          ]);
        }
        if (data.order) {
          setOrders(prev => {
            const exists = prev.some(o => o.id === data.order.id);
            if (exists) return prev.map(o => (o.id === data.order.id ? data.order : o));
            return [data.order, ...prev];
          });
        }
        if (data.bill) {
          setBills(prev => {
            const exists = prev.some(b => b.id === data.bill.id);
            if (exists) return prev.map(b => (b.id === data.bill.id ? data.bill : b));
            return [data.bill, ...prev];
          });
        }
        if (data.tableId && data.tableId !== 'TAKEAWAY') {
          setTables(prev => prev.map(t => (t.id === data.tableId ? { ...t, status: 'occupied' } : t)));
        }
      } else if (event === 'item_status_updated' || event === 'order_status_updated') {
        setLiveOrderSignal(s => s + 1);
        if (data.order) {
          setOrders(prev => {
            if (currentUser.role === 'kitchen' && data.order.status === 'served') {
              return prev.filter(o => o.id !== data.order.id);
            }
            return prev.map(o => (o.id === data.order.id ? data.order : o));
          });
        }
        if (data.bill) {
          setBills(prev => prev.map(b => (b.id === data.bill.id ? data.bill : b)));
        }
      } else if (event === 'bill_updated' || event === 'payment_recorded') {
        setLiveOrderSignal(s => s + 1);
        if (data.bill) {
          setBills(prev => {
            if (currentUser.role === 'cashier' && data.bill.status === 'paid' && data.bill.closedAt) {
              return prev.filter(b => b.id !== data.bill.id);
            }
            return prev.map(b => (b.id === data.bill.id ? data.bill : b));
          });
        }
      } else if (event === 'table_closed') {
        setLiveOrderSignal(s => s + 1);
        setTables(prev =>
          prev.map(t => (t.id === data.tableId ? { ...t, status: 'available', currentSessionId: null } : t))
        );
        if (currentUser.role === 'cashier' && data.sessionId) {
          setBills(prev => prev.filter(b => b.sessionId !== data.sessionId));
        } else if (data.bill) {
          setBills(prev => prev.map(b => (b.id === data.bill.id ? data.bill : b)));
        }
      } else if (event === 'tables_updated' && data.table) {
        setTables(prev => {
          const idx = prev.findIndex(t => t.id === data.table.id);
          if (idx >= 0) {
            const cp = [...prev];
            cp[idx] = data.table;
            return cp;
          }
          return [...prev, data.table];
        });
      } else if (event === 'table_deleted') {
        setTables(prev => prev.filter(t => t.id !== data.id));
      }
    },
    [isGuestMode, isTableTokenValidated, verifiedGuestTable, currentUser, settings.kitchenAudioAlert]
  );

  const sseScope =
    isGuestMode
      ? 'guest'
      : currentView === 'staff_login' || currentView === 'restricted' || !currentUser
      ? 'disabled'
      : 'staff';

  const { isConnected, connectionState } = useRealTimeEvents(handleRealTimeEvent, {
    scope: sseScope,
    staffToken: sseScope === 'staff' ? getStoredToken() : null,
    tableId: isGuestMode && isTableTokenValidated && verifiedGuestTable ? verifiedGuestTable.id : null,
    tableToken: isGuestMode && isTableTokenValidated ? currentTableToken : null,
    trackingTokensKey: isGuestMode ? anonymousTrackingTokens.join(',') : '',
    onReconnect: isGuestMode ? loadGuestData : loadStaffData
  });

  // ==========================================
  // NAVIGATION & AUTHENTICATION HANDLERS
  // ==========================================
  const navigateToGuestMenu = () => {
    setCurrentView('customer');
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams();
      if (attemptedTableId) params.set('table', attemptedTableId);
      if (currentTableToken) params.set('token', currentTableToken);
      const qs = params.toString();
      window.history.pushState({}, '', qs ? `/menu?${qs}` : '/');
    }
  };

  const handleClearUnverifiedTable = () => {
    setAttemptedTableId(null);
    setCurrentTableToken(null);
    setVerifiedGuestTable(null);
    setIsTableTokenValidated(false);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
  };

  const handleClearLocalAnonymousOrders = () => {
    clearAnonymousOrderTokens();
    setAnonymousTrackingTokens([]);
    if (isTableTokenValidated && verifiedGuestTable) {
      setGuestSessionOrders(prev => prev.filter(o => o.tableId === verifiedGuestTable.id));
    } else {
      setGuestSessionOrders([]);
    }
  };

  const navigateToStaffLogin = () => {
    setCurrentView('staff_login');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/staff');
    }
  };

  const handleLoginSuccess = (user: StaffUser, token: string) => {
    setStoredAuth(token, user);
    setCurrentUser(user);
    setIsVerifyingAuth(false);

    let targetView: AppView;
    if (pendingStaffView && isViewPermitted(pendingStaffView, user)) {
      targetView = pendingStaffView;
      setPendingStaffView(null);
    } else {
      targetView = getPermittedViewForRole(user);
    }

    setCurrentView(targetView);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/${targetView}`);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network error during logout
    }
    clearStoredAuth();
    setCurrentUser(null);
    setOrders([]);
    setBills([]);
    setTables([]);
    setIsTestModalOpen(false);
    navigateToStaffLogin();
  };

  const handleStaffNavigate = (view: 'customer' | 'kitchen' | 'counter' | 'admin' | 'tables') => {
    if (view === 'customer') {
      navigateToGuestMenu();
      return;
    }

    if (!currentUser) {
      setPendingStaffView(view);
      navigateToStaffLogin();
      return;
    }

    setCurrentView(view);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/${view}`);
    }
  };

  // ==========================================
  // ISOLATED ANONYMOUS ORDER SUBMISSION
  // ==========================================
  const handleCustomerSubmitOrder = async (
    items: Array<{
      menuItemId: string;
      quantity: number;
      selectedCustomizations?: Array<{ groupId: string; optionId: string }>;
      specialInstructions?: string;
    }>,
    customerNote?: string,
    idempotencyKey?: string,
    tableToken?: string
  ) => {
    const targetTableId =
      isTableTokenValidated && verifiedGuestTable
        ? verifiedGuestTable.id
        : attemptedTableId
        ? attemptedTableId
        : 'TAKEAWAY';

    const token =
      isTableTokenValidated && verifiedGuestTable
        ? tableToken || currentTableToken || undefined
        : undefined;

    const res = await api.createGuestOrder({
      tableId: targetTableId,
      tableToken: token,
      items,
      customerNote,
      idempotencyKey
    });

    if (res.trackingToken) {
      saveAnonymousOrderToken(res.trackingToken);
      setAnonymousTrackingTokens(getStoredAnonymousOrderTokens());
    }

    setGuestSessionOrders(prev => [res.order, ...prev.filter(o => o.id !== res.order.id)]);
    return { order: res.order, bill: res.bill, trackingToken: res.trackingToken };
  };

  // ==========================================
  // STAFF STATION MUTATION HANDLERS
  // ==========================================
  const handleKitchenUpdateItemStatus = async (
    orderId: string,
    itemId: string,
    status: OrderItemKitchenStatus,
    reason?: string
  ) => {
    const res = await api.updateKitchenItemStatus(orderId, itemId, status, reason);
    setOrders(prev => prev.map(o => (o.id === orderId ? res.order : o)));
    if (res.bill) {
      setBills(prev => prev.map(b => (b.id === res.bill!.id ? res.bill! : b)));
    }
  };

  const handleKitchenUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const res = await api.updateOrderStatus(orderId, status);
    setOrders(prev => {
      if (currentUser?.role === 'kitchen' && (status === 'served' || status === 'cancelled')) {
        return prev.filter(o => o.id !== orderId);
      }
      return prev.map(o => (o.id === orderId ? res.order : o));
    });
  };

  const handleApplyDiscount = async (
    billId: string,
    discount: { name: string; type: 'percentage' | 'fixed'; value: number; reason: string }
  ) => {
    const res = await api.applyDiscount(billId, discount);
    setBills(prev => prev.map(b => (b.id === billId ? res.bill : b)));
  };

  const handleRemoveDiscount = async (billId: string) => {
    const res = await api.removeDiscount(billId);
    setBills(prev => prev.map(b => (b.id === billId ? res.bill : b)));
  };

  const handleRecordPayment = async (
    billId: string,
    payment: { method: PaymentMethod; amount: number; reference?: string }
  ) => {
    const res = await api.recordPayment(billId, payment);
    setBills(prev => {
      if (currentUser?.role === 'cashier' && res.bill.status === 'paid' && res.bill.closedAt) {
        return prev.filter(b => b.id !== billId);
      }
      return prev.map(b => (b.id === billId ? res.bill : b));
    });
  };

  const handleCloseSession = async (sessionId: string) => {
    const res = await api.closeSession(sessionId);
    setTables(prev =>
      prev.map(t => (t.id === res.session.tableId ? { ...t, status: 'available', currentSessionId: null } : t))
    );
    await loadStaffData();
  };

  const handleMoveSession = async (sessionId: string, targetTableId: string) => {
    await api.moveSession(sessionId, targetTableId);
    await loadStaffData();
  };

  const handleAddOrderFromCounter = async (tableId: string, items: any[], note?: string) => {
    const res = await api.addOrderFromCounter(tableId, items, note);
    setOrders(prev => [res.order, ...prev.filter(o => o.id !== res.order.id)]);
    setBills(prev => {
      const exists = prev.some(b => b.id === res.bill.id);
      return exists ? prev.map(b => (b.id === res.bill.id ? res.bill : b)) : [res.bill, ...prev];
    });
  };

  const handleSaveMenuItem = async (item: Partial<MenuItem>) => {
    const res = await api.saveMenuItem(item);
    setMenuItems(prev => {
      const idx = prev.findIndex(m => m.id === res.item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = res.item;
        return copy;
      }
      return [...prev, res.item];
    });
  };

  const handleToggleAvailability = async (id: string, isAvailable: boolean, soldOut: boolean) => {
    const res = await api.toggleMenuItemAvailability(id, isAvailable, soldOut);
    setMenuItems(prev => prev.map(m => (m.id === id ? res.item : m)));
  };

  const handleDeleteMenuItem = async (id: string) => {
    await api.deleteMenuItem(id);
    setMenuItems(prev => prev.filter(m => m.id !== id));
  };

  const handleDismissKitchenAlert = (id: string) => {
    setIncomingKitchenAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleSimulateKitchenOrder = async () => {
    const randomTable = tables[Math.floor(Math.random() * Math.min(tables.length, 5))] || { id: 'T01' };
    const sampleItem = menuItems.find(m => m.isAvailable && !m.soldOut) || menuItems[0];
    if (!sampleItem) return;

    try {
      await api.createOrder({
        tableId: randomTable.id,
        items: [{ menuItemId: sampleItem.id, quantity: 2 }],
        customerNote: 'Rush preparation · Kitchen station test'
      });
    } catch (e) {
      console.error('Failed to simulate test order', e);
    }
  };

  // ==========================================
  // RENDER 1: DEDICATED ISOLATED ANONYMOUS GUEST INTERFACE
  // ==========================================
  if (isGuestMode) {
    const activeGuestOrders = guestSessionOrders.filter(
      o => o.status !== 'served' && o.status !== 'cancelled'
    );

    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-teal-100 selection:text-teal-900">
        <Navbar
          currentView="customer"
          onNavigate={() => {}}
          currentUser={null}
          onLogout={() => {}}
          isConnected={isConnected}
          verifiedTableLabel={isTableTokenValidated && verifiedGuestTable ? verifiedGuestTable.tableNumber : null}
          verifiedTableSection={isTableTokenValidated && verifiedGuestTable ? verifiedGuestTable.section : null}
        />

        <CustomerMenu
          settings={settings}
          categories={categories}
          menuItems={menuItems}
          verifiedTable={isTableTokenValidated ? verifiedGuestTable : null}
          attemptedTableId={attemptedTableId}
          currentTableToken={currentTableToken || undefined}
          isTableTokenValidated={isTableTokenValidated}
          onSubmitOrder={handleCustomerSubmitOrder}
          activeOrders={activeGuestOrders}
          sessionOrders={guestSessionOrders}
          onRefreshOrders={loadGuestData}
          onClearUnverifiedTable={handleClearUnverifiedTable}
          onClearLocalOrders={handleClearLocalAnonymousOrders}
          hasLocalAnonymousTokens={anonymousTrackingTokens.length > 0}
        />
      </div>
    );
  }

  // ==========================================
  // RENDER 2: SEPARATE STAFF SIGN-IN PORTAL (/staff)
  // ==========================================
  if (currentView === 'staff_login') {
    return (
      <StaffLoginView
        onSuccessLogin={handleLoginSuccess}
        onCancel={navigateToGuestMenu}
      />
    );
  }

  if (isVerifyingAuth && currentView !== 'restricted') {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-800 flex items-center justify-center p-6">
        <div className="bg-white border border-stone-200 rounded-2xl px-8 py-7 shadow-xs text-center space-y-3 max-w-xs w-full">
          <div className="w-8 h-8 rounded-full border-2 border-teal-700 border-t-transparent animate-spin mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-stone-900">Verifying Staff Session</p>
            <p className="text-xs text-stone-500">Checking your station permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER 3: BLOCKED UNKNOWN / PROTECTED URL GUARD
  // ==========================================
  if (currentView === 'restricted' || !currentUser || !isViewPermitted(currentView, currentUser)) {
    return (
      <AccessDeniedView
        currentUser={currentUser}
        attemptedView={currentView === 'restricted' ? attemptedPath : currentView}
        onNavigatePermitted={() => {
          const permitted = getPermittedViewForRole(currentUser);
          handleStaffNavigate(permitted as any);
        }}
        onSwitchStaff={() => {
          if (currentView !== 'restricted') {
            setPendingStaffView(currentView);
          }
          navigateToStaffLogin();
        }}
        onReturnToCustomer={navigateToGuestMenu}
      />
    );
  }

  // ==========================================
  // RENDER 4: AUTHORIZED STAFF CONSOLES
  // ==========================================
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      <Navbar
        currentView={currentView}
        onNavigate={handleStaffNavigate}
        currentUser={currentUser}
        onLogout={handleLogout}
        isConnected={isConnected}
        onOpenTestRunner={() => setIsTestModalOpen(true)}
        onOpenStaffLogin={navigateToStaffLogin}
      />

      {currentView === 'kitchen' && (
        <KitchenDisplay
          orders={orders}
          onUpdateItemStatus={handleKitchenUpdateItemStatus}
          onUpdateOrderStatus={handleKitchenUpdateOrderStatus}
          incomingAlerts={incomingKitchenAlerts}
          onDismissAlert={handleDismissKitchenAlert}
          onSimulateOrder={handleSimulateKitchenOrder}
          isConnected={isConnected}
          connectionState={connectionState}
          isLoadingOrders={isLoadingStaffOrders && orders.length === 0}
          onRefreshOrders={loadStaffData}
        />
      )}

      {currentView === 'counter' && (
        <CounterConsole
          bills={bills}
          tables={tables}
          orders={orders}
          menuItems={menuItems}
          settings={settings}
          currentUser={currentUser}
          onApplyDiscount={handleApplyDiscount}
          onRemoveDiscount={handleRemoveDiscount}
          onRecordPayment={handleRecordPayment}
          onCloseSession={handleCloseSession}
          onMoveSession={handleMoveSession}
          onAddOrderFromCounter={handleAddOrderFromCounter}
        />
      )}

      {currentView === 'admin' && (
        <AdminHub
          menuItems={menuItems}
          categories={categories}
          settings={settings}
          currentUser={currentUser}
          tables={tables}
          liveOrderSignal={liveOrderSignal}
          onSaveMenuItem={handleSaveMenuItem}
          onToggleAvailability={handleToggleAvailability}
          onDeleteMenuItem={handleDeleteMenuItem}
          onFetchReports={api.getReports}
          onFetchAuditLogs={api.getAuditLogs}
          onUpdateSettings={async updates => {
            const res = await api.updateSettings(updates);
            if (res.settings) setSettings(res.settings);
          }}
          onRefreshData={loadStaffData}
          onSelectTableForCustomerView={(tableId, token) => {
            setAttemptedTableId(tableId);
            setCurrentTableToken(token || null);
            setCurrentView('customer');
            if (typeof window !== 'undefined') {
              const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
              window.history.pushState({}, '', `/menu?table=${encodeURIComponent(tableId)}${tokenQuery}`);
            }
          }}
        />
      )}

      {currentView === 'tables' && (
        <TableQRManagement
          currentUser={currentUser}
          onSelectTableForCustomerView={(tableId, token) => {
            setAttemptedTableId(tableId);
            setCurrentTableToken(token || null);
            setCurrentView('customer');
            if (typeof window !== 'undefined') {
              const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
              window.history.pushState({}, '', `/menu?table=${encodeURIComponent(tableId)}${tokenQuery}`);
            }
          }}
          onRefreshData={loadStaffData}
        />
      )}

      {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
        <AcceptanceTestModal
          isOpen={isTestModalOpen}
          onClose={() => setIsTestModalOpen(false)}
          onRefreshAllData={loadStaffData}
        />
      )}
    </div>
  );
}
