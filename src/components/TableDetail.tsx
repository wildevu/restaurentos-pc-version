import React, { useState, useMemo } from 'react';
import { executeCommand } from '../offline';
import { useI18n } from '../i18n';
import type { Table, Order } from '../types';
import { 
  ChevronLeft, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  Search, 
  X,
  MessageSquare,
  UtensilsCrossed,
  ShoppingBag,
  Bell,
  CheckCircle2,
  CheckCheck,
  Users
} from 'lucide-react';
import { CoversModal } from './CoversModal';

interface Props {
  table: Table;
  order: Order | null;
  menu: any[];
  onBack: () => void;
  currency?: string;
}

export function TableDetail({ table, order, menu, onBack, currency = 'USD' }: Props) {
  const { t, formatCurrency } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showCoversModal, setShowCoversModal] = useState<boolean>(false);
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOrderSheet, setShowOrderSheet] = useState(false);

  const quickNotes = [
    'No Onions',
    'Extra Spicy',
    'Gluten Free',
    'Dressing on Side',
    'No Dairy',
    'To-Go',
    'Allergy Alert',
    'Less Salt',
    'Well Done',
    'Sauce on Side'
  ];

  const activeCurrency = order?.currencySnapshot || currency;

  const dispatchCommand = async (type: string, payload: any, callback?: () => void) => {
    try {
      setIsProcessing(true);
      await executeCommand(type, payload);
      if (callback) callback();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenTable = () => {
    setShowCoversModal(true);
  };

  const handleConfirmCovers = (coversCount: number) => {
    setShowCoversModal(false);
    dispatchCommand('OPEN_TABLE', { tableId: table.id, covers: coversCount });
  };

  const handleAddItem = (menuItem: any) => {
    dispatchCommand('ADD_ITEM', { 
      tableId: table.id, 
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price 
    });
  };

  const handleIncrement = (orderItemId: string) => {
    dispatchCommand('INCREMENT_ITEM', { tableId: table.id, orderItemId });
  };

  const handleDecrement = (orderItemId: string) => {
    dispatchCommand('DECREMENT_ITEM', { tableId: table.id, orderItemId });
  };

  const handleRemove = (orderItemId: string) => {
    dispatchCommand('REMOVE_ITEM', { tableId: table.id, orderItemId });
  };

  const handleMarkItemServed = (orderItemId: string) => {
    dispatchCommand('UPDATE_ITEM_KITCHEN_STATUS', { orderItemId, status: 'SERVED' });
  };

  const handleOpenNoteEditor = (item: any) => {
    setEditingNoteItemId(item.id);
    setNoteValue(item.notes || '');
  };

  const handleSaveNote = () => {
    if (!editingNoteItemId) return;
    dispatchCommand('SET_ITEM_NOTE', { 
      tableId: table.id, 
      orderItemId: editingNoteItemId, 
      notes: noteValue.trim() 
    }, () => {
      setEditingNoteItemId(null);
      setNoteValue('');
    });
  };

  // Filtered menu items
  const filteredMenu = useMemo(() => {
    const allItems = menu.flatMap(cat => 
      (cat.items || []).map((item: any) => ({ ...item, categoryId: cat.id, categoryName: cat.name }))
    );

    let list = allItems;
    if (selectedCategoryId) {
      list = list.filter(item => item.categoryId === selectedCategoryId);
    }

    const term = searchTerm.trim().toLowerCase();
    if (!term) return list;

    return list
      .filter(item => item.name.toLowerCase().includes(term) || (item.description && item.description.toLowerCase().includes(term)))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === term;
        const bExact = bName === term;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return aName.localeCompare(bName);
      });
  }, [menu, selectedCategoryId, searchTerm]);

  // Order summary metrics & partial readiness calculations
  const { totalItems, subtotal } = useMemo(() => {
    if (!order || !order.items) return { totalItems: 0, subtotal: 0 };
    const count = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const total = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    return { totalItems: count, subtotal: total };
  }, [order]);

  const readyItems = useMemo(() => {
    return (order?.items || []).filter((i: any) => i.kitchenStatus === 'READY');
  }, [order?.items]);

  const readyCount = useMemo(() => {
    return readyItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
  }, [readyItems]);

  const allItemsReadyOrServed = useMemo(() => {
    if (!order?.items || order.items.length === 0) return false;
    return order.items.every((i: any) => i.kitchenStatus === 'READY' || i.kitchenStatus === 'SERVED');
  }, [order?.items]);

  const allItemsServed = useMemo(() => {
    if (!order?.items || order.items.length === 0) return false;
    return order.items.every((i: any) => i.kitchenStatus === 'SERVED');
  }, [order?.items]);

  const formatPrice = (price: number) => {
    return formatCurrency(price, activeCurrency);
  };

  const getKitchenStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-800 rounded-full">{t('order.pending', 'Pending')}</span>;
      case 'PREPARING':
        return <span className="px-2 py-0.5 text-[10px] font-extrabold bg-orange-100 text-orange-800 rounded-full animate-pulse">{t('order.preparing', 'Prep')}</span>;
      case 'READY':
        return <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-500 text-white rounded-full animate-pulse flex items-center gap-1"><Bell size={10} /> {t('order.ready', 'Ready')}</span>;
      case 'SERVED':
        return <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-800 rounded-full flex items-center gap-1"><Check size={10} /> {t('order.served', 'Served')}</span>;
      default:
        return null;
    }
  };

  // If table is empty, show Open Table prompt
  if (!order || table.status === 'EMPTY') {
    return (
      <div className="h-full flex flex-col justify-between max-w-xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-3 bg-white hover:bg-gray-100 text-gray-700 rounded-2xl border border-gray-200 shadow-xs min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronLeft size={22} />
          </button>
          <div>
            <h2 className="text-xl font-black text-gray-900">
              {t('tables.tableNumber', `Table ${table.number}`, { number: table.number })} {table.label ? `(${table.label})` : ''}
            </h2>
            <p className="text-xs text-gray-500 font-medium">{table.section || t('common.allAreas', 'Main Dining')}</p>
          </div>
        </div>

        <CoversModal
          isOpen={showCoversModal}
          tableNumber={table.number}
          tableName={table.label}
          onSelectCovers={handleConfirmCovers}
        />

        <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center shadow-xs my-auto space-y-4">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <UtensilsCrossed size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900">{t('order.tableAvailableTitle', 'Table is Currently Available')}</h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1 font-medium">
              {t('order.tableAvailableDesc', `Start an active order to begin taking items for Table ${table.number}.`, { number: table.number })}
            </p>
          </div>
          <button
            onClick={handleOpenTable}
            disabled={isProcessing}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-base rounded-2xl shadow-md active:scale-[0.98] transition-all min-h-[52px] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={20} />
            <span>{t('order.openTableBtn', 'Open Table & Take Order')}</span>
          </button>
        </div>

        <div />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pb-24 lg:pb-6 relative space-y-4">
      {/* STICKY TOP HEADER */}
      <div className="bg-white border-b border-gray-200 p-3 sm:p-4 -mx-6 -mt-6 sticky top-0 z-10 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
              title={t('common.back', 'Back')}
            >
              <ChevronLeft size={22} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black text-gray-900">
                  {t('tables.tableNumber', `Table ${table.number}`, { number: table.number })}
                </span>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-extrabold rounded-full">
                  {t('tables.activeBadge', 'Active')}
                </span>
                {order?.covers && (
                  <span className="flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                    <Users size={12} /> {order.covers} {order.covers === 1 ? 'Personne' : 'Personnes'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                {table.section || t('common.allAreas', 'Main Dining')} &bull; {t('order.serverLabel', `Server: ${order.openedByUserName || 'Staff'}`, { name: order.openedByUserName || 'Staff' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Order Review Button for Small Screens */}
            <button
              onClick={() => setShowOrderSheet(!showOrderSheet)}
              className="lg:hidden flex items-center gap-2 px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-black text-xs min-h-[44px] cursor-pointer"
            >
              <ShoppingBag size={16} />
              <span>{totalItems} {t('common.items', 'items')} ({formatPrice(subtotal)})</span>
            </button>
          </div>
        </div>

        {/* Search & Category Chips Bar */}
        <div className="space-y-2">
          {/* Menu Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('order.searchMenuPlaceholder', 'Search menu items...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          {/* Category Filter Horizontal Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all shrink-0 min-h-[36px] cursor-pointer ${
                selectedCategoryId === null
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t('order.allItems', 'All Items')}
            </button>
            {menu.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all shrink-0 min-h-[36px] cursor-pointer ${
                  selectedCategoryId === cat.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name} ({cat.items?.length || 0})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* REAL-TIME KITCHEN READINESS BANNER */}
      {readyCount > 0 && !allItemsServed && (
        <div className="bg-emerald-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-md border border-emerald-700 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="font-black text-sm sm:text-base">
                {readyCount === 1
                  ? t('order.partialReadyBanner', '🔔 1 plat prêt à servir : {items}', { count: 1, items: readyItems.map(i => `${i.quantity > 1 ? `${i.quantity}x ` : ''}${i.name}`).join(', ') })
                  : t('order.partialReadyBannerPlural', '🔔 {count} plats prêts à servir : {items}', { count: readyCount, items: readyItems.map(i => `${i.quantity > 1 ? `${i.quantity}x ` : ''}${i.name}`).join(', ') })
                }
              </div>
              <div className="text-xs text-emerald-100 font-medium">
                {t('order.readyForPickup', 'Prêt en cuisine - Touchez "Servir" sur le plat que vous apportez à table :')}
              </div>
            </div>
          </div>

          {/* Individual Ready Item Chips with direct "Servir" buttons */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-emerald-500/60">
            {readyItems.map((item: any) => (
              <div 
                key={item.id} 
                className="flex items-center gap-2 bg-white text-emerald-950 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-xs text-xs font-black"
              >
                <span>{item.quantity > 1 ? `${item.quantity}x ` : ''}{item.name}</span>
                <button
                  type="button"
                  onClick={() => handleMarkItemServed(item.id)}
                  disabled={isProcessing}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 size={13} />
                  <span>{t('order.markItemServed', 'Servir')}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN SPLIT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* LEFT COLUMN: Menu Items Grid */}
        <div className="lg:col-span-7 xl:col-span-8 overflow-y-auto pr-1">
          {filteredMenu.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">{t('order.noItemsFound', 'No menu items found')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {filteredMenu.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => handleAddItem(item)}
                  className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 hover:border-blue-400 hover:shadow-md text-left transition-all active:scale-[0.98] flex items-center justify-between gap-3 shadow-2xs group cursor-pointer min-h-[72px]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-gray-900 text-sm truncate group-hover:text-blue-600">
                      {item.name}
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5 font-medium">
                        {item.description}
                      </p>
                    )}
                    <div className="text-sm font-black text-gray-900 mt-1">
                      {formatPrice(item.price)}
                    </div>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                    <Plus size={20} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Active Order List (Desktop) */}
        <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 flex-col bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden h-[calc(100vh-220px)]">
          {/* Order Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-blue-600" />
              <h3 className="text-sm font-black text-gray-900">{t('order.currentOrder', 'Current Order')}</h3>
            </div>
            <span className="text-xs font-bold text-gray-600 bg-gray-200 px-2.5 py-0.5 rounded-full">
              {totalItems} {t('common.items', 'items')}
            </span>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-3 space-y-2">
            {order.items && order.items.length > 0 ? (
              order.items.map((item: any) => {
                const isReady = item.kitchenStatus === 'READY';
                return (
                  <div 
                    key={item.id} 
                    className={`p-2.5 rounded-xl border space-y-2 transition-all ${
                      isReady 
                        ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-200' 
                        : 'bg-gray-50/70 border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-gray-900 text-sm">{item.name}</span>
                          {getKitchenStatusBadge(item.kitchenStatus)}
                        </div>
                        <div className="text-xs font-bold text-gray-600 mt-0.5">
                          {formatPrice(item.price * item.quantity)} ({formatPrice(item.price)} ea)
                        </div>
                      </div>

                      {/* Stepper +/- */}
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-0.5 shadow-2xs">
                        <button
                          onClick={() => handleDecrement(item.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 cursor-pointer"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-7 text-center font-black text-sm text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleIncrement(item.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 cursor-pointer"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Quick Serve Action for Waiter if READY */}
                    {isReady && (
                      <div className="pt-1">
                        <button
                          onClick={() => handleMarkItemServed(item.id)}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 size={13} />
                          <span>{t('order.markItemServed', 'Serve')}</span>
                        </button>
                      </div>
                    )}

                    {/* Notes display & action */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 text-xs">
                      <button
                        onClick={() => handleOpenNoteEditor(item)}
                        className="flex items-center gap-1.5 text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        <MessageSquare size={13} />
                        <span>{item.notes ? `${t('common.notes', 'Note')}: "${item.notes}"` : `+ ${t('order.addModifiers', 'Special Notes')}`}</span>
                      </button>

                      <button
                        onClick={() => handleRemove(item.id)}
                        className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                        title={t('common.remove', 'Remove item')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-gray-400">
                <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-semibold">{t('order.emptyOrderMessage', 'No items added yet')}</p>
              </div>
            )}
          </div>

          {/* Desktop Summary & Actions */}
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-bold text-gray-600">{t('order.totalLabel', 'Total')}:</span>
              <span className="text-2xl font-black text-gray-900">{formatPrice(subtotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM ACTION BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg z-30 flex items-center justify-between gap-3">
        <button
          onClick={() => setShowOrderSheet(true)}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white p-3 rounded-2xl flex items-center justify-between px-4 shadow-md active:scale-[0.98] transition-all min-h-[48px] cursor-pointer"
        >
          <div className="flex items-center gap-2 font-black text-sm">
            <ShoppingBag size={18} className="text-blue-400" />
            <span>{totalItems} {t('common.items', 'items')}</span>
          </div>
          <div className="font-black text-base text-blue-300">
            {formatPrice(subtotal)}
          </div>
        </button>
      </div>

      {/* MOBILE ORDER REVIEW DRAWER / SHEET */}
      {showOrderSheet && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Sheet Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-blue-600" />
                <h3 className="text-base font-black text-gray-900">
                  {t('order.reviewOrder', 'Review Order')} ({totalItems} {t('common.items', 'items')})
                </h3>
              </div>
              <button
                onClick={() => setShowOrderSheet(false)}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-xl cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sheet Items Scroll */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-gray-100 space-y-3">
              {order.items && order.items.length > 0 ? (
                order.items.map((item: any) => {
                  const isReady = item.kitchenStatus === 'READY';
                  return (
                    <div key={item.id} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-gray-900 text-sm">{item.name}</span>
                            {getKitchenStatusBadge(item.kitchenStatus)}
                          </div>
                          <div className="text-xs font-bold text-gray-500 mt-0.5">
                            {formatPrice(item.price * item.quantity)}
                          </div>
                        </div>

                        {/* Large Stepper Buttons for Mobile */}
                        <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-xl p-1">
                          <button
                            onClick={() => handleDecrement(item.id)}
                            className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-gray-700 shadow-2xs active:bg-gray-200 min-h-[36px] min-w-[36px] cursor-pointer"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-8 text-center font-black text-base text-gray-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleIncrement(item.id)}
                            className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-gray-700 shadow-2xs active:bg-gray-200 min-h-[36px] min-w-[36px] cursor-pointer"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Quick Serve Action for Waiter in Mobile Sheet */}
                      {isReady && (
                        <div className="pt-1">
                          <button
                            onClick={() => handleMarkItemServed(item.id)}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px]"
                          >
                            <CheckCircle2 size={14} />
                            <span>{t('order.markItemServed', 'Serve')}</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs pt-1">
                        <button
                          onClick={() => handleOpenNoteEditor(item)}
                          className="flex items-center gap-1 text-blue-600 font-bold py-1 cursor-pointer"
                        >
                          <MessageSquare size={13} />
                          <span>{item.notes ? `${t('common.notes', 'Note')}: "${item.notes}"` : `+ ${t('order.addModifiers', 'Special Notes')}`}</span>
                        </button>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="text-red-500 font-bold p-1 cursor-pointer"
                        >
                          {t('common.remove', 'Remove')}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm font-semibold">{t('order.emptyOrderMessage', 'No items added yet')}</p>
                </div>
              )}
            </div>

            {/* Sheet Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-gray-600">{t('order.subtotalLabel', 'Subtotal')}:</span>
                <span className="text-2xl font-black text-gray-900">{formatPrice(subtotal)}</span>
              </div>
              <button
                onClick={() => setShowOrderSheet(false)}
                className="w-full py-3 bg-blue-600 text-white font-black text-sm rounded-2xl shadow-md min-h-[48px] cursor-pointer"
              >
                + {t('menu.addItemBtn', 'Add More Items')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPECIAL ITEM NOTES MODAL */}
      {editingNoteItemId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-600" />
                {t('order.addModifiers', 'Item Modifiers & Notes')}
              </h3>
              <button
                onClick={() => setEditingNoteItemId(null)}
                className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Preset Tags */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                {t('order.quickModifiersTitle', 'Quick Modifiers:')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quickNotes.map(preset => (
                  <button
                    key={preset}
                    onClick={() => {
                      if (noteValue.includes(preset)) {
                        setNoteValue(noteValue.replace(preset, '').replace(/,\s*,/g, ',').trim());
                      } else {
                        setNoteValue(noteValue ? `${noteValue}, ${preset}` : preset);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[36px] cursor-pointer ${
                      noteValue.includes(preset)
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Text Area */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
                {t('common.notes', 'Notes')}
              </label>
              <textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder={t('order.notesPlaceholder', 'Add kitchen instructions (e.g., No onions, extra crispy)...')}
                rows={3}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={250}
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setNoteValue('');
                  handleSaveNote();
                }}
                className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
              >
                {t('common.clear', 'Clear')}
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
              >
                {t('order.saveNote', 'Save Note')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
