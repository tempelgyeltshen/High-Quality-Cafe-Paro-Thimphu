// @vitest-environment node
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiRouter } from '../../server/api.ts';

const DB_PATH = path.resolve(process.cwd(), 'data', 'cafe_db.json');

describe('Backend API Integration, End-to-End Ordering & RBAC Security', () => {
  let server: http.Server;
  let baseUrl: string;
  let originalDbSnapshot: string | null = null;

  beforeAll(async () => {
    if (fs.existsSync(DB_PATH)) {
      originalDbSnapshot = fs.readFileSync(DB_PATH, 'utf-8');
    }
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    await new Promise<void>(resolve => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (originalDbSnapshot !== null) {
      fs.writeFileSync(DB_PATH, originalDbSnapshot, 'utf-8');
    }
  });

  async function requestJson(
    urlPath: string,
    options: RequestInit = {}
  ): Promise<{ status: number; body: any }> {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Keep text body (e.g. CSV)
    }
    return { status: res.status, body };
  }

  it('enforces strict RBAC across guest, kitchen, cashier, GM, and admin roles', async () => {
    // 1. Unauthenticated guest blocked from all protected endpoints
    expect((await requestJson('/api/kitchen/tickets')).status).toBe(401);
    expect((await requestJson('/api/counter/bills')).status).toBe(401);
    expect((await requestJson('/api/admin/orders')).status).toBe(401);
    expect((await requestJson('/api/admin/reports')).status).toBe(401);
    expect((await requestJson('/api/admin/staff')).status).toBe(401);
    expect((await requestJson('/api/admin/tables-with-qr')).status).toBe(401);

    // 2. Public self-registration is forbidden
    expect((await requestJson('/api/auth/register', { method: 'POST', body: '{}' })).status).toBe(403);
    expect((await requestJson('/api/auth/signup', { method: 'POST', body: '{}' })).status).toBe(403);

    // 3. Authenticate all 4 staff roles
    const chefAuth = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'chef', pin: '3456' })
    });
    const cashierAuth = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', pin: '2345' })
    });
    const gmAuth = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'gm', pin: '4567' })
    });
    const adminAuth = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', pin: '1234' })
    });

    expect(chefAuth.status).toBe(200);
    expect(cashierAuth.status).toBe(200);
    expect(gmAuth.status).toBe(200);
    expect(adminAuth.status).toBe(200);

    // 4. Kitchen role permissions
    expect(
      (await requestJson('/api/kitchen/tickets', { headers: { Authorization: `Bearer ${chefAuth.body.token}` } })).status
    ).toBe(200);
    expect(
      (await requestJson('/api/counter/bills', { headers: { Authorization: `Bearer ${chefAuth.body.token}` } })).status
    ).toBe(403);
    expect(
      (await requestJson('/api/admin/orders', { headers: { Authorization: `Bearer ${chefAuth.body.token}` } })).status
    ).toBe(403);

    // 5. Cashier role permissions
    expect(
      (await requestJson('/api/counter/bills', { headers: { Authorization: `Bearer ${cashierAuth.body.token}` } })).status
    ).toBe(200);
    expect(
      (await requestJson('/api/admin/orders', { headers: { Authorization: `Bearer ${cashierAuth.body.token}` } })).status
    ).toBe(403);
    expect(
      (await requestJson('/api/admin/reports', { headers: { Authorization: `Bearer ${cashierAuth.body.token}` } })).status
    ).toBe(403);

    // 6. GM role permissions: Complete Order History & Reports allowed; Staff & Settings blocked
    expect(
      (await requestJson('/api/admin/orders', { headers: { Authorization: `Bearer ${gmAuth.body.token}` } })).status
    ).toBe(200);
    expect(
      (await requestJson('/api/admin/reports', { headers: { Authorization: `Bearer ${gmAuth.body.token}` } })).status
    ).toBe(200);
    const csvRes = await requestJson('/api/admin/reports/export-csv', {
      headers: { Authorization: `Bearer ${gmAuth.body.token}` }
    });
    expect(csvRes.status).toBe(200);
    expect(String(csvRes.body)).toContain('Bill Number');
    expect(
      (await requestJson('/api/admin/staff', { headers: { Authorization: `Bearer ${gmAuth.body.token}` } })).status
    ).toBe(403);

    // 7. Admin role permissions & logout token revocation
    expect(
      (await requestJson('/api/admin/staff', { headers: { Authorization: `Bearer ${adminAuth.body.token}` } })).status
    ).toBe(200);
    await requestJson('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chefAuth.body.token}` }
    });
    expect(
      (await requestJson('/api/auth/me', { headers: { Authorization: `Bearer ${chefAuth.body.token}` } })).status
    ).toBe(401);
  });

  it('executes complete 12-step dine-in QR ordering, kitchen preparation, cashier billing, payment, and session closure flow', async () => {
    const adminLogin = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', pin: '1234' })
    });
    const cashierLogin = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', pin: '2345' })
    });
    const chefLogin = await requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'chef', pin: '3456' })
    });

    // Fetch QR token for an available table (T04)
    const qrList = await requestJson('/api/admin/tables-with-qr', {
      headers: { Authorization: `Bearer ${adminLogin.body.token}` }
    });
    expect(qrList.status).toBe(200);
    const table4 = qrList.body.find((t: any) => t.id === 'T04');
    expect(table4).toBeDefined();

    // Guest loads public menu and verifies table QR token
    const guestMenu = await requestJson('/api/menu');
    expect(guestMenu.status).toBe(200);
    expect(guestMenu.body.menuItems.length).toBeGreaterThan(20);
    const availableDish = guestMenu.body.menuItems[0];

    const verifyRes = await requestJson(
      `/api/tables/T04?token=${encodeURIComponent(table4.tableToken)}`
    );
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.isTokenValid).toBe(true);
    expect('tableToken' in verifyRes.body.table).toBe(false);

    // Guest submits order for T04
    const orderRes = await requestJson('/api/orders', {
      method: 'POST',
      headers: { 'x-table-token': table4.tableToken },
      body: JSON.stringify({
        tableId: 'T04',
        items: [{ menuItemId: availableDish.id, quantity: 2, specialInstructions: 'Less chili' }],
        customerNote: 'Please bring warm water',
        idempotencyKey: `e2e_t04_${Date.now()}`
      })
    });
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.order.orderNumber).toMatch(/^#HQC-T04-/);
    expect(orderRes.body.message).not.toMatch(/anonymous/i);
    expect(orderRes.body.trackingToken).toMatch(/^trk_/);

    // Guest cannot modify or cancel submitted order
    expect(
      (await requestJson(`/api/orders/${orderRes.body.order.id}`, { method: 'DELETE' })).status
    ).toBe(403);

    // Cross-table snooping is blocked
    expect(
      (
        await requestJson('/api/tables/T02/orders', {
          headers: { 'x-table-token': table4.tableToken }
        })
      ).status
    ).toBe(403);

    // Chef sees ticket and advances status: submitted -> preparing -> ready -> served
    const prepRes = await requestJson(
      `/api/kitchen/orders/${orderRes.body.order.id}/status`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${chefLogin.body.token}` },
        body: JSON.stringify({ status: 'preparing' })
      }
    );
    expect(prepRes.status).toBe(200);
    expect(prepRes.body.order.status).toBe('preparing');

    const readyRes = await requestJson(
      `/api/kitchen/orders/${orderRes.body.order.id}/status`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${chefLogin.body.token}` },
        body: JSON.stringify({ status: 'ready' })
      }
    );
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.order.status).toBe('ready');

    // Cashier inspects bill, settles full payment, and still sees paid dine-in bill until session close
    const billId = orderRes.body.bill.id;
    const payRes = await requestJson(`/api/counter/bills/${billId}/payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierLogin.body.token}` },
      body: JSON.stringify({
        method: 'card',
        amount: orderRes.body.bill.total,
        reference: 'POS-9988'
      })
    });
    expect(payRes.status).toBe(200);
    expect(payRes.body.bill.status).toBe('paid');
    expect(payRes.body.bill.closedAt).toBeUndefined();

    // Cashier still sees the paid dine-in bill before closing the table session
    const cashierQueueBeforeClose = await requestJson('/api/counter/bills', {
      headers: { Authorization: `Bearer ${cashierLogin.body.token}` }
    });
    expect(cashierQueueBeforeClose.body.bills.some((b: any) => b.id === billId)).toBe(true);

    // Cashier closes Table 4 dining session
    const closeRes = await requestJson(
      `/api/counter/sessions/${orderRes.body.order.sessionId}/close`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierLogin.body.token}` }
      }
    );
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.session.status).toBe('closed');
    expect(closeRes.body.bill.closedAt).toBeDefined();

    // Once closed, archived bill is removed from cashier's active queue, while Admin sees complete order history
    const cashierQueueAfterClose = await requestJson('/api/counter/bills', {
      headers: { Authorization: `Bearer ${cashierLogin.body.token}` }
    });
    expect(cashierQueueAfterClose.body.bills.some((b: any) => b.id === billId)).toBe(false);

    const adminHistory = await requestJson(
      `/api/admin/orders?search=${encodeURIComponent(orderRes.body.order.orderNumber)}`,
      {
        headers: { Authorization: `Bearer ${adminLogin.body.token}` }
      }
    );
    expect(adminHistory.status).toBe(200);
    expect(adminHistory.body.orders.some((o: any) => o.id === orderRes.body.order.id)).toBe(true);
  });
});
