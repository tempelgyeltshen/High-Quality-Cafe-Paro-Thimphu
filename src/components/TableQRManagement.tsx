import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Printer,
  ExternalLink,
  Download,
  Sparkles,
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
  Layers,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import { RestaurantTable } from '../types/index.ts';
import { api } from '../lib/api.ts';

interface TableWithQR extends RestaurantTable {
  qrUrl: string;
  qrCodeDataUrl: string;
}

interface TableQRManagementProps {
  onSelectTableForCustomerView: (tableId: string, token?: string) => void;
  onRefreshData?: () => void;
}

export const TableQRManagement: React.FC<TableQRManagementProps> = ({
  onSelectTableForCustomerView,
  onRefreshData
}) => {
  const [tablesWithQR, setTablesWithQR] = useState<TableWithQR[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Table add/edit modal
  const [editingTable, setEditingTable] = useState<Partial<RestaurantTable> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Regenerate token confirmation modal
  const [tableToRegenerate, setTableToRegenerate] = useState<TableWithQR | null>(null);
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
      showNotification('success', `Downloaded QR image for ${table.tableNumber}`);
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
    showNotification('success', `Downloading all ${tablesWithQR.length} QR code images...`);
  };

  // Regenerate single table QR token
  const handleConfirmRegenerateToken = async () => {
    if (!tableToRegenerate) return;
    try {
      setIsRegenerating(true);
      const res = await api.regenerateTableToken(tableToRegenerate.id);
      await loadQRCodes();
      if (onRefreshData) onRefreshData();
      showNotification('success', `New secure QR token minted for ${res.table.tableNumber}. Old printed QR codes are now invalidated.`);
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
      showNotification('success', `Successfully regenerated unique secure QR tokens for all tables.`);
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
      showNotification('success', `Table ${editingTable.tableNumber} saved successfully with unique QR code generated.`);
      setEditingTable(null);
    } catch (err: any) {
      setModalError(err.message || 'Failed to save table');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete table
  const handleDeleteTable = async (table: TableWithQR) => {
    if (table.status === 'occupied') {
      alert(`Cannot delete ${table.tableNumber} because it currently has an active dining session.`);
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to delete ${table.tableNumber}? Its QR code will stop functioning.`);
    if (!confirmed) return;

    try {
      await api.deleteAdminTable(table.id);
      await loadQRCodes();
      if (onRefreshData) onRefreshData();
      showNotification('success', `${table.tableNumber} removed successfully.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete table');
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

  // Filter sections
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

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-28">
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
                className="border-2 border-stone-900 rounded-3xl p-6 flex flex-col items-center justify-between text-center bg-white shadow-none break-inside-avoid"
                style={{ minHeight: '380px' }}
              >
                {/* Stand Header */}
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

                {/* QR Code Graphic */}
                <div className="p-4 bg-white border border-stone-300 rounded-2xl shadow-xs my-2">
                  <img
                    src={table.qrCodeDataUrl}
                    alt={`QR Code for ${table.tableNumber}`}
                    className="w-52 h-52 object-contain"
                  />
                </div>

                {/* Instructions */}
                <div className="w-full pt-4 border-t-2 border-dashed border-stone-300 space-y-1">
                  <p className="text-sm font-black text-stone-900">
                    Scan with Phone Camera to Order
                  </p>
                  <p className="text-[11px] text-stone-600">
                    1. Point camera at QR &nbsp;•&nbsp; 2. Browse menu &nbsp;•&nbsp; 3. Order directly to kitchen
                  </p>
                  <p className="text-[9px] font-mono text-stone-400 pt-1">
                    Token: {table.tableToken?.slice(0, 16) || 'SECURE'} • Table ID: {table.id}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Screen Interface (Hidden during print) */}
      <div className="no-print">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-5 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500/10 text-amber-800 rounded-lg">
                  <QrCode className="w-5 h-5 text-amber-600" />
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
                  Table QR Codes & Ordering Security
                </h1>
              </div>
              <p className="text-xs text-stone-500">
                Every café table has a cryptographically unique QR code. Customers scanning are automatically bound to their specific table.
              </p>
            </div>

            {/* Global Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => {
                  setSinglePrintTable(null);
                  window.print();
                }}
                className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print All Stand Cards</span>
              </button>

              <button
                onClick={handleDownloadAllQRs}
                className="px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-stone-500" />
                <span>Download All QR Codes</span>
              </button>

              <button
                onClick={() => setIsRegeneratingAll(true)}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                title="Invalidate old printed QR codes and issue fresh tokens"
              >
                <RefreshCw className="w-4 h-4 text-amber-700" />
                <span>Regenerate All Tokens</span>
              </button>

              <button
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
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Table</span>
              </button>
            </div>
          </div>
        </header>

        {/* Action Notification Toast */}
        {actionMessage && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
            <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between border shadow-sm ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {actionMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{actionMessage.text}</span>
              </div>
              <button
                onClick={() => setActionMessage(null)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Security & Token Banner */}
          <div className="bg-amber-950/10 border border-amber-900/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Server-Enforced Table Identity & Token Verification
                </h3>
                <p className="text-xs text-amber-800/80 leading-relaxed max-w-3xl">
                  Each QR code contains a unique, validated table identifier and cryptographic token. Customers cannot switch or spoof tables by editing URL numbers, cannot view other tables' orders, and cannot access management features.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 text-xs font-semibold text-amber-900 bg-white/80 px-3 py-1.5 rounded-xl border border-amber-200">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>{tablesWithQR.length} Configured Tables</span>
            </div>
          </div>

          {/* Search & Section Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setSectionFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  sectionFilter === 'all'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                All Sections ({tablesWithQR.length})
              </button>
              {sections.map(sec => {
                const count = tablesWithQR.filter(t => t.section === sec).length;
                return (
                  <button
                    key={sec}
                    onClick={() => setSectionFilter(sec)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                      sectionFilter === sec
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                    }`}
                  >
                    {sec} ({count})
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search tables (e.g. Table 1, Terrace)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-3 pr-8 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Table Cards Grid */}
          {isLoading ? (
            <div className="p-16 text-center text-xs text-stone-400 bg-white rounded-2xl border border-stone-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
              Generating high-resolution validated QR codes...
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="p-12 text-center text-xs text-stone-500 bg-white rounded-2xl border border-stone-200">
              No tables matching your filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTables.map(table => (
                <article
                  key={table.id}
                  className="bg-white rounded-2xl border border-stone-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Top Card Header */}
                  <div>
                    <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                          <Coffee className="w-3.5 h-3.5" />
                          <span>High Quality Cafe</span>
                        </div>
                        <h2 className="text-xl font-bold font-display text-white">
                          {table.tableNumber}
                        </h2>
                        <p className="text-[11px] text-stone-400">
                          {table.section} {table.capacity > 0 ? `· Seats ${table.capacity}` : '· Takeaway'}
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase block text-center ${
                          table.status === 'occupied'
                            ? 'bg-amber-500 text-stone-950 font-bold animate-pulse'
                            : 'bg-emerald-600 text-white font-semibold'
                        }`}>
                          {table.status}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400 block">
                          ID: {table.id}
                        </span>
                      </div>
                    </div>

                    {/* QR Code Presentation Canvas */}
                    <div className="p-6 flex flex-col items-center justify-center bg-stone-50/60 border-b border-stone-100 space-y-3">
                      <div className="p-3 bg-white rounded-2xl border border-stone-200 shadow-sm relative group">
                        <img
                          src={table.qrCodeDataUrl}
                          alt={`QR Code for ${table.tableNumber}`}
                          className="w-44 h-44 object-contain"
                        />
                        <div className="absolute inset-0 bg-stone-950/70 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDownloadSingleQR(table)}
                            className="p-2 bg-white text-stone-900 rounded-lg text-xs font-semibold hover:bg-stone-100 flex items-center gap-1 cursor-pointer shadow-md"
                            title="Download PNG"
                          >
                            <Download className="w-4 h-4" />
                            <span>PNG</span>
                          </button>
                          <button
                            onClick={() => handlePrintSingle(table)}
                            className="p-2 bg-amber-500 text-stone-950 rounded-lg text-xs font-semibold hover:bg-amber-400 flex items-center gap-1 cursor-pointer shadow-md"
                            title="Print Card"
                          >
                            <Printer className="w-4 h-4" />
                            <span>Print</span>
                          </button>
                        </div>
                      </div>

                      <div className="text-center space-y-1 max-w-xs">
                        <p className="text-xs font-bold text-stone-800">
                          Scan to Order for {table.tableNumber}
                        </p>
                        <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg break-all">
                          <span className="truncate">{table.qrUrl}</span>
                          <button
                            onClick={() => handleCopyUrl(table)}
                            className="p-1 text-stone-400 hover:text-stone-700 shrink-0 cursor-pointer"
                            title="Copy link"
                          >
                            {copiedTableId === table.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center justify-center gap-1 text-[10px] text-stone-400 pt-0.5">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Token: {table.tableToken ? `${table.tableToken.slice(0, 14)}...` : 'Active'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Controls */}
                  <div className="p-3.5 bg-white space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => onSelectTableForCustomerView(table.id, table.tableToken)}
                        className="flex-1 py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Simulate customer scanning this table's QR code"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
                        <span>Test Customer View</span>
                      </button>

                      <button
                        onClick={() => handlePrintSingle(table)}
                        className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Print single stand tent card"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                      <button
                        onClick={() => setTableToRegenerate(table)}
                        className="text-stone-500 hover:text-amber-800 flex items-center gap-1 font-medium cursor-pointer"
                        title="Regenerate security token"
                      >
                        <RefreshCw className="w-3 h-3 text-stone-400" />
                        <span>Regenerate Token</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setModalError(null);
                            setEditingTable({ ...table });
                          }}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg cursor-pointer"
                          title="Edit table details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTable(table)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete table"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: Add or Edit Table */}
      {editingTable && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900 font-display">
                {tablesWithQR.some(t => t.id === editingTable.id) ? 'Edit Café Table' : 'Add New Café Table'}
              </h3>
              <button
                onClick={() => setEditingTable(null)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTable} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Table Identifier (ID)
                </label>
                <input
                  type="text"
                  required
                  value={editingTable.id || ''}
                  onChange={(e) => setEditingTable({ ...editingTable, id: e.target.value.toUpperCase() })}
                  placeholder="e.g. T09, T10, BALCONY_1"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono"
                />
                <span className="text-[10px] text-stone-400 mt-0.5 block">
                  Short unique code used in the system
                </span>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Table Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editingTable.tableNumber || ''}
                  onChange={(e) => setEditingTable({ ...editingTable, tableNumber: e.target.value })}
                  placeholder="e.g. Table 9, Window Table 3"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    Seating Capacity
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    required
                    value={editingTable.capacity !== undefined ? editingTable.capacity : 4}
                    onChange={(e) => setEditingTable({ ...editingTable, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    Café Section
                  </label>
                  <select
                    value={editingTable.section || 'Main Hall'}
                    onChange={(e) => setEditingTable({ ...editingTable, section: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="Main Hall">Main Hall</option>
                    <option value="Window Terrace">Window Terrace</option>
                    <option value="Balcony Lounge">Balcony Lounge</option>
                    <option value="Quick Pick-up">Quick Pick-up</option>
                    <option value="Outdoor Garden">Outdoor Garden</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save & Generate QR Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Regenerate Single Table Token Confirmation */}
      {tableToRegenerate && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 font-display">
                  Regenerate QR Token?
                </h3>
                <p className="text-xs text-stone-500">
                  {tableToRegenerate.tableNumber} ({tableToRegenerate.id})
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Generating a new cryptographic security token will update the QR code for <strong>{tableToRegenerate.tableNumber}</strong>. Any previously printed stand cards or saved bookmarks for this table will no longer be accepted for customer ordering until reprinted.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTableToRegenerate(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs rounded-xl font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRegenerateToken}
                disabled={isRegenerating}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-xl font-bold transition-colors cursor-pointer"
              >
                {isRegenerating ? 'Minting Token...' : 'Yes, Generate New Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Regenerate All Tokens Confirmation */}
      {isRegeneratingAll && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 font-display">
                  Regenerate All Table Tokens?
                </h3>
                <p className="text-xs text-stone-500">
                  System-Wide QR Security Rotation
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              This will simultaneously regenerate new cryptographic tokens for all {tablesWithQR.length} tables. You will need to reprint all table tent cards for guests.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRegeneratingAll(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs rounded-xl font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRegenerateAllTokens}
                disabled={isRegenerating}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-xl font-bold transition-colors cursor-pointer"
              >
                {isRegenerating ? 'Rotating All...' : 'Rotate All Tokens'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
