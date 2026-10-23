import fs from 'fs';
import path from 'path';
import {
  StaffUser,
  RestaurantTable,
  MenuCategory,
  MenuItem,
  DiningSession,
  OrderRound,
  Bill,
  PaymentRecord,
  BillDiscount,
  AuditLog,
  PriceAuditLog,
  SystemSettings,
  OrderItem,
  OrderItemKitchenStatus,
  OrderStatus,
  PaymentMethod,
  Role
} from '../src/types/index.ts';
import { officialCategories, officialMenuItems } from './officialMenuData.ts';

interface DatabaseSchema {
  settings: SystemSettings;
  staffUsers: StaffUser[];
  tables: RestaurantTable[];
  categories: MenuCategory[];
  menuItems: MenuItem[];
  diningSessions: DiningSession[];
  orderRounds: OrderRound[];
  bills: Bill[];
  auditLogs: AuditLog[];
  priceAuditLogs: PriceAuditLog[];
  idempotencyKeys: Record<string, { orderId: string; timestamp: number }>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'cafe_db.json');
const TMP_FILE = path.resolve(DATA_DIR, 'cafe_db.tmp');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getInitialSeedData(): DatabaseSchema {
  const categories: MenuCategory[] = officialCategories;

  const menuItems: MenuItem[] = officialMenuItems;

  const tables: RestaurantTable[] = [
    { id: 'T01', tableNumber: 'Table 1', capacity: 2, section: 'Window Terrace', status: 'available', tableToken: 'tok_t01_hqc9812' },
    { id: 'T02', tableNumber: 'Table 2', capacity: 4, section: 'Window Terrace', status: 'available', tableToken: 'tok_t02_hqc4731' },
    { id: 'T03', tableNumber: 'Table 3', capacity: 2, section: 'Main Hall', status: 'available', tableToken: 'tok_t03_hqc6204' },
    { id: 'T04', tableNumber: 'Table 4', capacity: 4, section: 'Main Hall', status: 'available', tableToken: 'tok_t04_hqc1895' },
    { id: 'T05', tableNumber: 'Table 5', capacity: 6, section: 'Main Hall', status: 'available', tableToken: 'tok_t05_hqc3547' },
    { id: 'T06', tableNumber: 'Table 6', capacity: 4, section: 'Balcony Lounge', status: 'available', tableToken: 'tok_t06_hqc7782' },
    { id: 'T07', tableNumber: 'Table 7', capacity: 4, section: 'Balcony Lounge', status: 'available', tableToken: 'tok_t07_hqc8829' },
    { id: 'T08', tableNumber: 'Table 8', capacity: 8, section: 'Balcony Lounge', status: 'available', tableToken: 'tok_t08_hqc5416' },
    { id: 'TAKEAWAY', tableNumber: 'Takeaway Counter', capacity: 0, section: 'Quick Pick-up', status: 'available', tableToken: 'tok_takeaway_hqc0019' },
  ];

  const staffUsers: StaffUser[] = [
    { id: 'usr_admin', username: 'admin', name: 'Dechen Wangchuk (General Manager)', role: 'admin', active: true, pin: '1234' },
    { id: 'usr_cashier', username: 'cashier', name: 'Sonam Choden (Head Cashier)', role: 'cashier', active: true, pin: '2345' },
    { id: 'usr_chef', username: 'chef', name: 'Chef Tashi Dorji (Executive Chef)', role: 'kitchen', active: true, pin: '3456' },
    { id: 'usr_manager', username: 'manager', name: 'Karma Tshering (Floor Manager)', role: 'manager', active: true, pin: '4567' },
  ];

  const settings: SystemSettings = {
    restaurantName: 'High Quality Cafe',
    tagline: 'Paro, Bhutan · Open 24/7',
    operatingHours: '24 Hours / 7 Days a Week',
    currency: 'Nu.',
    currencySymbol: 'Nu.',
    taxRate: 0.05, // 5% Bhutan Sales Tax
    serviceChargeRate: 0.10, // 10% Service Charge
    allowGuestOrdering: true,
    kitchenAudioAlert: true,
    showPricesOnCustomerMenu: false, // User explicitly requested: "price shouldnt be mentioned"
    address: 'High Quality Cafe, Paro Town, Paro, Bhutan',
    phone: '+975 8 271234',
  };

  return {
    settings,
    staffUsers,
    tables,
    categories,
    menuItems,
    diningSessions: [],
    orderRounds: [],
    bills: [],
    auditLogs: [
      {
        id: 'aud_init',
        action: 'SYSTEM_BOOT',
        category: 'system',
        details: 'High Quality Cafe Paro 24/7 operating database initialized with official PDF menu and table configurations.',
        performedBy: 'System',
        timestamp: new Date().toISOString()
      }
    ],
    priceAuditLogs: [],
    idempotencyKeys: {}
  };
}

class CafeDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Verify schema sanity and ensure official High Quality Cafe menu from PDF is loaded
        const hasOfficialMenu = parsed.categories?.some((c: any) => c.id === 'cat_starter') && parsed.menuItems?.length >= 50;
        if (parsed.menuItems && parsed.tables && parsed.settings && hasOfficialMenu) {
          if (parsed.settings.showPricesOnCustomerMenu === undefined) {
            parsed.settings.showPricesOnCustomerMenu = false;
          }
          // Ensure every table has a unique cryptographic tableToken
          let hasUpdatedTokens = false;
          parsed.tables.forEach((t: RestaurantTable, idx: number) => {
            if (!t.tableToken) {
              t.tableToken = `tok_${t.id.toLowerCase()}_${(idx + 1) * 739}_${Math.random().toString(36).slice(2, 8)}`;
              hasUpdatedTokens = true;
            }
          });
          if (hasUpdatedTokens) {
            this.persist(parsed);
          }
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to read cafe database from file, re-initializing seed data:', err);
    }
    const seed = getInitialSeedData();
    this.persist(seed);
    return seed;
  }

  private persist(dataToSave?: DatabaseSchema) {
    const data = dataToSave || this.data;
    try {
      // Atomic write: write to temp file then rename
      fs.writeFileSync(TMP_FILE, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(TMP_FILE, DB_FILE);
    } catch (err) {
      console.error('CRITICAL: Failed to persist cafe database to disk:', err);
    }
  }

  // --- Settings ---
  getSettings(): SystemSettings {
    return this.data.settings;
  }

  updateSettings(updates: Partial<SystemSettings>, staffName: string): SystemSettings {
    this.data.settings = { ...this.data.settings, ...updates };
    this.addAuditLog('UPDATE_SETTINGS', 'system', `System settings updated: ${Object.keys(updates).join(', ')}`, staffName);
    this.persist();
    return this.data.settings;
  }

  // --- Staff & Auth ---
  getStaffUsers(): StaffUser[] {
    return this.data.staffUsers.map(u => ({ ...u, pin: '••••' }));
  }

  getStaffUsersForAdmin(): StaffUser[] {
    return this.data.staffUsers.map(u => ({ ...u }));
  }

  authenticate(usernameOrPin: string): StaffUser | null {
    const user = this.data.staffUsers.find(
      u => (u.username.toLowerCase() === usernameOrPin.toLowerCase() || u.pin === usernameOrPin) && u.active
    );
    if (!user) return null;
    return { ...user };
  }

  saveStaffUser(staffData: Partial<StaffUser>, changedByStaffName: string): StaffUser {
    if (!staffData.name || staffData.name.trim().length < 2) {
      throw new Error('Staff member name must be at least 2 characters long');
    }
    if (!staffData.username || staffData.username.trim().length < 2) {
      throw new Error('Username must be at least 2 characters long');
    }
    const validRoles: Role[] = ['admin', 'manager', 'cashier', 'kitchen'];
    if (!staffData.role || !validRoles.includes(staffData.role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const cleanUsername = staffData.username.trim().toLowerCase();
    const existingIndex = this.data.staffUsers.findIndex(u => u.id === staffData.id);

    // Check username uniqueness
    const duplicate = this.data.staffUsers.find(
      u => u.username.toLowerCase() === cleanUsername && u.id !== staffData.id
    );
    if (duplicate) {
      throw new Error(`Username "${cleanUsername}" is already taken by another staff member`);
    }

    if (existingIndex >= 0) {
      const existing = this.data.staffUsers[existingIndex];
      const updated: StaffUser = {
        ...existing,
        name: staffData.name.trim(),
        username: cleanUsername,
        role: staffData.role,
        pin: staffData.pin ? staffData.pin.trim() : existing.pin,
        active: staffData.active !== undefined ? staffData.active : existing.active
      };
      this.data.staffUsers[existingIndex] = updated;
      this.addAuditLog('UPDATE_STAFF', 'system', `Updated staff account ${updated.name} (${updated.username}, role: ${updated.role})`, changedByStaffName);
      this.persist();
      return updated;
    } else {
      const newStaff: StaffUser = {
        id: staffData.id || `usr_${Date.now()}`,
        name: staffData.name.trim(),
        username: cleanUsername,
        role: staffData.role,
        pin: staffData.pin ? staffData.pin.trim() : '1234',
        active: staffData.active !== undefined ? staffData.active : true
      };
      this.data.staffUsers.push(newStaff);
      this.addAuditLog('CREATE_STAFF', 'system', `Created staff account ${newStaff.name} (${newStaff.username}, role: ${newStaff.role})`, changedByStaffName);
      this.persist();
      return newStaff;
    }
  }

  deleteStaffUser(id: string, changedByStaffName: string): boolean {
    const idx = this.data.staffUsers.findIndex(u => u.id === id);
    if (idx < 0) return false;
    const user = this.data.staffUsers[idx];
    if (user.username === 'admin') {
      throw new Error('Primary administrator account cannot be deleted');
    }
    this.data.staffUsers.splice(idx, 1);
    this.addAuditLog('DELETE_STAFF', 'system', `Deleted staff account ${user.name} (${user.username})`, changedByStaffName);
    this.persist();
    return true;
  }

  // --- Tables ---
  getTables(): RestaurantTable[] {
    return this.data.tables;
  }

  getTable(id: string): RestaurantTable | null {
    return this.data.tables.find(t => t.id === id) || null;
  }

  updateTableStatus(tableId: string, status: RestaurantTable['status'], sessionId?: string | null): RestaurantTable {
    const table = this.data.tables.find(t => t.id === tableId);
    if (!table) throw new Error(`Table ${tableId} not found`);
    table.status = status;
    if (sessionId !== undefined) {
      table.currentSessionId = sessionId;
    }
    this.persist();
    return table;
  }

  saveTable(tableData: Partial<RestaurantTable>, changedByStaffName: string): RestaurantTable {
    if (!tableData.tableNumber || tableData.tableNumber.trim().length === 0) {
      throw new Error('Table number or name is required');
    }
    const capacity = Number(tableData.capacity);
    if (isNaN(capacity) || capacity < 0) {
      throw new Error('Table capacity must be 0 or greater');
    }

    const tableId = tableData.id ? tableData.id.trim().toUpperCase() : `T${String(this.data.tables.length + 1).padStart(2, '0')}`;
    const existingIndex = this.data.tables.findIndex(t => t.id === tableId);

    if (existingIndex >= 0) {
      const existing = this.data.tables[existingIndex];
      const updated: RestaurantTable = {
        ...existing,
        tableNumber: tableData.tableNumber.trim(),
        capacity,
        section: tableData.section ? tableData.section.trim() : existing.section,
        status: tableData.status || existing.status,
        tableToken: existing.tableToken || `tok_${tableId.toLowerCase()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      };
      this.data.tables[existingIndex] = updated;
      this.addAuditLog('UPDATE_TABLE', 'table', `Updated table ${updated.tableNumber} (${updated.id})`, changedByStaffName);
      this.persist();
      return updated;
    } else {
      const newTable: RestaurantTable = {
        id: tableId,
        tableNumber: tableData.tableNumber.trim(),
        capacity,
        section: tableData.section ? tableData.section.trim() : 'Main Dining Area',
        status: 'available',
        tableToken: tableData.tableToken || `tok_${tableId.toLowerCase()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      };
      this.data.tables.push(newTable);
      this.addAuditLog('CREATE_TABLE', 'table', `Created table ${newTable.tableNumber} (${newTable.id}, section: ${newTable.section})`, changedByStaffName);
      this.persist();
      return newTable;
    }
  }

  regenerateTableToken(tableId: string, changedByStaffName: string): RestaurantTable {
    const table = this.data.tables.find(t => t.id === tableId);
    if (!table) throw new Error(`Table ${tableId} not found`);
    const newToken = `tok_${table.id.toLowerCase()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    table.tableToken = newToken;
    this.addAuditLog('REGENERATE_TABLE_TOKEN', 'table', `Regenerated QR security token for ${table.tableNumber} (${table.id})`, changedByStaffName);
    this.persist();
    return table;
  }

  regenerateAllTableTokens(changedByStaffName: string): RestaurantTable[] {
    this.data.tables.forEach(table => {
      table.tableToken = `tok_${table.id.toLowerCase()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    });
    this.addAuditLog('REGENERATE_ALL_TABLE_TOKENS', 'table', `Regenerated QR security tokens for all ${this.data.tables.length} tables`, changedByStaffName);
    this.persist();
    return this.data.tables;
  }

  deleteTable(id: string, changedByStaffName: string): boolean {
    const idx = this.data.tables.findIndex(t => t.id === id);
    if (idx < 0) return false;
    const table = this.data.tables[idx];
    if (table.status === 'occupied') {
      throw new Error('Cannot delete an occupied table with an active dining session');
    }
    this.data.tables.splice(idx, 1);
    this.addAuditLog('DELETE_TABLE', 'table', `Deleted table ${table.tableNumber} (${id})`, changedByStaffName);
    this.persist();
    return true;
  }

  // --- Menu Categories & Items ---
  getCategories(): MenuCategory[] {
    return [...this.data.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getMenuItems(): MenuItem[] {
    return this.data.menuItems;
  }

  getMenuItem(id: string): MenuItem | null {
    return this.data.menuItems.find(m => m.id === id) || null;
  }

  saveMenuItem(item: MenuItem, staffName: string): MenuItem {
    if (!item.name || typeof item.name !== 'string' || item.name.trim().length < 2) {
      throw new Error('Dish name must be at least 2 characters long');
    }
    if (typeof item.price !== 'number' || isNaN(item.price) || !isFinite(item.price) || item.price < 0) {
      throw new Error('Dish price must be a valid non-negative number');
    }
    if (!item.categoryId || !this.data.categories.some(c => c.id === item.categoryId)) {
      throw new Error('Valid menu category is required');
    }

    const sanitizedItem: MenuItem = {
      ...item,
      name: item.name.trim(),
      description: item.description?.trim() || '',
      price: Math.round(item.price * 100) / 100,
      customizationGroups: item.customizationGroups || [],
      allergens: item.allergens || []
    };

    const existingIndex = this.data.menuItems.findIndex(m => m.id === sanitizedItem.id);
    if (existingIndex >= 0) {
      const oldItem = this.data.menuItems[existingIndex];
      // Price change audit
      if (oldItem.price !== sanitizedItem.price) {
        this.addPriceAuditLog({
          id: `pa_${Date.now()}`,
          menuItemId: sanitizedItem.id,
          menuItemName: sanitizedItem.name,
          previousPrice: oldItem.price,
          newPrice: sanitizedItem.price,
          reason: 'Menu management manual update',
          changedBy: staffName,
          timestamp: new Date().toISOString()
        });
      }
      this.data.menuItems[existingIndex] = {
        ...sanitizedItem,
        updatedAt: new Date().toISOString()
      };
      this.addAuditLog('EDIT_MENU_ITEM', 'menu', `Updated menu dish: ${sanitizedItem.name} (${sanitizedItem.id})`, staffName);
    } else {
      this.data.menuItems.push({
        ...sanitizedItem,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      this.addAuditLog('CREATE_MENU_ITEM', 'menu', `Created new dish: ${sanitizedItem.name} at Nu. ${sanitizedItem.price}`, staffName);
    }
    this.persist();
    return sanitizedItem;
  }

  toggleMenuItemAvailability(id: string, isAvailable: boolean, soldOut: boolean, staffName: string): MenuItem {
    const item = this.getMenuItem(id);
    if (!item) throw new Error(`Menu item ${id} not found`);
    item.isAvailable = isAvailable;
    item.soldOut = soldOut;
    item.updatedAt = new Date().toISOString();
    this.addAuditLog('TOGGLE_AVAILABILITY', 'menu', `Dish ${item.name} availability: ${soldOut ? 'SOLD OUT' : isAvailable ? 'AVAILABLE' : 'HIDDEN'}`, staffName);
    this.persist();
    return item;
  }

  deleteMenuItem(id: string, staffName: string): boolean {
    const idx = this.data.menuItems.findIndex(m => m.id === id);
    if (idx < 0) return false;
    const name = this.data.menuItems[idx].name;
    this.data.menuItems.splice(idx, 1);
    this.addAuditLog('DELETE_MENU_ITEM', 'menu', `Deleted dish: ${name} (${id})`, staffName);
    this.persist();
    return true;
  }

  // --- Dining Sessions & Ordering ---
  getOrCreateActiveSession(tableId: string, guestCount?: number): DiningSession {
    const table = this.getTable(tableId);
    if (!table) throw new Error(`Table ${tableId} does not exist`);

    if (table.currentSessionId) {
      const session = this.data.diningSessions.find(s => s.id === table.currentSessionId && s.status === 'active');
      if (session) return session;
    }

    // Create fresh session
    const sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSession: DiningSession = {
      id: sessionId,
      tableId,
      tableNumber: table.tableNumber,
      status: 'active',
      startedAt: new Date().toISOString(),
      guestCount: guestCount || table.capacity || 2,
      orderRoundIds: []
    };

    this.data.diningSessions.push(newSession);
    this.updateTableStatus(tableId, 'occupied', sessionId);

    // Also initialize an empty bill for this session
    const billId = `bill_${Date.now()}`;
    const newBill: Bill = {
      id: billId,
      billNumber: `INV-${Date.now().toString().slice(-6)}`,
      sessionId,
      tableId,
      tableNumber: table.tableNumber,
      orderRoundIds: [],
      subtotal: 0,
      discount: null,
      taxRate: this.data.settings.taxRate,
      taxAmount: 0,
      serviceChargeRate: this.data.settings.serviceChargeRate,
      serviceChargeAmount: 0,
      additionalCharges: 0,
      total: 0,
      paidAmount: 0,
      balanceDue: 0,
      status: 'open',
      payments: [],
      createdAt: new Date().toISOString()
    };
    newSession.billId = billId;
    this.data.bills.push(newBill);

    this.persist();
    return newSession;
  }

  getSession(id: string): DiningSession | null {
    return this.data.diningSessions.find(s => s.id === id) || null;
  }

  getActiveSessionForTable(tableId: string): DiningSession | null {
    return this.data.diningSessions.find(s => s.tableId === tableId && s.status === 'active') || null;
  }

  /**
   * Validate and create an order round with backend calculated prices and anti-duplicate idempotency
   */
  createOrderRound(params: {
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
  }): { order: OrderRound; bill: Bill } {
    const { tableId, tableToken, items, customerNote, idempotencyKey } = params;

    // Check idempotency
    if (idempotencyKey && this.data.idempotencyKeys[idempotencyKey]) {
      const existing = this.getOrderRound(this.data.idempotencyKeys[idempotencyKey].orderId);
      if (existing) {
        const bill = this.getBillBySessionId(existing.sessionId);
        return { order: existing, bill: bill! };
      }
    }

    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    const table = this.getTable(tableId);
    if (!table) throw new Error(`Invalid table: ${tableId}`);

    // Verify table security token if a token was supplied or if table enforces secure token validation
    if (table.tableToken && tableToken && tableToken !== table.tableToken) {
      throw new Error(`Security verification failed for ${table.tableNumber}. The table token does not match.`);
    }

    // Get or start active dining session
    const session = this.getOrCreateActiveSession(tableId);

    // Validate and price items using trusted DB data
    const validatedOrderItems: OrderItem[] = [];
    let roundSubtotal = 0;

    for (const reqItem of items) {
      if (typeof reqItem.quantity !== 'number' || reqItem.quantity <= 0 || !Number.isInteger(reqItem.quantity) || reqItem.quantity > 99) {
        throw new Error(`Invalid quantity ${reqItem.quantity} for item ${reqItem.menuItemId}. Must be an integer between 1 and 99.`);
      }

      const menuItem = this.getMenuItem(reqItem.menuItemId);
      if (!menuItem) {
        throw new Error(`Dish not found: ${reqItem.menuItemId}`);
      }
      if (!menuItem.isAvailable || menuItem.soldOut) {
        throw new Error(`Dish "${menuItem.name}" is currently sold out and cannot be ordered`);
      }

      // Verify all required customization groups are selected or safely defaulted
      if (menuItem.customizationGroups && menuItem.customizationGroups.length > 0) {
        for (const grp of menuItem.customizationGroups) {
          if (grp.required) {
            let hasSelection = reqItem.selectedCustomizations?.some(s => s.groupId === grp.id);
            if (!hasSelection && grp.type === 'single' && grp.options.length > 0) {
              if (!reqItem.selectedCustomizations) reqItem.selectedCustomizations = [];
              reqItem.selectedCustomizations.push({
                groupId: grp.id,
                optionId: grp.options[0].id
              });
              hasSelection = true;
            }
            if (!hasSelection) {
              throw new Error(`Please select an option for required group "${grp.name}" on ${menuItem.name}`);
            }
          }
        }
      }

      // Calculate customizations modifiers
      let unitPrice = menuItem.price;
      const appliedCustomizations: OrderItem['customizations'] = [];

      if (reqItem.selectedCustomizations && Array.isArray(reqItem.selectedCustomizations)) {
        for (const sel of reqItem.selectedCustomizations) {
          const group = menuItem.customizationGroups.find(g => g.id === sel.groupId);
          if (group) {
            const option = group.options.find(o => o.id === sel.optionId);
            if (option) {
              unitPrice += option.priceModifier;
              appliedCustomizations.push({
                groupId: group.id,
                groupName: group.name,
                optionId: option.id,
                optionName: option.name,
                priceModifier: option.priceModifier
              });
            }
          }
        }
      }

      // Safeguard unit price
      if (unitPrice < 0) unitPrice = menuItem.price;

      const itemTotal = unitPrice * reqItem.quantity;
      roundSubtotal += itemTotal;

      validatedOrderItems.push({
        id: `oi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        cartItemId: `ci_${Date.now()}`,
        menuItemId: menuItem.id,
        name: menuItem.name,
        basePrice: menuItem.price,
        unitPrice,
        quantity: reqItem.quantity,
        dietType: menuItem.dietType,
        customizations: appliedCustomizations,
        specialInstructions: reqItem.specialInstructions?.trim() || undefined,
        imageUrl: menuItem.imageUrl,
        kitchenStatus: 'pending'
      });
    }

    const roundCount = session.orderRoundIds.length + 1;
    const orderNumber = `#HQC-${table.id}-${Date.now().toString().slice(-4)}`;

    const newOrder: OrderRound = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      orderNumber,
      sessionId: session.id,
      tableId: table.id,
      roundNumber: roundCount,
      items: validatedOrderItems,
      subtotal: roundSubtotal,
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerNote: customerNote?.trim() || undefined,
      idempotencyKey
    };

    this.data.orderRounds.push(newOrder);
    session.orderRoundIds.push(newOrder.id);

    // Save idempotency key
    if (idempotencyKey) {
      this.data.idempotencyKeys[idempotencyKey] = {
        orderId: newOrder.id,
        timestamp: Date.now()
      };
    }

    // Update bill
    let bill = this.getBillBySessionId(session.id);
    if (!bill) {
      bill = {
        id: `bill_${Date.now()}`,
        billNumber: `INV-${Date.now().toString().slice(-6)}`,
        sessionId: session.id,
        tableId: table.id,
        tableNumber: table.tableNumber,
        orderRoundIds: [newOrder.id],
        subtotal: 0,
        discount: null,
        taxRate: this.data.settings.taxRate,
        taxAmount: 0,
        serviceChargeRate: this.data.settings.serviceChargeRate,
        serviceChargeAmount: 0,
        additionalCharges: 0,
        total: 0,
        paidAmount: 0,
        balanceDue: 0,
        status: 'open',
        payments: [],
        createdAt: new Date().toISOString()
      };
      session.billId = bill.id;
      this.data.bills.push(bill);
    } else {
      if (!bill.orderRoundIds.includes(newOrder.id)) {
        bill.orderRoundIds.push(newOrder.id);
      }
    }

    this.recalculateBill(bill.id);

    this.addAuditLog(
      'ORDER_PLACED',
      'order',
      `Order ${newOrder.orderNumber} placed for ${table.tableNumber} (Round ${roundCount}): ${validatedOrderItems.length} items, total Nu. ${roundSubtotal}`,
      'Guest / Customer',
      { orderId: newOrder.id, tableId: table.id, subtotal: roundSubtotal }
    );

    this.persist();
    return { order: newOrder, bill };
  }

  getOrderRound(id: string): OrderRound | null {
    return this.data.orderRounds.find(o => o.id === id) || null;
  }

  getAllOrderRounds(): OrderRound[] {
    return [...this.data.orderRounds].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --- Kitchen Display System (KDS) Workflows ---
  updateOrderItemKitchenStatus(orderId: string, itemId: string, status: OrderItemKitchenStatus, rejectionReason?: string, staffName = 'Kitchen'): OrderRound {
    const order = this.getOrderRound(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const item = order.items.find(i => i.id === itemId);
    if (!item) throw new Error(`Item ${itemId} not found in order ${orderId}`);

    item.kitchenStatus = status;
    if (rejectionReason) item.rejectionReason = rejectionReason;
    order.updatedAt = new Date().toISOString();

    // Check if entire order ticket status should progress
    const allReady = order.items.every(i => i.kitchenStatus === 'ready' || i.kitchenStatus === 'cannot_prepare');
    const anyPreparing = order.items.some(i => i.kitchenStatus === 'preparing');

    if (allReady) {
      order.status = 'ready';
    } else if (anyPreparing) {
      order.status = 'preparing';
    }

    this.addAuditLog('KITCHEN_ITEM_UPDATE', 'order', `Item ${item.name} in ${order.orderNumber} marked as ${status}${rejectionReason ? ` (${rejectionReason})` : ''}`, staffName);
    this.persist();
    return order;
  }

  updateOrderStatus(orderId: string, status: OrderStatus, staffName = 'Staff'): OrderRound {
    const order = this.getOrderRound(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    order.status = status;
    order.updatedAt = new Date().toISOString();

    // Sync item states if ticket marked ready or preparing
    if (status === 'preparing') {
      order.items.forEach(i => {
        if (i.kitchenStatus === 'pending') i.kitchenStatus = 'preparing';
      });
    } else if (status === 'ready') {
      order.items.forEach(i => {
        if (i.kitchenStatus !== 'cannot_prepare') i.kitchenStatus = 'ready';
      });
    }

    this.addAuditLog('ORDER_STATUS_UPDATE', 'order', `Order ${order.orderNumber} changed to ${status}`, staffName);
    this.persist();
    return order;
  }

  // --- Billing & Counter Console ---
  getBill(id: string): Bill | null {
    return this.data.bills.find(b => b.id === id) || null;
  }

  getBillBySessionId(sessionId: string): Bill | null {
    return this.data.bills.find(b => b.sessionId === sessionId) || null;
  }

  getAllBills(): Bill[] {
    return [...this.data.bills].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  recalculateBill(billId: string): Bill {
    const bill = this.getBill(billId);
    if (!bill) throw new Error(`Bill ${billId} not found`);

    // Sum all non-cancelled orders for this bill
    let subtotal = 0;
    for (const roundId of bill.orderRoundIds) {
      const order = this.getOrderRound(roundId);
      if (order && order.status !== 'cancelled') {
        // Only count items not rejected by kitchen
        for (const item of order.items) {
          if (item.kitchenStatus !== 'cannot_prepare') {
            subtotal += item.unitPrice * item.quantity;
          }
        }
      }
    }

    bill.subtotal = Math.round(subtotal * 100) / 100;

    // Apply discount
    let discountAmount = 0;
    if (bill.discount) {
      if (bill.discount.type === 'percentage') {
        discountAmount = (bill.subtotal * bill.discount.value) / 100;
      } else {
        discountAmount = bill.discount.value;
      }
      if (discountAmount > bill.subtotal) discountAmount = bill.subtotal;
      bill.discount.appliedAmount = Math.round(discountAmount * 100) / 100;
    }

    const netTaxable = Math.max(0, bill.subtotal - discountAmount);

    // Calculate Service Charge (10%) and Sales Tax (5%)
    bill.serviceChargeAmount = Math.round(netTaxable * bill.serviceChargeRate * 100) / 100;
    bill.taxAmount = Math.round(netTaxable * bill.taxRate * 100) / 100;

    bill.total = Math.round((netTaxable + bill.serviceChargeAmount + bill.taxAmount + (bill.additionalCharges || 0)) * 100) / 100;

    // Payments sum
    const totalPaid = bill.payments.reduce((sum, p) => sum + p.amount, 0);
    bill.paidAmount = Math.round(totalPaid * 100) / 100;
    bill.balanceDue = Math.max(0, Math.round((bill.total - bill.paidAmount) * 100) / 100);

    // Keep payment and billing status distinct
    if (bill.paidAmount >= bill.total && bill.total > 0) {
      bill.status = 'paid';
    } else if (bill.payments.length > 0) {
      bill.status = 'preparing';
    } else {
      bill.status = 'open';
    }

    this.persist();
    return bill;
  }

  applyDiscount(billId: string, discount: Omit<BillDiscount, 'id' | 'appliedAmount'>, staffName: string): Bill {
    const bill = this.getBill(billId);
    if (!bill) throw new Error(`Bill ${billId} not found`);
    if (bill.status === 'paid') throw new Error('Cannot apply discount to an already settled bill');
    if (bill.subtotal <= 0) throw new Error('Cannot apply discount to an empty order round');

    if (typeof discount.value !== 'number' || isNaN(discount.value) || !isFinite(discount.value) || discount.value <= 0) {
      throw new Error('Discount value must be a positive number');
    }
    if (discount.type === 'percentage') {
      if (discount.value < 1 || discount.value > 100) {
        throw new Error('Discount percentage must be between 1% and 100%');
      }
    } else if (discount.type === 'fixed') {
      if (discount.value > bill.subtotal) {
        throw new Error(`Fixed discount amount (Nu. ${discount.value}) cannot exceed subtotal (Nu. ${bill.subtotal})`);
      }
    }
    if (!discount.reason || discount.reason.trim().length === 0) {
      throw new Error('Audit justification reason is required for discounts');
    }

    const newDiscount: BillDiscount = {
      id: `dsc_${Date.now()}`,
      name: discount.name.trim() || 'Authorized Discount',
      type: discount.type,
      value: Math.round(discount.value * 100) / 100,
      reason: discount.reason.trim(),
      authorizedBy: staffName,
      appliedAmount: 0
    };
    bill.discount = newDiscount;
    this.addAuditLog('APPLY_DISCOUNT', 'discount', `Discount "${newDiscount.name}" applied to Bill ${bill.billNumber}: ${newDiscount.value}${newDiscount.type === 'percentage' ? '%' : ' Nu.'}. Reason: ${newDiscount.reason}`, staffName);

    return this.recalculateBill(billId);
  }

  removeDiscount(billId: string, staffName: string): Bill {
    const bill = this.getBill(billId);
    if (!bill) throw new Error(`Bill ${billId} not found`);
    if (bill.status === 'paid') throw new Error('Cannot modify discount of a paid bill');

    const old = bill.discount?.name;
    bill.discount = null;
    this.addAuditLog('REMOVE_DISCOUNT', 'discount', `Removed discount "${old}" from Bill ${bill.billNumber}`, staffName);
    return this.recalculateBill(billId);
  }

  recordPayment(params: {
    billId: string;
    method: PaymentMethod;
    amount: number;
    reference?: string;
    staffName: string;
  }): { bill: Bill; payment: PaymentRecord } {
    const { billId, method, amount, reference, staffName } = params;
    const bill = this.getBill(billId);
    if (!bill) throw new Error(`Bill ${billId} not found`);

    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || amount <= 0) {
      throw new Error('Payment amount must be a valid number greater than zero');
    }
    if (bill.total <= 0) {
      throw new Error('Cannot process payment on an order with Nu. 0 total');
    }
    if (bill.status === 'paid' && bill.balanceDue <= 0) {
      throw new Error('This bill is already fully settled (Balance: Nu. 0)');
    }

    // Handle tendered amount vs balance due
    let recordedAmount = Math.round(amount * 100) / 100;
    let paymentRef = reference?.trim() || undefined;

    if (recordedAmount > bill.balanceDue) {
      const changeDue = Math.round((recordedAmount - bill.balanceDue) * 100) / 100;
      recordedAmount = bill.balanceDue;
      const changeNote = `Tendered: Nu. ${amount}, Change returned: Nu. ${changeDue}`;
      paymentRef = paymentRef ? `${paymentRef} (${changeNote})` : changeNote;
    }

    const payment: PaymentRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      method,
      amount: recordedAmount,
      reference: paymentRef,
      recordedBy: staffName,
      timestamp: new Date().toISOString()
    };

    bill.payments.push(payment);
    this.recalculateBill(billId);

    if (bill.status === 'paid') {
      bill.paidAt = new Date().toISOString();
      this.addAuditLog('BILL_SETTLED', 'payment', `Bill ${bill.billNumber} fully settled with payment Nu. ${recordedAmount} (${method}). Balance: Nu. 0`, staffName);
    } else {
      this.addAuditLog('PARTIAL_PAYMENT', 'payment', `Partial payment Nu. ${recordedAmount} (${method}) recorded for Bill ${bill.billNumber}. Remaining balance: Nu. ${bill.balanceDue}`, staffName);
    }

    this.persist();
    return { bill, payment };
  }

  closeDiningSession(sessionId: string, staffName: string): DiningSession {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const bill = this.getBillBySessionId(sessionId);

    // Require bill to be settled or balanced
    if (bill && bill.balanceDue > 0 && bill.status !== 'paid') {
      throw new Error(`Cannot close table session: Bill ${bill.billNumber} has an outstanding balance of Nu. ${bill.balanceDue}. Settle payment first.`);
    }

    session.status = 'closed';
    session.closedAt = new Date().toISOString();
    if (bill) {
      bill.closedAt = session.closedAt;
    }

    // Set table status to available/cleaning
    this.updateTableStatus(session.tableId, 'available', null);

    this.addAuditLog('CLOSE_SESSION', 'table', `Dining session ${session.id} at Table ${session.tableNumber} closed. Table is now available.`, staffName);
    this.persist();
    return session;
  }

  moveTableSession(sessionId: string, newTableId: string, staffName: string): DiningSession {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'active') throw new Error('Cannot move an inactive session');

    const targetTable = this.getTable(newTableId);
    if (!targetTable) throw new Error(`Target table ${newTableId} does not exist`);
    if (targetTable.currentSessionId && targetTable.currentSessionId !== sessionId) {
      throw new Error(`Target table ${targetTable.tableNumber} is already occupied!`);
    }

    const oldTableId = session.tableId;
    const oldTableNumber = session.tableNumber;

    // Vacate old table
    this.updateTableStatus(oldTableId, 'available', null);

    // Update session
    session.tableId = targetTable.id;
    session.tableNumber = targetTable.tableNumber;

    // Update table
    this.updateTableStatus(targetTable.id, 'occupied', sessionId);

    // Update linked bill & orders
    const bill = this.getBillBySessionId(sessionId);
    if (bill) {
      bill.tableId = targetTable.id;
      bill.tableNumber = targetTable.tableNumber;
    }
    for (const roundId of session.orderRoundIds) {
      const order = this.getOrderRound(roundId);
      if (order) {
        order.tableId = targetTable.id;
      }
    }

    this.addAuditLog('MOVE_TABLE', 'table', `Moved dining session from ${oldTableNumber} to ${targetTable.tableNumber}`, staffName);
    this.persist();
    return session;
  }

  // --- Audit Logs ---
  addAuditLog(action: string, category: AuditLog['category'], details: string, performedBy: string, metadata?: Record<string, any>) {
    const log: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      action,
      category,
      details,
      performedBy,
      timestamp: new Date().toISOString(),
      metadata
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
  }

  addPriceAuditLog(entry: PriceAuditLog) {
    this.data.priceAuditLogs.unshift(entry);
    if (this.data.priceAuditLogs.length > 300) {
      this.data.priceAuditLogs = this.data.priceAuditLogs.slice(0, 300);
    }
  }

  getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  getPriceAuditLogs(): PriceAuditLog[] {
    return this.data.priceAuditLogs;
  }
}

export const db = new CafeDatabase();
