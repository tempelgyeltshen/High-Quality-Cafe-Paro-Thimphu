import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Clock,
  Download,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  History,
  FileSpreadsheet,
  X,
  Search,
  Filter,
  Check,
  Users,
  Shield,
  ChefHat,
  CreditCard,
  QrCode,
  Printer,
  ExternalLink,
  KeyRound,
  Lock,
  Layers
} from 'lucide-react';
import {
  MenuItem,
  MenuCategory,
  SystemSettings,
  DietType,
  PriceAuditLog,
  StaffUser,
  RestaurantTable,
  Role
} from '../types/index.ts';
import { api } from '../lib/api.ts';
import { TableQRManagement } from './TableQRManagement.tsx';

interface AdminHubProps {
  menuItems: MenuItem[];
  categories: MenuCategory[];
  settings: SystemSettings;
  currentUser: StaffUser | null;
  tables: RestaurantTable[];
  onSaveMenuItem: (item: Partial<MenuItem>) => Promise<void>;
  onToggleAvailability: (id: string, isAvailable: boolean, soldOut: boolean) => Promise<void>;
  onDeleteMenuItem: (id: string) => Promise<void>;
  onFetchReports: () => Promise<any>;
  onFetchAuditLogs: () => Promise<any>;
  onUpdateSettings?: (updates: Partial<SystemSettings>) => Promise<void>;
  onRefreshData?: () => void;
  onSelectTableForCustomerView?: (tableId: string, token?: string) => void;
}

