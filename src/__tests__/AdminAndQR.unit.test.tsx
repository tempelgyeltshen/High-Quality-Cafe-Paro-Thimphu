import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Navbar } from '../components/Navbar.tsx';
import { AccessDeniedView } from '../components/AccessDeniedView.tsx';
import { PreviousOrdersView } from '../components/PreviousOrdersView.tsx';
import { AdminHub } from '../components/AdminHub.tsx';
import { api } from '../lib/api.ts';
import { MenuCategory, MenuItem, OrderRound, StaffUser, SystemSettings } from '../types/index.ts';

const SETTINGS: SystemSettings = {
  restaurantName: 'High Quality Cafe',
  tagline: 'Paro, Bhutan · Open 24/7',
  operatingHours: '24 Hours / 7 Days a Week',
  currency: 'Nu.',
  currencySymbol: 'Nu.',
  taxRate: 0.05,
  serviceChargeRate: 0.1,
  allowGuestOrdering: true,
  kitchenAudioAlert: true,
  showPricesOnCustomerMenu: true,
  address: 'High Quality Cafe, Paro Town, Paro, Bhutan',
  phone: '+975 8 271234',
};

const CATEGORIES: MenuCategory[] = [{ id: 'cat_starter', name: 'Starters', sortOrder: 1 }];

