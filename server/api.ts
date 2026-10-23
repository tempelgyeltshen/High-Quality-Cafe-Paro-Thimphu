import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { db } from './db.ts';
import { sseHub } from './sse.ts';
import { createStaffToken, extractStaffFromRequest, requireRole, AuthenticatedRequest } from './auth.ts';
import { MenuItem, PaymentMethod, Role } from '../src/types/index.ts';

export const apiRouter = Router();

// ==========================================
// 1. REAL-TIME SERVER-SENT EVENTS
// ==========================================
apiRouter.get('/events', (req: Request, res: Response) => {
  const clientId = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const role = req.query.role as string;
  const tableId = req.query.tableId as string;
  const sessionId = req.query.sessionId as string;

  sseHub.addClient(clientId, res, { role, tableId, sessionId });
});

// ==========================================
// 2. PUBLIC CUSTOMER ENDPOINTS
// ==========================================

// Get complete cafe info and active menu
apiRouter.get('/menu', (req: Request, res: Response) => {
  try {
    const settings = db.getSettings();
    const categories = db.getCategories();
    const menuItems = db.getMenuItems();
    res.json({
      settings,
      categories,
      menuItems
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load menu' });
  }
});

// Verify table existence and validated table token
apiRouter.get('/tables/:id', (req: Request, res: Response) => {
  const table = db.getTable(req.params.id);
  if (!table) {
    return res.status(404).json({ error: `Table "${req.params.id}" does not exist` });
  }
  const token = req.query.token as string | undefined;
  const isTokenValid = !table.tableToken || (token && token === table.tableToken);
  const activeSession = table.currentSessionId ? db.getSession(table.currentSessionId) : null;
  res.json({
    table,
    isTokenValid: !!isTokenValid,
    hasTokenConfigured: !!table.tableToken,
    activeSession
  });
});

// Get all order rounds for the current active table session
apiRouter.get('/tables/:id/orders', (req: Request, res: Response) => {
  const table = db.getTable(req.params.id);
  if (!table) {
    return res.status(404).json({ error: `Table "${req.params.id}" does not exist` });
  }
  if (!table.currentSessionId) {
    return res.json({ session: null, rounds: [], bill: null });
  }
  const session = db.getSession(table.currentSessionId);
  if (!session || session.status !== 'active') {
    return res.json({ session: null, rounds: [], bill: null });
  }
  const rounds = session.orderRoundIds.map(id => db.getOrderRound(id)).filter(Boolean);
  const bill = db.getBillBySessionId(session.id);
  res.json({
    session,
    rounds,
    bill
  });
});

// Submit a new order round for a table
apiRouter.post('/orders', (req: Request, res: Response) => {
  try {
    const { tableId, tableToken, items, customerNote, idempotencyKey } = req.body;

    if (!tableId) {
      return res.status(400).json({ error: 'tableId is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items array cannot be empty' });
    }

    const result = db.createOrderRound({
      tableId,
      tableToken,
      items,
      customerNote,
      idempotencyKey
    });

    // Real-time broadcast to kitchen and counter
    sseHub.broadcast('order_created', {
      order: result.order,
      bill: result.bill,
      tableId
    });

    res.status(201).json({
      success: true,
      order: result.order,
      bill: result.bill,
      message: `Order ${result.order.orderNumber} successfully placed for Table ${result.order.tableId}!`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create order' });
  }
});

// Get order details
apiRouter.get('/orders/:id', (req: Request, res: Response) => {
  const order = db.getOrderRound(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// Get session details and all rounds for customer tracker
apiRouter.get('/session/:id', (req: Request, res: Response) => {
  const session = db.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Dining session not found' });
  }
  const rounds = session.orderRoundIds.map(id => db.getOrderRound(id)).filter(Boolean);
  const bill = db.getBillBySessionId(session.id);
  res.json({
    session,
    rounds,
    bill
  });
});

// ==========================================
// 3. STAFF AUTHENTICATION
// ==========================================
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { credential } = req.body; // username or PIN
  if (!credential) {
    return res.status(400).json({ error: 'Please enter username or quick-switch PIN' });
  }
  const user = db.authenticate(String(credential));
  if (!user) {
    return res.status(401).json({ error: 'Invalid staff credential or inactive account' });
  }

  const token = createStaffToken(user);
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role
    }
  });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const user = extractStaffFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role
  });
});

