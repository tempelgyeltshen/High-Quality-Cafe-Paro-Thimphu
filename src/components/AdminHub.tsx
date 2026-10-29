import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  Download,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  History,
  X,
  Search,
  Users,
  Shield,
  ChefHat,
  CreditCard,
  QrCode,
  Layers,
  Utensils
} from 'lucide-react';
import {
  MenuItem,
  MenuCategory,
  SystemSettings,
  DietType,
  StaffUser,
  RestaurantTable,
  Role
} from '../types/index.ts';
import { api, downloadProtectedCsv } from '../lib/api.ts';
import { TableQRManagement } from './TableQRManagement.tsx';
import { OrderHistoryView } from './OrderHistoryView.tsx';

type HubTab = 'orders' | 'reports' | 'menu' | 'staff' | 'tables' | 'price_audits' | 'system_logs' | 'settings';

interface AdminHubProps {
  menuItems: MenuItem[];
  categories: MenuCategory[];
  settings: SystemSettings;
  currentUser: StaffUser | null;
  tables: RestaurantTable[];
  liveOrderSignal?: number;
  onSaveMenuItem: (item: Partial<MenuItem>) => Promise<void>;
  onToggleAvailability: (id: string, isAvailable: boolean, soldOut: boolean) => Promise<void>;
  onDeleteMenuItem: (id: string) => Promise<void>;
  onFetchReports: () => Promise<any>;
  onFetchAuditLogs: () => Promise<any>;
  onUpdateSettings?: (updates: Partial<SystemSettings>) => Promise<void>;
  onRefreshData?: () => void;
  onSelectTableForCustomerView?: (tableId: string, token?: string) => void;
}

const DIET_LABELS: Record<DietType, string> = {
  veg: 'Vegetarian',
  'non-veg': 'Non-Vegetarian',
  vegan: 'Vegan',
  egg: 'Contains Egg'
};

