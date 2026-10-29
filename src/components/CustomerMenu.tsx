import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Clock,
  AlertCircle,
  X,
  CheckCircle2,
  ChevronRight,
  Leaf,
  Info,
  ArrowRight,
  FileText,
  Utensils,
  History,
  ShieldCheck,
  Copy,
  Check,
  Lock
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
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Customize Item Modal
  const [itemToCustomize, setItemToCustomize] = useState<MenuItem | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalSelectedOptions, setModalSelectedOptions] = useState<Record<string, string[]>>({});
  const [modalSpecialInstructions, setModalSpecialInstructions] = useState('');

  // Submission & Confirmation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [cartAttemptSeed, setCartAttemptSeed] = useState(
    () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const [submittedOrder, setSubmittedOrder] = useState<OrderRound | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copiedConfirmation, setCopiedConfirmation] = useState(false);

  // Mint a fresh idempotency seed ONLY when cart items/quantities or kitchen note actually change
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

  const hasUnverifiedTableAttempt = Boolean(attemptedTableId && !isTableTokenValidated);
  const canPlaceAnonymousOrder = Boolean(settings.allowGuestOrdering && !hasUnverifiedTableAttempt);

  const activeDestinationLabel =
    isTableTokenValidated && verifiedTable
      ? verifiedTable.tableNumber
      : hasUnverifiedTableAttempt
      ? `Unverified ${attemptedTableId}`
      : 'Counter Pickup';

  const activeDestinationSubtitle =
    isTableTokenValidated && verifiedTable
      ? `${verifiedTable.section} · Verified Table QR`
      : hasUnverifiedTableAttempt
      ? 'Scan official table QR or switch to Counter Pickup'
      : 'Anonymous Order · No name or login required';

  // Scoped orders belonging ONLY to this verified table session or this device's private tracking tokens
  const trackedGuestOrders = useMemo(() => {
    if (sessionOrders && sessionOrders.length > 0) return sessionOrders;
    return activeOrders;
  }, [sessionOrders, activeOrders]);

  const activeCookingCount = useMemo(() => {
    return trackedGuestOrders.filter(o => o.status !== 'served' && o.status !== 'cancelled').length;
  }, [trackedGuestOrders]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
        return false;
      }
      if (dietFilter !== 'all' && item.dietType !== dietFilter) {
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

  const openCustomizer = (item: MenuItem) => {
    if (item.soldOut || !item.isAvailable) return;
    setItemToCustomize(item);
    setModalQuantity(1);
    setModalSpecialInstructions('');

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
    return Math.max(0, price);
  }, [itemToCustomize, modalSelectedOptions]);

  const handleAddToCart = () => {
    if (!itemToCustomize) return;

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

    const newCartItem: CartItem = {
      cartItemId: `ci_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      menuItemId: itemToCustomize.id,
      name: itemToCustomize.name,
      basePrice: itemToCustomize.price,
      unitPrice: modalUnitPrice,
      quantity: modalQuantity,
      dietType: itemToCustomize.dietType,
      customizations: selections,
      specialInstructions: modalSpecialInstructions.trim() || undefined,
      imageUrl: itemToCustomize.imageUrl
    };

    setCart(prev => [...prev, newCartItem]);
    setItemToCustomize(null);
    setSubmitError(null);
    setIsCartOpen(true);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
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
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const serviceCharge = Math.round(cartSubtotal * settings.serviceChargeRate * 100) / 100;
  const salesTax = Math.round(cartSubtotal * settings.taxRate * 100) / 100;
  const cartTotal = Math.round((cartSubtotal + serviceCharge + salesTax) * 100) / 100;
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleConfirmOrder = async () => {
    if (cart.length === 0 || isSubmitting || submittingRef.current) return;
    if (!canPlaceAnonymousOrder) {
      setSubmitError(
        hasUnverifiedTableAttempt
          ? 'This table link is missing a valid QR security token. Scan your table QR code or switch to Counter Pickup.'
          : 'Guest self-ordering is temporarily paused. Please place your order at the counter.'
      );
      return;
    }

    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      setSubmitError(null);

      const scopeKey = isTableTokenValidated && verifiedTable ? verifiedTable.id : 'ANON';
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
      // Ignore if clipboard blocked
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-36 sm:pb-32">
      {/* Welcoming Sunlit Storefront Header */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            <div className="lg:col-span-7 space-y-3.5">
              {/* Session & Privacy Context Line */}
              <div className="text-xs">
                {isTableTokenValidated && verifiedTable ? (
                  <div className="inline-flex flex-wrap items-center gap-2 text-teal-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                    <span className="font-bold text-stone-900">{verifiedTable.tableNumber}</span>
                    <span className="text-stone-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-stone-600">{verifiedTable.section}</span>
                    <span className="text-stone-300" aria-hidden="true">
                      ·
                    </span>
                    <span>Private Table Ordering</span>
                  </div>
                ) : hasUnverifiedTableAttempt ? (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center gap-2.5 bg-amber-50 border border-amber-200 text-amber-950 px-3.5 py-2.5 rounded-xl"
                  >
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Unverified link for <strong>{attemptedTableId}</strong>. Scan the QR stand on your table, or order for counter pickup instead.
                    </span>
                    {onClearUnverifiedTable && (
                      <button
                        type="button"
                        onClick={onClearUnverifiedTable}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Switch to Counter Pickup
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="inline-flex flex-wrap items-center gap-2 text-stone-600">
                    <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                    <span className="font-semibold text-stone-900">Anonymous Guest Ordering</span>
                    <span className="text-stone-300" aria-hidden="true">
                      ·
                    </span>
                    <span>No account, name, or phone number required</span>
                  </div>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-stone-900 font-display">
                {settings.restaurantName}
              </h1>

              <p className="text-sm sm:text-base text-stone-600 max-w-2xl leading-relaxed">
                {settings.tagline}. Browse freshly prepared Bhutanese favorites, comfort plates, and handcrafted coffee—place your order privately and follow kitchen progress right on your phone.
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-stone-500 pt-1">
                <span className="inline-flex items-center gap-1.5 text-stone-700 font-medium">
                  <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span>Open 24/7</span>
                </span>
                <span className="text-stone-300" aria-hidden="true">
                  ·
                </span>
                <span>Paro Town, Bhutan</span>
                {settings.showPricesOnCustomerMenu && (
                  <>
                    <span className="text-stone-300" aria-hidden="true">
                      ·
                    </span>
                    <span>Prices in Nu. (5% Tax &amp; 10% Service)</span>
                  </>
                )}
                <span className="text-stone-300" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => setIsPrivacyModalOpen(true)}
                  className="inline-flex items-center gap-1 text-teal-800 hover:text-teal-900 underline underline-offset-4 font-semibold cursor-pointer"
                >
                  <Lock className="w-3 h-3 shrink-0" />
                  <span>Privacy &amp; Data Notice</span>
                </button>
                <span className="text-stone-300" aria-hidden="true">
                  ·
                </span>
                <a
                  href="/assets/aistudio/paro_menu_final__Recovered__13981981.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-stone-700 hover:text-teal-800 underline underline-offset-4 font-semibold"
                >
                  <FileText className="w-3 h-3 shrink-0" />
                  <span>Printed PDF Menu</span>
                </a>
              </div>
            </div>

            {/* Warm Dining Room Photograph with Resilient Fallback */}
            <div className="lg:col-span-5 hidden sm:block">
              <div className="relative rounded-2xl overflow-hidden border border-stone-200 aspect-[16/9] lg:aspect-[16/10] bg-stone-100">
                {!failedImages['hero'] ? (
                  <img
                    src="/src/assets/images/hero_cafe_ambiance_1792466932618.jpg"
                    alt="High Quality Cafe warm dining room in Paro"
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
                      High Quality Cafe · Paro, Bhutan
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Guest Mode Navigation (Menu vs My Orders) */}
      <nav aria-label="Guest Navigation" className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setCustomerViewTab('menu')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-3.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer min-h-[48px] whitespace-nowrap shrink-0 ${
                customerViewTab === 'menu'
                  ? 'border-teal-700 text-teal-900 font-bold'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <Utensils className="w-4 h-4 shrink-0" />
              <span>Browse Menu</span>
            </button>

            <button
              type="button"
              onClick={() => setCustomerViewTab('orders')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-3.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer min-h-[48px] whitespace-nowrap shrink-0 ${
                customerViewTab === 'orders'
                  ? 'border-teal-700 text-teal-900 font-bold'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>My Orders &amp; Status</span>
              {trackedGuestOrders.length > 0 && (
                <span className="font-mono tabular-nums text-xs font-bold text-teal-800">
                  ({activeCookingCount > 0 ? `${activeCookingCount} active` : trackedGuestOrders.length})
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {customerViewTab === 'orders' ? (
        <PreviousOrdersView
          currentTable={isTableTokenValidated ? verifiedTable : null}
          orders={trackedGuestOrders}
          settings={settings}
          onOrderMore={() => setCustomerViewTab('menu')}
          onRefresh={onRefreshOrders}
          onClearLocalOrders={onClearLocalOrders}
          hasLocalAnonymousTokens={hasLocalAnonymousTokens}
        />
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* Active Order Reassurance Card (when guest has an order in progress) */}
          {activeOrders.length > 0 && (
            <section
              aria-label="Active Order Status"
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
                      (+{activeOrders.length - 1} more active)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCustomerViewTab('orders')}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100/80 text-teal-900 font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer self-start sm:self-auto text-xs whitespace-nowrap"
                >
                  <span>View Order Details ({trackedGuestOrders.length})</span>
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

          {/* Menu Discovery Controls (Search, Diet Filter & Category Strip) */}
          <section
            aria-label="Filter and search menu"
            className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <label htmlFor="guest-menu-search" className="sr-only">
                  Search dishes or drinks
                </label>
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="guest-menu-search"
                  type="text"
                  placeholder="Search dishes, ingredients, or drinks (e.g. Momos, Datshi, Burger, Latte)..."
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
                  All Dishes
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
                All Categories ({menuItems.length})
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
                  No matching dishes found
                </h3>
                <p className="text-xs sm:text-sm text-stone-600">
                  Try clearing your search term or selecting a different category or dietary preference.
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
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
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
                              Currently Sold Out
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Dish Details (Clean Unboxed Metadata) */}
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
                          {item.customizationGroups.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-teal-800 font-medium">Customizable</span>
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
                            ? 'Unavailable'
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

      {/* Isolated Customer Footer */}
      <footer className="mt-16 border-t border-stone-200 py-10 bg-white text-stone-500 text-xs text-center space-y-3 px-4">
        <div className="max-w-md mx-auto space-y-1">
          <p className="font-bold text-stone-900 text-sm font-display">{settings.restaurantName}</p>
          <p className="text-xs text-stone-600">{settings.tagline || 'Paro, Bhutan · Open 24/7'}</p>
          <p className="text-xs text-stone-500">{settings.address}</p>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
          {isTableTokenValidated && verifiedTable ? (
            <span className="text-stone-600">
              Private table session for <strong>{verifiedTable.tableNumber}</strong> ({verifiedTable.section})
            </span>
          ) : (
            <span className="text-stone-600">Private Counter Pickup &amp; Table QR Ordering</span>
          )}
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setIsPrivacyModalOpen(true)}
            className="text-stone-700 hover:text-teal-800 underline underline-offset-4 font-medium cursor-pointer"
          >
            Privacy &amp; Anonymity Policy
          </button>
          <span aria-hidden="true">·</span>
          <a
            href="/assets/aistudio/paro_menu_final__Recovered__13981981.pdf"
            target="_blank"
            rel="noreferrer"
            className="text-stone-700 hover:text-teal-800 underline underline-offset-4 font-medium"
          >
            Printed PDF Menu
          </a>
        </div>
      </footer>

      {/* Bottom Sticky Cart Summary Bar */}
      {cart.length > 0 && (
        <aside
          aria-label="Current order summary"
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
                <div className="text-xs text-stone-500 truncate">
                  {activeDestinationLabel} · Private Order
                </div>
                {settings.showPricesOnCustomerMenu ? (
                  <div className="text-sm sm:text-base font-extrabold text-stone-900 font-mono tabular-nums">
                    Nu. {cartTotal}{' '}
                    <span className="hidden sm:inline text-xs font-sans font-normal text-stone-500">
                      incl. tax &amp; service
                    </span>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-stone-900 truncate tabular-nums">
                    {totalCartCount} {totalCartCount > 1 ? 'items selected' : 'item selected'}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="min-h-[46px] px-4 sm:px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0"
            >
              <span>Review &amp; Place Order</span>
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
                      {grp.type === 'single' ? 'Choose 1' : 'Optional extras'}
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
                  Preparation Note (Optional)
                </label>
                <input
                  id="item-special-instructions"
                  type="text"
                  placeholder="e.g. Chili on the side, less salt, extra hot..."
                  value={modalSpecialInstructions}
                  onChange={e => setModalSpecialInstructions(e.target.value)}
                  className="w-full text-sm min-h-[44px] px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:border-teal-700 transition-colors"
                />
              </div>

              <div className="border-t border-stone-100 pt-4 flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-stone-800">Quantity</span>
                <div className="flex items-center gap-3 bg-stone-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setModalQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg bg-white text-stone-700 hover:bg-stone-200 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-sm sm:text-base w-8 text-center font-mono tabular-nums">
                    {modalQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalQuantity(q => q + 1)}
                    className="w-10 h-10 rounded-lg bg-white text-stone-700 hover:bg-stone-200 flex items-center justify-center transition-colors cursor-pointer"
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
                      Nu. {modalUnitPrice * modalQuantity}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-stone-500">Selected</div>
                    <div className="text-sm font-bold text-stone-900 tabular-nums">
                      {modalQuantity} {modalQuantity > 1 ? 'portions' : 'portion'}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className="min-h-[46px] px-5 sm:px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                Add {modalQuantity} to Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Review Drawer */}
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
                  Review Your Order
                </h2>
                <p className="text-xs text-stone-500">
                  {activeDestinationLabel} · {activeDestinationSubtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="w-10 h-10 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-800 cursor-pointer shrink-0"
                aria-label="Close order review drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Itemized Cart List (Single-Elevation Hairline Dividers) */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-5">
              <div className="divide-y divide-stone-200">
                {cart.map(item => (
                  <div
                    key={item.cartItemId}
                    className="py-4 first:pt-0 last:pb-0 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-bold text-stone-900">{item.name}</h4>
                        {settings.showPricesOnCustomerMenu && (
                          <div className="text-xs text-stone-500 font-mono tabular-nums">
                            Nu. {item.unitPrice} each
                          </div>
                        )}
                      </div>
                      {settings.showPricesOnCustomerMenu && (
                        <div className="text-sm font-bold text-stone-900 font-mono tabular-nums shrink-0">
                          Nu. {item.unitPrice * item.quantity}
                        </div>
                      )}
                    </div>

                    {item.customizations.length > 0 && (
                      <div className="text-xs text-stone-600 space-y-0.5">
                        {item.customizations.map(c => (
                          <div key={c.optionId} className="flex justify-between gap-2">
                            <span>
                              {c.groupName}: {c.optionName}
                            </span>
                            {settings.showPricesOnCustomerMenu && c.priceModifier > 0 && (
                              <span className="font-mono tabular-nums text-stone-500">
                                +Nu. {c.priceModifier}
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
                          onClick={() => updateCartQuantity(item.cartItemId, 1)}
                          className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Optional Kitchen Note */}
              <div className="pt-3 border-t border-stone-200 space-y-1.5">
                <label
                  htmlFor="order-kitchen-note"
                  className="text-xs sm:text-sm font-bold text-stone-800 block"
                >
                  Kitchen Preparation Note (Optional)
                </label>
                <input
                  id="order-kitchen-note"
                  type="text"
                  placeholder="e.g. Serve drinks first, extra napkins (no name needed)..."
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
                    <span>Total Amount</span>
                    <span className="font-mono tabular-nums">Nu. {cartTotal}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2 text-xs text-stone-600">
                  <div className="flex justify-between font-semibold text-stone-900 text-sm">
                    <span>Items Selected</span>
                    <span className="font-bold font-mono tabular-nums">
                      {totalCartCount} {totalCartCount > 1 ? 'items' : 'item'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 pt-1.5 border-t border-stone-200 leading-relaxed">
                    Your order goes straight to the kitchen with a unique Confirmation ID. Payment is settled at the counter when you&apos;re ready.
                  </p>
                </div>
              )}

              {/* Anonymity Assurance */}
              <div className="p-3.5 bg-teal-50/70 border border-teal-200/80 text-teal-950 text-xs rounded-xl flex items-start gap-2.5 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Private &amp; Anonymous:</strong> No name, phone number, or account is requested. Only your selected dishes and a random Confirmation ID are recorded.
                </span>
              </div>

              {hasUnverifiedTableAttempt && (
                <div
                  role="alert"
                  className="p-3.5 bg-amber-50 border border-amber-200 text-amber-950 text-xs rounded-xl space-y-2.5"
                >
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      Table <strong>{attemptedTableId}</strong> requires scanning the QR stand on that table, or you can switch to Counter Pickup.
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
            <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 space-y-2 pb-safe">
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={isSubmitting || cart.length === 0 || !canPlaceAnonymousOrder}
                className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white transition-colors flex items-center justify-center gap-2 min-h-[48px] ${
                  isSubmitting || !canPlaceAnonymousOrder
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-teal-700 hover:bg-teal-800 cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <span>Sending Order to Kitchen...</span>
                ) : canPlaceAnonymousOrder ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {isTableTokenValidated && verifiedTable
                        ? `Place Order for ${verifiedTable.tableNumber}`
                        : 'Place Counter Pickup Order'}
                    </span>
                  </>
                ) : (
                  <span>Verify Table QR or Switch to Pickup</span>
                )}
              </button>
              <p className="text-xs text-center text-stone-500">
                You will receive a unique Order Confirmation ID immediately.
              </p>
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
              <p id="order-confirmed-title" className="text-sm font-bold text-emerald-800">
                Order Sent to Kitchen
              </p>

              {/* Unique Order Confirmation Box */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
                <span className="text-xs text-stone-500 block">
                  Your Order Confirmation Number
                </span>
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
                    ? 'Show this Confirmation ID at the counter when your order is ready.'
                    : `Linked to ${submittedOrder.tableNumber || activeDestinationLabel} · Round #${submittedOrder.roundNumber}`}
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
                <span>Track Live Order Status</span>
              </button>
              <button
                type="button"
                onClick={() => setSubmittedOrder(null)}
                className="w-full min-h-[44px] py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Continue Browsing Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy & Data Transparency Modal */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-modal-title"
            className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-stone-200 space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="privacy-modal-title"
                    className="text-base sm:text-lg font-bold text-stone-900 font-display"
                  >
                    Anonymous Ordering &amp; Privacy
                  </h2>
                  <p className="text-xs text-stone-500">
                    How your anonymity and order records are protected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="w-10 h-10 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer shrink-0"
                aria-label="Close privacy dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm text-stone-600 leading-relaxed">
              <div className="space-y-1">
                <h3 className="font-bold text-stone-900">1. Zero Personal Identity Required</h3>
                <p>
                  Browse the menu and place orders without entering your real name, email address, phone number, or creating an account. Every order is identified strictly by a random Confirmation ID (such as <span className="font-mono text-stone-800">#HQC-ANON-4821</span>).
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-stone-900">2. Minimal Information Collected</h3>
                <p>
                  We record only what the kitchen needs to prepare your meal: selected dishes, quantities, dietary customizations, optional preparation notes, table number (if scanned via QR) or pickup mode, and order time.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-stone-900">3. Private Device Tracking</h3>
                <p>
                  A private tracking token is stored locally in your browser so only your phone can follow live preparation updates. Other guests cannot view or modify your orders, and you can clear your local history anytime under <strong>My Orders &amp; Status</strong>.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-stone-900">4. Confidential Order Archives</h3>
                <p>
                  Completed order records are stored confidentially for café operations and accounting, restricted on the server exclusively to authorized <strong>General Manager</strong> and <strong>Admin</strong> staff.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="min-h-[44px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
