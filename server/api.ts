import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { db } from './db.ts';
import { sseHub } from './sse.ts';
import {
  createStaffToken,
  revokeStaffToken,
  verifyStaffToken,
  extractRawBearerToken,
  extractStaffFromRequest,
  requireRole,
  timingSafeTokenMatch,
  createRateLimiter,
  AuthenticatedRequest
} from './auth.ts';
import {
  MenuItem,
  PaymentMethod,
  RestaurantTable,
  OrderRound,
  Bill,
  SystemSettings
} from '../src/types/index.ts';

export const apiRouter = Router();

// ==========================================
// SECURITY HELPERS & GUEST PAYLOAD SANITIZERS
// ==========================================

function extractTableToken(req: Request): string {
  const fromQuery = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (fromQuery) return fromQuery;
  const fromHeader = typeof req.headers['x-table-token'] === 'string' ? req.headers['x-table-token'].trim() : '';
  if (fromHeader) return fromHeader;
  const fromBody = typeof req.body?.tableToken === 'string' ? req.body.tableToken.trim() : '';
  return fromBody;
}

function isTableGuestAuthorized(req: Request, table: RestaurantTable): boolean {
  const providedToken = extractTableToken(req);
  if (!providedToken || !table.tableToken) return false;
  return timingSafeTokenMatch(providedToken, table.tableToken);
}

function sanitizeTableForGuest(table: RestaurantTable): Omit<RestaurantTable, 'tableToken' | 'currentSessionId'> {
  return {
    id: table.id,
    tableNumber: table.tableNumber,
    capacity: table.capacity,
    section: table.section,
    status: table.status
  };
}

function sanitizeOrderForGuest(order: OrderRound): Omit<OrderRound, 'idempotencyKey'> {
  const { idempotencyKey: _idemp, ...safeOrder } = order;
  return safeOrder;
}

function sanitizeBillForGuest(bill: Bill): Bill {
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    sessionId: bill.sessionId,
    tableId: bill.tableId,
    tableNumber: bill.tableNumber,
    orderRoundIds: bill.orderRoundIds,
    subtotal: bill.subtotal,
    discount: bill.discount
      ? {
          id: bill.discount.id,
          name: bill.discount.name,
          type: bill.discount.type,
          value: bill.discount.value,
          appliedAmount: bill.discount.appliedAmount,
          reason: '',
          authorizedBy: ''
        }
      : null,
    taxRate: bill.taxRate,
    taxAmount: bill.taxAmount,
    serviceChargeRate: bill.serviceChargeRate,
    serviceChargeAmount: bill.serviceChargeAmount,
    additionalCharges: bill.additionalCharges,
    total: bill.total,
    paidAmount: bill.paidAmount,
    balanceDue: bill.balanceDue,
    status: bill.status,
    payments: [], // Never expose staff payment logs or references to guest clients
    createdAt: bill.createdAt
  };
}

function sanitizeSettingsForGuest(settings: SystemSettings): SystemSettings {
  return {
    restaurantName: settings.restaurantName,
    tagline: settings.tagline,
    operatingHours: settings.operatingHours,
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    taxRate: settings.taxRate,
    serviceChargeRate: settings.serviceChargeRate,
    allowGuestOrdering: settings.allowGuestOrdering,
    kitchenAudioAlert: false,
    showPricesOnCustomerMenu: settings.showPricesOnCustomerMenu,
    address: settings.address,
    phone: settings.phone
  };
}

const guestOrderLimiter = createRateLimiter({
  scope: 'guest_order',
  maxRequests: 15,
  windowMs: 60 * 1000,
  message: 'Too many order submissions from this device. Please wait a minute before placing another round.'
});

const staffLoginLimiter = createRateLimiter({
  scope: 'staff_login',
  maxRequests: 15,
  windowMs: 5 * 60 * 1000,
  message: 'Too many sign-in attempts. Please wait a few minutes before retrying.'
});

