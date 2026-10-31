import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Minus,
  ShoppingBag,
  AlertCircle,
  X,
  CheckCircle2,
  ChevronRight,
  Leaf,
  Info,
  ArrowRight,
  Utensils,
  History,
  Copy,
  Check
} from 'lucide-react';
import {
  MenuItem,
  MenuCategory,
  SystemSettings,
  RestaurantTable,
  CartItem,
  SelectedCustomization,
  OrderRound,
  Bill
} from '../types/index.ts';
import { PreviousOrdersView } from './PreviousOrdersView.tsx';
import { OrderStatusTracker } from './OrderStatusTracker.tsx';

interface CustomerMenuProps {
  settings: SystemSettings;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  verifiedTable: RestaurantTable | null;
  attemptedTableId?: string | null;
  onSubmitOrder: (
    items: Array<{
      menuItemId: string;
      quantity: number;
      selectedCustomizations?: Array<{ groupId: string; optionId: string }>;
      specialInstructions?: string;
    }>,
    customerNote?: string,
    idempotencyKey?: string,
    tableToken?: string
  ) => Promise<{ order: OrderRound; bill: Bill; trackingToken?: string }>;
  activeOrders: OrderRound[];
  sessionOrders?: OrderRound[];
  currentTableToken?: string;
  isTableTokenValidated: boolean;
  onRefreshOrders?: () => void;
  onClearUnverifiedTable?: () => void;
  onClearLocalOrders?: () => void;
  hasLocalAnonymousTokens?: boolean;
}