export const AdminHub: React.FC<AdminHubProps> = ({
  menuItems,
  categories,
  settings,
  currentUser,
  tables,
  onSaveMenuItem,
  onToggleAvailability,
  onDeleteMenuItem,
  onFetchReports,
  onFetchAuditLogs,
  onUpdateSettings,
  onRefreshData,
  onSelectTableForCustomerView
}) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'menu' | 'staff' | 'tables' | 'price_audits' | 'system_logs' | 'settings'>('reports');
  const [reportsData, setReportsData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<{ generalLogs: any[]; priceLogs: any[] }>({ generalLogs: [], priceLogs: [] });
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [settingForm, setSettingForm] = useState(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Staff management state
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Partial<StaffUser> | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Table management state
  const [tablesWithQR, setTablesWithQR] = useState<Array<RestaurantTable & { qrUrl: string; qrCodeDataUrl: string }>>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [editingTable, setEditingTable] = useState<Partial<RestaurantTable> | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  // Menu item editing state
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [saveDishError, setSaveDishError] = useState<string | null>(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');

  useEffect(() => {
    loadReports();
    loadAudits();
    loadStaff();
    loadTables();
  }, []);

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
      setIsLoadingStaff(true);
      const data = await api.getAdminStaff();
      setStaffUsers(data);
    } catch (e) {
      console.error('Failed to load staff accounts', e);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const loadTables = async () => {
    try {
      setIsLoadingTables(true);
      const data = await api.getTablesWithQR();
      setTablesWithQR(data);
    } catch (e) {
      console.error('Failed to load tables with QR', e);
    } finally {
      setIsLoadingTables(false);
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
      setSaveDishError('Dish name must be at least 2 characters long');
      return;
    }
    const priceNum = Number(editingItem.price);
    if (isNaN(priceNum) || priceNum < 0) {
      setSaveDishError('Price must be a valid non-negative number');
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

  // Staff Save & Delete
  const handleSaveStaff = async () => {
    if (!editingStaff) return;
    if (!editingStaff.name || editingStaff.name.trim().length < 2) {
      setStaffError('Staff member name must be at least 2 characters long');
      return;
    }
    if (!editingStaff.username || editingStaff.username.trim().length < 2) {
      setStaffError('Username must be at least 2 characters long');
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

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff account?')) return;
    try {
      await api.deleteAdminStaff(id);
      await loadStaff();
      onRefreshData?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete staff account');
    }
  };

  // Table Save & Delete
  const handleSaveTable = async () => {
    if (!editingTable) return;
    if (!editingTable.tableNumber || editingTable.tableNumber.trim().length === 0) {
      setTableError('Table number/name is required');
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

  const handleDeleteTable = async (id: string) => {
    if (!confirm('Are you sure you want to delete this table?')) return;
    try {
      await api.deleteAdminTable(id);
      await loadTables();
      onRefreshData?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete table');
    }
  };

  const filteredMenuItems = menuItems.filter(m => {
    if (selectedCatFilter !== 'all' && m.categoryId !== selectedCatFilter) return false;
    if (menuSearch.trim() && !m.name.toLowerCase().includes(menuSearch.toLowerCase())) return false;
    return true;
  });

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'kitchen':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Kitchen Cook</span>;
      case 'cashier':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">Counter Staff</span>;
      case 'admin':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-300">Administrator</span>;
      case 'manager':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Floor Manager</span>;
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-20">
      {/* Top Header */}
      <div className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 shadow-xs no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
                Administrator Control Center
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-stone-900 text-amber-400">
                ROLE: ADMIN
              </span>
            </div>
            <p className="text-xs text-stone-500">
              High Quality Cafe · Full System Management, Staff Accounts, Tables, and Financial Audits
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/admin/reports/export-csv"
              download
              className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Sales CSV</span>
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto mt-4 flex items-center gap-1 sm:gap-2 border-b border-stone-200 overflow-x-auto pb-1">
          {[
            { id: 'reports', label: 'Reports & Revenue', icon: TrendingUp },
            { id: 'menu', label: 'Menu & Dishes', icon: ShoppingBag },
            { id: 'staff', label: 'Staff Accounts & Roles', icon: Users },
            { id: 'tables', label: 'Tables & QR Cards', icon: QrCode },
            { id: 'price_audits', label: 'Price Audits', icon: History },
            { id: 'system_logs', label: 'System Logs', icon: Clock },
            { id: 'settings', label: 'Restaurant Settings', icon: Shield },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-1 flex items-center gap-1.5 ${
                  activeTab === t.id
                    ? 'border-amber-600 text-amber-800 font-bold bg-amber-50/50 rounded-t-lg'
                    : 'border-transparent text-stone-500 hover:text-stone-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* TAB 1: REPORTS & REVENUE */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {reportsData ? (
              <>
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs space-y-1">
                    <span className="text-xs font-semibold text-stone-500 uppercase">
                      Total Collected Revenue
                    </span>
                    <div className="text-2xl font-extrabold text-emerald-700 font-mono tabular-nums">
                      Nu. {reportsData.summary.totalCollectedSales}
                    </div>
                    <p className="text-[11px] text-stone-400">
                      From {reportsData.summary.paidBillsCount} settled bills
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs space-y-1">
                    <span className="text-xs font-semibold text-stone-500 uppercase">
                      Outstanding Balances
                    </span>
                    <div className="text-2xl font-extrabold text-amber-700 font-mono tabular-nums">
                      Nu. {reportsData.summary.totalOutstandingBalance}
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Across {reportsData.summary.openBillsCount} active tables
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs space-y-1">
                    <span className="text-xs font-semibold text-stone-500 uppercase">
                      Discounts Courtesy
                    </span>
                    <div className="text-2xl font-extrabold text-stone-900 font-mono tabular-nums">
                      Nu. {reportsData.summary.totalDiscountsGiven}
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Authorized staff & promotional deductions
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs space-y-1">
                    <span className="text-xs font-semibold text-stone-500 uppercase">
                      Total Orders Placed
                    </span>
                    <div className="text-2xl font-extrabold text-stone-900 font-mono tabular-nums">
                      {reportsData.summary.totalOrders}
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Via customer QR codes & counter
                    </p>
                  </div>
                </div>

                {/* Popular Dishes & Categories */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Selling Dishes */}
                  <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs space-y-4">
                    <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                      Best Selling Dishes & Drinks
                    </h3>
                    <div className="space-y-2 divide-y divide-stone-100">
                      {reportsData.popularDishes.length === 0 ? (
                        <div className="text-xs text-stone-400 py-4 text-center">No orders recorded yet.</div>
                      ) : (
                        reportsData.popularDishes.map((dish: any, idx: number) => (
                          <div key={dish.id} className="pt-2 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-600 font-mono text-[11px] font-bold flex items-center justify-center">
                                #{idx + 1}
                              </span>
                              <span className="font-semibold text-stone-800">{dish.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-stone-900">{dish.quantity} orders</span>
                              <span className="text-stone-400 block text-[11px]">Nu. {dish.revenue}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Category Revenue Breakdown */}
                  <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs space-y-4">
                    <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                      Revenue by Menu Category
                    </h3>
                    <div className="space-y-3">
                      {reportsData.categoryBreakdown.map((cat: any) => (
                        <div key={cat.categoryId} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span>{cat.categoryName}</span>
                            <span className="font-mono">Nu. {cat.revenue}</span>
                          </div>
                          <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-amber-600 h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, reportsData.summary.totalCollectedSales > 0 ? (cat.revenue / reportsData.summary.totalCollectedSales) * 100 : 0)}%`
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-xs text-stone-400">Loading reports...</div>
            )}
          </div>
        )}

        {/* TAB 2: MENU & DISHES */}
        {activeTab === 'menu' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Search dishes..."
                    className="pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 w-48"
                  />
                </div>

                <select
                  value={selectedCatFilter}
                  onChange={(e) => setSelectedCatFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-xl"
                >
                  <option value="all">All Categories ({menuItems.length})</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={openNewDish}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Dish</span>
              </button>
            </div>

            {/* Menu Items Table */}
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Dish</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Official Price</th>
                      <th className="py-3 px-4">Kitchen Availability</th>
                      <th className="py-3 px-4">Diet</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredMenuItems.map(item => {
                      const cat = categories.find(c => c.id === item.categoryId);
                      return (
                        <tr key={item.id} className="hover:bg-stone-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-10 h-10 rounded-lg object-cover bg-stone-100"
                              />
                              <div>
                                <span className="font-bold text-stone-900 block">{item.name}</span>
                                <span className="text-[11px] text-stone-400 line-clamp-1 max-w-xs">{item.description}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-stone-600">
                            {cat?.name || item.categoryId}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-stone-900">
                            Nu. {item.price}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onToggleAvailability(item.id, !item.isAvailable, item.soldOut)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.isAvailable
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-stone-100 text-stone-500'
                                }`}
                              >
                                {item.isAvailable ? 'Active' : 'Hidden'}
                              </button>
                              <button
                                onClick={() => onToggleAvailability(item.id, item.isAvailable, !item.soldOut)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.soldOut
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                }`}
                              >
                                {item.soldOut ? 'SOLD OUT' : 'In Stock'}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.dietType === 'veg'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-stone-100 text-stone-700'
                            }`}>
                              {item.dietType}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSaveDishError(null);
                                  setEditingItem({ ...item });
                                }}
                                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100"
                                title="Edit Dish & Price"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteMenuItem(item.id)}
                                className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                title="Delete Dish"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STAFF ACCOUNTS & ROLES */}
        {activeTab === 'staff' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                  Staff Role-Based Accounts
                </h3>
                <p className="text-xs text-stone-500">
                  Manage login accounts and assign user roles: Customer, Kitchen Cook, Counter Staff, and Administrator.
                </p>
              </div>

              <button
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
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Staff Account</span>
              </button>
            </div>

            {/* Staff list */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffUsers.map((st) => (
                <div
                  key={st.id}
                  className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700">
                          {st.role === 'kitchen' && <ChefHat className="w-5 h-5 text-amber-600" />}
                          {st.role === 'cashier' && <CreditCard className="w-5 h-5 text-blue-600" />}
                          {(st.role === 'admin' || st.role === 'manager') && <Shield className="w-5 h-5 text-purple-600" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900">{st.name}</h4>
                          <span className="text-[11px] text-stone-500 font-mono">@{st.username}</span>
                        </div>
                      </div>
                      {getRoleBadge(st.role)}
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between text-stone-600">
                        <span>Station Access:</span>
                        <strong className="text-stone-900">
                          {st.role === 'kitchen' && 'Kitchen Display (KDS)'}
                          {st.role === 'cashier' && 'Counter Billing & POS'}
                          {st.role === 'admin' && 'Full Administrator'}
                          {st.role === 'manager' && 'Floor & Reports'}
                        </strong>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Terminal PIN:</span>
                        <span className="font-mono font-bold text-stone-800">{st.pin || '••••'}</span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Account Status:</span>
                        <span className={`font-semibold ${st.active ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {st.active ? 'Active' : 'Deactivated'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setStaffError(null);
                        setEditingStaff({ ...st });
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-lg flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3 text-stone-500" />
                      <span>Edit</span>
                    </button>
                    {st.username !== 'admin' && (
                      <button
                        onClick={() => handleDeleteStaff(st.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TABLES & QR CARDS */}
        {activeTab === 'tables' && (
          <TableQRManagement
            onSelectTableForCustomerView={(tableId, token) => onSelectTableForCustomerView?.(tableId, token)}
            onRefreshData={onRefreshData}
          />
        )}

        {/* TAB 5: PRICE AUDITS */}
        {activeTab === 'price_audits' && (
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Price Modification Audit Trail
              </h3>
              <p className="text-xs text-stone-500">
                Every dish price change is permanently recorded with staff identity, old price, new price, and justification.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Dish</th>
                    <th className="py-2.5 px-3">Previous Price</th>
                    <th className="py-2.5 px-3">New Price</th>
                    <th className="py-2.5 px-3">Changed By</th>
                    <th className="py-2.5 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {auditLogs.priceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-stone-400 font-sans">
                        No price modifications recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.priceLogs.map((log: any) => (
                      <tr key={log.id}>
                        <td className="py-2 px-3 text-stone-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="py-2 px-3 font-bold font-sans text-stone-900">{log.menuItemName}</td>
                        <td className="py-2 px-3 text-stone-400">Nu. {log.previousPrice}</td>
                        <td className="py-2 px-3 font-bold text-emerald-700">Nu. {log.newPrice}</td>
                        <td className="py-2 px-3 font-sans text-stone-700">{log.changedBy}</td>
                        <td className="py-2 px-3 font-sans text-stone-500">{log.reason}</td>
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
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                System Security & Operational Audit Log
              </h3>
              <p className="text-xs text-stone-500">
                Log of order creations, kitchen acknowledges, payment settlements, and policy updates.
              </p>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto divide-y divide-stone-100 text-xs">
              {auditLogs.generalLogs.length === 0 ? (
                <div className="text-stone-400 py-4 text-center">No system logs recorded yet.</div>
              ) : (
                auditLogs.generalLogs.slice().reverse().map((log: any) => (
                  <div key={log.id} className="pt-2 flex items-start justify-between gap-4 font-mono">
                    <div>
                      <span className="font-bold text-stone-800 mr-2">[{log.action}]</span>
                      <span className="text-stone-600 font-sans">{log.details}</span>
                    </div>
                    <div className="text-right shrink-0 text-stone-400 text-[11px]">
                      <span>{log.staffName} · {new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 7: SETTINGS & MENU PRICE POLICY */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs space-y-6 max-w-2xl">
            <div>
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                Cafe Policies & System Settings
              </h3>
              <p className="text-xs text-stone-500">
                Configure taxes, service charges, and customer-facing menu price visibility.
              </p>
            </div>

            {settingsSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Settings successfully saved and broadcast across all stations!</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Show prices on customer menu toggle */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex items-start justify-between gap-4">
                <div>
                  <div className="font-bold text-stone-900 text-sm">
                    Show Prices on Customer Menu
                  </div>
                  <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">
                    When disabled (default), dishes and customizations do not mention prices to guests on their phones. High Quality Cafe prepares dishes to order and prepares the bill at the cashier counter.
                  </p>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[11px] font-semibold ${
                    settingForm.showPricesOnCustomerMenu
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {settingForm.showPricesOnCustomerMenu ? 'Prices Visible to Guests' : 'Prices Hidden (Requested Policy)'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={!!settingForm.showPricesOnCustomerMenu}
                  onChange={(e) => setSettingForm(prev => ({ ...prev, showPricesOnCustomerMenu: e.target.checked }))}
                  className="w-5 h-5 accent-amber-600 rounded cursor-pointer mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Restaurant Name</label>
                  <input
                    type="text"
                    value={settingForm.restaurantName}
                    onChange={(e) => setSettingForm(prev => ({ ...prev, restaurantName: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Operating Hours</label>
                  <input
                    type="text"
                    value={settingForm.operatingHours}
                    onChange={(e) => setSettingForm(prev => ({ ...prev, operatingHours: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Bhutan Sales Tax Rate (0.05 = 5%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settingForm.taxRate}
                    onChange={(e) => setSettingForm(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Service Charge Rate (0.10 = 10%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settingForm.serviceChargeRate}
                    onChange={(e) => setSettingForm(prev => ({ ...prev, serviceChargeRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Address</label>
                <input
                  type="text"
                  value={settingForm.address}
                  onChange={(e) => setSettingForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Phone</label>
                <input
                  type="text"
                  value={settingForm.phone}
                  onChange={(e) => setSettingForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                />
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (onUpdateSettings) {
                      await onUpdateSettings(settingForm);
                      setSettingsSaved(true);
                      setTimeout(() => setSettingsSaved(false), 3000);
                    }
                  }}
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  Save Policy Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dish Add/Edit Drawer Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900 font-display">
                {editingItem.id && menuItems.some(m => m.id === editingItem.id) ? 'Edit Dish' : 'Create New Dish'}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="w-7 h-7 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveDishError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{saveDishError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Dish Name</label>
                <input
                  type="text"
                  value={editingItem.name || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Bhutanese Kewa Datshi"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Category</label>
                  <select
                    value={editingItem.categoryId}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg bg-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Official Price (Nu.)</label>
                  <input
                    type="number"
                    value={editingItem.price || 0}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, price: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Description</label>
                <textarea
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Diet Type</label>
                  <select
                    value={editingItem.dietType}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, dietType: e.target.value as DietType }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg bg-white"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="non-veg">Non-Vegetarian</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Prep Time (Mins)</label>
                  <input
                    type="number"
                    value={editingItem.preparationTimeMinutes || 10}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, preparationTimeMinutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Photo Image URL</label>
                <input
                  type="text"
                  value={editingItem.imageUrl || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3 py-2 text-xs text-stone-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDish}
                className="px-4 py-2 text-xs font-bold bg-stone-900 text-white rounded-lg"
              >
                Save Dish Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Account Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900 font-display">
                {editingStaff.id ? 'Edit Staff Account' : 'Create New Staff Member'}
              </h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="w-7 h-7 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {staffError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{staffError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingStaff.name || ''}
                  onChange={(e) => setEditingStaff(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Tshering Penjor"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Username</label>
                  <input
                    type="text"
                    value={editingStaff.username || ''}
                    onChange={(e) => setEditingStaff(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="e.g. tshering"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">PIN Code (4 digits)</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={editingStaff.pin || ''}
                    onChange={(e) => setEditingStaff(prev => ({ ...prev, pin: e.target.value }))}
                    placeholder="e.g. 5678"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Assigned Role</label>
                <select
                  value={editingStaff.role || 'kitchen'}
                  onChange={(e) => setEditingStaff(prev => ({ ...prev, role: e.target.value as Role }))}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg bg-white"
                >
                  <option value="kitchen">Kitchen Cook (Kitchen Display Only)</option>
                  <option value="cashier">Counter Staff (Billing & Payments Only)</option>
                  <option value="admin">Administrator (Full System Management)</option>
                  <option value="manager">Floor Manager (Operations & Reports)</option>
                </select>
                <p className="text-[11px] text-stone-400 mt-1">
                  Enforces strict access control: users cannot access interfaces outside their role.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="staffActiveCheck"
                  checked={editingStaff.active !== false}
                  onChange={(e) => setEditingStaff(prev => ({ ...prev, active: e.target.checked }))}
                  className="w-4 h-4 accent-amber-600 rounded"
                />
                <label htmlFor="staffActiveCheck" className="text-stone-700 font-semibold cursor-pointer">
                  Account is Active & Permitted to Login
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="px-3 py-2 text-xs text-stone-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStaff}
                className="px-4 py-2 text-xs font-bold bg-stone-900 text-white rounded-lg"
              >
                Save Staff Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Modal */}
      {editingTable && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900 font-display">
                {editingTable.id && tablesWithQR.some(t => t.id === editingTable.id) ? 'Edit Dining Table' : 'Add Dining Table'}
              </h3>
              <button
                onClick={() => setEditingTable(null)}
                className="w-7 h-7 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tableError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{tableError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Table ID / Code</label>
                  <input
                    type="text"
                    value={editingTable.id || ''}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, id: e.target.value.toUpperCase() }))}
                    placeholder="e.g. T09"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Table Name</label>
                  <input
                    type="text"
                    value={editingTable.tableNumber || ''}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, tableNumber: e.target.value }))}
                    placeholder="e.g. Table 9"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Section</label>
                  <input
                    type="text"
                    value={editingTable.section || ''}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, section: e.target.value }))}
                    placeholder="e.g. Riverside Garden"
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Guest Capacity</label>
                  <input
                    type="number"
                    min={0}
                    value={editingTable.capacity || 2}
                    onChange={(e) => setEditingTable(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTable(null)}
                className="px-3 py-2 text-xs text-stone-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTable}
                className="px-4 py-2 text-xs font-bold bg-stone-900 text-white rounded-lg"
              >
                Save Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