// ==========================================
// 1. REAL-TIME SERVER-SENT EVENTS (ISOLATED)
// ==========================================
apiRouter.get('/events', (req: Request, res: Response) => {
  const clientId = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Authenticate staff stream if valid staff token provided
  const rawStaffToken =
    (typeof req.query.staffToken === 'string' ? req.query.staffToken.trim() : '') ||
    extractRawBearerToken(req);
  const staff = rawStaffToken ? verifyStaffToken(rawStaffToken) : null;

  if (staff) {
    sseHub.addClient(clientId, res, {
      isStaff: true,
      staffRole: staff.role
    });
    return;
  }

  // Otherwise verify table-scoped guest QR token if provided
  const rawTableId = typeof req.query.tableId === 'string' ? req.query.tableId.trim().toUpperCase() : '';
  const rawTableToken = typeof req.query.tableToken === 'string' ? req.query.tableToken.trim() : '';
  const table = rawTableId ? db.getTable(rawTableId) : null;
  const isVerifiedGuest = Boolean(
    table && table.tableToken && rawTableToken && timingSafeTokenMatch(rawTableToken, table.tableToken)
  );

  sseHub.addClient(clientId, res, {
    isStaff: false,
    isVerifiedTableGuest: isVerifiedGuest,
    verifiedTableId: isVerifiedGuest && table ? table.id : undefined
  });
});

// ==========================================
// 2. GUEST-FACING MENU & TABLE-SCOPED ORDERING
// ==========================================

// Public customer menu (returns only guest-safe settings and active menu items for guests)
apiRouter.get('/menu', (req: Request, res: Response) => {
  try {
    const staff = extractStaffFromRequest(req);
    const settings = db.getSettings();
    const categories = db.getCategories();
    const allItems = db.getMenuItems();

    if (staff) {
      return res.json({
        settings,
        categories,
        menuItems: allItems
      });
    }

    res.json({
      settings: sanitizeSettingsForGuest(settings),
      categories,
      menuItems: allItems.filter(item => item.isAvailable !== false)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load menu' });
  }
});

// Verify table existence and cryptographic QR token (NEVER exposes tableToken!)
apiRouter.get('/tables/:id', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '').trim().toUpperCase();
  const table = db.getTable(tableId);
  if (!table) {
    return res.status(404).json({ error: `Table "${tableId}" does not exist` });
  }

  const staff = extractStaffFromRequest(req);
  const isTokenValid = isTableGuestAuthorized(req, table);

  if (!staff && !isTokenValid) {
    // Unverified guest: never leak tableToken, activeSession, or table occupancy state
    return res.json({
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        section: table.section,
        status: 'available'
      },
      isTokenValid: false,
      hasTokenConfigured: Boolean(table.tableToken),
      activeSession: null
    });
  }

  const activeSession = table.currentSessionId ? db.getSession(table.currentSessionId) : null;
  res.json({
    table: sanitizeTableForGuest(table),
    isTokenValid: Boolean(isTokenValid || staff),
    hasTokenConfigured: Boolean(table.tableToken),
    activeSession: activeSession
      ? {
          id: activeSession.id,
          tableId: activeSession.tableId,
          tableNumber: activeSession.tableNumber,
          status: activeSession.status,
          startedAt: activeSession.startedAt,
          orderRoundIds: activeSession.orderRoundIds
        }
      : null
  });
});

// Get order rounds for the current active table session (Requires valid table QR token or staff auth)
apiRouter.get('/tables/:id/orders', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '').trim().toUpperCase();
  const table = db.getTable(tableId);
  if (!table) {
    return res.status(404).json({ error: `Table "${tableId}" does not exist` });
  }

  const staff = extractStaffFromRequest(req);
  if (!staff && !isTableGuestAuthorized(req, table)) {
    return res.status(403).json({
      error: 'Forbidden: Valid table QR token is required to view orders for this table.'
    });
  }

  if (!table.currentSessionId) {
    return res.json({ session: null, rounds: [], bill: null });
  }
  const session = db.getSession(table.currentSessionId);
  if (!session || session.status !== 'active') {
    return res.json({ session: null, rounds: [], bill: null });
  }

  const rounds = session.orderRoundIds
    .map(id => db.getOrderRound(id))
    .filter((o): o is OrderRound => Boolean(o && (staff || o.status !== 'cancelled')));

  const bill = db.getBillBySessionId(session.id);

  if (staff) {
    return res.json({ session, rounds, bill });
  }

  res.json({
    session: {
      id: session.id,
      tableId: session.tableId,
      tableNumber: session.tableNumber,
      status: session.status,
      startedAt: session.startedAt,
      orderRoundIds: rounds.map(r => r.id)
    },
    rounds: rounds.map(sanitizeOrderForGuest),
    bill: bill ? sanitizeBillForGuest(bill) : null
  });
});

