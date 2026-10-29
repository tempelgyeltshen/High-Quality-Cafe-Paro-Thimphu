import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Printer,
  Tag,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  PlusCircle,
  X,
  Search,
  Receipt
} from 'lucide-react';
import {
  Bill,
  RestaurantTable,
  OrderRound,
  PaymentMethod,
  StaffUser,
  MenuItem,
  SystemSettings
} from '../types/index.ts';
import { soundService } from '../lib/audio.ts';

interface CounterConsoleProps {
  bills: Bill[];
  tables: RestaurantTable[];
  orders: OrderRound[];
  menuItems: MenuItem[];
  settings?: SystemSettings;
  currentUser: StaffUser | null;
  onApplyDiscount: (billId: string, discount: { name: string; type: 'percentage' | 'fixed'; value: number; reason: string }) => Promise<void>;
  onRemoveDiscount: (billId: string) => Promise<void>;
  onRecordPayment: (billId: string, payment: { method: PaymentMethod; amount: number; reference?: string }) => Promise<void>;
  onCloseSession: (sessionId: string) => Promise<void>;
  onMoveSession: (sessionId: string, targetTableId: string) => Promise<void>;
  onAddOrderFromCounter: (tableId: string, items: any[], note?: string) => Promise<void>;
}

const KITCHEN_ROUND_LABELS: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Pending in Kitchen', className: 'text-amber-800 bg-amber-50 border-amber-200' },
  acknowledged: { label: 'Acknowledged', className: 'text-amber-800 bg-amber-50 border-amber-200' },
  preparing: { label: 'Preparing', className: 'text-sky-800 bg-sky-50 border-sky-200' },
  ready: { label: 'Ready to Serve', className: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  served: { label: 'Served', className: 'text-stone-700 bg-stone-100 border-stone-200' },
  cancelled: { label: 'Cancelled', className: 'text-rose-800 bg-rose-50 border-rose-200' }
};

