import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Printer,
  ExternalLink,
  Download,
  Coffee,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Copy,
  Check,
  Search
} from 'lucide-react';
import { RestaurantTable, StaffUser } from '../types/index.ts';
import { api } from '../lib/api.ts';

interface TableWithQR extends RestaurantTable {
  qrUrl: string;
  qrCodeDataUrl: string;
}

interface TableQRManagementProps {
  currentUser?: StaffUser | null;
  onSelectTableForCustomerView: (tableId: string, token?: string) => void;
  onRefreshData?: () => void;
  embedded?: boolean;
}

export const TableQRManagement: React.FC<TableQRManagementProps> = ({
  currentUser,
  onSelectTableForCustomerView,
  onRefreshData,
  embedded = false
}) => {
  const isAdmin = !currentUser || currentUser.role === 'admin';
  const [tablesWithQR, setTablesWithQR] = useState<TableWithQR[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Table add/edit modal
  const [editingTable, setEditingTable] = useState<Partial<RestaurantTable> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Regenerate token & delete confirmation modals
  const [tableToRegenerate, setTableToRegenerate] = useState<TableWithQR | null>(null);
  const [tableToDelete, setTableToDelete] = useState<TableWithQR | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Single card print preview
  const [singlePrintTable, setSinglePrintTable] = useState<TableWithQR | null>(null);

  // Copied URL feedback
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);

  // Filter / Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');

  useEffect(() => {
    loadQRCodes();
  }, []);

  const loadQRCodes = async () => {
    try {
      setIsLoading(true);
      const data = await api.getTablesWithQR();
      setTablesWithQR(data);
    } catch (e: any) {
      console.error('Failed to load table QR codes:', e);
      setActionMessage({ type: 'error', text: e.message || 'Failed to load QR codes' });
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => {
      setActionMessage(null);
    }, 4500);
  };

  // Download single QR code image as PNG
  const handleDownloadSingleQR = (table: TableWithQR) => {
    try {
      const link = document.createElement('a');
      link.download = `high_quality_cafe_${table.tableNumber.toLowerCase().replace(/[^a-z0-9]/g, '_')}_qr.png`;
      link.href = table.qrCodeDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('success', `Downloaded QR image for ${table.tableNumber}.`);
    } catch (err: any) {
      showNotification('error', `Download failed: ${err.message}`);
    }
  };

  // Download all QR codes
  const handleDownloadAllQRs = () => {
    if (tablesWithQR.length === 0) return;
    tablesWithQR.forEach((table, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.download = `high_quality_cafe_${table.tableNumber.toLowerCase().replace(/[^a-z0-9]/g, '_')}_qr.png`;
        link.href = table.qrCodeDataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 250);
    });
    showNotification('success', `Downloading all ${tablesWithQR.length} QR code PNG files...`);
  };

  // Regenerate single table QR token
  const handleConfirmRegenerateToken = async () => {
    if (!tableToRegenerate) return;
    try {
      setIsRegenerating(true);
      const res = await api.regenerateTableToken(tableToRegenerate.id);
      await loadQRCodes();
      if (onRefreshData) onRefreshData();
      showNotification(
        'success',
        `New secure QR token minted for ${res.table.tableNumber}. Reprint its table stand card before guest use.`
      );
      setTableToRegenerate(null);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to regenerate token');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Regenerate all tokens in bulk
  const handleConfirmRegenerateAllTokens = async () => {
    try {
      setIsRegenerating(true);
      await api.regenerateAllTableTokens();
      await loadQRCodes();
      if (onRefreshData) onRefreshData();
      showNotification('success', 'Regenerated unique cryptographic QR tokens for all tables.');
      setIsRegeneratingAll(false);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to regenerate all tokens');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Save new / edited table
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable || !editingTable.tableNumber) return;

    try {
      setIsSaving(true);
      setModalError(null);
      await api.saveAdminTable(editingTable);
      await loadQRCodes();
      if (onRefreshData) onRefreshData();
      showNotification('success', `${editingTable.tableNumber} saved with a unique QR code.`);
      setEditingTable(null);
    } catch (err: any) {
      setModalError(err.message || 'Failed to save table');
    } finally {
      setIsSaving(false);
    }
  };

  // Request table deletion confirmation
  const requestDeleteTable = (table: TableWithQR) => {
    if (table.status === 'occupied') {
      showNotification('error', `Cannot delete ${table.tableNumber} while it has an active dining session.`);
      return;
    }
    setTableToDelete(table);
  };

  // Confirm delete table
  const handleConfirmDeleteTable = async () => {
    if (!tableToDelete || isDeleting) return;
    try {
      setIsDeleting(true);
      await api.deleteAdminTable(tableToDelete.id);
      const removedLabel = tableToDelete.tableNumber;
      setTableToDelete(null);
      await loadQRCodes();
      if (onRefreshData) onRefreshData();
      showNotification('success', `${removedLabel} removed.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete table');
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy table URL
  const handleCopyUrl = (table: TableWithQR) => {
    navigator.clipboard.writeText(table.qrUrl);
    setCopiedTableId(table.id);
    setTimeout(() => setCopiedTableId(null), 2500);
  };

  // Print single table stand card
  const handlePrintSingle = (table: TableWithQR) => {
    setSinglePrintTable(table);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const sections = Array.from(new Set(tablesWithQR.map(t => t.section))).filter(Boolean);

  const filteredTables = tablesWithQR.filter(table => {
    if (sectionFilter !== 'all' && table.section !== sectionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = table.tableNumber.toLowerCase().includes(q);
      const matchSec = table.section.toLowerCase().includes(q);
      const matchId = table.id.toLowerCase().includes(q);
      if (!matchNum && !matchSec && !matchId) return false;
    }
    return true;
  });

  const globalActionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setSinglePrintTable(null);
          window.print();
        }}
        className="min-h-[42px] px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
      >
        <Printer className="w-4 h-4 text-stone-500" />
        <span>Print All Cards</span>
      </button>

      <button
        type="button"
        onClick={handleDownloadAllQRs}
        className="min-h-[42px] px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
      >
        <Download className="w-4 h-4 text-stone-500" />
        <span>Download All PNGs</span>
      </button>

      {isAdmin && (
        <>
          <button
            type="button"
            onClick={() => setIsRegeneratingAll(true)}
            className="min-h-[42px] px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            title="Invalidate old printed QR codes and issue fresh tokens"
          >
            <RefreshCw className="w-4 h-4 text-stone-500" />
            <span>Rotate All Tokens</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalError(null);
              const nextNum = tablesWithQR.length + 1;
              setEditingTable({
                id: `T${String(nextNum).padStart(2, '0')}`,
                tableNumber: `Table ${nextNum}`,
                capacity: 4,
                section: 'Main Hall',
                status: 'available'
              });
            }}
            className="min-h-[42px] px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Table</span>
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className={embedded ? 'text-stone-900 space-y-6' : 'min-h-screen bg-stone-50 text-stone-900 pb-24'}>
      {/* Printable Sheet (Shown only during window.print) */}
      <div className="hidden print:block print:w-full print:bg-white print:text-stone-900">
        <div className="p-4 space-y-8">
          <div className="text-center pb-4 border-b border-stone-300">
            <h1 className="text-2xl font-black font-display uppercase tracking-wider text-stone-900">
              High Quality Cafe — Paro, Bhutan
            </h1>
            <p className="text-xs text-stone-600">
              Official Table QR Stand Cards · Scan with Phone Camera to Order (Open 24/7)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {(singlePrintTable ? [singlePrintTable] : filteredTables).map(table => (
              <div
                key={table.id}
                className="min-h-[380px] border-2 border-stone-900 rounded-3xl p-6 flex flex-col items-center justify-between text-center bg-white shadow-none break-inside-avoid"
              >
                <div className="w-full border-b-2 border-stone-900 pb-3 mb-4">
                  <div className="flex items-center justify-center gap-1.5 text-stone-900 mb-1">
                    <Coffee className="w-4 h-4" />
                    <span className="text-[11px] font-extrabold uppercase tracking-widest font-display">
                      High Quality Cafe
                    </span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight font-display text-stone-900">
                    {table.tableNumber.toUpperCase()}
                  </h2>
                  <p className="text-xs font-semibold text-stone-600">
                    {table.section} {table.capacity > 0 ? `· Seats ${table.capacity}` : ''}
                  </p>
                </div>

                <div className="p-4 bg-white border border-stone-300 rounded-2xl my-2">
                  <img
                    src={table.qrCodeDataUrl}
                    alt={`QR Code for ${table.tableNumber}`}
                    className="w-52 h-52 object-contain"
                  />
                </div>

                <div className="w-full pt-4 border-t-2 border-dashed border-stone-300 space-y-1">
                  <p className="text-sm font-black text-stone-900">
                    Scan with Phone Camera to Order
                  </p>
                  <p className="text-[11px] text-stone-600">
                    1. Point camera at QR &nbsp;·&nbsp; 2. Browse menu &nbsp;·&nbsp; 3. Send order to kitchen
                  </p>
                  <p className="text-[9px] font-mono text-stone-400 pt-1">
                    Token: {table.tableToken?.slice(0, 16) || 'SECURE'} · Table ID: {table.id}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Screen Interface (Hidden during print) */}
      <div className="no-print">
        {!embedded && (
          <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-5">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl flex items-center justify-center shrink-0">
                    <QrCode className="w-4 h-4" />
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
                    Table QR Stand Cards &amp; Tokens
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-stone-500 max-w-2xl">
                  Manage dining tables, print physical QR stand cards, or rotate cryptographic table tokens.
                </p>
              </div>

              {globalActionButtons}
            </div>
          </header>
        )}

        {/* Action Notification Banner */}
        {actionMessage && (
          <div className={embedded ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 pt-5'}>
            <div
              role="status"
              className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{actionMessage.text}</span>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setActionMessage(null)}
                className="text-stone-500 hover:text-stone-800 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className={embedded ? 'space-y-5' : 'max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6'}>
          {/* Embedded Header Bar (when inside AdminHub) */}
          {embedded && (
            <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-stone-900 font-display">
                  Dining Tables &amp; Cryptographic QR Cards
                </h2>
                <p className="text-xs text-stone-500 max-w-2xl">
                  Each table is bound to a unique server-verified QR token so guests cannot spoof table numbers or view other tables&apos; orders.
                </p>
              </div>
              {globalActionButtons}
            </div>
          )}

          {/* Security Summary Strip */}
          {!embedded && (
            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-xs font-bold text-stone-900">
                    Server-Enforced Table Identity Verification
                  </h2>
                  <p className="text-xs text-stone-500 leading-relaxed max-w-3xl">
                    Every QR code embeds a verified table token. Guests cannot switch tables by changing URL parameters or access other tables&apos; active sessions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 text-xs font-semibold text-stone-700 bg-stone-50 px-3.5 py-2 rounded-xl border border-stone-200 font-mono tabular-nums">
                <Lock className="w-3.5 h-3.5 text-teal-700" />
                <span>{tablesWithQR.length} Configured Tables</span>
              </div>
            </div>
          )}

          {/* Search & Section Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSectionFilter('all')}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  sectionFilter === 'all'
                    ? 'bg-teal-50 text-teal-900 border border-teal-200 font-bold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50 border border-transparent'
                }`}
              >
                All Sections ({tablesWithQR.length})
              </button>
              {sections.map(sec => {
                const count = tablesWithQR.filter(t => t.section === sec).length;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSectionFilter(sec)}
                    className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                      sectionFilter === sec
                        ? 'bg-teal-50 text-teal-900 border border-teal-200 font-bold'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50 border border-transparent'
                    }`}
                  >
                    {sec} ({count})
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <label htmlFor="qr-table-search" className="sr-only">
                Search tables by number, section, or ID
              </label>
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="qr-table-search"
                type="text"
                placeholder="Search table or section..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-64 h-11 pl-10 pr-14 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-500 hover:text-stone-800 px-1.5 py-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Table Cards Grid */}
          {isLoading ? (
            <div className="p-16 text-center text-xs text-stone-500 bg-white rounded-2xl border border-stone-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-700 mb-2.5" />
              Loading validated QR stand cards...
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="p-12 text-center text-xs sm:text-sm text-stone-500 bg-white rounded-2xl border border-stone-200">
              No tables match the current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTables.map(table => {
                const isOccupied = table.status === 'occupied';
                return (
                  <article
                    key={table.id}
                    className="bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col justify-between"
                  >
                    {/* Card Header */}
                    <div>
                      <div className="p-5 bg-stone-50/80 border-b border-stone-200 flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <h3 className="text-lg font-bold font-display text-stone-900">
                            {table.tableNumber}
                          </h3>
                          <p className="text-xs text-stone-500">
                            {table.section} · {table.capacity > 0 ? `Seats ${table.capacity}` : 'Counter Pickup'}
                          </p>
                        </div>

                        <div className="text-right space-y-1 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${
                              isOccupied
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOccupied ? 'bg-amber-600' : 'bg-emerald-600'
                              }`}
                            />
                            {isOccupied ? 'Occupied' : 'Available'}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-stone-400 block">
                            ID: {table.id}
                          </span>
                        </div>
                      </div>

                      {/* QR Code Canvas */}
                      <div className="p-6 flex flex-col items-center justify-center border-b border-stone-100 space-y-4">
                        <div className="p-3 bg-white rounded-2xl border border-stone-200">
                          <img
                            src={table.qrCodeDataUrl}
                            alt={`QR Code for ${table.tableNumber}`}
                            className="w-44 h-44 object-contain"
                          />
                        </div>

                        <div className="w-full space-y-1.5 text-center">
                          <div className="flex items-center justify-between gap-2 text-xs font-mono text-stone-600 bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl">
                            <span className="truncate">{table.qrUrl}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(table)}
                              className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 font-sans font-semibold shrink-0 cursor-pointer"
                            >
                              {copiedTableId === table.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500 font-mono">
                            <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                            <span>Token: {table.tableToken ? `${table.tableToken.slice(0, 14)}...` : 'Active'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Touch-Friendly Footer Actions (No Hover-Only Overlays) */}
                    <div className="p-4 bg-white space-y-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectTableForCustomerView(table.id, table.tableToken)}
                          className="col-span-3 sm:col-span-1 min-h-[40px] px-2.5 py-2 bg-teal-50 hover:bg-teal-100/80 text-teal-900 border border-teal-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          <span>Guest View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadSingleQR(table)}
                          className="min-h-[40px] px-2.5 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                          <span>PNG</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrintSingle(table)}
                          className="min-h-[40px] px-2.5 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                          <span>Print</span>
                        </button>
                      </div>

                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setTableToRegenerate(table)}
                          className="min-h-[36px] px-2 text-stone-600 hover:text-stone-900 flex items-center gap-1.5 font-medium cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
                          <span>Rotate Token</span>
                        </button>

                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setModalError(null);
                                setEditingTable({ ...table });
                              }}
                              aria-label={`Edit ${table.tableNumber}`}
                              className="min-h-[36px] px-2.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg inline-flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteTable(table)}
                              aria-label={`Delete ${table.tableNumber}`}
                              className="min-h-[36px] px-2.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: Add or Edit Table */}
      {editingTable && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-edit-table-title"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 id="qr-edit-table-title" className="text-base font-bold text-stone-900 font-display">
                {tablesWithQR.some(t => t.id === editingTable.id) ? 'Edit Café Table' : 'Add New Café Table'}
              </h3>
              <button
                type="button"
                aria-label="Close table dialog"
                onClick={() => setEditingTable(null)}
                className="w-9 h-9 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTable} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label htmlFor="qr-table-id-input" className="font-semibold text-stone-700 block">
                  Table Identifier (ID)
                </label>
                <input
                  id="qr-table-id-input"
                  type="text"
                  required
                  value={editingTable.id || ''}
                  onChange={(e) => setEditingTable({ ...editingTable, id: e.target.value.toUpperCase() })}
                  placeholder="e.g. T09, BALCONY_1"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700 font-mono"
                />
                <span className="text-[11px] text-stone-500 block">
                  Short unique code used in URLs and kitchen tickets.
                </span>
              </div>

              <div className="space-y-1">
                <label htmlFor="qr-table-name-input" className="font-semibold text-stone-700 block">
                  Display Name
                </label>
                <input
                  id="qr-table-name-input"
                  type="text"
                  required
                  value={editingTable.tableNumber || ''}
                  onChange={(e) => setEditingTable({ ...editingTable, tableNumber: e.target.value })}
                  placeholder="e.g. Table 9, Window Table 3"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="qr-table-cap-input" className="font-semibold text-stone-700 block">
                    Seating Capacity
                  </label>
                  <input
                    id="qr-table-cap-input"
                    type="number"
                    min="0"
                    max="50"
                    required
                    value={editingTable.capacity !== undefined ? editingTable.capacity : 4}
                    onChange={(e) => setEditingTable({ ...editingTable, capacity: Number(e.target.value) })}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700 font-mono tabular-nums"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="qr-table-sec-select" className="font-semibold text-stone-700 block">
                    Café Section
                  </label>
                  <select
                    id="qr-table-sec-select"
                    value={editingTable.section || 'Main Hall'}
                    onChange={(e) => setEditingTable({ ...editingTable, section: e.target.value })}
                    className="w-full min-h-[44px] px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
                  >
                    <option value="Main Hall">Main Hall</option>
                    <option value="Window Terrace">Window Terrace</option>
                    <option value="Balcony Lounge">Balcony Lounge</option>
                    <option value="Quick Pick-up">Quick Pick-up</option>
                    <option value="Outdoor Garden">Outdoor Garden</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="min-h-[44px] px-4 py-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-[44px] px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save & Generate QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Regenerate Single Table Token Confirmation */}
      {tableToRegenerate && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 font-display">
                  Rotate QR Token for {tableToRegenerate.tableNumber}?
                </h3>
                <p className="text-xs text-stone-500 font-mono">
                  ID: {tableToRegenerate.id}
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Generating a fresh cryptographic token updates the QR code for <strong>{tableToRegenerate.tableNumber}</strong>. Previously printed stand cards for this table will stop working until reprinted.
            </p>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTableToRegenerate(null)}
                className="min-h-[42px] px-4 py-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs rounded-xl font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRegenerateToken}
                disabled={isRegenerating}
                className="min-h-[42px] px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs rounded-xl font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isRegenerating ? 'Generating...' : 'Generate New Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Regenerate All Tokens Confirmation */}
      {isRegeneratingAll && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-amber-800" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 font-display">
                  Rotate All Table QR Tokens?
                </h3>
                <p className="text-xs text-stone-500">
                  System-wide security token refresh
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              This issues new cryptographic tokens for all {tablesWithQR.length} tables at once. You will need to reprint all table stand cards for guests.
            </p>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRegeneratingAll(false)}
                className="min-h-[42px] px-4 py-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs rounded-xl font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRegenerateAllTokens}
                disabled={isRegenerating}
                className="min-h-[42px] px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs rounded-xl font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isRegenerating ? 'Rotating All...' : 'Rotate All Tokens'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Table Confirmation */}
      {tableToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-stone-200 space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-stone-900 font-display">
                Delete {tableToDelete.tableNumber}?
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Permanently remove <strong>{tableToDelete.tableNumber} ({tableToDelete.id})</strong>? Any printed QR stand card for this table will stop working.
              </p>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTableToDelete(null)}
                className="min-h-[42px] px-4 py-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs rounded-xl font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTable}
                disabled={isDeleting}
                className="min-h-[42px] px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
