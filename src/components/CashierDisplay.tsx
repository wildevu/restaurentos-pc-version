import React, { useState, useMemo } from 'react';
import type { Table, Order } from '../types';
import { executeCommand } from '../offline';
import { useI18n } from '../i18n';
import { 
  Receipt, 
  Search, 
  Clock, 
  User, 
  Printer, 
  UtensilsCrossed, 
  CheckCircle2, 
  Layers,
  X,
  Check,
  FileText
} from 'lucide-react';

interface Props {
  tables: Table[];
  orders: Order[];
  restaurantName?: string;
  currency?: string;
  onDispatchCommand?: (command: any) => Promise<any>;
}

export function CashierDisplay({ 
  tables, 
  orders, 
  restaurantName = 'RestaurantOS', 
  currency = 'USD',
  onDispatchCommand 
}: Props) {
  const { t, formatCurrency, formatDateTime } = useI18n();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Active unarchived tables
  const allActiveTables = useMemo(() => tables.filter(t => !t.archivedAt), [tables]);
  const sections = useMemo(() => Array.from(new Set(allActiveTables.map(t => t.section || 'Main Dining'))), [allActiveTables]);

  // Tables with an open active order
  const tablesWithActiveOrders = useMemo(() => {
    return allActiveTables.filter(t => {
      if (t.status !== 'ACTIVE' || !t.orderId) return false;
      const order = orders.find(o => o.id === t.orderId && o.status === 'OPEN');
      return !!order;
    });
  }, [allActiveTables, orders]);

  // Filtered list based on search and section
  const filteredActiveTables = useMemo(() => {
    return tablesWithActiveOrders.filter(t => {
      if (sectionFilter !== 'ALL' && (t.section || 'Main Dining') !== sectionFilter) return false;
      
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const numMatch = String(t.number).includes(query);
        const labelMatch = t.label?.toLowerCase().includes(query);
        const secMatch = t.section?.toLowerCase().includes(query);
        
        const order = orders.find(o => o.id === t.orderId);
        const serverMatch = order?.openedByUserName?.toLowerCase().includes(query);
        
        return numMatch || labelMatch || secMatch || serverMatch;
      }
      return true;
    });
  }, [tablesWithActiveOrders, sectionFilter, searchTerm, orders]);

  // Total balance currently active across all open tables
  const totalActiveBalance = useMemo(() => {
    return tablesWithActiveOrders.reduce((sum, t) => {
      const order = orders.find(o => o.id === t.orderId && o.status === 'OPEN');
      const orderTotal = order?.items?.reduce((iSum, i) => iSum + (i.price * i.quantity), 0) || 0;
      return sum + orderTotal;
    }, 0);
  }, [tablesWithActiveOrders, orders]);

  // Currently inspected table for receipt modal
  const activeModalTable = useMemo(() => {
    if (!selectedTableId) return null;
    return tables.find(t => t.id === selectedTableId) || null;
  }, [selectedTableId, tables]);

  const activeModalOrder = useMemo(() => {
    if (!activeModalTable || !activeModalTable.orderId) return null;
    return orders.find(o => o.id === activeModalTable.orderId && o.status === 'OPEN') || null;
  }, [activeModalTable, orders]);

  // Calculations for active order in modal
  const { subtotal, totalItems } = useMemo(() => {
    if (!activeModalOrder || !activeModalOrder.items) return { subtotal: 0, totalItems: 0 };
    const items = activeModalOrder.items;
    const sub = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    return { subtotal: sub, totalItems: count };
  }, [activeModalOrder]);

  const getElapsedTimeString = (createdAtStr?: string) => {
    if (!createdAtStr) return t('common.justNow', 'Just now');
    const start = new Date(createdAtStr).getTime();
    if (isNaN(start)) return t('common.justNow', 'Just now');
    const elapsedMinutes = Math.floor((Date.now() - start) / 60000);
    if (elapsedMinutes < 1) return t('common.lessThanMinute', '< 1 min');
    if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleCloseAndClearTable = async () => {
    if (!activeModalTable) return;
    setIsProcessing(true);
    try {
      if (onDispatchCommand) {
        await onDispatchCommand({ type: 'CLOSE_TABLE', payload: { tableId: activeModalTable.id } });
      } else {
        await executeCommand('CLOSE_TABLE', { tableId: activeModalTable.id });
      }
      setShowConfirmModal(false);
      setSelectedTableId(null);
    } catch (err) {
      console.error('Failed to clear table:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full pb-16 px-1 sm:px-0">
      {/* CASHIER TOP BANNER & STATS */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Receipt className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-black text-gray-900">{t('cashier.title', 'Cashier Terminal')}</h1>
              <span className="px-2.5 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 font-extrabold text-[11px] sm:text-xs rounded-full">
                {tablesWithActiveOrders.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              {t('cashier.subtitle', 'Guest check settlement, itemized billing, and table clearance')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="flex-1 md:flex-initial bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
            <div className="text-xs font-semibold text-gray-500">
              {t('tables.activeFilter', 'Active')}:
            </div>
            <div className="text-sm sm:text-base font-black text-gray-900">
              {tablesWithActiveOrders.length}
            </div>
          </div>

          <div className="flex-1 md:flex-initial bg-teal-50 border border-teal-200 rounded-xl sm:rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
            <div className="text-xs font-semibold text-teal-700">
              {t('cashier.totalBalanceDue', 'Total Due')}:
            </div>
            <div className="text-sm sm:text-base font-black text-teal-800">
              {formatCurrency(totalActiveBalance, currency)}
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH AND AREA FILTERS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-white p-3 sm:p-3.5 rounded-2xl border border-gray-200 shadow-xs">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('cashier.searchPlaceholder', 'Search table #, label, or server...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Section Tabs */}
        {sections.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              onClick={() => setSectionFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[36px] ${
                sectionFilter === 'ALL'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('common.allAreas', 'All Areas')}
            </button>
            {sections.map(sec => (
              <button
                key={sec}
                onClick={() => setSectionFilter(sec)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer min-h-[36px] ${
                  sectionFilter === sec
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ACTIVE TABLES GRID (100% Mobile-First) */}
      {filteredActiveTables.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            <CheckCircle2 size={30} />
          </div>
          <h3 className="text-base sm:text-lg font-black text-gray-900">{t('cashier.noActiveTables', 'No active tables with balances currently open.')}</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 font-medium">
            {searchTerm || sectionFilter !== 'ALL' 
              ? t('tables.noTablesMatch', 'No tables match your filter.') 
              : t('cashier.noActiveTables', 'All guest checks are settled and tables are currently clear.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredActiveTables.map((table) => {
            const order = orders.find(o => o.id === table.orderId && o.status === 'OPEN');
            const orderTotal = order?.items?.reduce((sum, i) => sum + (i.price * i.quantity), 0) || 0;
            const itemCount = order?.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
            const orderCurrency = order?.currencySnapshot || currency;

            const allServed = order?.items && order.items.length > 0 && order.items.every(i => i.kitchenStatus === 'SERVED');
            const hasPending = order?.items?.some(i => i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'PREPARING');

            return (
              <div
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                className="w-full min-w-0 bg-white hover:bg-teal-50/20 active:scale-[0.99] border-2 border-gray-200 hover:border-teal-400 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs transition-all flex flex-col justify-between group cursor-pointer overflow-hidden"
              >
                <div>
                  {/* Card Top: Table badge, Name, Section, Elapsed */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 bg-teal-600 group-hover:bg-teal-700 text-white rounded-xl flex items-center justify-center font-black text-base shadow-xs transition-colors shrink-0">
                        T{table.number}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-gray-900 text-sm sm:text-base truncate">
                          {table.label || t('tables.tableNumber', `Table ${table.number}`, { number: table.number })}
                        </div>
                        <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1 truncate">
                          <Layers size={11} className="shrink-0 text-gray-400" />
                          <span className="truncate">{table.section || t('common.allAreas', 'Main Dining')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Clock size={10} /> {getElapsedTimeString(order?.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Card Middle: Server & Dish details */}
                  <div className="space-y-1.5 py-2 border-y border-gray-100 text-xs">
                    <div className="flex items-center justify-between text-gray-600">
                      <span className="flex items-center gap-1 truncate text-gray-500">
                        <User size={12} className="text-gray-400 shrink-0" /> {t('order.server', 'Serveur')} :
                      </span>
                      <span className="font-bold text-gray-800 truncate max-w-[120px]">
                        {order?.openedByUserName || 'Staff'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600">
                      <span className="flex items-center gap-1 text-gray-500">
                        <UtensilsCrossed size={12} className="text-gray-400 shrink-0" /> {t('cashier.receiptArticles', 'articles')} :
                      </span>
                      <span className="font-black text-gray-800">
                        {itemCount}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-gray-500 font-medium">{t('common.status', 'Statut')} :</span>
                      {allServed ? (
                        <span className="px-2 py-0.5 text-[10px] font-black bg-blue-100 text-blue-800 rounded-full flex items-center gap-0.5">
                          <Check size={10} /> {t('tables.allServedBadge', 'Tout Servi')}
                        </span>
                      ) : hasPending ? (
                        <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-800 rounded-full">
                          {t('tables.kitchenPrepBadge', 'En Cuisine')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-100 text-emerald-800 rounded-full">
                          {t('common.active', 'Actif')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Clean Stacked Balance & Détail Button (Never overflows) */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-2">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400 truncate">
                      {t('cashier.totalBalanceDue', 'Total')}
                    </span>
                    <span className="text-base sm:text-lg font-black text-teal-800 tracking-tight shrink-0">
                      {formatCurrency(orderTotal, orderCurrency)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTableId(table.id);
                    }}
                    className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-black shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]"
                  >
                    <FileText size={14} />
                    <span>{t('cashier.orderDetailsBtn', 'Détail de la Commande')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIRECT GUEST CHECK RECEIPT TICKET MODAL */}
      {activeModalTable && activeModalOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
                  <Printer size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-gray-900">
                    {t('cashier.printGuestCheck', "Reçu d'Addition Client")}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-bold">
                    {t('tables.tableNumber', `Table ${activeModalTable.number}`, { number: activeModalTable.number })} • {activeModalTable.section || t('common.allAreas', 'Main Dining')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTableId(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
                title={t('common.close', 'Fermer')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Receipt Body (Exact Thermal Guest Check Style) */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-gray-50/50">
              <div 
                id="printable-receipt" 
                className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/80 shadow-xs font-mono text-xs sm:text-sm text-gray-900 space-y-3.5 max-w-sm mx-auto"
              >
                {/* Restaurant Brand Header */}
                <div className="text-center space-y-1 pb-3 border-b border-dashed border-gray-300">
                  <h2 className="text-base sm:text-lg font-black tracking-wider uppercase text-gray-900">
                    {restaurantName || 'BISTO'}
                  </h2>
                  <p className="text-gray-500 text-xs font-semibold">
                    {t('nav.localHub', 'Hub Local')}
                  </p>
                  <p className="text-gray-400 text-[11px]">
                    {formatDateTime(activeModalOrder.createdAt ? new Date(activeModalOrder.createdAt) : new Date())}
                  </p>
                </div>

                {/* Table & Server Info Row */}
                <div className="flex items-center justify-between py-1.5 border-b border-dashed border-gray-300 text-xs font-bold">
                  <span>
                    {t('cashier.table', 'Table')}: <strong>{activeModalTable.number} ({activeModalTable.section || t('common.allAreas', 'Main Dining')})</strong>
                  </span>
                  <span>
                    {t('order.server', 'Serveur')} : <strong>{activeModalOrder.openedByUserName || 'Staff'}</strong>
                  </span>
                </div>

                {/* Itemized Dish List */}
                <div className="space-y-2 py-1">
                  {activeModalOrder.items && activeModalOrder.items.length > 0 ? (
                    activeModalOrder.items.map((item) => (
                      <div key={item.id} className="space-y-0.5">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-bold text-gray-900">
                            {item.quantity}x {item.name}
                          </span>
                          <span className="font-black text-gray-900 shrink-0">
                            {formatCurrency(item.price * item.quantity, activeModalOrder.currencySnapshot || currency)}
                          </span>
                        </div>
                        {item.notes && (
                          <div className="text-[11px] text-gray-500 italic pl-3">
                            * {item.notes}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-400 text-xs">
                      {t('order.emptyOrderMessage', 'No items in this order.')}
                    </div>
                  )}
                </div>

                {/* Totals & Summary */}
                <div className="border-t border-dashed border-gray-300 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-600 font-semibold">
                    <span>{t('cashier.receiptArticles', 'articles')} :</span>
                    <span className="font-black text-gray-900">{totalItems}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 font-semibold">
                    <span>{t('cashier.receiptSubtotal', 'Sous-total')} :</span>
                    <span className="font-black text-gray-900">{formatCurrency(subtotal, activeModalOrder.currencySnapshot || currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base font-black text-gray-900 pt-2 border-t border-dashed border-gray-300">
                    <span>{t('cashier.receiptTotal', 'Total')} :</span>
                    <span>{formatCurrency(subtotal, activeModalOrder.currencySnapshot || currency)}</span>
                  </div>
                </div>

                <div className="text-center pt-3 border-t border-dashed border-gray-300 text-[10px] text-gray-400">
                  <p>{t('cashier.printTip', 'Merci de votre visite !')}</p>
                </div>
              </div>
            </div>

            {/* Modal Bottom Action Controls (Print, Clear, Close) */}
            <div className="p-3.5 sm:p-4 border-t border-gray-200 bg-white flex flex-col sm:flex-row items-center gap-2.5 shrink-0 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:flex-1 py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-black text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 min-h-[42px] cursor-pointer"
              >
                <Printer size={15} />
                <span>{t('cashier.printReceiptBtn', "Imprimer l'Addition")}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="w-full sm:flex-[1.5] py-2.5 px-4 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 min-h-[42px] cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>{t('cashier.settleAndFreeTableBtn', 'Encaisser & Libérer')}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTableId(null)}
                className="w-full sm:w-auto py-2.5 px-3 text-gray-500 hover:text-gray-800 hover:bg-gray-100 font-bold text-xs rounded-xl transition-colors cursor-pointer min-h-[42px]"
              >
                {t('cashier.closeBtn', 'Fermer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR CLEARING TABLE */}
      {showConfirmModal && activeModalTable && activeModalOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-60 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-center space-y-4 border border-gray-200">
            <div className="w-14 h-14 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Receipt size={28} />
            </div>

            <div>
              <h3 className="text-lg font-black text-gray-900">
                {t('cashier.confirmPaidTitle', `Confirmer le Règlement & Libérer la Table ${activeModalTable.number} ?`, { number: activeModalTable.number })}
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-1">
                {t('cashier.confirmPaidMessage', `Confirmez que le client a réglé l'addition. Cette action clôturera la commande et libérera la Table ${activeModalTable.number}.`, { number: activeModalTable.number })}
              </p>
            </div>

            <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-2xl">
              <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">{t('cashier.totalBalanceDue', 'Total')}</div>
              <div className="text-2xl font-black text-teal-900 mt-0.5">
                {formatCurrency(subtotal, activeModalOrder.currencySnapshot || currency)}
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer min-h-[42px]"
              >
                {t('common.cancel', 'Annuler')}
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCloseAndClearTable}
                className="flex-[1.5] py-2.5 px-3 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
              >
                {isProcessing ? (
                  <span>{t('common.loading', 'Processing...')}</span>
                ) : (
                  <>
                    <Check size={15} />
                    <span>{t('cashier.confirmPaidBtn', 'Confirmer & Libérer')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