const DISHES: MenuItem[] = [
  {
    id: 'dish_1',
    categoryId: 'cat_starter',
    name: 'Crispy Chili Potatoes',
    description: 'Wok-tossed Paro potatoes with honey chili glaze.',
    price: 190,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_signature_food_1793252236494.jpg',
    preparationTimeMinutes: 10,
    timeSlot: 'all_day',
    customizationGroups: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('Navbar, AccessDeniedView, PreviousOrdersView & AdminHub Interactive Controls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('isolates guest Navbar with zero staff navigation buttons while exposing role-permitted buttons for staff', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onLogout = vi.fn();

    const { rerender, container } = render(
      <Navbar
        currentView="customer"
        onNavigate={onNavigate}
        currentUser={null}
        onLogout={onLogout}
        isConnected={true}
        verifiedTableLabel="Table 2"
        verifiedTableSection="Window Terrace"
      />
    );

    expect(screen.getByText('High Quality Cafe')).toBeInTheDocument();
    expect(screen.getByText('Table 2')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).not.toMatch(/Admin|Chef Dashboard|Counter|Staff/i);

    const adminUser: StaffUser = {
      id: 'usr_admin',
      username: 'admin',
      name: 'Dechen Wangchuk',
      role: 'admin',
      active: true,
      pin: '••••',
    };

    rerender(
      <Navbar
        currentView="admin"
        onNavigate={onNavigate}
        currentUser={adminUser}
        onLogout={onLogout}
        isConnected={true}
      />
    );

    await user.click(screen.getAllByRole('button', { name: /Kitchen|Chef Dashboard/i })[0]);
    expect(onNavigate).toHaveBeenCalledWith('kitchen');
  });

  it('renders AccessDeniedView action buttons and routes users properly', async () => {
    const user = userEvent.setup();
    const onReturn = vi.fn();
    const onSwitch = vi.fn();
    const onPermitted = vi.fn();

    render(
      <AccessDeniedView
        currentUser={null}
        attemptedView="/admin"
        onNavigatePermitted={onPermitted}
        onSwitchStaff={onSwitch}
        onReturnToCustomer={onReturn}
      />
    );

    await user.click(screen.getByRole('button', { name: /Return to Guest Menu/i }));
    expect(onReturn).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Staff & Management Sign-In/i }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('renders PreviousOrdersView with Nu. 0 for unavailable items and supports Refresh and Browse Menu buttons', async () => {
    const user = userEvent.setup();
    const onOrderMore = vi.fn();
    const onRefresh = vi.fn();

    const orderWithRejectedItem: OrderRound = {
      id: 'ord_prev_1',
      orderNumber: '#HQC-ANON-551100',
      sessionId: 'ses_1',
      tableId: 'TAKEAWAY',
      tableNumber: 'Anonymous Counter Pickup',
      orderMode: 'anonymous_pickup',
      roundNumber: 1,
      subtotal: 190,
      status: 'preparing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        {
          id: 'oi_ok',
          cartItemId: 'ci_ok',
          menuItemId: 'dish_1',
          name: 'Crispy Chili Potatoes',
          basePrice: 190,
          unitPrice: 190,
          quantity: 1,
          dietType: 'veg',
          customizations: [],
          imageUrl: '',
          kitchenStatus: 'preparing',
        },
        {
          id: 'oi_rej',
          cartItemId: 'ci_rej',
          menuItemId: 'dish_2',
          name: 'Seasonal Berry Tart',
          basePrice: 220,
          unitPrice: 220,
          quantity: 1,
          dietType: 'veg',
          customizations: [],
          rejectionReason: 'Sold out for tonight',
          imageUrl: '',
          kitchenStatus: 'cannot_prepare',
        },
      ],
    };

    const { container } = render(
      <PreviousOrdersView
        currentTable={null}
        orders={[orderWithRejectedItem]}
        settings={SETTINGS}
        onOrderMore={onOrderMore}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText('Nu. 0')).toBeInTheDocument();
    expect(screen.queryByText('Nu. 220')).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Anonymous Customer|Anonymous Guest/i);

    await user.click(screen.getByRole('button', { name: /Refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Order More/i }));
    expect(onOrderMore).toHaveBeenCalledTimes(1);
  });

  it('operates AdminHub tabs, Dish CRUD validation, System Logs chronological ordering, Settings save, and GM vs Admin tab scoping', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getCompleteOrderHistory').mockResolvedValue({
      orders: [],
      summary: {
        totalOrders: 0,
        activeOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalOrderValue: 0,
      },
    });
    vi.spyOn(api, 'getAdminStaff').mockResolvedValue([
      { id: 'usr_admin', username: 'admin', name: 'Dechen Wangchuk', role: 'admin', active: true, pin: '••••' },
    ]);

    const onSaveMenuItem = vi.fn().mockResolvedValue(undefined);
    const onToggleAvailability = vi.fn().mockResolvedValue(undefined);
    const onDeleteMenuItem = vi.fn().mockResolvedValue(undefined);
    const onUpdateSettings = vi.fn().mockResolvedValue(undefined);

    const onFetchReports = vi.fn().mockResolvedValue({
      summary: {
        totalCollectedSales: 1250,
        paidBillsCount: 3,
        totalOutstandingBalance: 400,
        openBillsCount: 1,
        totalDiscountsGiven: 50,
        totalOrders: 4,
      },
      popularDishes: [{ id: 'dish_1', name: 'Crispy Chili Potatoes', quantity: 5, revenue: 950 }],
      categoryBreakdown: [{ categoryId: 'cat_starter', categoryName: 'Starters', revenue: 950 }],
    });

    const onFetchAuditLogs = vi.fn().mockResolvedValue({
      generalLogs: [
        { id: 'log_newest', action: 'ORDER_PLACED', details: 'Newest order event', performedBy: 'Guest', timestamp: '2026-10-29T10:00:00.000Z' },
        { id: 'log_oldest', action: 'SYSTEM_BOOT', details: 'Initial boot event', performedBy: 'System', timestamp: '2026-10-20T08:00:00.000Z' },
      ],
      priceLogs: [],
    });

    const gmUser: StaffUser = {
      id: 'usr_gm',
      username: 'gm',
      name: 'Karma Tshering',
      role: 'manager',
      active: true,
      pin: '••••',
    };

    const adminUser: StaffUser = {
      id: 'usr_admin',
      username: 'admin',
      name: 'Dechen Wangchuk',
      role: 'admin',
      active: true,
      pin: '••••',
    };

    // GM sees Order History, Reports, Menu, Tables, Audits, Logs — but NOT Staff & Roles or Settings
    const { rerender } = render(
      <AdminHub
        menuItems={DISHES}
        categories={CATEGORIES}
        settings={SETTINGS}
        currentUser={gmUser}
        tables={[]}
        onSaveMenuItem={onSaveMenuItem}
        onToggleAvailability={onToggleAvailability}
        onDeleteMenuItem={onDeleteMenuItem}
        onFetchReports={onFetchReports}
        onFetchAuditLogs={onFetchAuditLogs}
        onUpdateSettings={onUpdateSettings}
      />
    );

    expect(screen.queryByRole('button', { name: /Staff & Roles/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Settings$/i })).not.toBeInTheDocument();

    // Rerender as Admin -> Staff & Roles and Settings tabs are available
    rerender(
      <AdminHub
        menuItems={DISHES}
        categories={CATEGORIES}
        settings={SETTINGS}
        currentUser={adminUser}
        tables={[]}
        onSaveMenuItem={onSaveMenuItem}
        onToggleAvailability={onToggleAvailability}
        onDeleteMenuItem={onDeleteMenuItem}
        onFetchReports={onFetchReports}
        onFetchAuditLogs={onFetchAuditLogs}
        onUpdateSettings={onUpdateSettings}
      />
    );

    // Check System Logs chronological ordering (Newest first!)
    await user.click(screen.getByRole('button', { name: /System Logs/i }));
    await waitFor(() => {
      expect(screen.getByText('Newest order event')).toBeInTheDocument();
    });
    const logsText = document.body.textContent || '';
    expect(logsText.indexOf('Newest order event')).toBeLessThan(logsText.indexOf('Initial boot event'));

    // Check Menu & Dishes tab -> Add New Dish validation & save
    await user.click(screen.getByRole('button', { name: /Menu & Dishes/i }));
    await user.click(screen.getByRole('button', { name: /Add New Dish/i }));

    const dishModal = screen.getByRole('dialog', { name: /Add New Menu Dish/i });
    await user.click(within(dishModal).getByRole('button', { name: /Save Dish Changes/i }));
    expect(within(dishModal).getByRole('alert')).toHaveTextContent(/at least 2 characters/i);

    await user.type(within(dishModal).getByLabelText(/Dish Name/i), 'Paro Buckwheat Pancakes');
    await user.click(within(dishModal).getByRole('button', { name: /Save Dish Changes/i }));
    await waitFor(() => {
      expect(onSaveMenuItem).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Paro Buckwheat Pancakes', price: 150 })
      );
    });

    // Check Settings tab -> Save Policy Settings
    await user.click(screen.getByRole('button', { name: /^Settings$/i }));
    await user.click(screen.getByRole('button', { name: /Save Policy Settings/i }));
    await waitFor(() => {
      expect(onUpdateSettings).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('status')).toHaveTextContent(/Settings saved/i);
  });
});