export const AdminHub: React.FC<AdminHubProps> = ({
  menuItems,
  categories,
  settings,
  currentUser,
  tables,
  liveOrderSignal = 0,
  onSaveMenuItem,
  onToggleAvailability,
  onDeleteMenuItem,
  onFetchReports,
  onFetchAuditLogs,
  onUpdateSettings,
  onRefreshData,
  onSelectTableForCustomerView
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<HubTab>('orders');
  const [reportsData, setReportsData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<{ generalLogs: any[]; priceLogs: any[] }>({ generalLogs: [], priceLogs: [] });
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [settingForm, setSettingForm] = useState(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [hubNotice, setHubNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<{
    kind: 'staff' | 'table' | 'dish';
    id: string;
    label: string;
  } | null>(null);

  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [editingStaff, setEditingStaff] = useState<Partial<StaffUser> | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  const [tablesWithQR, setTablesWithQR] = useState<Array<RestaurantTable & { qrUrl: string; qrCodeDataUrl: string }>>([]);
  const [editingTable, setEditingTable] = useState<Partial<RestaurantTable> | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [saveDishError, setSaveDishError] = useState<string | null>(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');

  useEffect(() => {
    setSettingForm(settings);
  }, [settings]);

  useEffect(() => {
    loadReports();
    loadAudits();
    loadTables();
    if (isAdmin) {
      loadStaff();
    }
  }, [isAdmin]);

  const loadReports = async () => {
    try {
      setIsLoadingReports(true);
      const data = await onFetchReports();
      setReportsData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const loadAudits = async () => {
    try {
      const data = await onFetchAuditLogs();
      setAuditLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStaff = async () => {
    try {
      const data = await api.getAdminStaff();
      setStaffUsers(data);
    } catch (e) {
      console.error('Failed to load staff accounts', e);
    }
  };

  const loadTables = async () => {
    try {
      const data = await api.getTablesWithQR();
      setTablesWithQR(data);
    } catch (e) {
      console.error('Failed to load tables with QR', e);
    }
  };

  const openNewDish = () => {
    setSaveDishError(null);
    setEditingItem({
      id: `dish_${Date.now()}`,
      name: '',
      categoryId: categories[0]?.id || 'cat_starter',
      description: '',
      price: 150,
      dietType: 'veg',
      isAvailable: true,
      soldOut: false,
      allergens: [],
      imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
      preparationTimeMinutes: 12,
      timeSlot: 'all_day',
      customizationGroups: []
    });
  };

  const handleSaveDish = async () => {
    if (!editingItem) return;
    if (!editingItem.name || editingItem.name.trim().length < 2) {
      setSaveDishError('Dish name must be at least 2 characters long.');
      return;
    }
    const priceNum = Number(editingItem.price);
    if (isNaN(priceNum) || priceNum < 0) {
      setSaveDishError('Price must be a valid non-negative number.');
      return;
    }

    try {
      setSaveDishError(null);
      await onSaveMenuItem({
        ...editingItem,
        name: editingItem.name.trim(),
        price: priceNum
      });
      setEditingItem(null);
      loadAudits();
    } catch (err: any) {
      setSaveDishError(err.message || 'Failed to save dish');
    }
  };

  const handleSaveStaff = async () => {
    if (!editingStaff) return;
    if (!editingStaff.name || editingStaff.name.trim().length < 2) {
      setStaffError('Staff member name must be at least 2 characters long.');
      return;
    }
    if (!editingStaff.username || editingStaff.username.trim().length < 2) {
      setStaffError('Username must be at least 2 characters long.');
      return;
    }
    try {
      setStaffError(null);
      await api.saveAdminStaff(editingStaff);
      setEditingStaff(null);
      await loadStaff();
      onRefreshData?.();
    } catch (err: any) {
      setStaffError(err.message || 'Failed to save staff account');
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setHubNotice(null);

    try {
      if (target.kind === 'staff') {
        await api.deleteAdminStaff(target.id);
        await loadStaff();
        onRefreshData?.();
        setHubNotice({ type: 'success', message: `Deleted staff account "${target.label}".` });
      } else if (target.kind === 'table') {
        await api.deleteAdminTable(target.id);
        await loadTables();
        onRefreshData?.();
        setHubNotice({ type: 'success', message: `Deleted table "${target.label}".` });
      } else if (target.kind === 'dish') {
        await onDeleteMenuItem(target.id);
        setHubNotice({ type: 'success', message: `Deleted dish "${target.label}".` });
      }
    } catch (err: any) {
      setHubNotice({
        type: 'error',
        message: err.message || `Failed to delete ${target.label}`
      });
    }
  };

  const handleSaveTable = async () => {
    if (!editingTable) return;
    if (!editingTable.tableNumber || editingTable.tableNumber.trim().length === 0) {
      setTableError('Table number or name is required.');
      return;
    }
    try {
      setTableError(null);
      await api.saveAdminTable(editingTable);
      setEditingTable(null);
      await loadTables();
      onRefreshData?.();
    } catch (err: any) {
      setTableError(err.message || 'Failed to save table');
    }
  };

  const handleExportSalesCsv = async () => {
    try {
      setHubNotice(null);
      const dateStamp = new Date().toISOString().slice(0, 10);
      await downloadProtectedCsv(
        '/api/admin/reports/export-csv',
        `high_quality_cafe_sales_${dateStamp}.csv`
      );
    } catch (err: any) {
      setHubNotice({ type: 'error', message: err.message || 'Failed to export sales CSV' });
    }
  };

  const filteredMenuItems = menuItems.filter(m => {
    if (selectedCatFilter !== 'all' && m.categoryId !== selectedCatFilter) return false;
    if (menuSearch.trim() && !m.name.toLowerCase().includes(menuSearch.toLowerCase())) return false;
    return true;
  });

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case 'kitchen':
        return <span className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">Kitchen Cook</span>;
      case 'cashier':
        return <span className="text-xs font-semibold text-sky-900 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">Counter Staff</span>;
      case 'admin':
        return <span className="text-xs font-bold text-teal-900 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">Admin</span>;
      case 'manager':
        return <span className="text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">General Manager</span>;
    }
  };

  const availableTabs: Array<{ id: HubTab; label: string; icon: any }> = [
    { id: 'orders', label: 'Order History', icon: Layers },
    { id: 'reports', label: 'Reports & Revenue', icon: TrendingUp },
    { id: 'menu', label: 'Menu & Dishes', icon: ShoppingBag },
    ...(isAdmin ? [{ id: 'staff' as HubTab, label: 'Staff & Roles', icon: Users }] : []),
    { id: 'tables', label: 'Tables & QR Cards', icon: QrCode },
    { id: 'price_audits', label: 'Price Audits', icon: History },
    { id: 'system_logs', label: 'System Logs', icon: Clock },
    ...(isAdmin ? [{ id: 'settings' as HubTab, label: 'Settings', icon: Shield }] : [])
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      {/* Top Header & Sub-Navigation */}
      <div className="bg-white border-b border-stone-200 px-4 sm:px-6 pt-5 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs text-stone-500 flex items-center gap-2">
              <span className="font-semibold text-teal-800">
                {isAdmin ? 'Administrator' : 'General Manager (GM)'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Management Workspace</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
              {isAdmin ? 'Administrator Control Center' : 'General Manager Console'}
            </h1>
            <p className="text-xs sm:text-sm text-stone-500">
              {isAdmin
                ? 'Confidential order history, revenue reports, menu catalog, staff credentials, and café policies.'
                : 'Confidential order history, live status controls, menu availability, and revenue reports.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleExportSalesCsv}
              className="min-h-[42px] px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Sales CSV</span>
            </button>
          </div>
        </div>

        <nav
          aria-label="Management sections"
          className="max-w-7xl mx-auto mt-5 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none"
        >
          {availableTabs.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`min-h-[44px] px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'border-teal-700 text-teal-900 font-bold bg-teal-50/40 rounded-t-lg'
                    : 'border-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-t-lg'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-700' : 'text-stone-400'}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {hubNotice && (
          <div
            role="status"
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              hubNotice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {hubNotice.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              ) : (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              )}
              <span>{hubNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setHubNotice(null)}
              className="font-semibold px-2 py-1 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 0: COMPLETE ORDER HISTORY */}
        {activeTab === 'orders' && (
          <OrderHistoryView
            currentUser={currentUser}
            tables={tables}
            liveOrderSignal={liveOrderSignal}
            onOrderUpdated={() => {
              loadReports();
              loadAudits();
              onRefreshData?.();
            }}
          />
        )}

        {/* TAB 1: REPORTS & REVENUE */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {reportsData && !isLoadingReports ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-stone-200 space-y-1">
                    <span className="text-xs font-medium text-stone-500 block">Collected Revenue</span>
                    <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                      Nu. {reportsData.summary.totalCollectedSales}
                    </div>
                    <p className="text-[11px] text-stone-500">From {reportsData.summary.paidBillsCount} settled bills</p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200 space-y-1">
                    <span className="text-xs font-medium text-stone-500 block">Outstanding Balances</span>
                    <div className="text-2xl font-bold text-amber-800 font-mono tabular-nums">
                      Nu. {reportsData.summary.totalOutstandingBalance}
                    </div>
                    <p className="text-[11px] text-stone-500">Across {reportsData.summary.openBillsCount} open tables</p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200 space-y-1">
                    <span className="text-xs font-medium text-stone-500 block">Authorized Discounts</span>
                    <div className="text-2xl font-bold text-stone-900 font-mono tabular-nums">
                      Nu. {reportsData.summary.totalDiscountsGiven}
                    </div>
                    <p className="text-[11px] text-stone-500">Courtesy &amp; promotional deductions</p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200 space-y-1">
                    <span className="text-xs font-medium text-stone-500 block">Total Orders Placed</span>
                    <div className="text-2xl font-bold text-stone-900 font-mono tabular-nums">
                      {reportsData.summary.totalOrders}
                    </div>
                    <p className="text-[11px] text-stone-500">Table QR &amp; counter channels</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                    <div className="space-y-0.5">
                      <h2 className="text-base font-bold text-stone-900 font-display">Top Ordered Dishes &amp; Drinks</h2>
                      <p className="text-xs text-stone-500">Ranked by total portions prepared</p>
                    </div>

                    <div className="divide-y divide-stone-100">
                      {reportsData.popularDishes.length === 0 ? (
                        <div className="text-xs text-stone-500 py-8 text-center">No orders recorded yet.</div>
                      ) : (
                        reportsData.popularDishes.map((dish: any, idx: number) => (
                          <div key={dish.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs sm:text-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 text-stone-400 font-mono tabular-nums text-xs font-semibold shrink-0">
                                #{idx + 1}
                              </span>
                              <span className="font-semibold text-stone-900 truncate">{dish.name}</span>
                            </div>
                            <div className="text-right shrink-0 font-mono tabular-nums">
                              <span className="font-bold text-stone-900">{dish.quantity} sold</span>
                              <span className="text-stone-500 block text-xs">Nu. {dish.revenue}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Category Revenue Breakdown (Pure SVG Proportional Bar — Zero Inline Styles) */}
                  <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                    <div className="space-y-0.5">
                      <h2 className="text-base font-bold text-stone-900 font-display">Revenue by Menu Category</h2>
                      <p className="text-xs text-stone-500">Share of collected food &amp; beverage sales</p>
                    </div>

                    <div className="space-y-4">
                      {reportsData.categoryBreakdown.map((cat: any) => {
                        const maxCatRevenue = Math.max(
                          1,
                          ...reportsData.categoryBreakdown.map((c: any) => Number(c.revenue) || 0)
                        );
                        const barPct = Math.min(100, Math.max(0, ((Number(cat.revenue) || 0) / maxCatRevenue) * 100));

                        return (
                          <div key={cat.categoryId} className="space-y-1.5">
                            <div className="flex justify-between items-baseline text-xs sm:text-sm">
                              <span className="font-semibold text-stone-800">{cat.categoryName}</span>
                              <span className="font-mono tabular-nums font-bold text-stone-900">
                                Nu. {cat.revenue}
                              </span>
                            </div>
                            <svg
                              viewBox="0 0 100 3"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                              className="w-full h-2 rounded-full overflow-hidden bg-stone-100 block"
                            >
                              <rect x="0" y="0" width={barPct} height="3" className="fill-teal-700" />
                            </svg>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-xs text-stone-500">
                Loading financial reports...
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MENU & DISHES */}
        {activeTab === 'menu' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <div className="relative flex-1 sm:max-w-xs">
                  <label htmlFor="admin-menu-search" className="sr-only">Search menu dishes</label>
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-menu-search"
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Search dishes..."
                    className="w-full h-11 pl-10 pr-3.5 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>

                <select
                  aria-label="Filter dishes by category"
                  value={selectedCatFilter}
                  onChange={(e) => setSelectedCatFilter(e.target.value)}
                  className="h-11 px-3.5 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                >
                  <option value="all">All Categories ({menuItems.length})</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={openNewDish}
                className="min-h-[44px] px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Dish</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              {filteredMenuItems.length === 0 ? (
                <div className="p-12 text-center text-xs sm:text-sm text-stone-500">
                  No menu dishes match your current filter.
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold">
                        <tr>
                          <th className="py-3.5 px-4">Dish</th>
                          <th className="py-3.5 px-4">Category &amp; Diet</th>
                          <th className="py-3.5 px-4 text-right">Official Price</th>
                          <th className="py-3.5 px-4">Visibility &amp; Stock</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredMenuItems.map(item => {
                          const cat = categories.find(c => c.id === item.categoryId);
                          const hasImgError = brokenImages[item.id];
                          return (
                            <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  {item.imageUrl && !hasImgError ? (
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      referrerPolicy="no-referrer"
                                      onError={() => setBrokenImages(prev => ({ ...prev, [item.id]: true }))}
                                      className="w-11 h-11 rounded-xl object-cover bg-stone-100 border border-stone-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-11 h-11 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                                      <Utensils className="w-4 h-4" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <span className="font-bold text-stone-900 block text-sm truncate max-w-xs">
                                      {item.name}
                                    </span>
                                    <span className="text-xs text-stone-500 line-clamp-1 max-w-sm">
                                      {item.description}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-stone-800">{cat?.name || item.categoryId}</div>
                                <div className="text-[11px] text-stone-500">
                                  {DIET_LABELS[item.dietType] || item.dietType} · {item.preparationTimeMinutes} min prep
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-stone-900 text-sm whitespace-nowrap">
                                Nu. {item.price}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onToggleAvailability(item.id, !item.isAvailable, item.soldOut)}
                                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                      item.isAvailable
                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100/70'
                                        : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200/70'
                                    }`}
                                  >
                                    {item.isAvailable ? 'Menu Active' : 'Hidden'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onToggleAvailability(item.id, item.isAvailable, !item.soldOut)}
                                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                      item.soldOut
                                        ? 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100/70'
                                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                                    }`}
                                  >
                                    {item.soldOut ? 'Sold Out' : 'In Stock'}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSaveDishError(null);
                                      setEditingItem({ ...item });
                                    }}
                                    className="min-h-[36px] px-2.5 text-stone-700 hover:text-stone-900 rounded-lg hover:bg-stone-100 inline-flex items-center gap-1 font-semibold cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-stone-500" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPendingDelete({
                                        kind: 'dish',
                                        id: item.id,
                                        label: item.name
                                      })
                                    }
                                    className="min-h-[36px] px-2.5 text-rose-600 hover:text-rose-800 rounded-lg hover:bg-rose-50 inline-flex items-center gap-1 font-semibold cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden divide-y divide-stone-200">
                    {filteredMenuItems.map(item => {
                      const cat = categories.find(c => c.id === item.categoryId);
                      return (
                        <div key={item.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-sm text-stone-900">{item.name}</h3>
                              <p className="text-xs text-stone-500">
                                {cat?.name || item.categoryId} · {DIET_LABELS[item.dietType] || item.dietType}
                              </p>
                            </div>
                            <span className="font-mono tabular-nums font-bold text-sm text-stone-900 shrink-0">
                              Nu. {item.price}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onToggleAvailability(item.id, !item.isAvailable, item.soldOut)}
                                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                                  item.isAvailable
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                    : 'bg-stone-100 text-stone-600 border-stone-200'
                                }`}
                              >
                                {item.isAvailable ? 'Active' : 'Hidden'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onToggleAvailability(item.id, item.isAvailable, !item.soldOut)}
                                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                                  item.soldOut
                                    ? 'bg-rose-50 text-rose-900 border-rose-200'
                                    : 'bg-white text-stone-700 border-stone-200'
                                }`}
                              >
                                {item.soldOut ? 'Sold Out' : 'In Stock'}
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSaveDishError(null);
                                  setEditingItem({ ...item });
                                }}
                                className="min-h-[38px] px-3 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDelete({
                                    kind: 'dish',
                                    id: item.id,
                                    label: item.name
                                  })
                                }
                                className="min-h-[38px] px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: STAFF ACCOUNTS & ROLES (Admin Only) */}
        {isAdmin && activeTab === 'staff' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="text-base font-bold text-stone-900 font-display">Staff &amp; Management Accounts</h2>
                <p className="text-xs text-stone-500">
                  Assign station permissions across Admin, General Manager, Counter Staff, and Kitchen Cook roles.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStaffError(null);
                  setEditingStaff({
                    name: '',
                    username: '',
                    role: 'kitchen',
                    pin: '1234',
                    active: true
                  });
                }}
                className="min-h-[42px] px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Staff Account</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {staffUsers.map((st) => (
                <article
                  key={st.id}
                  className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 shrink-0">
                          {st.role === 'kitchen' && <ChefHat className="w-4 h-4 text-teal-800" />}
                          {st.role === 'cashier' && <CreditCard className="w-4 h-4 text-teal-800" />}
                          {(st.role === 'admin' || st.role === 'manager') && <Shield className="w-4 h-4 text-teal-800" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-stone-900">{st.name}</h3>
                          <span className="text-xs text-stone-500 font-mono">@{st.username}</span>
                        </div>
                      </div>
                      {getRoleLabel(st.role)}
                    </div>

                    <dl className="divide-y divide-stone-100 border-t border-b border-stone-100 text-xs">
                      <div className="py-2 flex justify-between gap-2">
                        <dt className="text-stone-500">Workspace</dt>
                        <dd className="font-semibold text-stone-900 text-right">
                          {st.role === 'kitchen' && 'Chef Dashboard (KDS)'}
                          {st.role === 'cashier' && 'Counter Billing & POS'}
                          {st.role === 'admin' && 'Full System Admin'}
                          {st.role === 'manager' && 'Order History & Reports'}
                        </dd>
                      </div>
                      <div className="py-2 flex justify-between gap-2">
                        <dt className="text-stone-500">Terminal PIN</dt>
                        <dd className="font-mono font-semibold text-stone-700">•••• (Protected)</dd>
                      </div>
                      <div className="py-2 flex justify-between gap-2">
                        <dt className="text-stone-500">Status</dt>
                        <dd className={`font-semibold ${st.active ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {st.active ? 'Active' : 'Deactivated'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStaffError(null);
                        setEditingStaff({ ...st, pin: '' });
                      }}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-stone-500" />
                      <span>Edit</span>
                    </button>
                    {st.username !== 'admin' && (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            kind: 'staff',
                            id: st.id,
                            label: `${st.name} (@${st.username})`
                          })
                        }
                        className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TABLES & QR CARDS */}
        {activeTab === 'tables' && (
          <TableQRManagement
            embedded={true}
            currentUser={currentUser}
            onSelectTableForCustomerView={(tableId, token) => onSelectTableForCustomerView?.(tableId, token)}
            onRefreshData={onRefreshData}
          />
        )}

        {/* TAB 5: PRICE AUDITS */}
        {activeTab === 'price_audits' && (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-stone-200 space-y-1">
              <h2 className="text-base font-bold text-stone-900 font-display">Price Modification Audit Trail</h2>
              <p className="text-xs text-stone-500">
                Every official menu price change is logged with staff identity, previous price, new price, and timestamp.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Dish</th>
                    <th className="py-3 px-4 text-right">Previous Price</th>
                    <th className="py-3 px-4 text-right">New Price</th>
                    <th className="py-3 px-4">Changed By</th>
                    <th className="py-3 px-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {auditLogs.priceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-stone-500">
                        No dish price modifications recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.priceLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-stone-50/60">
                        <td className="py-3 px-4 text-stone-500 font-mono tabular-nums whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-semibold text-stone-900">{log.menuItemName}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-500">
                          Nu. {log.previousPrice}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                          Nu. {log.newPrice}
                        </td>
                        <td className="py-3 px-4 text-stone-700">{log.changedBy}</td>
                        <td className="py-3 px-4 text-stone-500">{log.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: SYSTEM LOGS */}
        {activeTab === 'system_logs' && (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-stone-200 space-y-1">
              <h2 className="text-base font-bold text-stone-900 font-display">Operational &amp; Security Audit Log</h2>
              <p className="text-xs text-stone-500">
                Chronological record of order placements, kitchen updates, payment settlements, and configuration changes.
              </p>
            </div>

            <div className="max-h-[480px] overflow-y-auto divide-y divide-stone-100 text-xs">
              {auditLogs.generalLogs.length === 0 ? (
                <div className="text-stone-500 py-10 text-center">No operational logs recorded yet.</div>
              ) : (
                auditLogs.generalLogs
                  .slice()
                  .reverse()
                  .map((log: any) => (
                    <div key={log.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-stone-50/60">
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-teal-900 mr-2">[{log.action}]</span>
                        <span className="text-stone-700">{log.details}</span>
                      </div>
                      <div className="text-stone-500 font-mono tabular-nums text-[11px] shrink-0">
                        {log.performedBy || log.staffName || 'System'} · {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* TAB 7: SETTINGS & POLICIES (Admin Only) */}
        {isAdmin && activeTab === 'settings' && (
          <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 space-y-6 max-w-2xl">
            <div className="space-y-1 border-b border-stone-100 pb-4">
              <h2 className="text-lg font-bold text-stone-900 font-display">Café Policies &amp; System Settings</h2>
              <p className="text-xs text-stone-500">
                Configure guest ordering availability, menu price visibility, kitchen audio chimes, and tax rates.
              </p>
            </div>

            {settingsSaved && (
              <div role="status" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Settings saved and synchronized across all stations.</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <label
                htmlFor="setting-allow-guest-ordering"
                className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex items-start justify-between gap-4 cursor-pointer"
              >
                <div>
                  <div className="font-bold text-stone-900 text-sm">Enable Anonymous Guest Self-Ordering</div>
                  <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">
                    Allows guests to submit anonymous pickup and table QR orders from their phones. Pause during maintenance or private events.
                  </p>
                </div>
                <input
                  id="setting-allow-guest-ordering"
                  type="checkbox"
                  checked={settingForm.allowGuestOrdering !== false}
                  onChange={(e) => setSettingForm(prev => ({ ...prev, allowGuestOrdering: e.target.checked }))}
                  className="w-5 h-5 accent-teal-700 rounded cursor-pointer mt-0.5 shrink-0"
                />
              </label>

              <label
                htmlFor="setting-show-prices"
                className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex items-start justify-between gap-4 cursor-pointer"
              >
                <div>
                  <div className="font-bold text-stone-900 text-sm">Show Prices on Customer Menu</div>
                  <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">
                    When disabled, guest menus hide prices and present itemized bills at the cashier counter.
                  </p>
                  <span
                    className={`inline-block mt-2 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                      settingForm.showPricesOnCustomerMenu
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    }`}
                  >
                    {settingForm.showPricesOnCustomerMenu ? 'Prices Visible to Guests' : 'Prices Hidden on Guest Menu'}
                  </span>
                </div>
                <input
                  id="setting-show-prices"
                  type="checkbox"
                  checked={!!settingForm.showPricesOnCustomerMenu}
                  onChange={(e) => setSettingForm(prev => ({ ...prev, showPricesOnCustomerMenu: e.target.checked }))}
                  className="w-5 h-5 accent-teal-700 rounded cursor-pointer mt-0.5 shrink-0"
                />
              </label>

              <label
                htmlFor="setting-kitchen-chime"
                className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex items-start justify-between gap-4 cursor-pointer"
              >
                <div>
                  <div className="font-bold text-stone-900 text-sm">Default Kitchen Audio Chime Alert</div>
                  <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">
                    Play an audible notification chime on staff terminals whenever a new order arrives.
                  </p>
                </div>
                <input
                  id="setting-kitchen-chime"
                  type="checkbox"
                  checked={!!settingForm.kitchenAudioAlert}
                  onChange={(e) => setSettingForm(prev => ({ ...prev, kitchenAudioAlert: e.target.checked }))}
                  className="w-5 h-5 accent-teal-700 rounded cursor-pointer mt-0.5 shrink-0"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label htmlFor="setting-restaurant-name" className="font-semibold text-stone-700 block">Restaurant Name</label>
                  <input
                    id="setting-restaurant-name"
                    type="text"
                    value={settingForm.restaurantName}
                    onChange={(e) => setSettingForm(prev => ({ ...prev, restaurantName: e.target.value }))}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="setting-operating-hours" className="font-semibold text-stone-700 block">Operating Hours</label>
                  <input
                    id="setting-operating-hours"
                    type="text"
                    value={settingForm.operatingHours}
                    onChange={(e) => setSettingForm(prev => ({ ...prev, operatingHours: e.target.value }))}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="setting-tax-rate" className="font-semibold text-stone-700 block">
                    Bhutan Sales Tax Rate (0.05 = 5%)
                  </label>
                  <input
                    id="setting-tax-rate"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settingForm.taxRate}
                    onChange={(e) => setSettingForm(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="setting-service-rate" className="font-semibold text-stone-700 block">
                    Service Charge Rate (0.10 = 10%)
                  </label>
                  <input
                    id="setting-service-rate"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settingForm.serviceChargeRate}
                    onChange={(e) => setSettingForm(prev => ({ ...prev, serviceChargeRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="setting-address" className="font-semibold text-stone-700 block">Street Address</label>
                <input
                  id="setting-address"
                  type="text"
                  value={settingForm.address}
                  onChange={(e) => setSettingForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="setting-phone" className="font-semibold text-stone-700 block">Contact Telephone</label>
                <input
                  id="setting-phone"
                  type="text"
                  value={settingForm.phone}
                  onChange={(e) => setSettingForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="pt-4 border-t border-stone-100 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (!onUpdateSettings) return;
                    try {
                      setHubNotice(null);
                      await onUpdateSettings(settingForm);
                      setSettingsSaved(true);
                      setTimeout(() => setSettingsSaved(false), 3000);
                    } catch (err: any) {
                      setHubNotice({
                        type: 'error',
                        message: err.message || 'Failed to save system settings'
                      });
                    }
                  }}
                  className="min-h-[46px] px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Save Policy Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dish Add/Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dish-modal-title"
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-stone-200 space-y-4 my-8"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 id="dish-modal-title" className="text-base font-bold text-stone-900 font-display">
                {editingItem.id && menuItems.some(m => m.id === editingItem.id) ? 'Edit Menu Dish' : 'Add New Menu Dish'}
              </h3>
              <button
                type="button"
                aria-label="Close dish dialog"
                onClick={() => setEditingItem(null)}
                className="w-9 h-9 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveDishError && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{saveDishError}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label htmlFor="dish-name-input" className="font-semibold text-stone-700 block">Dish Name</label>
                <input
                  id="dish-name-input"
                  type="text"
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Bhutanese Kewa Datshi"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="dish-cat-select" className="font-semibold text-stone-700 block">Category</label>
                  <select
                    id="dish-cat-select"
                    value={editingItem.categoryId}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full min-h-[44px] px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="dish-price-input" className="font-semibold text-stone-700 block">Official Price (Nu.)</label>
                  <input
                    id="dish-price-input"
                    type="number"
                    value={editingItem.price || 0}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, price: Number(e.target.value) }))}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums font-bold focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="dish-desc-input" className="font-semibold text-stone-700 block">Description</label>
                <textarea
                  id="dish-desc-input"
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="dish-diet-select" className="font-semibold text-stone-700 block">Dietary Classification</label>
                  <select
                    id="dish-diet-select"
                    value={editingItem.dietType}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, dietType: e.target.value as DietType }))}
                    className="w-full min-h-[44px] px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="non-veg">Non-Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="egg">Contains Egg</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="dish-prep-input" className="font-semibold text-stone-700 block">Prep Time (Minutes)</label>
                  <input
                    id="dish-prep-input"
                    type="number"
                    value={editingItem.preparationTimeMinutes || 10}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, preparationTimeMinutes: Number(e.target.value) }))}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="dish-image-input" className="font-semibold text-stone-700 block">Photo URL</label>
                <input
                  id="dish-image-input"
                  type="text"
                  value={editingItem.imageUrl || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-[11px] focus:bg-white focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDish}
                className="min-h-[44px] px-5 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-colors cursor-pointer"
              >
                Save Dish Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Account Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-modal-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 id="staff-modal-title" className="text-base font-bold text-stone-900 font-display">
                {editingStaff.id ? 'Edit Staff Account' : 'Create Staff Account'}
              </h3>
              <button
                type="button"
                aria-label="Close staff dialog"
                onClick={() => setEditingStaff(null)}
                className="w-9 h-9 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {staffError && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{staffError}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label htmlFor="staff-fullname-input" className="font-semibold text-stone-700 block">Full Name</label>
                <input
                  id="staff-fullname-input"
                  type="text"
                  value={editingStaff.name || ''}
                  onChange={(e) => setEditingStaff(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Tshering Penjor"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="staff-username-input" className="font-semibold text-stone-700 block">Username</label>
                  <input
                    id="staff-username-input"
                    type="text"
                    value={editingStaff.username || ''}
                    onChange={(e) => setEditingStaff(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="e.g. tshering"
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="staff-pin-input" className="font-semibold text-stone-700 block">
                    {editingStaff.id ? 'New PIN (Optional)' : 'PIN Code (4–8 chars)'}
                  </label>
                  <input
                    id="staff-pin-input"
                    type="password"
                    autoComplete="new-password"
                    maxLength={8}
                    value={editingStaff.pin || ''}
                    onChange={(e) => setEditingStaff(prev => ({ ...prev, pin: e.target.value }))}
                    placeholder={editingStaff.id ? 'Keep current' : 'e.g. 5678'}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-center focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="staff-role-select" className="font-semibold text-stone-700 block">Assigned Role</label>
                <select
                  id="staff-role-select"
                  value={editingStaff.role || 'kitchen'}
                  disabled={editingStaff.username === 'admin'}
                  onChange={(e) => setEditingStaff(prev => ({ ...prev, role: e.target.value as Role }))}
                  className="w-full min-h-[44px] px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700 disabled:bg-stone-100 disabled:text-stone-500"
                >
                  <option value="kitchen">Kitchen Cook (Active Kitchen Queue Only)</option>
                  <option value="cashier">Counter Staff (Active Billing Only)</option>
                  <option value="manager">GM · General Manager (Order History &amp; Reports)</option>
                  <option value="admin">Admin (Full System, Users &amp; Settings)</option>
                </select>
                <p className="text-[11px] text-stone-500 pt-0.5">
                  Only GM and Admin roles can access the complete order history.
                </p>
              </div>

              <div className="pt-1 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="staffActiveCheck"
                  disabled={editingStaff.username === 'admin'}
                  checked={editingStaff.active !== false}
                  onChange={(e) => setEditingStaff(prev => ({ ...prev, active: e.target.checked }))}
                  className="w-4 h-4 accent-teal-700 rounded disabled:opacity-50"
                />
                <label htmlFor="staffActiveCheck" className="text-stone-700 font-semibold cursor-pointer">
                  Account is active and permitted to sign in
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStaff}
                className="min-h-[44px] px-5 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-colors cursor-pointer"
              >
                Save Staff Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Modal */}
      {editingTable && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900 font-display">
                {editingTable.id && tablesWithQR.some(t => t.id === editingTable.id) ? 'Edit Dining Table' : 'Add Dining Table'}
              </h3>
              <button
                type="button"
                aria-label="Close table dialog"
                onClick={() => setEditingTable(null)}
                className="w-9 h-9 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tableError && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{tableError}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="admin-table-id" className="font-semibold text-stone-700 block">Table ID / Code</label>
                  <input
                    id="admin-table-id"
                    type="text"
                    value={editingTable.id || ''}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, id: e.target.value.toUpperCase() }))}
                    placeholder="e.g. T09"
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="admin-table-name" className="font-semibold text-stone-700 block">Table Name</label>
                  <input
                    id="admin-table-name"
                    type="text"
                    value={editingTable.tableNumber || ''}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, tableNumber: e.target.value }))}
                    placeholder="e.g. Table 9"
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="admin-table-section" className="font-semibold text-stone-700 block">Section</label>
                  <input
                    id="admin-table-section"
                    type="text"
                    value={editingTable.section || ''}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, section: e.target.value }))}
                    placeholder="e.g. Main Hall"
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="admin-table-capacity" className="font-semibold text-stone-700 block">Guest Capacity</label>
                  <input
                    id="admin-table-capacity"
                    type="number"
                    min={0}
                    value={editingTable.capacity || 2}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums focus:bg-white focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingTable(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTable}
                className="min-h-[44px] px-5 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-colors cursor-pointer"
              >
                Save Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Delete Confirmation Dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-stone-200 space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-stone-900 font-display">Confirm Deletion</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Are you sure you want to permanently delete <strong>{pendingDelete.label}</strong>? This action is recorded in the security audit trail.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
