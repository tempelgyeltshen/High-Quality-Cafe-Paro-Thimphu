// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CafeDatabase } from '../../server/db.ts';

describe('CafeDatabase Business Logic, Validation & Calculations', () => {
  let tempDir: string;
  let dbFile: string;
  let db: CafeDatabase;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hqc-db-test-'));
    dbFile = path.join(tempDir, 'test_cafe_db.json');
    db = new CafeDatabase(dbFile);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('initializes with official menu items, categories, tables, and default settings', () => {
    const settings = db.getSettings();
    expect(settings.restaurantName).toBe('High Quality Cafe');
    expect(settings.taxRate).toBe(0.05);
    expect(settings.serviceChargeRate).toBe(0.1);
    expect(settings.showPricesOnCustomerMenu).toBe(true);

    expect(db.getCategories().length).toBeGreaterThanOrEqual(5);
    expect(db.getMenuItems().length).toBeGreaterThanOrEqual(50);
    expect(db.getTables().some(t => t.id === 'T01' && Boolean(t.tableToken))).toBe(true);
    expect(db.getTables().some(t => t.id === 'TAKEAWAY')).toBe(true);
  });

  it('validates staff authentication, GM alias, PIN masking, and admin account protection', () => {
    expect(db.authenticate({ username: 'admin', pin: '1234' })?.role).toBe('admin');
    expect(db.authenticate({ username: 'gm', pin: '4567' })?.role).toBe('manager');
    expect(db.authenticate({ username: 'manager', pin: '4567' })?.role).toBe('manager');
    expect(db.authenticate({ username: 'cashier', pin: '2345' })?.role).toBe('cashier');
    expect(db.authenticate({ username: 'chef', pin: '3456' })?.role).toBe('kitchen');

    // Rejects wrong PIN or empty PIN
    expect(db.authenticate({ username: 'admin', pin: '9999' })).toBeNull();
    expect(db.authenticate({ username: 'admin', pin: '' })).toBeNull();
    expect(db.authenticate('')).toBeNull();

    // Never exposes plaintext PINs
    const maskedUsers = db.getStaffUsers();
    expect(maskedUsers.every(u => u.pin === '••••')).toBe(true);

    // Protects primary admin account
    const adminUser = maskedUsers.find(u => u.username === 'admin')!;
    expect(() => db.deleteStaffUser(adminUser.id, 'Admin')).toThrow(/cannot be deleted/i);
    expect(() =>
      db.saveStaffUser({ ...adminUser, active: false }, 'Admin')
    ).toThrow(/cannot be deactivated/i);
    expect(() =>
      db.saveStaffUser({ ...adminUser, role: 'cashier' }, 'Admin')
    ).toThrow(/must retain the Admin role/i);
  });

  it('creates, updates, toggles availability, and logs price audits for menu dishes', () => {
    const firstItem = db.getMenuItems()[0];
    const originalPrice = firstItem.price;
    const updated = db.saveMenuItem(
      { ...firstItem, price: originalPrice + 45 },
      'Dechen Wangchuk'
    );
    expect(updated.price).toBe(originalPrice + 45);

    const priceLogs = db.getPriceAuditLogs();
    expect(priceLogs.length).toBe(1);
    expect(priceLogs[0].menuItemId).toBe(firstItem.id);
    expect(priceLogs[0].previousPrice).toBe(originalPrice);
    expect(priceLogs[0].newPrice).toBe(originalPrice + 45);

    // Rejects invalid dish inputs
    expect(() =>
      db.saveMenuItem({ ...firstItem, name: 'A' }, 'Admin')
    ).toThrow(/at least 2 characters/i);
    expect(() =>
      db.saveMenuItem({ ...firstItem, price: -10 }, 'Admin')
    ).toThrow(/non-negative number/i);
    expect(() =>
      db.saveMenuItem({ ...firstItem, categoryId: 'non_existent_cat' }, 'Admin')
    ).toThrow(/Valid menu category/i);
  });

  it('enforces table QR token verification for dine-in orders while isolating takeaway pickup sessions', () => {
    const table1 = db.getTable('T01')!;
    const dishA = db.getMenuItems().find(m => m.isAvailable && !m.soldOut)!;
    const dishB = db.getMenuItems().filter(m => m.isAvailable && !m.soldOut)[1]!;

    // Forged or missing token for T01 is rejected for guests
    expect(() =>
      db.createOrderRound({
        tableId: 'T01',
        tableToken: 'forged_token_xyz',
        requireValidTableToken: true,
        items: [{ menuItemId: dishA.id, quantity: 1 }]
      })
    ).toThrow(/Valid table QR code scan is required/i);

    // Valid token succeeds and occupies T01
    const dineInRes = db.createOrderRound({
      tableId: 'T01',
      tableToken: table1.tableToken,
      requireValidTableToken: true,
      items: [{ menuItemId: dishA.id, quantity: 2 }],
      customerNote: 'Extra spicy'
    });
    expect(dineInRes.order.orderNumber).toMatch(/^#HQC-T01-/);
    expect(dineInRes.order.roundNumber).toBe(1);
    expect(db.getTable('T01')?.status).toBe('occupied');

    // Anonymous takeaway orders get isolated sessions & bills
    const pickup1 = db.createOrderRound({
      tableId: 'TAKEAWAY',
      requireValidTableToken: true,
      items: [{ menuItemId: dishA.id, quantity: 1 }]
    });
    const pickup2 = db.createOrderRound({
      tableId: 'TAKEAWAY',
      requireValidTableToken: true,
      items: [{ menuItemId: dishB.id, quantity: 1 }]
    });

    expect(pickup1.order.orderNumber).toMatch(/^#HQC-ANON-/);
    expect(pickup2.order.orderNumber).toMatch(/^#HQC-ANON-/);
    expect(pickup1.order.sessionId).not.toBe(pickup2.order.sessionId);
    expect(pickup1.bill.id).not.toBe(pickup2.bill.id);

    // Private tracking token lookup only returns matching order
    const tracked = db.getOrdersByTrackingTokens([pickup1.order.trackingToken!]);
    expect(tracked).toHaveLength(1);
    expect(tracked[0].id).toBe(pickup1.order.id);
  });

  it('rejects invalid quantities, empty carts, sold-out items, and malformed customizations without mutating state', () => {
    const dish = db.getMenuItems().find(m => m.isAvailable && !m.soldOut)!;

    expect(() =>
      db.createOrderRound({ tableId: 'TAKEAWAY', items: [] })
    ).toThrow(/at least one item/i);

    expect(() =>
      db.createOrderRound({ tableId: 'TAKEAWAY', items: [{ menuItemId: dish.id, quantity: 0 }] })
    ).toThrow(/Invalid quantity/i);

    expect(() =>
      db.createOrderRound({ tableId: 'TAKEAWAY', items: [{ menuItemId: dish.id, quantity: -3 }] })
    ).toThrow(/Invalid quantity/i);

    expect(() =>
      db.createOrderRound({ tableId: 'TAKEAWAY', items: [{ menuItemId: dish.id, quantity: 100 }] })
    ).toThrow(/Invalid quantity/i);

    expect(() =>
      db.createOrderRound({ tableId: 'TAKEAWAY', items: [{ menuItemId: dish.id, quantity: 1.5 }] })
    ).toThrow(/Invalid quantity/i);

    // Mark sold out and verify order rejection
    db.toggleMenuItemAvailability(dish.id, true, true, 'Chef');
    expect(() =>
      db.createOrderRound({ tableId: 'TAKEAWAY', items: [{ menuItemId: dish.id, quantity: 1 }] })
    ).toThrow(/unavailable or sold out/i);

    // Restore and test required multi-select & forged customization validation
    const customDish = db.saveMenuItem(
      {
        ...dish,
        isAvailable: true,
        soldOut: false,
        price: 200,
        customizationGroups: [
          {
            id: 'grp_size',
            name: 'Portion Size',
            type: 'single',
            required: true,
            options: [
              { id: 'opt_reg', name: 'Regular', priceModifier: 0 },
              { id: 'opt_lrg', name: 'Large', priceModifier: 50 }
            ]
          },
          {
            id: 'grp_base',
            name: 'Required Base',
            type: 'multiple',
            required: true,
            options: [
              { id: 'opt_red_rice', name: 'Bhutanese Red Rice', priceModifier: 20 },
              { id: 'opt_tingmo', name: 'Steamed Tingmo', priceModifier: 30 }
            ]
          }
        ]
      },
      'Admin'
    );

    // Forged option ID rejected
    expect(() =>
      db.createOrderRound({
        tableId: 'TAKEAWAY',
        items: [
          {
            menuItemId: customDish.id,
            quantity: 1,
            selectedCustomizations: [{ groupId: 'grp_size', optionId: 'forged_opt' }]
          }
        ]
      })
    ).toThrow(/Invalid customization option/i);

    // Missing required multiple-choice group rejected
    expect(() =>
      db.createOrderRound({
        tableId: 'TAKEAWAY',
        items: [
          {
            menuItemId: customDish.id,
            quantity: 1,
            selectedCustomizations: [{ groupId: 'grp_size', optionId: 'opt_lrg' }]
          }
        ]
      })
    ).toThrow(/required group "Required Base"/i);

    // Valid selections compute exact server-side price: (200 + 50 + 20) * 2 = 540
    const validRes = db.createOrderRound({
      tableId: 'TAKEAWAY',
      items: [
        {
          menuItemId: customDish.id,
          quantity: 2,
          selectedCustomizations: [
            { groupId: 'grp_size', optionId: 'opt_lrg' },
            { groupId: 'grp_base', optionId: 'opt_red_rice' }
          ]
        }
      ],
      idempotencyKey: 'idem_custom_test_1'
    });
    expect(validRes.order.items[0].unitPrice).toBe(270);
    expect(validRes.order.subtotal).toBe(540);
    // Bill total = 540 + 54 (10% service) + 27 (5% tax) = 621
    expect(validRes.bill.subtotal).toBe(540);
    expect(validRes.bill.serviceChargeAmount).toBe(54);
    expect(validRes.bill.taxAmount).toBe(27);
    expect(validRes.bill.total).toBe(621);

    // Duplicate submission with same idempotencyKey returns identical order without double-charging
    const dedupRes = db.createOrderRound({
      tableId: 'TAKEAWAY',
      items: [
        {
          menuItemId: customDish.id,
          quantity: 2,
          selectedCustomizations: [
            { groupId: 'grp_size', optionId: 'opt_lrg' },
            { groupId: 'grp_base', optionId: 'opt_red_rice' }
          ]
        }
      ],
      idempotencyKey: 'idem_custom_test_1'
    });
    expect(dedupRes.order.id).toBe(validRes.order.id);
    expect(dedupRes.bill.total).toBe(621);
  });

  it('computes discounts, partial/overpaid settlements, kitchen item unavailability, and session closure accurately', () => {
    const table2 = db.getTable('T02')!;
    const menuItems = db.getMenuItems().filter(m => m.isAvailable && !m.soldOut);
    const item1 = db.saveMenuItem({ ...menuItems[0], price: 200 }, 'Admin');
    const item2 = db.saveMenuItem({ ...menuItems[1], price: 100 }, 'Admin');

    const created = db.createOrderRound({
      tableId: 'T02',
      tableToken: table2.tableToken,
      requireValidTableToken: true,
      items: [
        { menuItemId: item1.id, quantity: 2 }, // 400
        { menuItemId: item2.id, quantity: 1 } // 100 -> subtotal 500
      ]
    });

    expect(created.bill.subtotal).toBe(500);
    expect(created.bill.serviceChargeAmount).toBe(50);
    expect(created.bill.taxAmount).toBe(25);
    expect(created.bill.total).toBe(575);

    // Kitchen marks item2 (Nu. 100) as cannot_prepare -> subtotal drops to 400, total to 460
    const orderItem2 = created.order.items[1];
    const updatedOrderAfterReject = db.updateOrderItemKitchenStatus(
      created.order.id,
      orderItem2.id,
      'cannot_prepare',
      'Out of fresh herbs',
      'Chef Tashi'
    );
    expect(updatedOrderAfterReject.status).toBe('submitted');
    const billAfterReject = db.getBill(created.bill.id)!;
    expect(billAfterReject.subtotal).toBe(400);
    expect(billAfterReject.total).toBe(460);

    // Apply 10% discount -> netTaxable = 360, service = 36, tax = 18, total = 414
    const discountedBill = db.applyDiscount(
      created.bill.id,
      {
        name: 'Local Resident',
        type: 'percentage',
        value: 10,
        reason: 'Regular guest',
        authorizedBy: 'Cashier'
      },
      'Cashier'
    );
    expect(discountedBill.discount?.appliedAmount).toBe(40);
    expect(discountedBill.serviceChargeAmount).toBe(36);
    expect(discountedBill.taxAmount).toBe(18);
    expect(discountedBill.total).toBe(414);

    // Cannot close session while balance is unpaid
    expect(() => db.closeDiningSession(created.order.sessionId, 'Cashier')).toThrow(
      /outstanding balance/i
    );

    // Partial payment of Nu. 200 -> balanceDue = 214, status = 'preparing'
    const partial = db.recordPayment({
      billId: created.bill.id,
      method: 'mbob_transfer',
      amount: 200,
      reference: 'MBOB-101',
      staffName: 'Cashier'
    });
    expect(partial.bill.paidAmount).toBe(200);
    expect(partial.bill.balanceDue).toBe(214);
    expect(partial.bill.status).toBe('preparing');

    // Cash overpayment of Nu. 250 -> records exact 214 balance and logs Nu. 36 change
    const finalPay = db.recordPayment({
      billId: created.bill.id,
      method: 'cash',
      amount: 250,
      staffName: 'Cashier'
    });
    expect(finalPay.payment.amount).toBe(214);
    expect(finalPay.payment.reference).toContain('Change returned: Nu. 36');
    expect(finalPay.bill.status).toBe('paid');
    expect(finalPay.bill.balanceDue).toBe(0);
    // Physical dine-in table stays open until closeDiningSession is called
    expect(finalPay.bill.closedAt).toBeUndefined();
    expect(db.getTable('T02')?.status).toBe('occupied');

    // Close dining session -> frees T02 and stamps closedAt on bill
    const closedSession = db.closeDiningSession(created.order.sessionId, 'Cashier');
    expect(closedSession.status).toBe('closed');
    expect(db.getTable('T02')?.status).toBe('available');
    expect(db.getBill(created.bill.id)?.closedAt).toBeDefined();
  });

  it('auto-cancels an order round if every item in the round is marked cannot_prepare', () => {
    const dish = db.getMenuItems().find(m => m.isAvailable && !m.soldOut)!;
    const res = db.createOrderRound({
      tableId: 'TAKEAWAY',
      items: [{ menuItemId: dish.id, quantity: 1 }]
    });

    const updated = db.updateOrderItemKitchenStatus(
      res.order.id,
      res.order.items[0].id,
      'cannot_prepare',
      'Ingredient depleted',
      'Chef'
    );
    expect(updated.status).toBe('cancelled');
    expect(db.getBill(res.bill.id)?.total).toBe(0);
    expect(db.getBill(res.bill.id)?.balanceDue).toBe(0);
  });
});