// Submit a new order round (Approved guest ordering endpoint with strict server-side validation)
apiRouter.post('/orders', guestOrderLimiter, (req: Request, res: Response) => {
  try {
    const staff = extractStaffFromRequest(req);
    const settings = db.getSettings();

    if (!staff && !settings.allowGuestOrdering) {
      return res.status(403).json({
        error: 'Guest self-ordering is currently disabled. Please place your order with café staff.'
      });
    }

    const { tableId, items, customerNote, idempotencyKey } = req.body || {};
    const tableToken = extractTableToken(req);

    if (!tableId || typeof tableId !== 'string') {
      return res.status(400).json({ error: 'tableId is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items array cannot be empty' });
    }

    const result = db.createOrderRound({
      tableId,
      tableToken: tableToken || undefined,
      requireValidTableToken: !staff,
      placedByStaffName: staff?.name,
      items,
      customerNote,
      idempotencyKey
    });

    // Scoped broadcast: full operational payload to staff, sanitized order status to verified table guest ONLY
    sseHub.broadcastToTableAndStaff(
      result.order.tableId,
      'order_created',
      {
        order: result.order,
        bill: result.bill,
        tableId: result.order.tableId
      },
      {
        order: sanitizeOrderForGuest(result.order),
        tableId: result.order.tableId
      }
    );

    res.status(201).json({
      success: true,
      order: staff ? result.order : sanitizeOrderForGuest(result.order),
      bill: staff ? result.bill : sanitizeBillForGuest(result.bill),
      message: `Order ${result.order.orderNumber} successfully placed for ${result.bill.tableNumber}!`
    });
  } catch (err: any) {
    const status = err.statusCode === 403 ? 403 : 400;
    res.status(status).json({ error: err.message || 'Failed to create order' });
  }
});

// Explicitly block guests from modifying or cancelling orders
apiRouter.put('/orders/:id', (_req: Request, res: Response) => {
  res.status(403).json({ error: 'Forbidden: Guests cannot modify submitted orders.' });
});
apiRouter.patch('/orders/:id', (_req: Request, res: Response) => {
  res.status(403).json({ error: 'Forbidden: Guests cannot modify or cancel submitted orders.' });
});
apiRouter.delete('/orders/:id', (_req: Request, res: Response) => {
  res.status(403).json({ error: 'Forbidden: Guests cannot cancel or delete orders.' });
});

// Get single order confirmation details (Strictly requires staff auth OR matching active table QR token)
apiRouter.get('/orders/:id', (req: Request, res: Response) => {
  const staff = extractStaffFromRequest(req);
  const order = db.getOrderRound(req.params.id);

  if (!staff) {
    const providedToken = extractTableToken(req);
    if (!providedToken) {
      return res.status(403).json({ error: 'Forbidden: Valid table QR token required to view order details.' });
    }
    if (!order) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view this order.' });
    }
    const table = db.getTable(order.tableId);
    const session = db.getSession(order.sessionId);
    if (!table || !session || session.status !== 'active' || !isTableGuestAuthorized(req, table)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view other customers\' orders.' });
    }
    return res.json(sanitizeOrderForGuest(order));
  }

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// Get session details (Strictly requires staff auth OR matching active table QR token)
apiRouter.get('/session/:id', (req: Request, res: Response) => {
  const staff = extractStaffFromRequest(req);
  const session = db.getSession(req.params.id);

  if (!staff) {
    const providedToken = extractTableToken(req);
    if (!providedToken || !session || session.status !== 'active') {
      return res.status(403).json({ error: 'Forbidden: Valid active table QR token required.' });
    }
    const table = db.getTable(session.tableId);
    if (!table || !isTableGuestAuthorized(req, table)) {
      return res.status(403).json({ error: 'Forbidden: Cannot access another table\'s dining session.' });
    }
    const rounds = session.orderRoundIds
      .map(id => db.getOrderRound(id))
      .filter((o): o is OrderRound => Boolean(o && o.status !== 'cancelled'))
      .map(sanitizeOrderForGuest);
    const bill = db.getBillBySessionId(session.id);

    return res.json({
      session: {
        id: session.id,
        tableId: session.tableId,
        tableNumber: session.tableNumber,
        status: session.status,
        startedAt: session.startedAt,
        orderRoundIds: rounds.map(r => r.id)
      },
      rounds,
      bill: bill ? sanitizeBillForGuest(bill) : null
    });
  }

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
// 3. STAFF AUTHENTICATION (SEPARATED & PROTECTED)
// ==========================================

// Block any public self-registration attempts
apiRouter.all('/auth/register', (_req: Request, res: Response) => {
  res.status(403).json({ error: 'Forbidden: Public registration for staff or administrator accounts is disabled.' });
});
apiRouter.all('/auth/signup', (_req: Request, res: Response) => {
  res.status(403).json({ error: 'Forbidden: Public registration for staff or administrator accounts is disabled.' });
});

apiRouter.post('/auth/login', staffLoginLimiter, (req: Request, res: Response) => {
  const { username, pin, credential } = req.body || {};
  const effectivePin = typeof pin === 'string' ? pin.trim() : typeof credential === 'string' ? credential.trim() : '';

  if (!effectivePin) {
    return res.status(400).json({ error: 'Valid staff security PIN is required to sign in.' });
  }

  const user = db.authenticate({
    username: typeof username === 'string' ? username : undefined,
    pin: effectivePin
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid staff credentials or inactive account' });
  }

  const token = createStaffToken(user);
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      active: user.active
    }
  });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const rawToken = extractRawBearerToken(req);
  if (rawToken) {
    revokeStaffToken(rawToken);
  }
  res.json({ success: true });
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
    role: user.role,
    active: user.active
  });
});

