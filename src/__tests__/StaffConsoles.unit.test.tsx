import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { KitchenDisplay } from '../components/KitchenDisplay.tsx';
import { CounterConsole } from '../components/CounterConsole.tsx';
import { StaffLoginView } from '../components/StaffLoginView.tsx';
import { api } from '../lib/api.ts';
import { Bill, MenuItem, OrderRound, RestaurantTable, StaffUser } from '../types/index.ts';

const SAMPLE_ORDER: OrderRound = {
  id: 'ord_kds_1',
  orderNumber: '#HQC-T03-1024',
  sessionId: 'ses_t03_1',
  tableId: 'T03',
  tableNumber: 'Table 3',
  orderMode: 'table_qr',
  roundNumber: 1,
  subtotal: 360,
  status: 'submitted',
  customerNote: 'Rush order for airport flight',
  createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
  updatedAt: new Date().toISOString(),
  items: [
    {
      id: 'oi_kds_1',
      cartItemId: 'ci_1',
      menuItemId: 'm_1',
      name: 'Bhutanese Ema Datshi',
      basePrice: 180,
      unitPrice: 180,
      quantity: 2,
      dietType: 'veg',
      customizations: [],
      specialInstructions: 'Extra cheese',
      imageUrl: '/src/assets/images/dish_ema_datshi_1792466932457.jpg',
      kitchenStatus: 'pending',
    },
  ],
};

const CANCELLED_ORDER: OrderRound = {
  ...SAMPLE_ORDER,
  id: 'ord_cancelled_2',
  orderNumber: '#HQC-T03-1025',
  roundNumber: 2,
  status: 'cancelled',
  items: [
    {
      ...SAMPLE_ORDER.items[0],
      id: 'oi_cancelled_1',
      name: 'Cancelled Soup',
      unitPrice: 150,
      quantity: 1,
    },
  ],
};