apiRouter.get('/auth/staff-accounts', (req: Request, res: Response) => {
  // Public sanitized list of demo accounts for test switch
  const users = db.getStaffUsers();
  res.json(users);
});

// ==========================================
// 4. KITCHEN DISPLAY SYSTEM (KDS)
// ==========================================
apiRouter.get('/kitchen/tickets', requireRole(['kitchen', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  const allOrders = db.getAllOrderRounds();
  // Filter active tickets (exclude fully served or cancelled from active queue if desired)
  res.json(allOrders);
});

apiRouter.patch('/kitchen/orders/:orderId/items/:itemId', requireRole(['kitchen', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, rejectionReason } = req.body;
    const staffName = req.staff?.name || 'Kitchen Staff';

    const updatedOrder = db.updateOrderItemKitchenStatus(
      req.params.orderId,
      req.params.itemId,
      status,
      rejectionReason,
      staffName
    );

    // If item was rejected, bill subtotal may change!
    const session = db.getSession(updatedOrder.sessionId);
    const bill = session?.billId ? db.recalculateBill(session.billId) : null;

    sseHub.broadcast('item_status_updated', {
      order: updatedOrder,
      bill,
      itemId: req.params.itemId,
      status
    });

    res.json({ success: true, order: updatedOrder, bill });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/kitchen/orders/:orderId/status', requireRole(['kitchen', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    const staffName = req.staff?.name || 'Kitchen Staff';

    const updatedOrder = db.updateOrderStatus(req.params.orderId, status, staffName);

    sseHub.broadcast('order_status_updated', {
      order: updatedOrder,
      status
    });

    res.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 5. CASHIER / COUNTER CONSOLE
// ==========================================
apiRouter.get('/counter/bills', requireRole(['cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  const bills = db.getAllBills();
  const tables = db.getTables();
  const orders = db.getAllOrderRounds();
  res.json({
    bills,
    tables,
    orders
  });
});

apiRouter.get('/counter/bills/:id', requireRole(['cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  const bill = db.getBill(req.params.id);
  if (!bill) {
    return res.status(404).json({ error: 'Bill not found' });
  }
  const rounds = bill.orderRoundIds.map(id => db.getOrderRound(id)).filter(Boolean);
  res.json({ bill, rounds });
});

apiRouter.post('/counter/bills/:id/discount', requireRole(['cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, value, reason } = req.body;
    if (!name || typeof name !== 'string' || !reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'Discount name and authorized justification reason are required' });
    }
    if (type !== 'percentage' && type !== 'fixed') {
      return res.status(400).json({ error: 'Discount type must be either "percentage" or "fixed"' });
    }
    const numValue = Number(value);
    if (isNaN(numValue) || !isFinite(numValue) || numValue <= 0) {
      return res.status(400).json({ error: 'Discount value must be a positive number' });
    }
    const staffName = req.staff?.name || 'Cashier';
    const updatedBill = db.applyDiscount(
      req.params.id,
      {
        name: name.trim(),
        type,
        value: numValue,
        reason: reason.trim(),
        authorizedBy: staffName
      },
      staffName
    );

    sseHub.broadcast('bill_updated', { bill: updatedBill });
    res.json({ success: true, bill: updatedBill });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/counter/bills/:id/discount', requireRole(['cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Cashier';
    const updatedBill = db.removeDiscount(req.params.id, staffName);
    sseHub.broadcast('bill_updated', { bill: updatedBill });
    res.json({ success: true, bill: updatedBill });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/counter/bills/:id/payment', requireRole(['cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { method, amount, reference } = req.body;
    const validMethods: PaymentMethod[] = ['cash', 'card', 'mbob_transfer', 'qr_pay', 'split'];
    if (!method || !validMethods.includes(method as PaymentMethod)) {
      return res.status(400).json({ error: `Valid payment method is required (${validMethods.join(', ')})` });
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be a valid positive number' });
    }
    const staffName = req.staff?.name || 'Cashier';
    const result = db.recordPayment({
      billId: req.params.id,
      method: method as PaymentMethod,
      amount: numAmount,
      reference,
      staffName
    });

    sseHub.broadcast('payment_recorded', {
      bill: result.bill,
      payment: result.payment
    });

    res.json({
      success: true,
      bill: result.bill,
      payment: result.payment,
      message: `Payment of Nu. ${result.payment.amount} recorded successfully!`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/counter/sessions/:sessionId/close', requireRole(['cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Cashier';
    const closedSession = db.closeDiningSession(req.params.sessionId, staffName);

    sseHub.broadcast('table_closed', {
      sessionId: req.params.sessionId,
      tableId: closedSession.tableId
    });

    res.json({
      success: true,
      session: closedSession,
      message: `Table ${closedSession.tableNumber} session closed successfully!`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/counter/sessions/:sessionId/move', requireRole(['cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetTableId } = req.body;
    if (!targetTableId) {
      return res.status(400).json({ error: 'targetTableId is required' });
    }
    const staffName = req.staff?.name || 'Cashier';
    const movedSession = db.moveTableSession(req.params.sessionId, targetTableId, staffName);

    sseHub.broadcast('table_moved', {
      session: movedSession
    });

    res.json({
      success: true,
      session: movedSession,
      message: `Session transferred to Table ${movedSession.tableNumber}!`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Add extra items to an existing table directly from counter
apiRouter.post('/counter/tables/:tableId/add-order', requireRole(['cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items, note } = req.body;
    const result = db.createOrderRound({
      tableId: req.params.tableId,
      items,
      customerNote: note ? `[Added by Counter]: ${note}` : undefined
    });

    sseHub.broadcast('order_created', {
      order: result.order,
      bill: result.bill,
      tableId: req.params.tableId
    });

    res.status(201).json({ success: true, order: result.order, bill: result.bill });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 6. MENU MANAGEMENT & ADMIN
// ==========================================
apiRouter.post('/admin/menu', requireRole(['manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const newItem: MenuItem = {
      ...req.body,
      id: req.body.id || `dish_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const saved = db.saveMenuItem(newItem, staffName);
    sseHub.broadcast('menu_updated', { item: saved });
    res.status(201).json({ success: true, item: saved });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/admin/menu/:id', requireRole(['manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const updated = db.saveMenuItem({ ...req.body, id: req.params.id }, staffName);
    sseHub.broadcast('menu_updated', { item: updated });
    res.json({ success: true, item: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.patch('/admin/menu/:id/availability', requireRole(['kitchen', 'cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isAvailable, soldOut } = req.body;
    const staffName = req.staff?.name || 'Staff';
    const item = db.toggleMenuItemAvailability(req.params.id, Boolean(isAvailable), Boolean(soldOut), staffName);
    sseHub.broadcast('menu_availability_changed', { item });
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/admin/menu/:id', requireRole(['manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const ok = db.deleteMenuItem(req.params.id, staffName);
    if (!ok) return res.status(404).json({ error: 'Item not found' });
    sseHub.broadcast('menu_item_deleted', { id: req.params.id });
    res.json({ success: true, message: 'Item deleted' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Tables and printable QR codes
apiRouter.get('/admin/tables-with-qr', async (req: Request, res: Response) => {
  try {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const tables = db.getTables();

    const tablesWithQR = await Promise.all(
      tables.map(async t => {
        const tokenParam = t.tableToken ? `&token=${t.tableToken}` : '';
        const targetUrl = `${baseUrl}/menu?table=${t.id}${tokenParam}`;
        const qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
          width: 450,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#1c1917',
            light: '#ffffff'
          }
        });
        return {
          ...t,
          qrUrl: targetUrl,
          qrCodeDataUrl
        };
      })
    );

    res.json(tablesWithQR);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Table CRUD
apiRouter.post('/admin/tables', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const table = db.saveTable(req.body, staffName);
    sseHub.broadcast('tables_updated', { table });
    res.status(201).json({ success: true, table });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/admin/tables/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const table = db.saveTable({ ...req.body, id: req.params.id }, staffName);
    sseHub.broadcast('tables_updated', { table });
    res.json({ success: true, table });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/admin/tables/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const ok = db.deleteTable(req.params.id, staffName);
    if (!ok) return res.status(404).json({ error: 'Table not found' });
    sseHub.broadcast('table_deleted', { id: req.params.id });
    res.json({ success: true, message: 'Table deleted' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Regenerate single table QR security token
apiRouter.post('/admin/tables/:id/regenerate-token', requireRole(['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const table = db.regenerateTableToken(req.params.id, staffName);
    sseHub.broadcast('tables_updated', { table });
    res.json({ success: true, table });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Regenerate all table QR security tokens in bulk
apiRouter.post('/admin/tables/regenerate-all-tokens', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const tables = db.regenerateAllTableTokens(staffName);
    sseHub.broadcast('tables_updated', { tables });
    res.json({ success: true, tables });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Staff Accounts Management
apiRouter.get('/admin/staff', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = db.getStaffUsersForAdmin();
    res.json(staff);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/staff', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const user = db.saveStaffUser(req.body, staffName);
    res.status(201).json({ success: true, user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/admin/staff/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const user = db.saveStaffUser({ ...req.body, id: req.params.id }, staffName);
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/admin/staff/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const ok = db.deleteStaffUser(req.params.id, staffName);
    if (!ok) return res.status(404).json({ error: 'Staff account not found' });
    res.json({ success: true, message: 'Staff account deleted' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Sales Reports & Analytics
apiRouter.get('/admin/reports', requireRole(['manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const bills = db.getAllBills();
    const orders = db.getAllOrderRounds();

    // Calculate metrics
    let totalCollectedSales = 0;
    let totalOutstandingBalance = 0;
    let totalDiscountAmount = 0;
    let paidBillsCount = 0;
    let openBillsCount = 0;

    for (const b of bills) {
      totalCollectedSales += b.paidAmount;
      if (b.status === 'paid') {
        paidBillsCount++;
      } else {
        openBillsCount++;
        totalOutstandingBalance += b.balanceDue;
      }
      if (b.discount) {
        totalDiscountAmount += b.discount.appliedAmount;
      }
    }

    // Dish popularity
    const dishSalesMap = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();
    const categorySalesMap = new Map<string, number>();
    const menuItems = db.getMenuItems();
    const itemToCategory = new Map(menuItems.map(m => [m.id, m.categoryId]));

    for (const ord of orders) {
      if (ord.status !== 'cancelled') {
        for (const it of ord.items) {
          if (it.kitchenStatus !== 'cannot_prepare') {
            const current = dishSalesMap.get(it.menuItemId) || { id: it.menuItemId, name: it.name, quantity: 0, revenue: 0 };
            current.quantity += it.quantity;
            current.revenue += it.unitPrice * it.quantity;
            dishSalesMap.set(it.menuItemId, current);

            const catId = itemToCategory.get(it.menuItemId) || 'other';
            categorySalesMap.set(catId, (categorySalesMap.get(catId) || 0) + (it.unitPrice * it.quantity));
          }
        }
      }
    }

    const popularDishes = Array.from(dishSalesMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
    const categoryBreakdown = Array.from(categorySalesMap.entries()).map(([catId, amount]) => {
      const cat = db.getCategories().find(c => c.id === catId);
      return {
        categoryId: catId,
        categoryName: cat?.name || catId,
        revenue: Math.round(amount * 100) / 100
      };
    });

    res.json({
      summary: {
        totalOrders: orders.length,
        totalCollectedSales: Math.round(totalCollectedSales * 100) / 100,
        totalOutstandingBalance: Math.round(totalOutstandingBalance * 100) / 100,
        totalDiscountsGiven: Math.round(totalDiscountAmount * 100) / 100,
        paidBillsCount,
        openBillsCount
      },
      popularDishes,
      categoryBreakdown
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CSV Export for Sales & Payments
apiRouter.get('/admin/reports/export-csv', requireRole(['manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const bills = db.getAllBills();
    let csv = 'Bill Number,Table,Status,Created At,Subtotal (Nu.),Discount (Nu.),Service Charge (Nu.),Tax (Nu.),Total (Nu.),Paid Amount (Nu.),Balance Due (Nu.),Payment Methods\n';

    for (const b of bills) {
      const methods = b.payments.map(p => `${p.method}: ${p.amount}`).join('; ');
      csv += `"${b.billNumber}","${b.tableNumber}","${b.status}","${b.createdAt}",${b.subtotal},${b.discount?.appliedAmount || 0},${b.serviceChargeAmount},${b.taxAmount},${b.total},${b.paidAmount},${b.balanceDue},"${methods}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="high_quality_cafe_sales_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs
apiRouter.get('/admin/audit-logs', requireRole(['manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  res.json({
    generalLogs: db.getAuditLogs(),
    priceLogs: db.getPriceAuditLogs()
  });
});

// Update System Settings
apiRouter.put('/admin/settings', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const updated = db.updateSettings(req.body, staffName);
    sseHub.broadcast('settings_updated', { settings: updated });
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
