import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Clock,
  Sparkles,
  AlertCircle,
  X,
  CheckCircle2,
  ChevronRight,
  Flame,
  Leaf,
  Info,
  Layers,
  ArrowRight,
  FileText,
  Utensils,
  History
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
  ) => Promise<{ order: OrderRound; bill: Bill }>;
  activeOrders: OrderRound[];
  sessionOrders?: OrderRound[];
  currentTableToken?: string;
  isTableTokenValidated: boolean;
  onRefreshOrders?: () => void;
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
  onRefreshOrders
}) => {
  const [customerViewTab, setCustomerViewTab] = useState<'menu' | 'orders'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerNote, setCustomerNote] = useState('');

  // Customize Item Modal
  const [itemToCustomize, setItemToCustomize] = useState<MenuItem | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalSelectedOptions, setModalSelectedOptions] = useState<Record<string, string[]>>({});
  const [modalSpecialInstructions, setModalSpecialInstructions] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<OrderRound | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canPlaceTableOrder = Boolean(
    isTableTokenValidated && verifiedTable && currentTableToken && settings.allowGuestOrdering
  );

  const activeTableLabel = verifiedTable ? verifiedTable.tableNumber : 'Guest Menu';
  const activeTableSection = verifiedTable ? verifiedTable.section : 'Scan Table QR to Order';

  // Orders for current verified dining session ONLY
  const tableSessionOrders = useMemo(() => {
    if (!isTableTokenValidated || !verifiedTable) return [];
    if (sessionOrders && sessionOrders.length > 0) return sessionOrders;
    return activeOrders;
  }, [isTableTokenValidated, verifiedTable, sessionOrders, activeOrders]);

  const activeCookingCount = useMemo(() => {
    return tableSessionOrders.filter(o => o.status !== 'served' && o.status !== 'cancelled').length;
  }, [tableSessionOrders]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      // Category filter
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
        return false;
      }
      // Diet filter
      if (dietFilter !== 'all' && item.dietType !== dietFilter) {
        return false;
      }
      // Search query
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

  // Open customization modal
  const openCustomizer = (item: MenuItem) => {
    if (item.soldOut || !item.isAvailable) return;
    setItemToCustomize(item);
    setModalQuantity(1);
    setModalSpecialInstructions('');

    // Pre-populate default options
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

  // Calculate unit price inside modal
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

  // Add customized item to cart
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
    setIsCartOpen(true);
  };

  // Adjust cart item quantity
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

  // Cart financial totals
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const serviceCharge = Math.round(cartSubtotal * settings.serviceChargeRate * 100) / 100;
  const salesTax = Math.round(cartSubtotal * settings.taxRate * 100) / 100;
  const cartTotal = Math.round((cartSubtotal + serviceCharge + salesTax) * 100) / 100;
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Submit Order with idempotency key and verified QR token
  const handleConfirmOrder = async () => {
    if (cart.length === 0 || isSubmitting) return;
    if (!canPlaceTableOrder || !verifiedTable || !currentTableToken) {
      setSubmitError('Please scan the official QR code on your café table to place an order.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const idempotencyKey = `idemp_${verifiedTable.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const orderItemsPayload = cart.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        selectedCustomizations: item.customizations.map(c => ({
          groupId: c.groupId,
          optionId: c.optionId
        })),
        specialInstructions: item.specialInstructions
      }));

      const res = await onSubmitOrder(orderItemsPayload, customerNote, idempotencyKey, currentTableToken);
      setSubmittedOrder(res.order);
      setCart([]);
      setIsCartOpen(false);
      setCustomerNote('');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-36 sm:pb-32">
      {/* Table & Cafe Hero Banner */}
      <section className="bg-stone-900 text-stone-100 border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 md:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
            <div className="lg:col-span-8 space-y-2.5 sm:space-y-3">
              {/* Verified Table Identity (No Table Switcher / No Spoofing) */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {isTableTokenValidated && verifiedTable ? (
                  <div className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-extrabold font-display text-xs sm:text-sm tracking-wide text-white">
                      {verifiedTable.tableNumber}
                    </span>
                    <span className="text-stone-300">· {verifiedTable.section}</span>
                  </div>
                ) : attemptedTableId ? (
                  <div className="inline-flex items-center gap-2 bg-rose-500/15 border border-rose-500/40 text-rose-200 px-3 py-1.5 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>
                      Unverified link for <strong>{attemptedTableId}</strong> — Scan your table&apos;s QR code to order
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 text-stone-300 text-xs">
                    <Utensils className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Browse Menu · Scan your table&apos;s QR code when seated to place an order</span>
                  </div>
                )}
              </div>

              <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white font-display">
                {settings.restaurantName}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-stone-400 max-w-2xl leading-relaxed">
                {settings.tagline}. Order directly from your table — your dishes are prepared fresh and billed seamlessly.
              </p>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-stone-400 pt-0.5">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Open 24/7</span>
                </div>
                <span>·</span>
                <div>Paro, Bhutan</div>
                {settings.showPricesOnCustomerMenu && (
                  <>
                    <span>·</span>
                    <div>Prices in Nu.</div>
                    <span>·</span>
                    <div>5% Tax & 10% Service</div>
                  </>
                )}
                <span>·</span>
                <a
                  href="/assets/aistudio/paro_menu_final__Recovered__13981981.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[11px] font-semibold transition-colors"
                >
                  <FileText className="w-3 h-3 shrink-0" />
                  <span>PDF Menu</span>
                </a>
              </div>
            </div>

            {/* Ambiance Photo Showcase */}
            <div className="lg:col-span-4 hidden sm:block">
              <div className="relative rounded-xl overflow-hidden border border-stone-800 shadow-lg aspect-[16/9] lg:aspect-[4/3] bg-stone-800">
                <img
                  src="/src/assets/images/hero_cafe_ambiance_1792466932618.jpg"
                  alt="High Quality Cafe Cozy Dining Room"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent flex items-end p-3">
                  <p className="text-xs text-stone-200 font-medium">Himalayan Artisan Ambiance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Customer Tab Bar (Shown when a verified table QR is active) */}
      {isTableTokenValidated && verifiedTable && (
        <nav aria-label="Customer Navigation" className="bg-stone-900 border-b border-stone-800 sticky top-14 sm:top-16 z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-2 sm:px-6">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCustomerViewTab('menu')}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer min-h-[44px] ${
                  customerViewTab === 'menu'
                    ? 'border-amber-400 text-amber-300 bg-stone-800/60'
                    : 'border-transparent text-stone-400 hover:text-stone-200 hover:bg-stone-800/30'
                }`}
              >
                <Utensils className="w-4 h-4 shrink-0" />
                <span>Browse Menu</span>
              </button>

              <button
                onClick={() => setCustomerViewTab('orders')}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer min-h-[44px] ${
                  customerViewTab === 'orders'
                    ? 'border-amber-400 text-amber-300 bg-stone-800/60'
                    : 'border-transparent text-stone-400 hover:text-stone-200 hover:bg-stone-800/30'
                }`}
              >
                <History className="w-4 h-4 shrink-0" />
                <span>My Table Orders</span>
                {tableSessionOrders.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeCookingCount > 0
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-800 text-stone-300 border border-stone-700'
                  }`}>
                    {tableSessionOrders.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Active Orders Visual Progress Tracker Bar on Menu Page */}
      {isTableTokenValidated && verifiedTable && activeOrders.length > 0 && customerViewTab === 'menu' && (
        <section className="bg-stone-900 border-b border-stone-800 py-3 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-200">
                <span className="font-semibold">
                  <strong>{verifiedTable.tableNumber}</strong> — Active Order ({activeOrders[0].orderNumber})
                </span>
                {activeOrders.length > 1 && (
                  <span className="text-stone-400 text-[11px]">
                    · +{activeOrders.length - 1} more rounds
                  </span>
                )}
              </div>
              <button
                onClick={() => setCustomerViewTab('orders')}
                className="font-bold text-amber-300 hover:text-amber-100 flex items-center gap-1 shrink-0 underline decoration-amber-500/50 cursor-pointer self-start sm:self-auto text-xs"
              >
                Track All Rounds ({tableSessionOrders.length}) <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <OrderStatusTracker
              status={activeOrders[0].status}
              orderNumber={activeOrders[0].orderNumber}
              variant="compact"
            />
          </div>
        </section>
      )}

      {isTableTokenValidated && verifiedTable && customerViewTab === 'orders' ? (
        <PreviousOrdersView
          currentTable={verifiedTable}
          orders={tableSessionOrders}
          settings={settings}
          onOrderMore={() => setCustomerViewTab('menu')}
          onRefresh={onRefreshOrders}
        />
      ) : (
        <>
          {/* Category Tabs, Search & Filters */}
          <section className={`sticky ${isTableTokenValidated && verifiedTable ? 'top-[102px] sm:top-[112px]' : 'top-14 sm:top-16'} z-20 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs`}>
            <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 space-y-2.5 sm:space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                {/* Category horizontal scroll with touch momentum */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none -mx-1 px-1">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer active:scale-[0.98] ${
                      selectedCategory === 'all'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 bg-stone-50'
                    }`}
                  >
                    All Dishes ({menuItems.length})
                  </button>
                  {categories.map(cat => {
                    const count = menuItems.filter(m => m.categoryId === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer active:scale-[0.98] ${
                          selectedCategory === cat.id
                            ? 'bg-stone-900 text-white shadow-xs'
                            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 bg-stone-50'
                        }`}
                      >
                        {cat.name} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Diet Switcher */}
                <div className="flex items-center gap-1 p-0.5 bg-stone-100 rounded-xl shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => setDietFilter('all')}
                    className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      dietFilter === 'all' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setDietFilter('veg')}
                    className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                      dietFilter === 'veg' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Leaf className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Pure Veg</span>
                  </button>
                  <button
                    onClick={() => setDietFilter('non-veg')}
                    className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      dietFilter === 'non-veg' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Non-Veg
                  </button>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search dishes (e.g. Momos, Datshi, Burger, Latte)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-9 text-xs sm:text-sm bg-stone-100/90 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-stone-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700 min-h-[32px] px-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </section>

      {/* Dishes Catalog Grid */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 py-4 sm:py-8">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 max-w-md mx-auto">
            <AlertCircle className="w-10 h-10 text-stone-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-stone-900">No dishes found</h3>
            <p className="text-xs text-stone-500 mt-1">
              Try adjusting your category filter, vegetarian toggle, or search query.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setDietFilter('all');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2.5 text-xs font-semibold text-stone-800 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors min-h-[40px] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
            {filteredItems.map(item => {
              const isUnavailable = item.soldOut || !item.isAvailable;

              return (
                <article
                  key={item.id}
                  className={`bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                    isUnavailable ? 'opacity-70 bg-stone-50/50' : ''
                  }`}
                >
                  <div>
                    {/* Dish Photography */}
                    <div className="relative aspect-[16/10] sm:aspect-[4/3] bg-stone-100 overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        className={`w-full h-full object-cover transition-transform duration-300 hover:scale-105 ${
                          isUnavailable ? 'grayscale' : ''
                        }`}
                        referrerPolicy="no-referrer"
                      />
                      {/* Dietary dot indicator */}
                      <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 shadow-xs">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.dietType === 'veg' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        <span className="capitalize text-stone-700">{item.dietType}</span>
                      </div>

                      {/* Sold out notice */}
                      {isUnavailable && (
                        <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-[2px] flex items-center justify-center">
                          <span className="bg-rose-600 text-white font-bold text-xs uppercase px-3 py-1 rounded-md tracking-wider shadow-md">
                            Currently Sold Out
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Dish Info */}
                    <div className="p-3.5 sm:p-5 space-y-1.5 sm:space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-stone-900 text-sm sm:text-base leading-snug">
                          {item.name}
                        </h3>
                        {settings.showPricesOnCustomerMenu && (
                          <div className="font-bold text-stone-900 text-sm sm:text-base tabular-nums whitespace-nowrap text-right">
                            Nu. {item.price}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>

                      {/* Allergen & Prep Metadata */}
                      <div className="pt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                          <span>~{item.preparationTimeMinutes} mins</span>
                        </div>
                        {item.allergens.length > 0 && (
                          <>
                            <span>·</span>
                            <span>Contains: {item.allergens.join(', ')}</span>
                          </>
                        )}
                        {item.customizationGroups.length > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-amber-700 font-medium">Customizable</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="p-3.5 sm:p-5 pt-0">
                    <button
                      onClick={() => openCustomizer(item)}
                      disabled={isUnavailable}
                      className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all min-h-[44px] cursor-pointer active:scale-[0.98] ${
                        isUnavailable
                          ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                          : 'bg-stone-900 text-white hover:bg-stone-800 shadow-xs'
                      }`}
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <span>{item.customizationGroups.length > 0 ? 'Customize & Add' : 'Add to Order'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
        </>
      )}

      {/* Isolated Customer Footer (Zero Staff or Admin Links) */}
      <footer className="mt-16 border-t border-stone-200 py-10 bg-white text-stone-500 text-xs text-center space-y-3 px-4">
        <div className="max-w-md mx-auto space-y-1">
          <p className="font-bold text-stone-800 text-sm font-display">{settings.restaurantName}</p>
          <p className="text-[11px] text-stone-500">{settings.tagline || 'Paro, Bhutan · Open 24/7'}</p>
          <p className="text-[11px] text-stone-400">{settings.address}</p>
        </div>

        <div className="pt-3 flex flex-wrap items-center justify-center gap-3 text-[11px]">
          {isTableTokenValidated && verifiedTable ? (
            <span className="text-stone-500">
              Ordering for <strong>{verifiedTable.tableNumber}</strong> ({verifiedTable.section})
            </span>
          ) : (
            <span className="text-stone-400">Scan your table&apos;s QR code to place an order</span>
          )}
          <span>·</span>
          <a
            href="/assets/aistudio/paro_menu_final__Recovered__13981981.pdf"
            target="_blank"
            rel="noreferrer"
            className="hover:text-amber-800 underline font-medium"
          >
            Official Printed PDF Menu
          </a>
        </div>
      </footer>
      {cart.length > 0 && (
        <aside className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-2xl p-3 sm:p-4 pb-safe bottom-safe">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center relative font-bold text-sm shrink-0">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-amber-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-mono shadow-xs">
                  {totalCartCount}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs text-stone-500 truncate">{activeTableLabel} Order Cart</div>
                {settings.showPricesOnCustomerMenu ? (
                  <div className="text-sm sm:text-base font-extrabold text-stone-900 tabular-nums">
                    Nu. {cartTotal}{' '}
                    <span className="hidden sm:inline text-xs font-normal text-stone-500">incl. tax & charges</span>
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                    {totalCartCount} {totalCartCount > 1 ? 'dishes selected' : 'dish selected'}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="px-4 sm:px-5 py-2.5 sm:py-3 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-h-[44px] cursor-pointer shrink-0"
            >
              <span>Review Order</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </aside>
      )}

      {/* Customize Item Modal / Mobile Bottom Sheet */}
      {itemToCustomize && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 overflow-y-auto">
          <div className="bg-white w-full rounded-t-3xl sm:rounded-2xl max-w-lg max-h-[88vh] sm:max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden animate-in slide-in-from-bottom duration-200 sm:animate-in sm:zoom-in-95">
            {/* Mobile swipe/drag indicator pill */}
            <div className="pt-2 pb-1 flex justify-center sm:hidden bg-stone-100">
              <span className="w-10 h-1 bg-stone-300 rounded-full" />
            </div>

            {/* Modal Image Header */}
            <div className="relative aspect-[16/9] max-h-44 sm:max-h-56 bg-stone-100 shrink-0">
              <img
                src={itemToCustomize.imageUrl}
                alt={itemToCustomize.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => setItemToCustomize(null)}
                className="absolute top-3 right-3 w-9 h-9 min-h-[36px] rounded-full bg-stone-900/70 hover:bg-stone-900 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Customization Content */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 font-display">
                    {itemToCustomize.name}
                  </h2>
                  {settings.showPricesOnCustomerMenu && (
                    <div className="text-sm sm:text-base font-bold text-stone-900 tabular-nums whitespace-nowrap">
                      Nu. {itemToCustomize.price}
                    </div>
                  )}
                </div>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  {itemToCustomize.description}
                </p>
              </div>

              {/* Customization Groups */}
              {itemToCustomize.customizationGroups.map(grp => (
                <div key={grp.id} className="space-y-2 border-t border-stone-100 pt-3 sm:pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] sm:text-xs font-bold text-stone-800 uppercase tracking-wider">
                      {grp.name}
                    </label>
                    <span className="text-[10px] sm:text-[11px] text-stone-500">
                      {grp.type === 'single' ? 'Choose 1' : 'Optional add-ons'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
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
                          className={`w-full text-left px-3.5 py-3 rounded-xl border text-xs flex items-center justify-between transition-all min-h-[44px] cursor-pointer active:scale-[0.99] ${
                            isSelected
                              ? 'border-amber-600 bg-amber-50/70 text-amber-900 font-semibold shadow-xs'
                              : 'border-stone-200 hover:border-stone-300 text-stone-700 bg-stone-50/50'
                          }`}
                        >
                          <span className="font-medium">{opt.name}</span>
                          {settings.showPricesOnCustomerMenu && (
                            <span className="text-stone-500 font-mono text-[11px]">
                              {opt.priceModifier > 0 ? `+Nu. ${opt.priceModifier}` : opt.priceModifier < 0 ? `-Nu. ${Math.abs(opt.priceModifier)}` : 'Included'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Special Instructions */}
              <div className="border-t border-stone-100 pt-3 sm:pt-4 space-y-1.5">
                <label className="text-[11px] sm:text-xs font-bold text-stone-800 uppercase tracking-wider block">
                  Special Kitchen Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ezay chili on the side, less salt, extra hot..."
                  value={modalSpecialInstructions}
                  onChange={(e) => setModalSpecialInstructions(e.target.value)}
                  className="w-full text-xs h-11 px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Quantity Stepper */}
              <div className="border-t border-stone-100 pt-3 sm:pt-4 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Quantity
                </span>
                <div className="flex items-center gap-3 bg-stone-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setModalQuantity(q => Math.max(1, q - 1))}
                    className="w-9 h-9 min-h-[36px] rounded-lg bg-white shadow-xs text-stone-700 hover:bg-stone-200 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-sm w-7 text-center tabular-nums">
                    {modalQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalQuantity(q => q + 1)}
                    className="w-9 h-9 min-h-[36px] rounded-lg bg-white shadow-xs text-stone-700 hover:bg-stone-200 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Bottom Sticky CTA */}
            <div className="p-3.5 sm:p-5 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-3 pb-safe">
              <div>
                {settings.showPricesOnCustomerMenu ? (
                  <>
                    <div className="text-[10px] sm:text-[11px] text-stone-500">Total Price</div>
                    <div className="text-sm sm:text-base font-extrabold text-stone-900 tabular-nums">
                      Nu. {modalUnitPrice * modalQuantity}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] sm:text-[11px] text-stone-500">Quantity</div>
                    <div className="text-xs sm:text-sm font-bold text-stone-800">
                      {modalQuantity} {modalQuantity > 1 ? 'portions' : 'portion'}
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className="px-5 sm:px-6 py-2.5 sm:py-3 bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all min-h-[44px] cursor-pointer"
              >
                Add {modalQuantity} to Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Review Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-stone-900 font-display">
                  Your Table Order
                </h2>
                <p className="text-xs text-stone-500">
                  {activeTableLabel} · {activeTableSection}
                </p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Itemized Cart List */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
              {cart.map(item => (
                <div
                  key={item.cartItemId}
                  className="bg-stone-50/60 border border-stone-200/80 rounded-xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{item.name}</h4>
                      {settings.showPricesOnCustomerMenu && (
                        <div className="text-[11px] text-stone-500 font-mono">
                          Nu. {item.unitPrice} each
                        </div>
                      )}
                    </div>
                    {settings.showPricesOnCustomerMenu && (
                      <div className="text-xs font-bold text-stone-900 tabular-nums">
                        Nu. {item.unitPrice * item.quantity}
                      </div>
                    )}
                  </div>

                  {/* Customizations tags */}
                  {item.customizations.length > 0 && (
                    <div className="text-[11px] text-stone-600 bg-white/80 p-2 rounded-lg border border-stone-150 space-y-0.5">
                      {item.customizations.map(c => (
                        <div key={c.optionId} className="flex justify-between">
                          <span>{c.groupName}: {c.optionName}</span>
                          {settings.showPricesOnCustomerMenu && c.priceModifier > 0 && (
                            <span className="font-mono text-stone-400">+Nu. {c.priceModifier}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Special instruction text */}
                  {item.specialInstructions && (
                    <div className="text-[11px] text-amber-800 italic bg-amber-50/60 px-2 py-1 rounded">
                      Note: "{item.specialInstructions}"
                    </div>
                  )}

                  {/* Stepper & Remove */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => removeCartItem(item.cartItemId)}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-medium py-1.5 px-1 cursor-pointer min-h-[36px]"
                    >
                      Remove
                    </button>
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-stone-200 shadow-xs">
                      <button
                        onClick={() => updateCartQuantity(item.cartItemId, -1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold w-6 text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(item.cartItemId, 1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Order note for kitchen */}
              <div className="pt-2">
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Overall Order Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Please bring drinks first, all at once..."
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  className="w-full text-xs h-11 px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Bill preview summary */}
              {settings.showPricesOnCustomerMenu ? (
                <div className="bg-stone-100 rounded-xl p-3.5 space-y-1.5 text-xs text-stone-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums text-stone-900">Nu. {cartSubtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Charge (10%)</span>
                    <span className="font-mono tabular-nums text-stone-900">Nu. {serviceCharge}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bhutan Sales Tax (5%)</span>
                    <span className="font-mono tabular-nums text-stone-900">Nu. {salesTax}</span>
                  </div>
                  <div className="border-t border-stone-200 pt-1.5 flex justify-between font-bold text-stone-900 text-sm">
                    <span>Total Order Amount</span>
                    <span className="tabular-nums">Nu. {cartTotal}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-stone-100 rounded-xl p-3.5 space-y-1.5 text-xs text-stone-600">
                  <div className="flex justify-between font-medium text-stone-800">
                    <span>Total Dishes in Order</span>
                    <span className="font-bold text-stone-900">{totalCartCount} {totalCartCount > 1 ? 'dishes' : 'dish'}</span>
                  </div>
                  <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-200 leading-relaxed">
                    Dishes are sent directly to the kitchen upon submission. Itemized billing and payment are completed at the cashier counter.
                  </p>
                </div>
              )}

              {!canPlaceTableOrder && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    {!settings.allowGuestOrdering
                      ? 'Self-ordering is temporarily paused. Please place your order with café staff.'
                      : 'Scan the official QR code on your café table with your phone camera to link your table and submit this order.'}
                  </span>
                </div>
              )}

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            {/* Drawer Bottom Action */}
            <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 space-y-2 pb-safe">
              <button
                onClick={handleConfirmOrder}
                disabled={isSubmitting || cart.length === 0 || !canPlaceTableOrder}
                className={`w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 min-h-[48px] ${
                  isSubmitting || !canPlaceTableOrder
                    ? 'bg-stone-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <span>Sending Order to Kitchen...</span>
                ) : canPlaceTableOrder && verifiedTable ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm &amp; Send Order ({verifiedTable.tableNumber})</span>
                  </>
                ) : (
                  <span>Scan Table QR Code to Order</span>
                )}
              </button>
              <p className="text-[11px] text-center text-stone-500">
                No upfront card required. Pay at the counter when you finish your meal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Order Confirmation & Live Tracking Screen */}
      {submittedOrder && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-stone-200 space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono font-bold text-amber-700 uppercase tracking-wider">
                Order Confirmed
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 font-display">
                {submittedOrder.orderNumber}
              </h2>
              <p className="text-xs text-stone-500">
                Linked to <strong>{activeTableLabel}</strong> ({activeTableSection}) · Round #{submittedOrder.roundNumber}
              </p>
            </div>

            {/* Visual Order Status Progress Tracker: Placed -> Preparing -> Ready */}
            <OrderStatusTracker
              status={submittedOrder.status}
              orderNumber={submittedOrder.orderNumber}
              variant="full"
            />

            {/* Items summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Items Ordered</h4>
              <div className="max-h-40 overflow-y-auto divide-y divide-stone-100 text-xs">
                {submittedOrder.items.map(it => (
                  <div key={it.id} className="py-2 flex justify-between items-center gap-2">
                    <div>
                      <span className="font-semibold text-stone-900">{it.quantity}x {it.name}</span>
                      {it.customizations.length > 0 && (
                        <span className="text-[11px] text-stone-500 block">
                          {it.customizations.map(c => c.optionName).join(', ')}
                        </span>
                      )}
                    </div>
                    {settings.showPricesOnCustomerMenu ? (
                      <span className="font-mono tabular-nums text-stone-600 whitespace-nowrap">Nu. {it.unitPrice * it.quantity}</span>
                    ) : (
                      <span className="text-emerald-700 font-medium text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
                        Sent to Kitchen
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  setSubmittedOrder(null);
                  setCustomerViewTab('orders');
                }}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm min-h-[44px] cursor-pointer"
              >
                <History className="w-4 h-4" />
                Track Live in Previous Orders
              </button>
              <button
                onClick={() => setSubmittedOrder(null)}
                className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 active:scale-[0.98] text-stone-800 rounded-xl text-xs font-semibold transition-all min-h-[40px] cursor-pointer"
              >
                Back to Menu (Add More Rounds Anytime)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