export const CounterConsole: React.FC<CounterConsoleProps> = ({
  bills,
  tables,
  orders,
  menuItems,
  settings,
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
  const [mobilePanel, setMobilePanel] = useState<'list' | 'invoice'>('list');

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
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Selected Bill
  const currentBill = bills.find(b => b.id === selectedBillId) || bills[0] || null;

  // Rounds linked to this bill
  const currentBillRounds = useMemo(() => {
    if (!currentBill) return [];
    return currentBill.orderRoundIds
      .map(id => orders.find(o => o.id === id))
      .filter(Boolean) as OrderRound[];
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

  const openBillsCount = useMemo(() => bills.filter(b => b.status !== 'paid').length, [bills]);
  const paidBillsCount = useMemo(() => bills.filter(b => b.status === 'paid').length, [bills]);

  // Open Payment Modal
  const openPayment = () => {
    if (!currentBill) return;
    setPaymentAmount(String(currentBill.balanceDue));
    setPaymentRef('');
    setPaymentMethod('cash');
    setActionError(null);
    setIsPaymentModalOpen(true);
  };

  // Submit Payment
  const handleConfirmPayment = async () => {
    if (!currentBill || isSubmittingAction) return;
    const num = parseFloat(paymentAmount);
    if (isNaN(num) || num <= 0) {
      setActionError('Enter a valid payment amount greater than zero.');
      return;
    }

    try {
      setIsSubmittingAction(true);
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
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Submit Discount
  const handleApplyDiscountSubmit = async () => {
    if (!currentBill || isSubmittingAction) return;
    if (!discountName.trim()) {
      setActionError('Discount name is required.');
      return;
    }
    if (!discountReason.trim()) {
      setActionError('Audit justification reason is required.');
      return;
    }
    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) {
      setActionError('Discount value must be a positive number.');
      return;
    }
    if (discountType === 'percentage' && (val < 1 || val > 100)) {
      setActionError('Percentage discount must be between 1% and 100%.');
      return;
    }
    if (discountType === 'fixed' && val > currentBill.subtotal) {
      setActionError(`Fixed discount cannot exceed food & beverage subtotal (Nu. ${currentBill.subtotal}).`);
      return;
    }

    try {
      setIsSubmittingAction(true);
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
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Submit Move Table
  const handleConfirmMoveTable = async () => {
    if (!currentBill || !targetMoveTableId || isSubmittingAction) return;
    try {
      setIsSubmittingAction(true);
      setActionError(null);
      await onMoveSession(currentBill.sessionId, targetMoveTableId);
      setIsMoveTableModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to move session');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Add Item From Counter
  const handleConfirmAddItem = async () => {
    if (!currentBill || !selectedMenuItemId || isSubmittingAction) return;
    try {
      setIsSubmittingAction(true);
      setActionError(null);
      await onAddOrderFromCounter(
        currentBill.tableId,
        [
          {
            menuItemId: selectedMenuItemId,
            quantity: addItemQty
          }
        ],
        addItemNote
      );
      setIsAddItemModalOpen(false);
      setSelectedMenuItemId('');
      setAddItemQty(1);
      setAddItemNote('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to add items');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Close Session
  const handleCloseSession = async () => {
    if (!currentBill || isSubmittingAction) return;
    try {
      setIsSubmittingAction(true);
      setActionError(null);
      await onCloseSession(currentBill.sessionId);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const anyModalOpen =
    isPaymentModalOpen || isDiscountModalOpen || isMoveTableModalOpen || isAddItemModalOpen || isReceiptModalOpen;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      {/* Top Workspace Header */}
      <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
              Cashier &amp; Billing Console
            </h1>
            <p className="text-xs sm:text-sm text-stone-500">
              Review table rounds, apply authorized discounts, print receipts, and record settlement payments.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 self-start sm:self-auto">
            <span>
              Operator: <strong className="text-stone-900">{currentUser?.name || 'Counter Cashier'}</strong>
            </span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="font-mono tabular-nums font-semibold text-teal-800">
              {openBillsCount} open {openBillsCount === 1 ? 'bill' : 'bills'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4 no-print">
        {/* Mobile View Switcher (< lg) */}
        <div className="lg:hidden grid grid-cols-2 gap-1.5 p-1 bg-stone-200/70 rounded-xl">
          <button
            type="button"
            onClick={() => setMobilePanel('list')}
            className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mobilePanel === 'list' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600'
            }`}
          >
            Bills Queue ({filteredBills.length})
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel('invoice')}
            className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer truncate ${
              mobilePanel === 'invoice' ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600'
            }`}
          >
            {currentBill ? `Invoice · ${currentBill.tableNumber}` : 'Selected Invoice'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Bills Queue */}
          <aside
            aria-label="Table bills queue"
            className={`lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col lg:max-h-[780px] ${
              mobilePanel === 'invoice' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Filter & Search Controls */}
            <div className="p-4 border-b border-stone-200 space-y-3">
              {currentUser?.role === 'manager' || currentUser?.role === 'admin' ? (
                <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setBillFilter('open')}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      billFilter === 'open'
                        ? 'bg-white text-stone-900 shadow-xs font-bold'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Open Bills ({openBillsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillFilter('paid')}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      billFilter === 'paid'
                        ? 'bg-white text-stone-900 shadow-xs font-bold'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Settled ({paidBillsCount})
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs py-0.5">
                  <span className="font-bold text-stone-900">
                    Active Open Bills ({openBillsCount})
                  </span>
                  <span className="text-stone-500">
                    Archive: GM &amp; Admin
                  </span>
                </div>
              )}

              <div className="relative">
                <label htmlFor="counter-bill-search" className="sr-only">
                  Filter bills by table or invoice number
                </label>
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="counter-bill-search"
                  type="text"
                  placeholder="Search table or invoice number..."
                  value={searchTable}
                  onChange={(e) => setSearchTable(e.target.value)}
                  className="w-full h-11 pl-10 pr-14 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                />
                {searchTable && (
                  <button
                    type="button"
                    onClick={() => setSearchTable('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-500 hover:text-stone-800 px-2 py-1 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Bill Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
              {filteredBills.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <Receipt className="w-6 h-6 text-stone-400 mx-auto" />
                  <p className="text-sm font-semibold text-stone-700">No matching bills</p>
                  <p className="text-xs text-stone-500">
                    New customer orders will appear here automatically as soon as they are submitted.
                  </p>
                </div>
              ) : (
                filteredBills.map(bill => {
                  const isSelected = bill.id === currentBill?.id;
                  const isPaid = bill.status === 'paid';

                  return (
                    <button
                      key={bill.id}
                      type="button"
                      onClick={() => {
                        setSelectedBillId(bill.id);
                        setActionError(null);
                        setMobilePanel('invoice');
                      }}
                      className={`w-full min-h-[72px] text-left px-4 py-3.5 transition-colors flex items-center justify-between gap-3 cursor-pointer border-l-4 ${
                        isSelected
                          ? 'bg-teal-50/70 border-l-teal-700'
                          : 'border-l-transparent hover:bg-stone-50'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-stone-900">
                            {bill.tableNumber}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              isPaid ? 'text-emerald-700' : 'text-amber-800'
                            }`}
                          >
                            · {isPaid ? 'Settled' : 'Open'}
                          </span>
                        </div>
                        <div className="text-xs text-stone-500 font-mono tabular-nums truncate">
                          {bill.billNumber} · {bill.orderRoundIds.length}{' '}
                          {bill.orderRoundIds.length === 1 ? 'round' : 'rounds'}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-stone-500">
                          {isPaid ? 'Paid Total' : 'Balance Due'}
                        </div>
                        <div
                          className={`text-sm font-bold tabular-nums font-mono ${
                            isPaid ? 'text-emerald-700' : 'text-stone-900'
                          }`}
                        >
                          Nu. {isPaid ? bill.total : bill.balanceDue}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Column: Detailed Invoice & Payment Settlement */}
          <section
            aria-label="Selected table invoice"
            className={`lg:col-span-7 xl:col-span-8 space-y-6 ${
              mobilePanel === 'list' ? 'hidden lg:block' : 'block'
            }`}
          >
            {!currentBill ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 space-y-2">
                <Receipt className="w-7 h-7 text-stone-400 mx-auto" />
                <h2 className="text-base font-bold text-stone-900 font-display">No Open Bill Selected</h2>
                <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto">
                  Choose an active table bill from the queue to inspect ordered dishes, apply authorized discounts, or record payment.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                {/* Invoice Header */}
                <div className="p-5 sm:p-6 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-display">
                        {currentBill.tableNumber}
                      </h2>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-md font-semibold border ${
                          currentBill.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}
                      >
                        {currentBill.status === 'paid' ? 'Settled Invoice' : 'Open Bill'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 font-mono tabular-nums">
                      Invoice {currentBill.billNumber} · Session {currentBill.sessionId}
                    </p>
                  </div>

                  {/* Secondary Station Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setIsReceiptModalOpen(true);
                      }}
                      className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-stone-500" />
                      <span>Print Receipt</span>
                    </button>

                    {currentBill.status !== 'paid' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setTargetMoveTableId('');
                            setIsMoveTableModalOpen(true);
                          }}
                          className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-stone-500" />
                          <span>Move Table</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setIsAddItemModalOpen(true);
                          }}
                          className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-teal-700" />
                          <span>Add Dish</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline Error Banner (when no modal is covering) */}
                {actionError && !anyModalOpen && (
                  <div
                    role="alert"
                    className="mx-5 sm:mx-6 mt-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{actionError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActionError(null)}
                      className="text-rose-700 hover:text-rose-900 font-semibold px-2 py-0.5 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="p-5 sm:p-6 space-y-6">
                  {/* Itemized Rounds Breakdown (Single-Elevation Hairline List) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                        Ordered Rounds ({currentBillRounds.length})
                      </h3>
                      <span className="text-xs text-stone-500">
                        Live Kitchen Sync
                      </span>
                    </div>

                    {currentBillRounds.length === 0 ? (
                      <div className="p-6 text-center text-xs text-stone-500 border border-stone-200 rounded-xl">
                        No dishes have been ordered for this table yet.
                      </div>
                    ) : (
                      <div className="border border-stone-200 rounded-xl divide-y divide-stone-200 overflow-hidden">
                        {currentBillRounds.map((round) => {
                          const statusMeta = KITCHEN_ROUND_LABELS[round.status] || {
                            label: round.status,
                            className: 'text-stone-700 bg-stone-100 border-stone-200'
                          };

                          return (
                            <div key={round.id} className="p-4 space-y-3 bg-white">
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs sm:text-sm text-stone-900">
                                    Round #{round.roundNumber}
                                  </span>
                                  <span className="text-xs font-mono tabular-nums text-stone-500">
                                    ({round.orderNumber})
                                  </span>
                                  <span
                                    className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${statusMeta.className}`}
                                  >
                                    {statusMeta.label}
                                  </span>
                                </div>
                                <span className="text-xs font-mono tabular-nums font-semibold text-stone-700">
                                  Subtotal: Nu. {round.subtotal}
                                </span>
                              </div>

                              <div className="divide-y divide-stone-100">
                                {round.items.map(item => {
                                  const unavailable = item.kitchenStatus === 'cannot_prepare';
                                  return (
                                    <div
                                      key={item.id}
                                      className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-4 text-xs sm:text-sm"
                                    >
                                      <div className="space-y-0.5">
                                        <div className="text-stone-900 font-medium">
                                          <span className="font-mono tabular-nums font-bold mr-1.5">
                                            {item.quantity}x
                                          </span>
                                          <span className={unavailable ? 'line-through text-stone-400' : ''}>
                                            {item.name}
                                          </span>
                                        </div>
                                        {item.customizations.length > 0 && (
                                          <div className="text-xs text-stone-500">
                                            {item.customizations.map(c => c.optionName).join(' · ')}
                                          </div>
                                        )}
                                        {unavailable && (
                                          <div className="text-xs font-semibold text-rose-700">
                                            Marked unavailable by kitchen — excluded from bill (Nu. 0)
                                          </div>
                                        )}
                                      </div>

                                      <span
                                        className={`font-mono tabular-nums font-semibold shrink-0 ${
                                          unavailable ? 'line-through text-stone-400' : 'text-stone-900'
                                        }`}
                                      >
                                        Nu. {unavailable ? 0 : item.unitPrice * item.quantity}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Financial Summary & Authorized Discounts */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs sm:text-sm text-stone-600">
                      <span>Food &amp; Beverage Subtotal</span>
                      <span className="font-mono tabular-nums font-semibold text-stone-900">
                        Nu. {currentBill.subtotal}
                      </span>
                    </div>

                    {/* Authorized Discount Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                        <span className="text-stone-700 font-medium">
                          {currentBill.discount
                            ? `Discount: ${currentBill.discount.name} (${currentBill.discount.value}${
                                currentBill.discount.type === 'percentage' ? '%' : ' Nu.'
                              })`
                            : 'Authorized Discount'}
                        </span>
                        {currentBill.discount && currentBill.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => onRemoveDiscount(currentBill.id)}
                            className="text-xs text-rose-700 hover:text-rose-900 font-semibold underline cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div>
                        {currentBill.discount ? (
                          <span className="font-mono tabular-nums font-semibold text-emerald-700">
                            -Nu. {currentBill.discount.appliedAmount}
                          </span>
                        ) : currentBill.status !== 'paid' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActionError(null);
                              setIsDiscountModalOpen(true);
                            }}
                            className="text-xs font-semibold text-teal-800 hover:text-teal-950 underline cursor-pointer"
                          >
                            Apply Discount
                          </button>
                        ) : (
                          <span className="text-xs text-stone-400">None</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs sm:text-sm text-stone-600">
                      <span>Service Charge ({Math.round(currentBill.serviceChargeRate * 100)}%)</span>
                      <span className="font-mono tabular-nums text-stone-800">
                        Nu. {currentBill.serviceChargeAmount}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs sm:text-sm text-stone-600">
                      <span>Bhutan Sales Tax ({Math.round(currentBill.taxRate * 100)}%)</span>
                      <span className="font-mono tabular-nums text-stone-800">
                        Nu. {currentBill.taxAmount}
                      </span>
                    </div>

                    <div className="border-t border-stone-200 pt-3 flex items-center justify-between text-base font-bold text-stone-900">
                      <span>Final Bill Total</span>
                      <span className="font-mono tabular-nums text-lg">
                        Nu. {currentBill.total}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs sm:text-sm text-stone-600 pt-0.5">
                      <span>Amount Paid</span>
                      <span className="font-mono tabular-nums text-emerald-700 font-bold">
                        Nu. {currentBill.paidAmount}
                      </span>
                    </div>

                    <div className="border-t border-dashed border-stone-300 pt-3 flex items-center justify-between text-sm sm:text-base font-bold text-stone-900">
                      <span>Remaining Balance Due</span>
                      <span
                        className={`font-mono tabular-nums ${
                          currentBill.balanceDue > 0 ? 'text-amber-800 text-lg' : 'text-emerald-700'
                        }`}
                      >
                        Nu. {currentBill.balanceDue}
                      </span>
                    </div>
                  </div>

                  {/* Recorded Payment Receipts */}
                  {currentBill.payments.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                        Recorded Payments ({currentBill.payments.length})
                      </h4>
                      <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl divide-y divide-emerald-200/70">
                        {currentBill.payments.map((p) => (
                          <div
                            key={p.id}
                            className="p-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm"
                          >
                            <div className="space-y-0.5">
                              <div>
                                <span className="font-bold text-emerald-950 capitalize">
                                  {p.method.replace('_', ' ')}
                                </span>
                                {p.reference && (
                                  <span className="text-emerald-800 text-xs ml-2 font-mono">
                                    Ref: {p.reference}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-stone-500">
                                Recorded by {p.recordedBy} · {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

                  {/* Primary Settlement CTA */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                    {currentBill.balanceDue > 0 ? (
                      <button
                        type="button"
                        onClick={openPayment}
                        className="min-h-[48px] px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Record Payment (Nu. {currentBill.balanceDue})</span>
                      </button>
                    ) : currentBill.status !== 'paid' ? (
                      <button
                        type="button"
                        disabled={isSubmittingAction}
                        onClick={handleCloseSession}
                        className="min-h-[48px] px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Close Table Session &amp; Settle</span>
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>Invoice fully settled and closed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* MODAL 1: Record Payment */}
      {isPaymentModalOpen && currentBill && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-5"
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3.5">
              <div>
                <h3 id="payment-modal-title" className="text-base font-bold text-stone-900 font-display">
                  Record Table Payment
                </h3>
                <p className="text-xs text-stone-500 font-mono tabular-nums mt-0.5">
                  {currentBill.tableNumber} · Balance Due: Nu. {currentBill.balanceDue}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close payment dialog"
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-9 h-9 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-700 block">
                Select Payment Method
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cash', label: 'Cash Tendered' },
                  { id: 'card', label: 'Credit / Debit Card' },
                  { id: 'mbob_transfer', label: 'mBoB / Bhutan Pay' },
                  { id: 'qr_pay', label: 'BNB / QR Bank Pay' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs font-semibold text-center transition-colors cursor-pointer ${
                      paymentMethod === m.id
                        ? 'border-teal-700 bg-teal-50 text-teal-900 font-bold'
                        : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="payment-amount-input" className="text-xs font-semibold text-stone-700">
                  Amount Tendered (Nu.)
                </label>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(String(currentBill.balanceDue))}
                  className="text-xs text-teal-800 hover:text-teal-950 font-semibold underline cursor-pointer"
                >
                  Use Full Balance (Nu. {currentBill.balanceDue})
                </button>
              </div>
              <input
                id="payment-amount-input"
                type="number"
                step="any"
                min="1"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full min-h-[46px] text-base font-bold font-mono tabular-nums px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="payment-ref-input" className="text-xs font-semibold text-stone-700 block">
                Transaction Reference (Optional)
              </label>
              <input
                id="payment-ref-input"
                type="text"
                placeholder="e.g. mBoB journal number or card slip..."
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full min-h-[44px] text-xs sm:text-sm px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
              />
            </div>

            {actionError && (
              <div role="alert" className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={handleConfirmPayment}
                className="min-h-[44px] px-5 py-2.5 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingAction ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Apply Authorized Discount */}
      {isDiscountModalOpen && currentBill && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="discount-modal-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 id="discount-modal-title" className="text-base font-bold text-stone-900 font-display">
                Apply Authorized Discount
              </h3>
              <button
                type="button"
                aria-label="Close discount dialog"
                onClick={() => setIsDiscountModalOpen(false)}
                className="w-9 h-9 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-stone-600 block">Quick Presets</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: 'Local Resident', type: 'percentage', val: 10 },
                  { name: 'Staff Courtesy', type: 'percentage', val: 15 },
                  { name: 'Manager VIP', type: 'fixed', val: 100 }
                ].map(pre => (
                  <button
                    key={pre.name}
                    type="button"
                    onClick={() => {
                      setDiscountName(pre.name);
                      setDiscountType(pre.type as 'percentage' | 'fixed');
                      setDiscountValue(pre.val);
                    }}
                    className="min-h-[42px] p-2 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 hover:border-teal-600 hover:bg-teal-50/50 transition-colors cursor-pointer"
                  >
                    {pre.name} ({pre.val}{pre.type === 'percentage' ? '%' : ' Nu.'})
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="discount-name-input" className="text-xs font-semibold text-stone-700 block">
                Discount Label
              </label>
              <input
                id="discount-name-input"
                type="text"
                value={discountName}
                onChange={(e) => setDiscountName(e.target.value)}
                className="w-full min-h-[44px] text-xs sm:text-sm px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="discount-type-select" className="text-xs font-semibold text-stone-700 block">
                  Discount Type
                </label>
                <select
                  id="discount-type-select"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                  className="w-full min-h-[44px] text-xs sm:text-sm px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (Nu.)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="discount-value-input" className="text-xs font-semibold text-stone-700 block">
                  Value
                </label>
                <input
                  id="discount-value-input"
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full min-h-[44px] text-xs sm:text-sm px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums focus:bg-white focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="discount-reason-input" className="text-xs font-semibold text-stone-700 block">
                Audit Justification Reason
              </label>
              <input
                id="discount-reason-input"
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Required for financial audit logs..."
                className="w-full min-h-[44px] text-xs sm:text-sm px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
              />
            </div>

            {actionError && (
              <div role="alert" className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={handleApplyDiscountSubmit}
                className="min-h-[44px] px-5 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingAction ? 'Applying...' : 'Apply Discount'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Move Table */}
      {isMoveTableModalOpen && currentBill && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-table-modal-title"
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-stone-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 id="move-table-modal-title" className="text-base font-bold text-stone-900 font-display">
                Move {currentBill.tableNumber}
              </h3>
              <button
                type="button"
                aria-label="Close move table dialog"
                onClick={() => setIsMoveTableModalOpen(false)}
                className="w-9 h-9 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Transfer all active rounds and billing history to another available dining table.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="move-destination-select" className="text-xs font-semibold text-stone-700 block">
                Destination Table
              </label>
              <select
                id="move-destination-select"
                value={targetMoveTableId}
                onChange={(e) => setTargetMoveTableId(e.target.value)}
                className="w-full min-h-[44px] text-xs sm:text-sm px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
              >
                <option value="">Choose available table...</option>
                {tables
                  .filter(t => t.id !== currentBill.tableId && !t.currentSessionId)
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.tableNumber} ({t.section} · Seats {t.capacity})
                    </option>
                  ))}
              </select>
            </div>

            {actionError && (
              <div role="alert" className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsMoveTableModalOpen(false)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetMoveTableId || isSubmittingAction}
                onClick={handleConfirmMoveTable}
                className="min-h-[44px] px-5 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingAction ? 'Moving...' : 'Confirm Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Item From Counter */}
      {isAddItemModalOpen && currentBill && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-dish-modal-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 id="add-dish-modal-title" className="text-base font-bold text-stone-900 font-display">
                Add Dish to {currentBill.tableNumber}
              </h3>
              <button
                type="button"
                aria-label="Close add dish dialog"
                onClick={() => setIsAddItemModalOpen(false)}
                className="w-9 h-9 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="counter-add-dish-select" className="text-xs font-semibold text-stone-700 block">
                Select Available Dish
              </label>
              <select
                id="counter-add-dish-select"
                value={selectedMenuItemId}
                onChange={(e) => setSelectedMenuItemId(e.target.value)}
                className="w-full min-h-[44px] text-xs sm:text-sm px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
              >
                <option value="">Choose an available dish...</option>
                {menuItems
                  .filter(m => m.isAvailable && !m.soldOut)
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Nu. {m.price})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="counter-add-qty-input" className="text-xs font-semibold text-stone-700 block">
                Quantity
              </label>
              <input
                id="counter-add-qty-input"
                type="number"
                min="1"
                value={addItemQty}
                onChange={(e) => setAddItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full min-h-[44px] text-xs sm:text-sm px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono tabular-nums focus:bg-white focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="counter-add-note-input" className="text-xs font-semibold text-stone-700 block">
                Kitchen Note (Optional)
              </label>
              <input
                id="counter-add-note-input"
                type="text"
                placeholder="e.g. Requested at counter..."
                value={addItemNote}
                onChange={(e) => setAddItemNote(e.target.value)}
                className="w-full min-h-[44px] text-xs sm:text-sm px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
              />
            </div>

            {actionError && (
              <div role="alert" className="text-xs text-rose-800 bg-rose-50 p-3 rounded-xl border border-rose-200">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsAddItemModalOpen(false)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedMenuItemId || isSubmittingAction}
                onClick={handleConfirmAddItem}
                className="min-h-[44px] px-5 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingAction ? 'Sending...' : 'Send Dish to Kitchen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Printable Thermal Receipt */}
      {isReceiptModalOpen && currentBill && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-stone-200 space-y-4 my-8">
            <div id="printable-receipt" className="text-stone-900 font-mono tabular-nums text-xs space-y-3 leading-relaxed">
              <div className="text-center space-y-0.5 border-b border-dashed border-stone-300 pb-3">
                <div className="font-bold text-sm tracking-tight uppercase">
                  {settings?.restaurantName || 'HIGH QUALITY CAFE'}
                </div>
                <div className="text-[11px] text-stone-600">
                  {settings?.address || 'Paro Town, Paro, Bhutan'} · 24/7 Dining
                </div>
                <div className="text-[10px] text-stone-500">
                  Tel: {settings?.phone || '+975 8 271234'}
                </div>
              </div>

              <div className="text-[11px] space-y-0.5 border-b border-dashed border-stone-300 pb-2">
                <div className="flex justify-between">
                  <span>Bill #{currentBill.billNumber}</span>
                  <span>{currentBill.tableNumber}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Date: {new Date(currentBill.createdAt).toLocaleDateString()}</span>
                  <span>Time: {new Date(currentBill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                    <div key={idx} className="flex justify-between text-[11px] gap-2">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="shrink-0">Nu. {item.unitPrice * item.quantity}</span>
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
                  <span>Service Charge ({Math.round(currentBill.serviceChargeRate * 100)}%)</span>
                  <span>Nu. {currentBill.serviceChargeAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bhutan Sales Tax ({Math.round(currentBill.taxRate * 100)}%)</span>
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

            <div className="flex items-center justify-between pt-3 border-t border-stone-200 no-print">
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[42px] px-4 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
