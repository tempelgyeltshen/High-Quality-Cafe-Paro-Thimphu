import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Receipt,
  DollarSign,
  Printer,
  Tag,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  PlusCircle,
  X,
  FileText,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Search
} from 'lucide-react';
import {
  Bill,
  RestaurantTable,
  OrderRound,
  PaymentMethod,
  StaffUser,
  MenuItem
} from '../types/index.ts';
import { soundService } from '../lib/audio.ts';

interface CounterConsoleProps {
  bills: Bill[];
  tables: RestaurantTable[];
  orders: OrderRound[];
  menuItems: MenuItem[];
  currentUser: StaffUser | null;
  onApplyDiscount: (billId: string, discount: { name: string; type: 'percentage' | 'fixed'; value: number; reason: string }) => Promise<void>;
  onRemoveDiscount: (billId: string) => Promise<void>;
  onRecordPayment: (billId: string, payment: { method: PaymentMethod; amount: number; reference?: string }) => Promise<void>;
  onCloseSession: (sessionId: string) => Promise<void>;
  onMoveSession: (sessionId: string, targetTableId: string) => Promise<void>;
  onAddOrderFromCounter: (tableId: string, items: any[], note?: string) => Promise<void>;
}

export const CounterConsole: React.FC<CounterConsoleProps> = ({
  bills,
  tables,
  orders,
  menuItems,
  currentUser,
  onApplyDiscount,
  onRemoveDiscount,
  onRecordPayment,
  onCloseSession,
  onMoveSession,
  onAddOrderFromCounter
}) => {
  const [selectedBillId, setSelectedBillId] = useState<string | null>(bills[0]?.id || null);
  const [billFilter, setBillFilter] = useState<'open' | 'paid' | 'all'>('open');
  const [searchTable, setSearchTable] = useState('');

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState('');

  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountName, setDiscountName] = useState('Local Resident Courtesy');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [discountReason, setDiscountReason] = useState('Standard local guest discount');

  const [isMoveTableModalOpen, setIsMoveTableModalOpen] = useState(false);
  const [targetMoveTableId, setTargetMoveTableId] = useState('');

  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [addItemQty, setAddItemQty] = useState(1);
  const [addItemNote, setAddItemNote] = useState('');

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Selected Bill
  const currentBill = bills.find(b => b.id === selectedBillId) || bills[0] || null;

  // Rounds linked to this bill
  const currentBillRounds = useMemo(() => {
    if (!currentBill) return [];
    return currentBill.orderRoundIds.map(id => orders.find(o => o.id === id)).filter(Boolean) as OrderRound[];
  }, [currentBill, orders]);

  // Filtered bills list
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      if (billFilter === 'open' && b.status === 'paid') return false;
      if (billFilter === 'paid' && b.status !== 'paid') return false;
      if (searchTable.trim()) {
        const q = searchTable.toLowerCase();
        return b.tableNumber.toLowerCase().includes(q) || b.billNumber.toLowerCase().includes(q);
      }
      return true;
    });
  }, [bills, billFilter, searchTable]);

  // Open Payment Modal
  const openPayment = () => {
    if (!currentBill) return;
    setPaymentAmount(String(currentBill.balanceDue));
    setPaymentRef('');
    setPaymentMethod('cash');
    setIsPaymentModalOpen(true);
    setActionError(null);
  };

  // Submit Payment
  const handleConfirmPayment = async () => {
    if (!currentBill) return;
    const num = parseFloat(paymentAmount);
    if (isNaN(num) || num <= 0) {
      setActionError('Enter a valid payment amount greater than zero');
      return;
    }

    try {
      setActionError(null);
      await onRecordPayment(currentBill.id, {
        method: paymentMethod,
        amount: num,
        reference: paymentRef.trim() || undefined
      });
      soundService.playPaymentSuccess();
      setIsPaymentModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Payment failed');
    }
  };

  // Submit Discount
  const handleApplyDiscountSubmit = async () => {
    if (!currentBill) return;
    if (!discountName.trim()) {
      setActionError('Discount name is required');
      return;
    }
    if (!discountReason.trim()) {
      setActionError('Audit justification reason is required');
      return;
    }
    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) {
      setActionError('Discount value must be a positive number');
      return;
    }
    if (discountType === 'percentage' && (val < 1 || val > 100)) {
      setActionError('Percentage discount must be between 1% and 100%');
      return;
    }
    if (discountType === 'fixed' && val > currentBill.subtotal) {
      setActionError(`Fixed discount cannot exceed food & beverage subtotal (Nu. ${currentBill.subtotal})`);
      return;
    }

    try {
      setActionError(null);
      await onApplyDiscount(currentBill.id, {
        name: discountName.trim(),
        type: discountType,
        value: val,
        reason: discountReason.trim()
      });
      setIsDiscountModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to apply discount');
    }
  };

  // Submit Move Table
  const handleConfirmMoveTable = async () => {
    if (!currentBill || !targetMoveTableId) return;
    try {
      setActionError(null);
      await onMoveSession(currentBill.sessionId, targetMoveTableId);
      setIsMoveTableModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to move session');
    }
  };

  // Add Item From Counter
  const handleConfirmAddItem = async () => {
    if (!currentBill || !selectedMenuItemId) return;
    try {
      setActionError(null);
      await onAddOrderFromCounter(currentBill.tableId, [
        {
          menuItemId: selectedMenuItemId,
          quantity: addItemQty
        }
      ], addItemNote);
      setIsAddItemModalOpen(false);
      setSelectedMenuItemId('');
      setAddItemQty(1);
      setAddItemNote('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to add items');
    }
  };

  // Close Session
  const handleCloseSession = async () => {
    if (!currentBill) return;
    try {
      setActionError(null);
      await onCloseSession(currentBill.sessionId);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-20">
      {/* Top Banner */}
      <div className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
              Cashier & Billing Console
            </h1>
            <p className="text-xs text-stone-500">
              High Quality Cafe · Open Tables, Round Linking & Payment Settlement
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">
              Staff Operator: <strong>{currentUser?.name || 'Counter Cashier'}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Tables / Bills List (4 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden flex flex-col h-[780px]">
            {/* Filter bar */}
            <div className="p-4 border-b border-stone-100 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-0.5 bg-stone-100 rounded-lg">
                  <button
                    onClick={() => setBillFilter('open')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      billFilter === 'open' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    Open Bills ({bills.filter(b => b.status !== 'paid').length})
                  </button>
                  <button
                    onClick={() => setBillFilter('paid')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      billFilter === 'paid' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    Paid / Settled ({bills.filter(b => b.status === 'paid').length})
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by table or bill #..."
                  value={searchTable}
                  onChange={(e) => setSearchTable(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
              {filteredBills.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  No bills found matching this filter.
                </div>
              ) : (
                filteredBills.map(bill => {
                  const isSelected = bill.id === currentBill?.id;
                  const isPaid = bill.status === 'paid';

                  return (
                    <button
                      key={bill.id}
                      onClick={() => setSelectedBillId(bill.id)}
                      className={`w-full text-left p-4 transition-colors flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-amber-500/10 border-l-4 border-amber-600'
                          : 'hover:bg-stone-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-stone-900">
                            {bill.tableNumber}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isPaid ? 'PAID' : 'OPEN'}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono">
                          {bill.billNumber} · {bill.orderRoundIds.length} round{bill.orderRoundIds.length > 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-stone-500">Balance Due</div>
                        <div className={`text-sm font-extrabold tabular-nums font-mono ${isPaid ? 'text-emerald-700' : 'text-stone-900'}`}>
                          Nu. {bill.balanceDue}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Bill Preparation & Management (8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {!currentBill ? (
              <div className="bg-white rounded-2xl p-12 text-center text-stone-400 border border-stone-200">
                Select an open bill from the left list to review charges, apply discounts, or record payments.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
                {/* Bill Header */}
                <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-stone-900 font-display">
                        {currentBill.tableNumber}
                      </h2>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        currentBill.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {currentBill.status === 'paid' ? 'Fully Paid' : 'Open Bill'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 font-mono mt-0.5">
                      Invoice: {currentBill.billNumber} · Session: {currentBill.sessionId}
                    </p>
                  </div>

                  {/* Header Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setIsReceiptModalOpen(true)}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Preview and print thermal receipt"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Receipt</span>
                    </button>

                    {currentBill.status !== 'paid' && (
                      <>
                        <button
                          onClick={() => setIsMoveTableModalOpen(true)}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Move Table</span>
                        </button>
                        <button
                          onClick={() => setIsAddItemModalOpen(true)}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Add Item</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Error Banner */}
                {actionError && (
                  <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}

                {/* Itemized Rounds Breakdown with Kitchen Preparation Status */}
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                        Ordered Items Across Rounds ({currentBillRounds.length} Rounds)
                      </h3>
                      <span className="text-xs text-stone-400">
                        Kitchen & Billing Live Sync
                      </span>
                    </div>

                    {currentBillRounds.length === 0 ? (
                      <div className="text-xs text-stone-400 italic">
                        No dishes ordered yet for this table.
                      </div>
                    ) : (
                      currentBillRounds.map((round, rIdx) => (
                        <div
                          key={round.id}
                          className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-stone-200/60 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-stone-800">
                                Round #{round.roundNumber} ({round.orderNumber})
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${
                                round.status === 'ready'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : round.status === 'preparing'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-stone-200 text-stone-700'
                              }`}>
                                Kitchen: {round.status}
                              </span>
                            </div>
                            <span className="text-xs font-mono font-semibold text-stone-600">
                              Nu. {round.subtotal}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {round.items.map(item => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-stone-900">
                                    {item.quantity}x {item.name}
                                  </span>
                                  {item.customizations.length > 0 && (
                                    <span className="text-[11px] text-stone-500 ml-2">
                                      ({item.customizations.map(c => c.optionName).join(', ')})
                                    </span>
                                  )}
                                  {item.kitchenStatus === 'cannot_prepare' && (
                                    <span className="ml-2 text-rose-600 font-semibold text-[11px]">
                                      [Kitchen: Unavailable - Nu. 0]
                                    </span>
                                  )}
                                </div>
                                <span className={`font-mono tabular-nums ${
                                  item.kitchenStatus === 'cannot_prepare' ? 'line-through text-stone-400' : 'text-stone-800'
                                }`}>
                                  Nu. {item.kitchenStatus === 'cannot_prepare' ? 0 : item.unitPrice * item.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Calculations & Discounts Card */}
                  <div className="bg-stone-100/70 border border-stone-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span>Food & Beverage Subtotal</span>
                      <span className="font-mono tabular-nums font-semibold text-stone-900">
                        Nu. {currentBill.subtotal}
                      </span>
                    </div>

                    {/* Discount row */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-stone-700 font-medium">
                          {currentBill.discount
                            ? `Discount: ${currentBill.discount.name} (${currentBill.discount.value}${currentBill.discount.type === 'percentage' ? '%' : ' Nu.'})`
                            : 'Authorized Discount'}
                        </span>
                        {currentBill.discount && currentBill.status !== 'paid' && (
                          <button
                            onClick={() => onRemoveDiscount(currentBill.id)}
                            className="text-[10px] text-rose-600 hover:text-rose-800 underline ml-1"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {currentBill.discount ? (
                          <span className="font-mono tabular-nums font-semibold text-emerald-700">
                            -Nu. {currentBill.discount.appliedAmount}
                          </span>
                        ) : currentBill.status !== 'paid' ? (
                          <button
                            onClick={() => setIsDiscountModalOpen(true)}
                            className="text-xs text-amber-700 hover:text-amber-900 font-semibold underline"
                          >
                            + Apply Discount
                          </button>
                        ) : (
                          <span className="text-stone-400">None</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span>Service Charge (10%)</span>
                      <span className="font-mono tabular-nums text-stone-800">
                        Nu. {currentBill.serviceChargeAmount}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span>Bhutan Sales Tax (5%)</span>
                      <span className="font-mono tabular-nums text-stone-800">
                        Nu. {currentBill.taxAmount}
                      </span>
                    </div>

                    <div className="border-t border-stone-200/80 pt-3 flex items-center justify-between text-base font-extrabold text-stone-900">
                      <span>Final Bill Total</span>
                      <span className="font-mono tabular-nums text-lg">
                        Nu. {currentBill.total}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-600 pt-1">
                      <span>Total Paid So Far</span>
                      <span className="font-mono tabular-nums text-emerald-700 font-bold">
                        Nu. {currentBill.paidAmount}
                      </span>
                    </div>

                    <div className="border-t border-dashed border-stone-300 pt-2 flex items-center justify-between text-sm font-bold text-stone-900">
                      <span>Remaining Balance Due</span>
                      <span className={`font-mono tabular-nums ${currentBill.balanceDue > 0 ? 'text-amber-700 text-base' : 'text-emerald-700'}`}>
                        Nu. {currentBill.balanceDue}
                      </span>
                    </div>
                  </div>

                  {/* Payment History on this Bill */}
                  {currentBill.payments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-stone-600 uppercase">
                        Payment Receipts ({currentBill.payments.length})
                      </h4>
                      <div className="space-y-1.5">
                        {currentBill.payments.map((p) => (
                          <div
                            key={p.id}
                            className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-3 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-emerald-900 capitalize">
                                {p.method.replace('_', ' ')}
                              </span>
                              {p.reference && (
                                <span className="text-emerald-700 text-[11px] ml-2 font-mono">
                                  Ref: {p.reference}
                                </span>
                              )}
                              <div className="text-[10px] text-stone-400">
                                Recorded by {p.recordedBy} · {new Date(p.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                            <span className="font-bold text-emerald-900 font-mono tabular-nums">
                              +Nu. {p.amount}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Checkout Actions */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                    {currentBill.balanceDue > 0 ? (
                      <button
                        onClick={openPayment}
                        className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Record Payment (Nu. {currentBill.balanceDue})</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleCloseSession}
                        className="py-3 px-6 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Close Table Session & Settle</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isPaymentModalOpen && currentBill && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-display">
                  Record Table Payment
                </h3>
                <p className="text-xs text-stone-500">
                  {currentBill.tableNumber} · Outstanding: Nu. {currentBill.balanceDue}
                </p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payment method selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 uppercase">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cash', label: 'Cash Tendered' },
                  { id: 'card', label: 'Credit / Debit Card' },
                  { id: 'mbob_transfer', label: 'mBoB / Bhutan Pay' },
                  { id: 'qr_pay', label: 'BNB / QR Bank Pay' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-colors ${
                      paymentMethod === m.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-stone-200 text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-stone-700 uppercase">
                  Amount in Nu.
                </label>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(String(currentBill.balanceDue))}
                  className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold underline"
                >
                  Pay Full Balance (Nu. {currentBill.balanceDue})
                </button>
              </div>
              <input
                type="number"
                step="any"
                min="1"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full text-base font-bold font-mono px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Reference input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 uppercase">
                Transaction / Reference Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. mBoB Txn #984210 or Card Slip #..."
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full text-xs px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {actionError && (
              <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {actionError}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-500 hover:text-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-colors"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Discount Modal */}
      {isDiscountModalOpen && currentBill && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <h3 className="text-base font-bold text-stone-900 font-display">
              Apply Authorized Discount
            </h3>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: 'Local Resident', type: 'percentage', val: 10 },
                { name: 'Staff Courtesy', type: 'percentage', val: 15 },
                { name: 'Manager VIP', type: 'fixed', val: 100 },
              ].map(pre => (
                <button
                  key={pre.name}
                  type="button"
                  onClick={() => {
                    setDiscountName(pre.name);
                    setDiscountType(pre.type as any);
                    setDiscountValue(pre.val);
                  }}
                  className="p-2 border border-stone-200 rounded-lg text-xs font-semibold hover:border-amber-500 hover:bg-amber-50/50"
                >
                  {pre.name} ({pre.val}{pre.type === 'percentage' ? '%' : ' Nu.'})
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Discount Name</label>
              <input
                type="text"
                value={discountName}
                onChange={(e) => setDiscountName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg bg-white"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (Nu.)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Value</label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Audit Justification / Reason</label>
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Reason is required for audit logs..."
                className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="px-3 py-1.5 text-xs text-stone-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyDiscountSubmit}
                className="px-4 py-2 text-xs font-bold bg-stone-900 text-white rounded-lg"
              >
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Table Modal */}
      {isMoveTableModalOpen && currentBill && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900">
              Move {currentBill.tableNumber} to Another Table
            </h3>
            <p className="text-xs text-stone-600">
              Transfer all open rounds and billing history seamlessly to an available table.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Select Target Table</label>
              <select
                value={targetMoveTableId}
                onChange={(e) => setTargetMoveTableId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg bg-white"
              >
                <option value="">-- Choose destination table --</option>
                {tables
                  .filter(t => t.id !== currentBill.tableId && !t.currentSessionId)
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.tableNumber} ({t.section} · Cap {t.capacity})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsMoveTableModalOpen(false)}
                className="px-3 py-1.5 text-xs text-stone-500"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetMoveTableId}
                onClick={handleConfirmMoveTable}
                className="px-4 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg disabled:opacity-50"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item From Counter Modal */}
      {isAddItemModalOpen && currentBill && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900">
              Add Extra Item to {currentBill.tableNumber}
            </h3>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Select Dish</label>
              <select
                value={selectedMenuItemId}
                onChange={(e) => setSelectedMenuItemId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg bg-white"
              >
                <option value="">-- Choose a dish --</option>
                {menuItems.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Nu. {m.price})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Quantity</label>
              <input
                type="number"
                min="1"
                value={addItemQty}
                onChange={(e) => setAddItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Note</label>
              <input
                type="text"
                placeholder="e.g. Added directly at counter by customer request"
                value={addItemNote}
                onChange={(e) => setAddItemNote(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-stone-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddItemModalOpen(false)}
                className="px-3 py-1.5 text-xs text-stone-500"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedMenuItemId}
                onClick={handleConfirmAddItem}
                className="px-4 py-1.5 text-xs font-bold bg-stone-900 text-white rounded-lg disabled:opacity-50"
              >
                Add Dish to Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {isReceiptModalOpen && currentBill && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4 my-8">
            {/* Thermal receipt layout */}
            <div id="printable-receipt" className="text-stone-900 font-mono text-xs space-y-3 leading-relaxed">
              <div className="text-center space-y-0.5 border-b border-dashed border-stone-300 pb-3">
                <div className="font-extrabold text-sm tracking-tight">HIGH QUALITY CAFE</div>
                <div className="text-[11px] text-stone-600">Thimphu, Bhutan · 24/7 Dining</div>
                <div className="text-[10px] text-stone-500">Tax ID: BT-7729-01 · Tel: +975 2 324488</div>
              </div>

              <div className="text-[11px] space-y-0.5 border-b border-dashed border-stone-300 pb-2">
                <div className="flex justify-between">
                  <span>Bill #{currentBill.billNumber}</span>
                  <span>{currentBill.tableNumber}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Date: {new Date(currentBill.createdAt).toLocaleDateString()}</span>
                  <span>Time: {new Date(currentBill.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="text-stone-500">
                  Cashier: {currentUser?.name || 'Counter Staff'}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5 border-b border-dashed border-stone-300 pb-3">
                {currentBillRounds.flatMap(r => r.items).map((item, idx) => {
                  if (item.kitchenStatus === 'cannot_prepare') return null;
                  return (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>{item.quantity}x {item.name}</span>
                      <span>Nu. {item.unitPrice * item.quantity}</span>
                    </div>
                  );
                })}
              </div>

              {/* Calculations */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-stone-300 pb-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Nu. {currentBill.subtotal}</span>
                </div>
                {currentBill.discount && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount ({currentBill.discount.name})</span>
                    <span>-Nu. {currentBill.discount.appliedAmount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Service Charge (10%)</span>
                  <span>Nu. {currentBill.serviceChargeAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bhutan Sales Tax (5%)</span>
                  <span>Nu. {currentBill.taxAmount}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-stone-200">
                  <span>TOTAL AMOUNT</span>
                  <span>Nu. {currentBill.total}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>PAID</span>
                  <span>Nu. {currentBill.paidAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>BALANCE DUE</span>
                  <span>Nu. {currentBill.balanceDue}</span>
                </div>
              </div>

              {/* Payments summary */}
              {currentBill.payments.length > 0 && (
                <div className="text-[10px] text-stone-500 border-b border-dashed border-stone-300 pb-2">
                  <div className="font-bold">Payments:</div>
                  {currentBill.payments.map(p => (
                    <div key={p.id} className="flex justify-between">
                      <span className="capitalize">{p.method.replace('_', ' ')}</span>
                      <span>Nu. {p.amount}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center text-[10px] text-stone-500 pt-2 space-y-1">
                <div>Thank you for dining with High Quality Cafe!</div>
                <div>Please come again · Open 24/7</div>
              </div>
            </div>

            {/* Print action buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold bg-stone-900 text-white rounded-lg flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Thermal Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
