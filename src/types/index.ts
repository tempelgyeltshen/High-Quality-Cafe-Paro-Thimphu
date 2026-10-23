export type Role = 'admin' | 'manager' | 'cashier' | 'kitchen';

export interface StaffUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  pin: string; // for fast quick-switch / terminal login
}

export type TableStatus = 'available' | 'occupied' | 'billing' | 'cleaning';

export interface RestaurantTable {
  id: string; // e.g. "T01"
  tableNumber: string; // "Table 1"
  capacity: number;
  section: string; // "Main Hall", "Window Terrace", "Balcony Lounge"
  status: TableStatus;
  currentSessionId?: string | null;
  qrCodeUrl?: string;
  tableToken?: string; // Cryptographically unique token establishing trusted table identity
}

export type DietType = 'veg' | 'non-veg' | 'vegan' | 'egg';

export interface CustomizationOption {
  id: string;
  name: string;
  priceModifier: number; // e.g. +20 Nu.
}

export interface CustomizationGroup {
  id: string;
  name: string; // e.g. "Spice Level", "Portion Size", "Add-ons"
  type: 'single' | 'multiple';
  required: boolean;
  options: CustomizationOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  price: number; // Bhutanese Ngultrum (Nu.)
  dietType: DietType;
  isAvailable: boolean;
  soldOut: boolean;
  allergens: string[];
  imageUrl: string;
  customizationGroups: CustomizationGroup[];
  timeSlot?: 'all_day' | 'breakfast' | 'lunch_dinner' | 'late_night';
  preparationTimeMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  iconName?: string;
  description?: string;
}

export interface SelectedCustomization {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceModifier: number;
}

export interface CartItem {
  cartItemId: string;
  menuItemId: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  dietType: DietType;
  customizations: SelectedCustomization[];
  specialInstructions?: string;
  imageUrl?: string;
}

export type OrderItemKitchenStatus = 'pending' | 'preparing' | 'ready' | 'cannot_prepare';

export interface OrderItem extends CartItem {
  id: string;
  kitchenStatus: OrderItemKitchenStatus;
  rejectionReason?: string;
}

export type OrderStatus = 'submitted' | 'acknowledged' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface OrderRound {
  id: string;
  orderNumber: string; // e.g. "#HQC-1001"
  sessionId: string;
  tableId: string;
  roundNumber: number;
  items: OrderItem[];
  subtotal: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  customerNote?: string;
  idempotencyKey?: string;
}

export type BillStatus = 'open' | 'preparing' | 'paid' | 'voided';
export type PaymentMethod = 'cash' | 'card' | 'mbob_transfer' | 'qr_pay' | 'split';

export interface PaymentRecord {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string; // transaction reference or note
  recordedBy: string; // staff name
  timestamp: string;
}

export interface BillDiscount {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number; // e.g. 10 for 10% or 50 for 50 Nu.
  appliedAmount: number;
  reason: string;
  authorizedBy: string;
}

export interface Bill {
  id: string;
  billNumber: string; // e.g. "INV-2026-001"
  sessionId: string;
  tableId: string;
  tableNumber: string;
  orderRoundIds: string[];
  subtotal: number;
  discount: BillDiscount | null;
  taxRate: number; // e.g. 0.05 (5% Bhutan Sales Tax)
  taxAmount: number;
  serviceChargeRate: number; // e.g. 0.10 (10% Service Charge)
  serviceChargeAmount: number;
  additionalCharges: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  status: BillStatus;
  payments: PaymentRecord[];
  createdAt: string;
  paidAt?: string;
  closedAt?: string;
}

export interface DiningSession {
  id: string;
  tableId: string;
  tableNumber: string;
  status: 'active' | 'closed';
  startedAt: string;
  closedAt?: string;
  guestCount?: number;
  orderRoundIds: string[];
  billId?: string;
}

export interface PriceAuditLog {
  id: string;
  menuItemId: string;
  menuItemName: string;
  previousPrice: number;
  newPrice: number;
  reason: string;
  changedBy: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  action: string;
  category: 'order' | 'payment' | 'menu' | 'table' | 'discount' | 'cancellation' | 'system';
  details: string;
  performedBy: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SystemSettings {
  restaurantName: string;
  tagline: string;
  operatingHours: string;
  currency: string;
  currencySymbol: string;
  taxRate: number; // 0.05 (5%)
  serviceChargeRate: number; // 0.10 (10%)
  allowGuestOrdering: boolean;
  kitchenAudioAlert: boolean;
  showPricesOnCustomerMenu: boolean;
  address: string;
  phone: string;
}