// Strictly restricted to authenticated staff (never exposed to guests)
apiRouter.get('/auth/staff-accounts', requireRole(['kitchen', 'cashier', 'manager', 'admin']), (_req: AuthenticatedRequest, res: Response) => {
  const users = db.getStaffUsers();
  res.json(users);
});

// ==========================================
// 4. KITCHEN DISPLAY SYSTEM (KDS) — PROTECTED
// ==========================================
apiRouter.use('/kitchen', requireRole(['kitchen', 'manager', 'admin']));

apiRouter.get('/kitchen/tickets', requireRole(['kitchen', 'manager', 'admin']), (_req: AuthenticatedRequest, res: Response) => {
  const allOrders = db.getAllOrderRounds();
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

    const session = db.getSession(updatedOrder.sessionId);
    const bill = session?.billId ? db.recalculateBill(session.billId) : null;

    sseHub.broadcastToTableAndStaff(
      updatedOrder.tableId,
      'item_status_updated',
      {
        order: updatedOrder,
        bill,
        itemId: req.params.itemId,
        status
      },
      {
        order: sanitizeOrderForGuest(updatedOrder),
        itemId: req.params.itemId,
        status
      }
    );

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

    sseHub.broadcastToTableAndStaff(
      updatedOrder.tableId,
      'order_status_updated',
      {
        order: updatedOrder,
        status
      },
      {
        order: sanitizeOrderForGuest(updatedOrder),
        status
      }
    );

    res.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 5. CASHIER / COUNTER CONSOLE — PROTECTED
// ==========================================
apiRouter.use('/counter', requireRole(['cashier', 'manager', 'admin']));

apiRouter.get('/counter/bills', requireRole(['cashier', 'manager', 'admin']), (_req: AuthenticatedRequest, res: Response) => {
  const bills = db.getAllBills();
  const tables = db.getTables().map(sanitizeTableForGuest);
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

    sseHub.broadcastToStaff('bill_updated', { bill: updatedBill }, ['cashier', 'manager', 'admin']);
    res.json({ success: true, bill: updatedBill });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/counter/bills/:id/discount', requireRole(['cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Cashier';
    const updatedBill = db.removeDiscount(req.params.id, staffName);
    sseHub.broadcastToStaff('bill_updated', { bill: updatedBill }, ['cashier', 'manager', 'admin']);
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

    sseHub.broadcastToStaff(
      'payment_recorded',
      {
        bill: result.bill,
        payment: result.payment
      },
      ['cashier', 'manager', 'admin']
    );

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

    sseHub.broadcastToTableAndStaff(
      closedSession.tableId,
      'table_closed',
      {
        sessionId: req.params.sessionId,
        tableId: closedSession.tableId
      },
      {
        tableId: closedSession.tableId
      }
    );

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

    sseHub.broadcastToStaff('table_moved', { session: movedSession });

    res.json({
      success: true,
      session: movedSession,
      message: `Session transferred to Table ${movedSession.tableNumber}!`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/counter/tables/:tableId/add-order', requireRole(['cashier', 'manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items, note } = req.body;
    const staffName = req.staff?.name || 'Counter Staff';
    const result = db.createOrderRound({
      tableId: req.params.tableId,
      requireValidTableToken: false,
      placedByStaffName: staffName,
      items,
      customerNote: note ? `[Added by Counter]: ${note}` : undefined
    });

    sseHub.broadcastToTableAndStaff(
      result.order.tableId,
      'order_created',
      {
        order: result.order,
        bill: result.bill,
        tableId: result.order.tableId
      },
      {
        order: sanitizeOrderForGuest(result.order),
        tableId: result.order.tableId
      }
    );

    res.status(201).json({ success: true, order: result.order, bill: result.bill });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 6. MENU MANAGEMENT & ADMIN — PROTECTED
// ==========================================
apiRouter.use('/admin', requireRole(['kitchen', 'cashier', 'manager', 'admin']));

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
    if (saved.isAvailable !== false) {
      sseHub.broadcastPublic('menu_updated', { item: saved });
    } else {
      sseHub.broadcastToStaff('menu_updated', { item: saved });
    }
    res.status(201).json({ success: true, item: saved });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/admin/menu/:id', requireRole(['manager', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const updated = db.saveMenuItem({ ...req.body, id: req.params.id }, staffName);
    if (updated.isAvailable !== false) {
      sseHub.broadcastPublic('menu_updated', { item: updated });
    } else {
      sseHub.broadcastPublic('menu_item_deleted', { id: updated.id });
      sseHub.broadcastToStaff('menu_updated', { item: updated });
    }
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
    if (item.isAvailable !== false) {
      sseHub.broadcastPublic('menu_availability_changed', { item });
    } else {
      sseHub.broadcastPublic('menu_item_deleted', { id: item.id });
      sseHub.broadcastToStaff('menu_availability_changed', { item });
    }
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
    sseHub.broadcastPublic('menu_item_deleted', { id: req.params.id });
    res.json({ success: true, message: 'Item deleted' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Tables and printable QR codes — STRICTLY ADMIN / MANAGER ONLY
apiRouter.get('/admin/tables-with-qr', requireRole(['manager', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const tables = db.getTables();

    const tablesWithQR = await Promise.all(
      tables.map(async t => {
        const tokenParam = t.tableToken ? `&token=${encodeURIComponent(t.tableToken)}` : '';
        const targetUrl = `${baseUrl}/menu?table=${encodeURIComponent(t.id)}${tokenParam}`;
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
    sseHub.broadcastToStaff('tables_updated', { table: sanitizeTableForGuest(table) });
    res.status(201).json({ success: true, table });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/admin/tables/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const staffName = req.staff?.name || 'Admin';
    const table = db.saveTable({ ...req.body, id: req.params.id }, staffName);
    sseHub.broadcastToStaff('tables_updated', { table: sanitizeTableForGuest(table) });
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
    sseHub.broadcastToStaff('table_deleted', { id: req.params.id });
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
    sseHub.broadcastToStaff('tables_updated', { table: sanitizeTableForGuest(table) });
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
    sseHub.broadcastToStaff('tables_updated', { tables: tables.map(sanitizeTableForGuest) });
    res.json({ success: true, tables });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Staff Accounts Management
apiRouter.get('/admin/staff', requireRole(['admin']), (_req: AuthenticatedRequest, res: Response) => {
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
apiRouter.get('/admin/reports', requireRole(['manager', 'admin']), (_req: AuthenticatedRequest, res: Response) => {
  try {
    const bills = db.getAllBills();
    const orders = db.getAllOrderRounds();

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
apiRouter.get('/admin/reports/export-csv', requireRole(['manager', 'admin']), (_req: AuthenticatedRequest, res: Response) => {
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
apiRouter.get('/admin/audit-logs', requireRole(['manager', 'admin']), (_req: AuthenticatedRequest, res: Response) => {
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
    sseHub.broadcastPublic('settings_updated', { settings: sanitizeSettingsForGuest(updated) });
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Catch-all for unknown API routes (never fall through to SPA HTML)
apiRouter.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found or access denied' });
});
