import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CustomerMenu } from '../components/CustomerMenu.tsx';
import { MenuCategory, MenuItem, OrderRound, SystemSettings, Bill } from '../types/index.ts';

const TEST_SETTINGS: SystemSettings = {
  restaurantName: 'High Quality Cafe',
  tagline: 'Paro, Bhutan · Open 24/7',
  operatingHours: '24 Hours / 7 Days a Week',
  currency: 'Nu.',
  currencySymbol: 'Nu.',
  taxRate: 0.05,
  serviceChargeRate: 0.1,
  allowGuestOrdering: true,
  kitchenAudioAlert: false,
  showPricesOnCustomerMenu: true,
  address: 'Paro Town, Paro, Bhutan',
  phone: '+975 8 271234',
};

const TEST_CATEGORIES: MenuCategory[] = [
  { id: 'cat_momos', name: 'Momos & Dumplings', sortOrder: 1 },
  { id: 'cat_drinks', name: 'Artisan Coffee', sortOrder: 2 },
];

const TEST_ITEMS: MenuItem[] = [
  {
    id: 'item_momo_veg',
    categoryId: 'cat_momos',
    name: 'Steamed Cheese Momos',
    description: 'Hand-pleated dumplings filled with local Bhutanese cheese and scallions.',
    price: 180,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy', 'Gluten'],
    imageUrl: '/src/assets/images/dish_momos_steamed_1792466933578.jpg',
    preparationTimeMinutes: 12,
    timeSlot: 'all_day',
    customizationGroups: [
      {
        id: 'grp_spice',
        name: 'Ezay Chili Level',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_mild', name: 'Mild Ezay', priceModifier: 0 },
          { id: 'opt_spicy', name: 'Extra Fiery Ezay', priceModifier: 20 },
        ],
      },
      {
        id: 'grp_dip',
        name: 'Required Dipping Sauce',
        type: 'multiple',
        required: true,
        options: [
          { id: 'opt_sesame', name: 'Roasted Sesame Sauce', priceModifier: 15 },
          { id: 'opt_broth', name: 'Light Broth Cup', priceModifier: 0 },
        ],
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'item_vegan_latte',
    categoryId: 'cat_drinks',
    name: 'Oat Milk Himalayan Latte',
    description: 'Double espresso with velvety steamed oat milk.',
    price: 160,
    dietType: 'vegan',
    isAvailable: true,
    soldOut: false,
    allergens: ['Oats'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    customizationGroups: [
      {
        id: 'grp_temp',
        name: 'Temperature',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_hot', name: 'Hot', priceModifier: 0 },
          { id: 'opt_small', name: 'Piccolo Cup', priceModifier: -20 },
        ],
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'item_egg_toast',
    categoryId: 'cat_momos',
    name: 'Brioche Egg Toast',
    description: 'Soft scrambled farm eggs over toasted brioche.',
    price: 210,
    dietType: 'egg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Egg', 'Gluten'],
    imageUrl: '/src/assets/images/hero_signature_food_1793252236494.jpg',
    preparationTimeMinutes: 10,
    timeSlot: 'all_day',
    customizationGroups: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'item_soldout_burger',
    categoryId: 'cat_momos',
    name: 'Highland Yak Burger',
    description: 'Chargrilled yak patty with aged cheddar.',
    price: 350,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: true,
    allergens: ['Gluten', 'Dairy'],
    imageUrl: '/src/assets/images/dish_yak_burger_1792466934556.jpg',
    preparationTimeMinutes: 18,
    timeSlot: 'all_day',
    customizationGroups: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('CustomerMenu Ordering Flow, Filters, Cart Math & Clean Copy', () => {
  it('renders clean minimal hero banner,Order Now button, and never displays Anonymous Customer labels', () => {
    const { container } = render(
      <CustomerMenu
        settings={TEST_SETTINGS}
        categories={TEST_CATEGORIES}
        menuItems={TEST_ITEMS}
        verifiedTable={null}
        isTableTokenValidated={false}
        onSubmitOrder={vi.fn()}
        activeOrders={[]}
      />
    );

    expect(
      screen.getByRole('heading', { name: /Fresh Himalayan Dishes & Handcrafted Coffee/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Order Now/i })).toBeInTheDocument();
    expect(screen.getByText('Contains Egg')).toBeInTheDocument();

    // Never expose internal labels on customer-facing UI
    expect(container.textContent).not.toMatch(/Anonymous Customer/i);
    expect(container.textContent).not.toMatch(/Anonymous Guest/i);
  });

  it('filters by category, search query, Pure Veg (including vegan), Non-Veg, and resets cleanly', async () => {
    const user = userEvent.setup();
    render(
      <CustomerMenu
        settings={TEST_SETTINGS}
        categories={TEST_CATEGORIES}
        menuItems={TEST_ITEMS}
        verifiedTable={null}
        isTableTokenValidated={false}
        onSubmitOrder={vi.fn()}
        activeOrders={[]}
      />
    );

    // Pure Veg includes both 'veg' and 'vegan', excluding 'egg' and 'non-veg'
    await user.click(screen.getByRole('button', { name: /Pure Veg/i }));
    expect(screen.getByText('Steamed Cheese Momos')).toBeInTheDocument();
    expect(screen.getByText('Oat Milk Himalayan Latte')).toBeInTheDocument();
    expect(screen.queryByText('Brioche Egg Toast')).not.toBeInTheDocument();
    expect(screen.queryByText('Highland Yak Burger')).not.toBeInTheDocument();

    // Non-Veg includes 'non-veg' and 'egg'
    await user.click(screen.getByRole('button', { name: /^Non-Veg$/i }));
    expect(screen.getByText('Brioche Egg Toast')).toBeInTheDocument();
    expect(screen.getByText('Highland Yak Burger')).toBeInTheDocument();
    expect(screen.queryByText('Steamed Cheese Momos')).not.toBeInTheDocument();

    // Search with no matches shows empty state and Show All Items resets all filters
    const searchInput = screen.getByLabelText(/Search dishes or drinks/i);
    await user.type(searchInput, 'zzz-nonexistent-dish');
    expect(screen.getByText(/No matching items found/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show All Items/i }));
    expect(screen.getByText('Steamed Cheese Momos')).toBeInTheDocument();
    expect(screen.getByText('Oat Milk Himalayan Latte')).toBeInTheDocument();
    expect(screen.getByText('Brioche Egg Toast')).toBeInTheDocument();

    // Sold-out item button is disabled
    const yakCard = screen.getByText('Highland Yak Burger').closest('article')!;
    const soldOutBtn = within(yakCard).getByRole('button', { name: /Sold Out/i });
    expect(soldOutBtn).toBeDisabled();
  });

  it('validates required customizations, merges identical items, updates quantities, computes exact taxes, handles errors, and completes checkout', async () => {
    const user = userEvent.setup();
    const mockOrder: OrderRound = {
      id: 'ord_test_1',
      orderNumber: '#HQC-ANON-882101',
      sessionId: 'ses_anon_1',
      tableId: 'TAKEAWAY',
      tableNumber: 'Anonymous Counter Pickup',
      orderMode: 'anonymous_pickup',
      roundNumber: 1,
      status: 'submitted',
      subtotal: 430,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        {
          id: 'oi_1',
          cartItemId: 'ci_1',
          menuItemId: 'item_momo_veg',
          name: 'Steamed Cheese Momos',
          basePrice: 180,
          unitPrice: 215,
          quantity: 2,
          dietType: 'veg',
          customizations: [
            {
              groupId: 'grp_spice',
              groupName: 'Ezay Chili Level',
              optionId: 'opt_spicy',
              optionName: 'Extra Fiery Ezay',
              priceModifier: 20,
            },
            {
              groupId: 'grp_dip',
              groupName: 'Required Dipping Sauce',
              optionId: 'opt_sesame',
              optionName: 'Roasted Sesame Sauce',
              priceModifier: 15,
            },
          ],
          specialInstructions: 'Extra napkins',
          imageUrl: '/src/assets/images/dish_momos_steamed_1792466933578.jpg',
          kitchenStatus: 'pending',
        },
      ],
    };

    const mockBill: Bill = {
      id: 'bill_test_1',
      billNumber: 'INV-882101',
      sessionId: 'ses_anon_1',
      tableId: 'TAKEAWAY',
      tableNumber: 'Counter Pickup',
      orderRoundIds: ['ord_test_1'],
      subtotal: 430,
      discount: null,
      taxRate: 0.05,
      taxAmount: 21.5,
      serviceChargeRate: 0.1,
      serviceChargeAmount: 43,
      additionalCharges: 0,
      total: 494.5,
      paidAmount: 0,
      balanceDue: 494.5,
      status: 'open',
      payments: [],
      createdAt: new Date().toISOString(),
    };

    const onSubmitOrder = vi
      .fn()
      .mockRejectedValueOnce(new Error('Kitchen network timeout'))
      .mockResolvedValueOnce({ order: mockOrder, bill: mockBill, trackingToken: 'trk_1234567890abcdef' });

    const { container } = render(
      <CustomerMenu
        settings={TEST_SETTINGS}
        categories={TEST_CATEGORIES}
        menuItems={TEST_ITEMS}
        verifiedTable={null}
        isTableTokenValidated={false}
        onSubmitOrder={onSubmitOrder}
        activeOrders={[]}
        sessionOrders={[mockOrder]}
      />
    );

    // 1. Open customizer for Steamed Cheese Momos
    const momoCard = screen.getByText('Steamed Cheese Momos').closest('article')!;
    await user.click(within(momoCard).getByRole('button', { name: /Customize & Add/i }));

    const dialog = screen.getByRole('dialog');
    // Required multi-select group "Required Dipping Sauce" starts unselected -> clicking Add to Cart shows validation alert
    await user.click(within(dialog).getByRole('button', { name: /Add to Cart/i }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/Required Dipping Sauce/i);

    // Select Extra Fiery Ezay (+Nu. 20) and Roasted Sesame Sauce (+Nu. 15) -> unitPrice = 215
    await user.click(within(dialog).getByRole('button', { name: /Extra Fiery Ezay/i }));
    await user.click(within(dialog).getByRole('button', { name: /Roasted Sesame Sauce/i }));
    await user.type(within(dialog).getByLabelText(/Special Instructions/i), 'Extra napkins');

    // Increase quantity to 2 -> Item Total = Nu. 430
    await user.click(within(dialog).getByRole('button', { name: /Increase quantity/i }));
    expect(within(dialog).getByText('Nu. 430')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Add to Cart/i }));

    // 2. Cart drawer opens automatically with accurate totals:
    // Subtotal = 430, Service Charge (10%) = 43, Sales Tax (5%) = 21.5, Total = 494.5
    const cartDialog = screen.getByRole('dialog', { name: /Your Cart/i });
    expect(within(cartDialog).getAllByText('Nu. 430').length).toBeGreaterThanOrEqual(2);
    expect(within(cartDialog).getByText('Nu. 43')).toBeInTheDocument();
    expect(within(cartDialog).getByText('Nu. 21.5')).toBeInTheDocument();
    expect(within(cartDialog).getByText('Nu. 494.5')).toBeInTheDocument();

    // Test + and - quantity adjustments in cart drawer
    await user.click(within(cartDialog).getByRole('button', { name: /Increase quantity of Steamed Cheese Momos/i }));
    expect(within(cartDialog).getAllByText('Nu. 645').length).toBeGreaterThanOrEqual(2);
    await user.click(within(cartDialog).getByRole('button', { name: /Decrease quantity of Steamed Cheese Momos/i }));
    expect(within(cartDialog).getAllByText('Nu. 430').length).toBeGreaterThanOrEqual(2);

    // 3. First submission fails with network error -> displays alert and preserves cart (never shows fake confirmation)
    await user.click(within(cartDialog).getByRole('button', { name: /Place Order/i }));
    await waitFor(() => {
      expect(within(cartDialog).getByRole('alert')).toHaveTextContent(/Kitchen network timeout/i);
    });
    expect(screen.queryByText(/Order Confirmed/i)).not.toBeInTheDocument();

    // 4. Retry submission succeeds -> clears cart and shows Order Confirmation modal
    await user.click(within(cartDialog).getByRole('button', { name: /Place Order/i }));
    const confirmDialog = await screen.findByRole('dialog', { name: /Order Confirmed/i });
    expect(within(confirmDialog).getByText('#HQC-ANON-882101')).toBeInTheDocument();
    expect(within(confirmDialog).getByText(/Show this order number at the counter/i)).toBeInTheDocument();

    // Copy order number button works
    await user.click(within(confirmDialog).getByRole('button', { name: /Copy/i }));
    expect(within(confirmDialog).getByText(/Copied/i)).toBeInTheDocument();

    // Track Order Status navigates to My Orders view without exposing internal labels
    await user.click(within(confirmDialog).getByRole('button', { name: /Track Order Status/i }));
    expect(screen.getByRole('heading', { name: /My Orders/i })).toBeInTheDocument();
    expect(screen.getByText('Counter Pickup')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Anonymous Customer/i);
    expect(container.textContent).not.toMatch(/Anonymous Guest/i);
  });
});