export const CustomerMenu: React.FC<CustomerMenuProps> = ({
  settings,
  categories,
  menuItems,
  verifiedTable,
  attemptedTableId,
  currentTableToken,
  isTableTokenValidated,
  onSubmitOrder,
  activeOrders,
  sessionOrders,
  onRefreshOrders,
  onClearUnverifiedTable,
  onClearLocalOrders,
  hasLocalAnonymousTokens = false
}) => {
  const [customerViewTab, setCustomerViewTab] = useState<'menu' | 'orders'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerNote, setCustomerNote] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const menuSectionRef = useRef<HTMLDivElement>(null);

  // Customize Item Modal
  const [itemToCustomize, setItemToCustomize] = useState<MenuItem | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalSelectedOptions, setModalSelectedOptions] = useState<Record<string, string[]>>({});
  const [modalSpecialInstructions, setModalSpecialInstructions] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Submission & Confirmation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [cartAttemptSeed, setCartAttemptSeed] = useState(
    () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const [submittedOrder, setSubmittedOrder] = useState<OrderRound | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copiedConfirmation, setCopiedConfirmation] = useState(false);

  const roundCurrency = (val: number) => Math.round(val * 100) / 100;

  // Mint a fresh idempotency seed ONLY when cart items/quantities or preparation note change
  const cartFingerprint = useMemo(
    () =>
      JSON.stringify({
        items: cart.map(c => ({
          id: c.menuItemId,
          q: c.quantity,
          o: c.customizations.map(x => `${x.groupId}:${x.optionId}`),
          s: c.specialInstructions || ''
        })),
        note: customerNote.trim()
      }),
    [cart, customerNote]
  );

  useEffect(() => {
    setCartAttemptSeed(`${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  }, [cartFingerprint]);

  const unavailableCartItemIds = useMemo(() => {
    if (menuItems.length === 0) return new Set<string>();
    const unavailable = new Set<string>();
    for (const cartItem of cart) {
      const liveItem = menuItems.find(m => m.id === cartItem.menuItemId);
      if (!liveItem || !liveItem.isAvailable || liveItem.soldOut) {
        unavailable.add(cartItem.cartItemId);
      }
    }
    return unavailable;
  }, [cart, menuItems]);

  const hasUnverifiedTableAttempt = Boolean(attemptedTableId && !isTableTokenValidated);
  const canPlaceOrder = Boolean(settings.allowGuestOrdering && !hasUnverifiedTableAttempt);

  const activeDestinationLabel =
    isTableTokenValidated && verifiedTable
      ? verifiedTable.tableNumber
      : 'Counter Pickup';

  const activeDestinationDetail =
    isTableTokenValidated && verifiedTable
      ? verifiedTable.section
        ? `${verifiedTable.tableNumber} · ${verifiedTable.section}`
        : verifiedTable.tableNumber
      : 'Counter Pickup';

  const trackedOrders = useMemo(() => {
    if (sessionOrders && sessionOrders.length > 0) return sessionOrders;
    return activeOrders;
  }, [sessionOrders, activeOrders]);

  const activeCookingCount = useMemo(() => {
    return trackedOrders.filter(o => o.status !== 'served' && o.status !== 'cancelled').length;
  }, [trackedOrders]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
        return false;
      }
      if (dietFilter === 'veg' && item.dietType !== 'veg' && item.dietType !== 'vegan') {
        return false;
      }
      if (dietFilter === 'non-veg' && item.dietType !== 'non-veg' && item.dietType !== 'egg') {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesAllergens = item.allergens.some(a => a.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesAllergens) return false;
      }
      return true;
    });
  }, [menuItems, selectedCategory, dietFilter, searchQuery]);

  const handleScrollToMenu = () => {
    setCustomerViewTab('menu');
    requestAnimationFrame(() => {
      menuSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openCustomizer = (item: MenuItem) => {
    if (item.soldOut || !item.isAvailable) return;
    setItemToCustomize(item);
    setModalQuantity(1);
    setModalSpecialInstructions('');
    setModalError(null);

    const defaults: Record<string, string[]> = {};
    item.customizationGroups.forEach(grp => {
      if (grp.type === 'single' && grp.options.length > 0) {
        defaults[grp.id] = [grp.options[0].id];
      } else {
        defaults[grp.id] = [];
      }
    });
    setModalSelectedOptions(defaults);
  };

  const modalUnitPrice = useMemo(() => {
    if (!itemToCustomize) return 0;
    let price = itemToCustomize.price;
    itemToCustomize.customizationGroups.forEach(grp => {
      const selected = modalSelectedOptions[grp.id] || [];
      selected.forEach(optId => {
        const opt = grp.options.find(o => o.id === optId);
        if (opt) price += opt.priceModifier;
      });
    });
    return roundCurrency(Math.max(0, price));
  }, [itemToCustomize, modalSelectedOptions]);

  const handleAddToCart = () => {
    if (!itemToCustomize) return;

    const missingRequiredGroup = itemToCustomize.customizationGroups.find(
      grp => grp.required && (modalSelectedOptions[grp.id] || []).length === 0
    );
    if (missingRequiredGroup) {
      setModalError(`Please choose an option for "${missingRequiredGroup.name}".`);
      return;
    }

    const selections: SelectedCustomization[] = [];
    itemToCustomize.customizationGroups.forEach(grp => {
      const selected = modalSelectedOptions[grp.id] || [];
      selected.forEach(optId => {
        const opt = grp.options.find(o => o.id === optId);
        if (opt) {
          selections.push({
            groupId: grp.id,
            groupName: grp.name,
            optionId: opt.id,
            optionName: opt.name,
            priceModifier: opt.priceModifier
          });
        }
      });
    });

    const normalizedNote = modalSpecialInstructions.trim() || undefined;
    const selectionSignature = selections
      .map(s => `${s.groupId}:${s.optionId}`)
      .sort()
      .join('|');

    setCart(prev => {
      const existingIndex = prev.findIndex(existing => {
        if (existing.menuItemId !== itemToCustomize.id) return false;
        if ((existing.specialInstructions || '') !== (normalizedNote || '')) return false;
        const existingSig = existing.customizations
          .map(s => `${s.groupId}:${s.optionId}`)
          .sort()
          .join('|');
        return existingSig === selectionSignature;
      });

      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = {
          ...copy[existingIndex],
          unitPrice: modalUnitPrice,
          quantity: Math.min(99, copy[existingIndex].quantity + modalQuantity)
        };
        return copy;
      }

      const newCartItem: CartItem = {
        cartItemId: `ci_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        menuItemId: itemToCustomize.id,
        name: itemToCustomize.name,
        basePrice: itemToCustomize.price,
        unitPrice: modalUnitPrice,
        quantity: Math.min(99, Math.max(1, modalQuantity)),
        dietType: itemToCustomize.dietType,
        customizations: selections,
        specialInstructions: normalizedNote,
        imageUrl: itemToCustomize.imageUrl
      };
      return [...prev, newCartItem];
    });

    setModalError(null);
    setItemToCustomize(null);
    setSubmitError(null);
    setIsCartOpen(true);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.cartItemId === cartItemId) {
            const newQty = Math.min(99, item.quantity + delta);
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeCartItem = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const cartSubtotal = useMemo(() => {
    return roundCurrency(cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  }, [cart]);

  const serviceCharge = Math.round(cartSubtotal * settings.serviceChargeRate * 100) / 100;
  const salesTax = Math.round(cartSubtotal * settings.taxRate * 100) / 100;
  const cartTotal = Math.round((cartSubtotal + serviceCharge + salesTax) * 100) / 100;
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleConfirmOrder = async () => {
    if (cart.length === 0 || isSubmitting || submittingRef.current) return;
    if (!canPlaceOrder) {
      setSubmitError(
        hasUnverifiedTableAttempt
          ? 'Please scan the QR code on your table, or switch to Counter Pickup.'
          : 'Online ordering is temporarily paused. Please place your order at the counter.'
      );
      return;
    }
    if (unavailableCartItemIds.size > 0) {
      setSubmitError(
        'One or more items in your cart are now sold out. Please remove sold-out items before placing your order.'
      );
      return;
    }

    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      setSubmitError(null);

      const scopeKey = isTableTokenValidated && verifiedTable ? verifiedTable.id : 'PICKUP';
      const idempotencyKey = `idemp_${scopeKey}_${cartAttemptSeed}`;
      const orderItemsPayload = cart.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        selectedCustomizations: item.customizations.map(c => ({
          groupId: c.groupId,
          optionId: c.optionId
        })),
        specialInstructions: item.specialInstructions
      }));

      const res = await onSubmitOrder(
        orderItemsPayload,
        customerNote,
        idempotencyKey,
        isTableTokenValidated ? currentTableToken : undefined
      );
      setSubmittedOrder(res.order);
      setCopiedConfirmation(false);
      setCart([]);
      setIsCartOpen(false);
      setCustomerNote('');
      setCartAttemptSeed(`${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Unable to submit your order right now. Please try again.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCopySubmittedNumber = async () => {
    if (!submittedOrder) return;
    try {
      await navigator.clipboard.writeText(submittedOrder.orderNumber);
      setCopiedConfirmation(true);
      setTimeout(() => setCopiedConfirmation(false), 2200);
    } catch {
      // Ignore if clipboard unavailable
    }
  };

  const getSubmittedDestinationLabel = (order: OrderRound) => {
    if (
      order.tableId === 'TAKEAWAY' ||
      !order.tableNumber ||
      order.tableNumber.toLowerCase().includes('anonymous')
    ) {
      return 'Counter Pickup';
    }
    return order.tableNumber;
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-36 sm:pb-32">
      {/* Clean, Minimal Food-First Hero Banner */}
      {customerViewTab === 'menu' && (
        <section className="bg-white border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-9 lg:gap-12 items-center">
              <div className="lg:col-span-6 space-y-5">
                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-stone-900 font-display leading-[1.12] text-balance">
                  Fresh Himalayan Dishes &amp; Handcrafted Coffee
                </h1>

                <p className="text-sm sm:text-base text-stone-600 max-w-lg leading-relaxed">
                  Made fresh to order—customize your meal and place your order in seconds.
                </p>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleScrollToMenu}
                    className="min-h-[48px] px-7 py-3.5 bg-teal-700 hover:bg-teal-800 text-white text-sm sm:text-base font-bold rounded-xl transition-colors inline-flex items-center gap-2 shadow-xs whitespace-nowrap cursor-pointer"
                  >
                    <span>Order Now</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="relative rounded-2xl overflow-hidden border border-stone-200/80 aspect-[16/10] bg-stone-100 shadow-xs">
                  {!failedImages['hero'] ? (
                    <img
                      src="/src/assets/images/hero_signature_food_1793252236494.jpg"
                      alt="Freshly steamed dumplings with chili sauce, handcrafted latte, and pastries"
                      className="w-full h-full object-cover"
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setFailedImages(prev => ({ ...prev, hero: true }))}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-stone-100 text-stone-500 p-6 text-center">
                      <Utensils className="w-8 h-8 text-teal-700 mb-2" />
                      <span className="text-xs font-semibold text-stone-700">
                        {settings.restaurantName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Menu & Orders Navigation Bar */}
      <div
        id="menu-section"
        ref={menuSectionRef}
        className="scroll-mt-16 bg-white border-b border-stone-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <nav aria-label="Menu and Orders" className="flex items-center gap-1 sm:gap-3">
            <button
              type="button"
              onClick={() => setCustomerViewTab('menu')}
              className={`flex items-center justify-center gap-2 py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer min-h-[48px] whitespace-nowrap shrink-0 ${
                customerViewTab === 'menu'
                  ? 'border-teal-700 text-teal-900 font-bold'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <Utensils className="w-4 h-4 shrink-0" />
              <span>Menu</span>
            </button>

            <button
              type="button"
              onClick={() => setCustomerViewTab('orders')}
              className={`flex items-center justify-center gap-2 py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer min-h-[48px] whitespace-nowrap shrink-0 ${
                customerViewTab === 'orders'
                  ? 'border-teal-700 text-teal-900 font-bold'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>My Orders</span>
              {trackedOrders.length > 0 && (
                <span className="font-mono tabular-nums text-xs font-bold text-teal-800">
                  ({activeCookingCount > 0 ? activeCookingCount : trackedOrders.length})
                </span>
              )}
            </button>
          </nav>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100/80 border border-teal-200 text-teal-900 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-teal-800 shrink-0" />
              <span>Cart ({totalCartCount})</span>
            </button>
          )}
        </div>
      </div>

      {customerViewTab === 'orders' ? (
        <PreviousOrdersView
          currentTable={isTableTokenValidated ? verifiedTable : null}
          orders={trackedOrders}
          settings={settings}
          onOrderMore={() => setCustomerViewTab('menu')}
          onRefresh={onRefreshOrders}
          onClearLocalOrders={onClearLocalOrders}
          hasLocalAnonymousTokens={hasLocalAnonymousTokens}
        />
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* Table QR Prompt (only shown if customer visited an incomplete table link) */}
          {hasUnverifiedTableAttempt && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-950 px-4 py-3 rounded-xl text-xs sm:text-sm"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  To order to <strong>{attemptedTableId}</strong>, scan the QR code on your table—or switch to Counter Pickup.
                </span>
              </div>
              {onClearUnverifiedTable && (
                <button
                  type="button"
                  onClick={onClearUnverifiedTable}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  Switch to Counter Pickup
                </button>
              )}
            </div>
          )}

          {/* Active Order Status Banner (only when customer has an order in progress) */}
          {activeOrders.length > 0 && (
            <section
              aria-label="Order Status"
              className="bg-white border border-teal-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
                <div className="flex flex-wrap items-center gap-2 text-stone-800">
                  <span className="font-semibold text-teal-800">Order in Progress</span>
                  <span className="text-stone-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono font-bold text-stone-900 tabular-nums">
                    {activeOrders[0].orderNumber}
                  </span>
                  {activeOrders.length > 1 && (
                    <span className="text-stone-500 text-xs tabular-nums">
                      (+{activeOrders.length - 1} more)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCustomerViewTab('orders')}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100/80 text-teal-900 font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer self-start sm:self-auto text-xs whitespace-nowrap"
                >
                  <span>View Details</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>

              <OrderStatusTracker
                status={activeOrders[0].status}
                orderNumber={activeOrders[0].orderNumber}
                variant="compact"
              />
            </section>
          )}

          {/* Search, Dietary Filter & Category Strip */}
          <section
            aria-label="Filter and search menu"
            className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <label htmlFor="menu-search" className="sr-only">
                  Search dishes or drinks
                </label>
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="menu-search"
                  type="text"
                  placeholder="Search dishes or drinks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full min-h-[44px] pl-10 pr-16 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-teal-700 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[36px] px-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Dietary Segmented Control */}
              <div
                role="group"
                aria-label="Dietary preference"
                className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl shrink-0 self-start md:self-auto"
              >
                <button
                  type="button"
                  onClick={() => setDietFilter('all')}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dietFilter === 'all'
                      ? 'bg-white text-stone-900 shadow-xs font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setDietFilter('veg')}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    dietFilter === 'veg'
                      ? 'bg-white text-emerald-800 shadow-xs font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Leaf className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Pure Veg</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDietFilter('non-veg')}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dietFilter === 'non-veg'
                      ? 'bg-white text-stone-900 shadow-xs font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Non-Veg
                </button>
              </div>
            </div>

            {/* Category Filter Strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none pt-1 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-teal-700 text-white'
                    : 'bg-stone-50 border border-stone-200 text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                All ({menuItems.length})
              </button>
              {categories.map(cat => {
                const count = menuItems.filter(m => m.categoryId === cat.id).length;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-700 text-white'
                        : 'bg-stone-50 border border-stone-200 text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    {cat.name} <span className="tabular-nums opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Menu Items Grid */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 sm:py-16 bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 max-w-md mx-auto space-y-3">
              <AlertCircle className="w-9 h-9 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-900 font-display">
                  No matching items found
                </h3>
                <p className="text-xs sm:text-sm text-stone-600">
                  Try clearing your search or choosing another category.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setDietFilter('all');
                  setSearchQuery('');
                }}
                className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-800 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors cursor-pointer"
              >
                Show All Items
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map(item => {
                const isUnavailable = item.soldOut || !item.isAvailable;
                const imgFailed = failedImages[item.id];
                const catName = categories.find(c => c.id === item.categoryId)?.name;

                return (
                  <article
                    key={item.id}
                    className={`bg-white rounded-2xl border border-stone-200 overflow-hidden transition-all duration-150 hover:border-stone-300 hover:shadow-sm flex flex-col justify-between ${
                      isUnavailable ? 'opacity-75 bg-stone-50/60' : ''
                    }`}
                  >
                    <div>
                      {/* Dish Photography (Consistent 4:3 Ratio) */}
                      <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
                        {!imgFailed ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
                            className={`w-full h-full object-cover ${isUnavailable ? 'grayscale' : ''}`}
                            referrerPolicy="no-referrer"
                            onError={() => setFailedImages(prev => ({ ...prev, [item.id]: true }))}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-100 text-stone-500 p-4 text-center">
                            <Utensils className="w-7 h-7 text-stone-400 mb-1.5" />
                            <span className="text-xs font-medium text-stone-600">{item.name}</span>
                          </div>
                        )}

                        {isUnavailable && (
                          <div className="absolute inset-0 bg-stone-900/55 flex items-center justify-center">
                            <span className="bg-white text-stone-900 font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs">
                              Sold Out
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Dish Details */}
                      <div className="p-4 sm:p-5 space-y-2">
                        {catName && (
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 block">
                            {catName}
                          </span>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-bold text-stone-900 text-base leading-snug">
                            {item.name}
                          </h3>
                          {settings.showPricesOnCustomerMenu && (
                            <div className="font-bold text-stone-900 text-sm sm:text-base font-mono tabular-nums whitespace-nowrap text-right shrink-0">
                              Nu. {item.price}
                            </div>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>

                        <div className="pt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-stone-500">
                          <span
                            className={
                              item.dietType === 'veg' || item.dietType === 'vegan'
                                ? 'text-emerald-800 font-semibold'
                                : 'text-stone-600 font-medium'
                            }
                          >
                            {item.dietType === 'veg'
                              ? 'Pure Veg'
                              : item.dietType === 'vegan'
                              ? 'Vegan'
                              : item.dietType === 'egg'
                              ? 'Contains Egg'
                              : 'Non-Veg'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">~{item.preparationTimeMinutes} mins</span>
                          {item.allergens.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Contains {item.allergens.join(', ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Primary Card CTA */}
                    <div className="p-4 sm:p-5 pt-0">
                      <button
                        type="button"
                        onClick={() => openCustomizer(item)}
                        disabled={isUnavailable}
                        className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                          isUnavailable
                            ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                            : 'bg-teal-700 text-white hover:bg-teal-800'
                        }`}
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span>
                          {isUnavailable
                            ? 'Sold Out'
                            : item.customizationGroups.length > 0
                            ? 'Customize & Add'
                            : 'Add to Order'}
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* Simple Café Footer */}
      <footer className="mt-16 border-t border-stone-200 py-8 bg-white text-stone-500 text-xs text-center px-4">
        <div className="max-w-xl mx-auto space-y-1">
          <p className="font-bold text-stone-900 text-sm font-display">{settings.restaurantName}</p>
          <p className="text-xs text-stone-500">
            {settings.address} · Open 24/7
          </p>
        </div>
      </footer>

      {/* Bottom Sticky Cart Summary Bar */}
      {cart.length > 0 && (
        <aside
          aria-label="Order summary"
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-lg p-3 sm:p-4 pb-safe"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center relative font-bold text-sm shrink-0">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-teal-700 text-white text-[11px] w-5 h-5 rounded-full flex items-center justify-center font-mono tabular-nums">
                  {totalCartCount}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-stone-500 truncate">{activeDestinationLabel}</div>
                {settings.showPricesOnCustomerMenu ? (
                  <div className="text-sm sm:text-base font-extrabold text-stone-900 font-mono tabular-nums">
                    Nu. {cartTotal}{' '}
                    <span className="hidden sm:inline text-xs font-sans font-normal text-stone-500">
                      incl. tax &amp; service
                    </span>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-stone-900 truncate tabular-nums">
                    {totalCartCount} {totalCartCount > 1 ? 'items' : 'item'}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="min-h-[46px] px-4 sm:px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0"
            >
              <span>View Cart</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </aside>
      )}

      {/* Customize Item Modal */}
      {itemToCustomize && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="customize-item-title"
            className="bg-white w-full rounded-t-3xl sm:rounded-2xl max-w-lg max-h-[88vh] sm:max-h-[86vh] flex flex-col shadow-xl border border-stone-200 overflow-hidden"
          >
            <div className="pt-2 pb-1 flex justify-center sm:hidden bg-stone-50">
              <span className="w-10 h-1 bg-stone-300 rounded-full" />
            </div>

            <div className="relative aspect-[16/9] max-h-48 sm:max-h-56 bg-stone-100 shrink-0">
              {!failedImages[itemToCustomize.id] ? (
                <img
                  src={itemToCustomize.imageUrl}
                  alt={itemToCustomize.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImages(prev => ({ ...prev, [itemToCustomize.id]: true }))}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                  <Utensils className="w-8 h-8" />
                </div>
              )}
              <button
                type="button"
                onClick={() => setItemToCustomize(null)}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-stone-800 border border-stone-200 shadow-xs flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close customization dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2
                    id="customize-item-title"
                    className="text-lg sm:text-xl font-bold text-stone-900 font-display"
                  >
                    {itemToCustomize.name}
                  </h2>
                  {settings.showPricesOnCustomerMenu && (
                    <div className="text-base font-bold text-stone-900 font-mono tabular-nums whitespace-nowrap shrink-0">
                      Nu. {itemToCustomize.price}
                    </div>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                  {itemToCustomize.description}
                </p>
              </div>

              {itemToCustomize.customizationGroups.map(grp => (
                <div key={grp.id} className="space-y-2.5 border-t border-stone-100 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-stone-900">
                      {grp.name}
                    </span>
                    <span className="text-xs text-stone-500">
                      {grp.type === 'single'
                        ? grp.required
                          ? 'Choose 1 · Required'
                          : 'Choose 1'
                        : grp.required
                        ? 'Select at least 1 · Required'
                        : 'Optional extras'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {grp.options.map(opt => {
                      const isSelected = (modalSelectedOptions[grp.id] || []).includes(opt.id);

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setModalError(null);
                            if (grp.type === 'single') {
                              setModalSelectedOptions(prev => ({ ...prev, [grp.id]: [opt.id] }));
                            } else {
                              setModalSelectedOptions(prev => {
                                const current = prev[grp.id] || [];
                                const next = isSelected
                                  ? current.filter(id => id !== opt.id)
                                  : [...current, opt.id];
                                return { ...prev, [grp.id]: next };
                              });
                            }
                          }}
                          className={`w-full text-left px-3.5 py-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between transition-colors min-h-[46px] cursor-pointer ${
                            isSelected
                              ? 'border-teal-700 bg-teal-50/70 text-teal-950 font-semibold'
                              : 'border-stone-200 hover:border-stone-300 text-stone-700 bg-white'
                          }`}
                        >
                          <span className="font-medium">{opt.name}</span>
                          {settings.showPricesOnCustomerMenu && (
                            <span className="text-stone-600 font-mono tabular-nums text-xs">
                              {opt.priceModifier > 0
                                ? `+Nu. ${opt.priceModifier}`
                                : opt.priceModifier < 0
                                ? `-Nu. ${Math.abs(opt.priceModifier)}`
                                : 'Included'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="border-t border-stone-100 pt-4 space-y-1.5">
                <label
                  htmlFor="item-special-instructions"
                  className="text-xs sm:text-sm font-bold text-stone-800 block"
                >
                  Special Instructions (Optional)
                </label>
                <input
                  id="item-special-instructions"
                  type="text"
                  maxLength={300}
                  placeholder="e.g. Chili on the side, less salt, extra hot..."
                  value={modalSpecialInstructions}
                  onChange={e => setModalSpecialInstructions(e.target.value)}
                  className="w-full text-sm min-h-[44px] px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:border-teal-700 transition-colors"
                />
              </div>

              {modalError && (
                <div
                  role="alert"
                  className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="border-t border-stone-100 pt-4 flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-800">Quantity</span>
                <div className="flex items-center gap-3 bg-stone-100 p-1 rounded-xl">
                  <button
                    type="button"
                    disabled={modalQuantity <= 1}
                    onClick={() => setModalQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg bg-white text-stone-700 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-sm sm:text-base w-8 text-center font-mono tabular-nums">
                    {modalQuantity}
                  </span>
                  <button
                    type="button"
                    disabled={modalQuantity >= 99}
                    onClick={() => setModalQuantity(q => Math.min(99, q + 1))}
                    className="w-10 h-10 rounded-lg bg-white text-stone-700 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3 pb-safe">
              <div>
                {settings.showPricesOnCustomerMenu ? (
                  <>
                    <div className="text-xs text-stone-500">Item Total</div>
                    <div className="text-base font-extrabold text-stone-900 font-mono tabular-nums">
                      Nu. {roundCurrency(modalUnitPrice * modalQuantity)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-stone-500">Quantity</div>
                    <div className="text-sm font-bold text-stone-900 tabular-nums">
                      {modalQuantity} {modalQuantity > 1 ? 'items' : 'item'}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className="min-h-[46px] px-5 sm:px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart & Checkout Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex justify-end">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            className="bg-white w-full max-w-md h-full flex flex-col justify-between shadow-xl border-l border-stone-200"
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between gap-3">
              <div>
                <h2 id="cart-drawer-title" className="text-lg font-bold text-stone-900 font-display">
                  Your Cart
                </h2>
                <p className="text-xs text-stone-500">{activeDestinationDetail}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="w-10 h-10 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-800 cursor-pointer shrink-0"
                aria-label="Close cart"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Itemized Cart List */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-5">
              <div className="divide-y divide-stone-200">
                {cart.map(item => {
                  const isNowUnavailable = unavailableCartItemIds.has(item.cartItemId);
                  return (
                    <div
                      key={item.cartItemId}
                      className="py-4 first:pt-0 last:pb-0 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4
                            className={`text-sm font-bold ${
                              isNowUnavailable ? 'line-through text-stone-400' : 'text-stone-900'
                            }`}
                          >
                            {item.name}
                          </h4>
                          {settings.showPricesOnCustomerMenu && (
                            <div className="text-xs text-stone-500 font-mono tabular-nums">
                              Nu. {item.unitPrice} each
                            </div>
                          )}
                        </div>
                        {settings.showPricesOnCustomerMenu && (
                          <div className="text-sm font-bold text-stone-900 font-mono tabular-nums shrink-0">
                            Nu. {roundCurrency(item.unitPrice * item.quantity)}
                          </div>
                        )}
                      </div>

                      {isNowUnavailable && (
                        <div className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg">
                          Currently sold out — please remove this item to place your order.
                        </div>
                      )}

                      {item.customizations.length > 0 && (
                        <div className="text-xs text-stone-600 space-y-0.5">
                          {item.customizations.map(c => (
                            <div key={`${c.groupId}:${c.optionId}`} className="flex justify-between gap-2">
                              <span>
                                {c.groupName}: {c.optionName}
                              </span>
                              {settings.showPricesOnCustomerMenu && c.priceModifier !== 0 && (
                                <span className="font-mono tabular-nums text-stone-500">
                                  {c.priceModifier > 0
                                    ? `+Nu. ${c.priceModifier}`
                                    : `-Nu. ${Math.abs(c.priceModifier)}`}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {item.specialInstructions && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 rounded-lg">
                          Note: {item.specialInstructions}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.cartItemId)}
                          className="min-h-[38px] px-2 text-xs text-rose-700 hover:text-rose-900 font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                        <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.cartItemId, -1)}
                            className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs sm:text-sm font-bold w-6 text-center font-mono tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= 99}
                            onClick={() => updateCartQuantity(item.cartItemId, 1)}
                            className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-stone-700 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Optional Order Note */}
              <div className="pt-3 border-t border-stone-200 space-y-1.5">
                <label
                  htmlFor="order-kitchen-note"
                  className="text-xs sm:text-sm font-bold text-stone-800 block"
                >
                  Order Note (Optional)
                </label>
                <input
                  id="order-kitchen-note"
                  type="text"
                  placeholder="e.g. Serve drinks first, extra napkins..."
                  value={customerNote}
                  onChange={e => setCustomerNote(e.target.value)}
                  className="w-full text-sm min-h-[44px] px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:border-teal-700 transition-colors"
                />
              </div>

              {/* Order Total Summary */}
              {settings.showPricesOnCustomerMenu ? (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-xs sm:text-sm text-stone-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums text-stone-900">Nu. {cartSubtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Charge (10%)</span>
                    <span className="font-mono tabular-nums text-stone-900">Nu. {serviceCharge}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sales Tax (5%)</span>
                    <span className="font-mono tabular-nums text-stone-900">Nu. {salesTax}</span>
                  </div>
                  <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-stone-900 text-sm sm:text-base">
                    <span>Total</span>
                    <span className="font-mono tabular-nums">Nu. {cartTotal}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex justify-between font-semibold text-stone-900 text-sm">
                  <span>Items Selected</span>
                  <span className="font-bold font-mono tabular-nums">
                    {totalCartCount} {totalCartCount > 1 ? 'items' : 'item'}
                  </span>
                </div>
              )}

              {hasUnverifiedTableAttempt && (
                <div
                  role="alert"
                  className="p-3.5 bg-amber-50 border border-amber-200 text-amber-950 text-xs rounded-xl space-y-2.5"
                >
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      To send this order to <strong>{attemptedTableId}</strong>, scan the QR code on your table—or switch to Counter Pickup.
                    </span>
                  </div>
                  {onClearUnverifiedTable && (
                    <button
                      type="button"
                      onClick={onClearUnverifiedTable}
                      className="w-full min-h-[42px] py-2 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Switch to Counter Pickup
                    </button>
                  )}
                </div>
              )}

              {submitError && (
                <div
                  role="alert"
                  className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            {/* Drawer Submit Footer */}
            <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 pb-safe">
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={isSubmitting || cart.length === 0 || !canPlaceOrder}
                className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white transition-colors flex items-center justify-center gap-2 min-h-[48px] ${
                  isSubmitting || !canPlaceOrder
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-teal-700 hover:bg-teal-800 cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <span>Placing Order...</span>
                ) : canPlaceOrder ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {isTableTokenValidated && verifiedTable
                        ? `Place Order · ${verifiedTable.tableNumber}`
                        : settings.showPricesOnCustomerMenu
                        ? `Place Order · Nu. ${cartTotal}`
                        : 'Place Order'}
                    </span>
                  </>
                ) : (
                  <span>Scan Table QR or Switch to Pickup</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Confirmation Modal */}
      {submittedOrder && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-confirmed-title"
            className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-stone-200 space-y-5 my-auto max-h-[92vh] overflow-y-auto"
          >
            <div className="text-center space-y-2.5">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p id="order-confirmed-title" className="text-base font-bold text-stone-900 font-display">
                Order Confirmed
              </p>

              {/* Order Number Box */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
                <span className="text-xs text-stone-500 block">Order Number</span>
                <div className="flex items-center justify-center gap-2.5">
                  <span className="text-xl sm:text-2xl font-extrabold text-stone-900 font-mono tabular-nums tracking-tight">
                    {submittedOrder.orderNumber}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySubmittedNumber}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedConfirmation ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-stone-600">
                  {submittedOrder.tableId === 'TAKEAWAY'
                    ? 'Show this order number at the counter when picking up.'
                    : `${getSubmittedDestinationLabel(submittedOrder)} · Round #${submittedOrder.roundNumber}`}
                </p>
              </div>
            </div>

            <OrderStatusTracker
              status={submittedOrder.status}
              orderNumber={submittedOrder.orderNumber}
              variant="full"
            />

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-stone-700">Ordered Items</h4>
              <div className="max-h-40 overflow-y-auto divide-y divide-stone-100 text-xs sm:text-sm">
                {submittedOrder.items.map(it => (
                  <div key={it.id} className="py-2 flex justify-between items-center gap-2">
                    <div>
                      <span className="font-bold text-stone-900 font-mono tabular-nums">
                        {it.quantity}×
                      </span>{' '}
                      <span className="font-semibold text-stone-900">{it.name}</span>
                      {it.customizations.length > 0 && (
                        <span className="text-xs text-stone-500 block">
                          {it.customizations.map(c => c.optionName).join(' · ')}
                        </span>
                      )}
                    </div>
                    {settings.showPricesOnCustomerMenu ? (
                      <span className="font-mono tabular-nums text-stone-800 font-semibold whitespace-nowrap">
                        Nu. {it.unitPrice * it.quantity}
                      </span>
                    ) : (
                      <span className="text-teal-800 font-semibold text-xs whitespace-nowrap">
                        Queued
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-1 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setSubmittedOrder(null);
                  setCustomerViewTab('orders');
                }}
                className="w-full min-h-[46px] py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <History className="w-4 h-4 shrink-0" />
                <span>Track Order Status</span>
              </button>
              <button
                type="button"
                onClick={() => setSubmittedOrder(null)}
                className="w-full min-h-[44px] py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
