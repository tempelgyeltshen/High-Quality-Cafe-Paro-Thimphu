import React, { useState, useEffect, useCallback } from 'react';
import {
  api,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
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

type AppView = 'customer' | 'kitchen' | 'counter' | 'admin' | 'tables' | 'staff_login';

export default function App() {
  // Navigation View
  const [currentView, setCurrentView] = useState<AppView>('customer');
  const [currentTableId, setCurrentTableId] = useState<string>('T01');
  const [pendingStaffView, setPendingStaffView] = useState<AppView | null>(null);

  // Real-Time Incoming Kitchen Alerts
  const [incomingKitchenAlerts, setIncomingKitchenAlerts] = useState<AlertOrderNotification[]>([]);

  // Core Data
  const [settings, setSettings] = useState<SystemSettings>({
    restaurantName: 'High Quality Cafe',
    tagline: 'Paro, Bhutan · Open 24/7',
    operatingHours: '24 Hours / 7 Days a Week',
    currency: 'Nu.',
    currencySymbol: 'Nu.',
    taxRate: 0.05,
    serviceChargeRate: 0.10,
    allowGuestOrdering: true,
    kitchenAudioAlert: true,
    showPricesOnCustomerMenu: false,
    address: 'High Quality Cafe, Paro Town, Paro, Bhutan',
    phone: '+975 8 271234'
  });
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<OrderRound[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  // Auth: Start as null (Guest Customer) unless explicitly stored in session
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(getStoredUser());
  const [staffList, setStaffList] = useState<StaffUser[]>([]);

  // Modals & UI
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [currentTableToken, setCurrentTableToken] = useState<string | null>(null);
  const [isTableTokenValidated, setIsTableTokenValidated] = useState<boolean>(false);

  // Parse URL on initial load for table query parameter and routes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tableParam = urlParams.get('table');
      const tokenParam = urlParams.get('token');
      if (tokenParam) {
        setCurrentTableToken(tokenParam);
      }
      if (tableParam) {
        setCurrentTableId(tableParam.toUpperCase());
        setCurrentView('customer');
      } else {
        const path = window.location.pathname;
        if (path.includes('/kitchen')) setCurrentView('kitchen');
        else if (path.includes('/counter')) setCurrentView('counter');
        else if (path.includes('/admin')) setCurrentView('admin');
        else if (path.includes('/tables')) setCurrentView('tables');
        else if (path.includes('/staff')) setCurrentView('staff_login');
      }
    }
  }, []);

  // Validate table token whenever tables or current table/token change
  useEffect(() => {
    const table = tables.find(t => t.id === currentTableId);
    if (table && currentTableToken) {
      setIsTableTokenValidated(table.tableToken === currentTableToken);
    } else {
      setIsTableTokenValidated(false);
    }
  }, [tables, currentTableId, currentTableToken]);

  // Fetch initial data
  const loadAllData = useCallback(async () => {
    try {
      const [menuData, counterData, staffData] = await Promise.all([
        api.getMenu(),
        api.getCounterBills().catch(() => ({ bills: [], tables: [], orders: [] })),
        api.getDemoStaffAccounts().catch(() => [])
      ]);

      if (menuData) {
        setSettings(menuData.settings);
        setCategories(menuData.categories);
        setMenuItems(menuData.menuItems);
      }

      if (counterData) {
        setBills(counterData.bills);
        setTables(counterData.tables);
        setOrders(counterData.orders);
      }

      if (staffData && staffData.length > 0) {
        setStaffList(staffData);
      }
    } catch (err) {
      console.error('Failed to load initial cafe data', err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle Real-Time SSE Events
  const handleRealTimeEvent = useCallback((event: string, data: any) => {
    if (event === 'order_created') {
      soundService.playNewOrderChime();
      if (data.order) {
        setIncomingKitchenAlerts(prev => [
          {
            id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            order: data.order,
            receivedAt: Date.now()
          },
          ...prev
        ]);
      }
      setOrders(prev => {
        const exists = prev.some(o => o.id === data.order.id);
        if (exists) return prev.map(o => o.id === data.order.id ? data.order : o);
        return [data.order, ...prev];
      });
      if (data.bill) {
        setBills(prev => {
          const exists = prev.some(b => b.id === data.bill.id);
          if (exists) return prev.map(b => b.id === data.bill.id ? data.bill : b);
          return [data.bill, ...prev];
        });
      }
      setTables(prev => prev.map(t => t.id === data.tableId ? { ...t, status: 'occupied' } : t));
    } else if (event === 'item_status_updated' || event === 'order_status_updated') {
      setOrders(prev => prev.map(o => o.id === data.order.id ? data.order : o));
      if (data.bill) {
        setBills(prev => prev.map(b => b.id === data.bill.id ? data.bill : b));
      }
    } else if (event === 'bill_updated' || event === 'payment_recorded') {
      setBills(prev => prev.map(b => b.id === data.bill.id ? data.bill : b));
    } else if (event === 'table_closed') {
      setTables(prev => prev.map(t => t.id === data.tableId ? { ...t, status: 'available', currentSessionId: null } : t));
    } else if (event === 'tables_updated') {
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
    } else if (event === 'menu_updated') {
      setMenuItems(prev => {
        const idx = prev.findIndex(m => m.id === data.item.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = data.item;
          return copy;
        }
        return [...prev, data.item];
      });
    } else if (event === 'menu_availability_changed') {
      setMenuItems(prev => prev.map(m => m.id === data.item.id ? data.item : m));
    } else if (event === 'menu_item_deleted') {
      setMenuItems(prev => prev.filter(m => m.id !== data.id));
    } else if (event === 'settings_updated') {
      setSettings(data.settings);
    }
  }, []);

  const { isConnected } = useRealTimeEvents(handleRealTimeEvent);

  // Authentication Handlers
  const handleLoginDemoUser = async (user: StaffUser) => {
    try {
      const res = await api.login(user.username);
      setStoredAuth(res.token, res.user);
      setCurrentUser(res.user);
    } catch (e) {
      console.error('Login error', e);
    }
  };

  const handleLoginSuccess = (user: StaffUser, token: string) => {
    setStoredAuth(token, user);
    setCurrentUser(user);

    // Route to permitted destination
    if (pendingStaffView && isViewPermitted(pendingStaffView, user)) {
      setCurrentView(pendingStaffView);
      setPendingStaffView(null);
    } else {
      if (user.role === 'kitchen') setCurrentView('kitchen');
      else if (user.role === 'cashier') setCurrentView('counter');
      else setCurrentView('admin');
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    setCurrentUser(null);
    setCurrentView('customer');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/menu?table=${currentTableId}`);
    }
  };

  // Role Permission Guard
  const isViewPermitted = (view: AppView, user: StaffUser | null): boolean => {
    if (view === 'customer' || view === 'staff_login') return true;
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'manager') return true;
    if (view === 'kitchen') return user.role === 'kitchen';
    if (view === 'counter') return user.role === 'cashier';
    return false;
  };

  const handleNavigate = (view: AppView) => {
    if (view === 'customer') {
      setCurrentView('customer');
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', `/menu?table=${currentTableId}`);
      }
      return;
    }

    if (view === 'staff_login') {
      setCurrentView('staff_login');
      return;
    }

    if (!currentUser) {
      // Must authenticate first
      setPendingStaffView(view);
      setCurrentView('staff_login');
      return;
    }

    setCurrentView(view);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/${view}`);
    }
  };

  // Submit Order from Customer Menu
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
    const res = await api.createOrder({
      tableId: currentTableId,
      tableToken: tableToken || currentTableToken || undefined,
      items,
      customerNote,
      idempotencyKey
    });

    setOrders(prev => [res.order, ...prev.filter(o => o.id !== res.order.id)]);
    setBills(prev => [res.bill, ...prev.filter(b => b.id !== res.bill.id)]);
    setTables(prev => prev.map(t => t.id === currentTableId ? { ...t, status: 'occupied' } : t));

    return { order: res.order, bill: res.bill };
  };

  // Kitchen Actions
  const handleKitchenUpdateItemStatus = async (orderId: string, itemId: string, status: OrderItemKitchenStatus, reason?: string) => {
    const res = await api.updateKitchenItemStatus(orderId, itemId, status, reason);
    setOrders(prev => prev.map(o => o.id === orderId ? res.order : o));
    if (res.bill) {
      setBills(prev => prev.map(b => b.id === res.bill!.id ? res.bill! : b));
    }
  };

  const handleKitchenUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const res = await api.updateOrderStatus(orderId, status);
    setOrders(prev => prev.map(o => o.id === orderId ? res.order : o));
  };

  // Counter Actions
  const handleApplyDiscount = async (billId: string, discount: { name: string; type: 'percentage' | 'fixed'; value: number; reason: string }) => {
    const res = await api.applyDiscount(billId, discount);
    setBills(prev => prev.map(b => b.id === billId ? res.bill : b));
  };

  const handleRemoveDiscount = async (billId: string) => {
    const res = await api.removeDiscount(billId);
    setBills(prev => prev.map(b => b.id === billId ? res.bill : b));
  };

  const handleRecordPayment = async (billId: string, payment: { method: PaymentMethod; amount: number; reference?: string }) => {
    const res = await api.recordPayment(billId, payment);
    setBills(prev => prev.map(b => b.id === billId ? res.bill : b));
  };

  const handleCloseSession = async (sessionId: string) => {
    const res = await api.closeSession(sessionId);
    setTables(prev => prev.map(t => t.id === res.session.tableId ? { ...t, status: 'available', currentSessionId: null } : t));
    await loadAllData();
  };

  const handleMoveSession = async (sessionId: string, targetTableId: string) => {
    await api.moveSession(sessionId, targetTableId);
    await loadAllData();
  };

  const handleAddOrderFromCounter = async (tableId: string, items: any[], note?: string) => {
    const res = await api.addOrderFromCounter(tableId, items, note);
    setOrders(prev => [res.order, ...prev]);
    setBills(prev => prev.map(b => b.id === res.bill.id ? res.bill : b));
  };

  // Admin Actions
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
    setMenuItems(prev => prev.map(m => m.id === id ? res.item : m));
  };

  const handleDeleteMenuItem = async (id: string) => {
    await api.deleteMenuItem(id);
    setMenuItems(prev => prev.filter(m => m.id !== id));
  };

  const activeOrdersForCurrentTable = orders.filter(
    o => o.tableId === currentTableId && o.status !== 'served' && o.status !== 'cancelled'
  );

  const sessionOrdersForCurrentTable = orders.filter(
    o => o.tableId === currentTableId && o.status !== 'cancelled'
  );

  const handleDismissKitchenAlert = (id: string) => {
    setIncomingKitchenAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleSimulateKitchenOrder = async () => {
    const randomTable = tables[Math.floor(Math.random() * Math.min(tables.length, 5))] || { id: 'T01' };
    const sampleItem = menuItems.find(m => m.id === 'item_suja_shamdray') || menuItems[0];
    if (!sampleItem) return;

    try {
      await api.createOrder({
        tableId: randomTable.id,
        items: [{ menuItemId: sampleItem.id, quantity: 2 }],
        customerNote: 'Rush preparation · Table guest'
      });
    } catch (e) {
      console.error('Failed to simulate test order', e);
    }
  };

  // Helper for permitted view redirection
  const getPermittedViewForCurrentRole = (): AppView => {
    if (!currentUser) return 'customer';
    if (currentUser.role === 'kitchen') return 'kitchen';
    if (currentUser.role === 'cashier') return 'counter';
    return 'admin';
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Universal Top Bar (Isolated per role) */}
      {currentView !== 'staff_login' && (
        <Navbar
          currentView={currentView as any}
          onNavigate={handleNavigate as any}
          currentUser={currentUser}
          onLoginDemoUser={handleLoginDemoUser}
          onLogout={handleLogout}
          staffList={staffList}
          isConnected={isConnected}
          onOpenTestRunner={() => setIsTestModalOpen(true)}
          onOpenStaffLogin={() => setCurrentView('staff_login')}
          currentTableId={currentTableId}
        />
      )}

      {/* VIEW: STAFF SIGN-IN PORTAL */}
      {currentView === 'staff_login' && (
        <StaffLoginView
          onSuccessLogin={handleLoginSuccess}
          onCancel={() => setCurrentView('customer')}
          staffList={staffList}
        />
      )}

      {/* VIEW: CUSTOMER MENU (QR Code Entry, No login required) */}
      {currentView === 'customer' && (
        <CustomerMenu
          settings={settings}
          categories={categories}
          menuItems={menuItems}
          tables={tables}
          currentTableId={currentTableId}
          onTableChange={(id) => {
            setCurrentTableId(id);
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', `/menu?table=${id}`);
            }
          }}
          onSubmitOrder={handleCustomerSubmitOrder}
          activeOrders={activeOrdersForCurrentTable}
          sessionOrders={sessionOrdersForCurrentTable}
          currentTableToken={currentTableToken || undefined}
          isTableTokenValidated={isTableTokenValidated}
          onRefreshOrders={loadAllData}
          onOpenStaffLogin={() => setCurrentView('staff_login')}
        />
      )}

      {/* VIEW: KITCHEN DISPLAY SYSTEM */}
      {currentView === 'kitchen' && (
        !currentUser ? (
          <AccessDeniedView
            currentUser={null}
            attemptedView="kitchen"
            onNavigatePermitted={() => setCurrentView('customer')}
            onSwitchStaff={() => setCurrentView('staff_login')}
            onReturnToCustomer={() => setCurrentView('customer')}
          />
        ) : !isViewPermitted('kitchen', currentUser) ? (
          <AccessDeniedView
            currentUser={currentUser}
            attemptedView="kitchen"
            onNavigatePermitted={() => setCurrentView(getPermittedViewForCurrentRole())}
            onSwitchStaff={() => setCurrentView('staff_login')}
            onReturnToCustomer={() => setCurrentView('customer')}
          />
        ) : (
          <KitchenDisplay
            orders={orders}
            onUpdateItemStatus={handleKitchenUpdateItemStatus}
            onUpdateOrderStatus={handleKitchenUpdateOrderStatus}
            incomingAlerts={incomingKitchenAlerts}
            onDismissAlert={handleDismissKitchenAlert}
            onSimulateOrder={handleSimulateKitchenOrder}
          />
        )
      )}

      {/* VIEW: COUNTER BILLING CONSOLE */}
      {currentView === 'counter' && (
        !currentUser ? (
          <AccessDeniedView
            currentUser={null}
            attemptedView="counter"
            onNavigatePermitted={() => setCurrentView('customer')}
            onSwitchStaff={() => setCurrentView('staff_login')}
            onReturnToCustomer={() => setCurrentView('customer')}
          />
        ) : !isViewPermitted('counter', currentUser) ? (
          <AccessDeniedView
            currentUser={currentUser}
            attemptedView="counter"
            onNavigatePermitted={() => setCurrentView(getPermittedViewForCurrentRole())}
            onSwitchStaff={() => setCurrentView('staff_login')}
            onReturnToCustomer={() => setCurrentView('customer')}
          />
        ) : (
          <CounterConsole
            bills={bills}
            tables={tables}
            orders={orders}
            menuItems={menuItems}
            currentUser={currentUser}
            onApplyDiscount={handleApplyDiscount}
            onRemoveDiscount={handleRemoveDiscount}
            onRecordPayment={handleRecordPayment}
            onCloseSession={handleCloseSession}
            onMoveSession={handleMoveSession}
            onAddOrderFromCounter={handleAddOrderFromCounter}
          />
        )
      )}

      {/* VIEW: ADMINISTRATOR HUB */}
      {currentView === 'admin' && (
        !currentUser ? (
          <AccessDeniedView
            currentUser={null}
            attemptedView="admin"
            onNavigatePermitted={() => setCurrentView('customer')}
            onSwitchStaff={() => setCurrentView('staff_login')}
            onReturnToCustomer={() => setCurrentView('customer')}
          />
        ) : !isViewPermitted('admin', currentUser) ? (
          <AccessDeniedView
            currentUser={currentUser}
            attemptedView="admin"
            onNavigatePermitted={() => setCurrentView(getPermittedViewForCurrentRole())}
            onSwitchStaff={() => setCurrentView('staff_login')}
            onReturnToCustomer={() => setCurrentView('customer')}
          />
        ) : (
          <AdminHub
            menuItems={menuItems}
            categories={categories}
            settings={settings}
            currentUser={currentUser}
            tables={tables}
            onSaveMenuItem={handleSaveMenuItem}
            onToggleAvailability={handleToggleAvailability}
            onDeleteMenuItem={handleDeleteMenuItem}
            onFetchReports={api.getReports}
            onFetchAuditLogs={api.getAuditLogs}
            onUpdateSettings={async (updates) => {
              const res = await api.updateSettings(updates);
              if (res.settings) setSettings(res.settings);
            }}
            onRefreshData={loadAllData}
            onSelectTableForCustomerView={(tableId, token) => {
              setCurrentTableId(tableId);
              if (token) setCurrentTableToken(token);
              setCurrentView('customer');
              if (typeof window !== 'undefined') {
                const tokenQuery = token ? `&token=${token}` : '';
                window.history.pushState({}, '', `/menu?table=${tableId}${tokenQuery}`);
              }
            }}
          />
        )
      )}

      {/* VIEW: TABLES & QR MANAGEMENT */}
      {currentView === 'tables' && (
        !currentUser ? (
          <AccessDeniedView
            currentUser={null}
            attemptedView="tables"
            onNavigatePermitted={() => setCurrentView('customer')}
            onSwitchStaff={() => setCurrentView('staff_login')}
            onReturnToCustomer={() => setCurrentView('customer')}
          />
        ) : !isViewPermitted('tables', currentUser) ? (
          <AccessDeniedView
            currentUser={currentUser}
            attemptedView="tables"
            onNavigatePermitted={() => setCurrentView(getPermittedViewForCurrentRole())}
            onSwitchStaff={() => setCurrentView('staff_login')}
            onReturnToCustomer={() => setCurrentView('customer')}
          />
        ) : (
          <TableQRManagement
            onSelectTableForCustomerView={(tableId, token) => {
              setCurrentTableId(tableId);
              if (token) setCurrentTableToken(token);
              setCurrentView('customer');
              if (typeof window !== 'undefined') {
                const tokenQuery = token ? `&token=${token}` : '';
                window.history.pushState({}, '', `/menu?table=${tableId}${tokenQuery}`);
              }
            }}
            onRefreshData={loadAllData}
          />
        )
      )}

      {/* Acceptance Test Runner Modal */}
      <AcceptanceTestModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onRefreshAllData={loadAllData}
      />
    </div>
  );
}