describe('Staff Login, Kitchen Display & Counter Billing Consoles', () => {
  it('validates StaffLoginView PIN requirement, toggles visibility, and authenticates', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onCancel = vi.fn();
    const loginSpy = vi.spyOn(api, 'login').mockResolvedValueOnce({
      success: true,
      token: 'tok_staff_test',
      user: {
        id: 'usr_chef',
        name: 'Chef Tashi',
        username: 'chef',
        role: 'kitchen',
        active: true,
        pin: '••••',
      },
    });

    render(<StaffLoginView onSuccessLogin={onSuccess} onCancel={onCancel} />);

    // Submitting without PIN shows clear error
    await user.click(screen.getByRole('button', { name: /Sign In to Workspace/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/security PIN/i);

    const pinInput = screen.getByLabelText(/^Security PIN$/i);
    expect(pinInput).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: /Show security PIN/i }));
    expect(pinInput).toHaveAttribute('type', 'text');

    await user.type(screen.getByLabelText(/Staff Username/i), 'chef');
    await user.type(pinInput, '3456');
    await user.click(screen.getByRole('button', { name: /Sign In to Workspace/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'chef', role: 'kitchen' }),
        'tok_staff_test'
      );
    });

    await user.click(screen.getByRole('button', { name: /Return to Guest Menu/i }));
    expect(onCancel).toHaveBeenCalled();
    loginSpy.mockRestore();
  });

  it('operates KitchenDisplay buttons: Start Preparing, Mark dish unavailable modal, and search filter', async () => {
    const user = userEvent.setup();
    const onUpdateItemStatus = vi.fn().mockResolvedValue(undefined);
    const onUpdateOrderStatus = vi.fn().mockResolvedValue(undefined);

    render(
      <KitchenDisplay
        orders={[SAMPLE_ORDER]}
        onUpdateItemStatus={onUpdateItemStatus}
        onUpdateOrderStatus={onUpdateOrderStatus}
        isConnected={true}
      />
    );

    expect(screen.getAllByText('#HQC-T03-1024').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bhutanese Ema Datshi').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rush order for airport flight/i).length).toBeGreaterThan(0);

    // Click Start Preparing
    const startBtns = screen.getAllByRole('button', { name: /Start Preparing/i });
    await user.click(startBtns[0]);
    expect(onUpdateOrderStatus).toHaveBeenCalledWith('ord_kds_1', 'preparing');

    // Open Mark Dish Unavailable modal and confirm with preset reason
    const unavailableBtns = screen.getAllByRole('button', {
      name: /Mark Bhutanese Ema Datshi unavailable/i,
    });
    await user.click(unavailableBtns[0]);

    const modal = screen.getByRole('dialog', { name: /Mark Dish Unavailable/i });
    await user.type(within(modal).getByLabelText(/Reason/i), 'Out of key ingredient');
    await user.click(within(modal).getByRole('button', { name: /Confirm Unavailable/i }));

    await waitFor(() => {
      expect(onUpdateItemStatus).toHaveBeenCalledWith(
        'ord_kds_1',
        'oi_kds_1',
        'cannot_prepare',
        'Out of key ingredient'
      );
    });
  });

  it('operates CounterConsole discounts, payment recording, receipt printing (excluding cancelled rounds), and Close Table Session after full payment', async () => {
    const user = userEvent.setup();
    const cashierUser: StaffUser = {
      id: 'usr_cashier',
      username: 'cashier',
      name: 'Sonam Choden',
      role: 'cashier',
      active: true,
      pin: '••••',
    };

    const tables: RestaurantTable[] = [
      { id: 'T03', tableNumber: 'Table 3', capacity: 2, section: 'Main Hall', status: 'occupied', currentSessionId: 'ses_t03_1' },
      { id: 'T04', tableNumber: 'Table 4', capacity: 4, section: 'Main Hall', status: 'available' },
    ];

    const menuItems: MenuItem[] = [];

    const openBill: Bill = {
      id: 'bill_t03',
      billNumber: 'INV-102400',
      sessionId: 'ses_t03_1',
      tableId: 'T03',
      tableNumber: 'Table 3',
      orderRoundIds: ['ord_kds_1', 'ord_cancelled_2'],
      subtotal: 360,
      discount: null,
      taxRate: 0.05,
      taxAmount: 18,
      serviceChargeRate: 0.1,
      serviceChargeAmount: 36,
      additionalCharges: 0,
      total: 414,
      paidAmount: 0,
      balanceDue: 414,
      status: 'open',
      payments: [],
      createdAt: new Date().toISOString(),
    };

    const onApplyDiscount = vi.fn().mockResolvedValue(undefined);
    const onRemoveDiscount = vi.fn().mockResolvedValue(undefined);
    const onRecordPayment = vi.fn().mockResolvedValue(undefined);
    const onCloseSession = vi.fn().mockResolvedValue(undefined);

    const { rerender, container } = render(
      <CounterConsole
        bills={[openBill]}
        tables={tables}
        orders={[SAMPLE_ORDER, CANCELLED_ORDER]}
        menuItems={menuItems}
        currentUser={cashierUser}
        onApplyDiscount={onApplyDiscount}
        onRemoveDiscount={onRemoveDiscount}
        onRecordPayment={onRecordPayment}
        onCloseSession={onCloseSession}
        onMoveSession={vi.fn()}
        onAddOrderFromCounter={vi.fn()}
      />
    );

    // Anti-slop check: zero border-l-4 classes anywhere in CounterConsole
    expect(container.querySelector('.border-l-4')).toBeNull();

    // Open Print Receipt and verify cancelled rounds are excluded from printable receipt
    await user.click(screen.getByRole('button', { name: /Print Receipt/i }));
    const receiptEl = document.getElementById('printable-receipt')!;
    expect(receiptEl.textContent).toContain('Bhutanese Ema Datshi');
    expect(receiptEl.textContent).not.toContain('Cancelled Soup');
    await user.click(screen.getByRole('button', { name: /^Close$/i }));

    // Open Apply Discount modal, test invalid >100% rejection, then apply valid 10% preset
    await user.click(screen.getByRole('button', { name: /Apply Discount/i }));
    const discountDialog = screen.getByRole('dialog', { name: /Apply Authorized Discount/i });
    const valInput = within(discountDialog).getByLabelText(/Value/i);
    await user.clear(valInput);
    await user.type(valInput, '150');
    await user.click(within(discountDialog).getByRole('button', { name: /Apply Discount/i }));
    expect(within(discountDialog).getByRole('alert')).toHaveTextContent(/between 1% and 100%/i);

    await user.click(within(discountDialog).getByRole('button', { name: /Local Resident/i }));
    await user.click(within(discountDialog).getByRole('button', { name: /Apply Discount/i }));
    await waitFor(() => {
      expect(onApplyDiscount).toHaveBeenCalledWith(
        'bill_t03',
        expect.objectContaining({ name: 'Local Resident', type: 'percentage', value: 10 })
      );
    });

    // Open Record Payment modal and confirm payment
    await user.click(screen.getByRole('button', { name: /Record Payment/i }));
    const payDialog = screen.getByRole('dialog', { name: /Record Table Payment/i });
    await user.click(within(payDialog).getByRole('button', { name: /Confirm Payment/i }));
    await waitFor(() => {
      expect(onRecordPayment).toHaveBeenCalledWith('bill_t03', {
        method: 'cash',
        amount: 414,
        reference: undefined,
      });
    });

    // Rerender with settled dine-in bill (status === 'paid', balanceDue === 0, closedAt === undefined)
    const paidUnclosedBill: Bill = {
      ...openBill,
      paidAmount: 414,
      balanceDue: 0,
      status: 'paid',
      paidAt: new Date().toISOString(),
    };

    rerender(
      <CounterConsole
        bills={[paidUnclosedBill]}
        tables={tables}
        orders={[SAMPLE_ORDER, CANCELLED_ORDER]}
        menuItems={menuItems}
        currentUser={cashierUser}
        onApplyDiscount={onApplyDiscount}
        onRemoveDiscount={onRemoveDiscount}
        onRecordPayment={onRecordPayment}
        onCloseSession={onCloseSession}
        onMoveSession={vi.fn()}
        onAddOrderFromCounter={vi.fn()}
      />
    );

    // Cashier sees "Close Table Session" button and closes the table session!
    const closeTableBtn = screen.getByRole('button', { name: /Close Table Session/i });
    expect(closeTableBtn).toBeInTheDocument();
    await user.click(closeTableBtn);
    expect(onCloseSession).toHaveBeenCalledWith('ses_t03_1');
  });
});
