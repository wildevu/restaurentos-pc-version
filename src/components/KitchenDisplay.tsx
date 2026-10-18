import React, { useState, useEffect, useMemo } from 'react';
import { executeCommand } from '../offline';
import { useI18n } from '../i18n';
import type { Order, OrderItem } from '../types';
import { 
  ChefHat, 
  Clock, 
  CheckCircle2, 
  Flame, 
  CheckCheck, 
  Undo2, 
  ListOrdered,
  LayoutGrid,
  Printer,
  Table as TableIcon,
  Zap,
  Check
} from 'lucide-react';

interface Props {
  orders: Order[];
  onBack?: () => void;
  isStandalone?: boolean;
}

export function KitchenDisplay({ orders, onBack, isStandalone }: Props) {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'READY' | 'SERVED'>('ALL');
  const [viewMode, setViewMode] = useState<'TICKETS' | 'AGGREGATE'>('TICKETS');
  const [now, setNow] = useState<number>(Date.now());
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  // Update timer every 10 seconds for live elapsed calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Active orders with unfulfilled items (genuine active kitchen workload)
  const activeOrders = useMemo(() => {
    return orders.filter(o => 
      o.status === 'OPEN' && 
      o.items && 
      o.items.length > 0 && 
      o.items.some(i => i.kitchenStatus !== 'SERVED')
    );
  }, [orders]);

  // Orders that have all items served but table is not yet closed (completed kitchen work history)
  const completedOrders = useMemo(() => {
    return orders.filter(o => 
      o.status === 'OPEN' && 
      o.items && 
      o.items.length > 0 && 
      o.items.every(i => i.kitchenStatus === 'SERVED')
    );
  }, [orders]);

  const handleUpdateItemStatus = async (orderItemId: string, nextStatus: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED') => {
    setUpdatingItemId(orderItemId);
    try {
      await executeCommand('UPDATE_ITEM_KITCHEN_STATUS', {
        orderItemId,
        status: nextStatus
      });
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleBatchUpdateStatus = async (orderId: string, nextStatus: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED') => {
    await executeCommand('BATCH_UPDATE_KITCHEN_STATUS', {
      orderId,
      status: nextStatus
    });
  };

  // 1-Click Bump All Active Units of a Specific Dish to READY in Mode RUSH
  const handleBumpDishToReady = async (dishName: string) => {
    for (const order of activeOrders) {
      for (const item of order.items) {
        if (item.name === dishName && (item.kitchenStatus === 'PENDING' || item.kitchenStatus === 'PREPARING')) {
          await handleUpdateItemStatus(item.id, 'READY');
        }
      }
    }
  };

  const getElapsedMinutes = (createdAtStr?: string) => {
    if (!createdAtStr) return 0;
    const orderTime = new Date(createdAtStr).getTime();
    if (isNaN(orderTime)) return 0;
    return Math.max(0, Math.floor((now - orderTime) / 60000));
  };

  const getTimerBadgeStyle = (elapsedMins: number) => {
    if (elapsedMins < 5) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    } else if (elapsedMins < 12) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    } else {
      return 'bg-red-100 text-red-800 border-red-300 animate-pulse';
    }
  };

  // Filter orders based on status tab
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'SERVED') {
      return completedOrders;
    }
    return activeOrders.filter(order => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PENDING') return order.items.some(i => i.kitchenStatus === 'PENDING');
      if (statusFilter === 'PREPARING') return order.items.some(i => i.kitchenStatus === 'PREPARING');
      if (statusFilter === 'READY') return order.items.some(i => i.kitchenStatus === 'READY');
      return true;
    });
  }, [activeOrders, completedOrders, statusFilter]);

  // Aggregate items across active orders for the Kitchen Prep Summary View
  const aggregatedDishTotals = useMemo(() => {
    const map = new Map<string, { name: string, totalQty: number, pendingQty: number, prepQty: number, readyQty: number }>();
    
    for (const order of activeOrders) {
      for (const item of order.items) {
        if (item.kitchenStatus === 'SERVED') continue;
        const key = item.name;
        const existing = map.get(key) || { 
          name: item.name, 
          totalQty: 0, 
          pendingQty: 0, 
          prepQty: 0, 
          readyQty: 0
        };
        
        existing.totalQty += item.quantity;
        if (item.kitchenStatus === 'PENDING') existing.pendingQty += item.quantity;
        if (item.kitchenStatus === 'PREPARING') existing.prepQty += item.quantity;
        if (item.kitchenStatus === 'READY') existing.readyQty += item.quantity;
        map.set(key, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [activeOrders]);

  const totalActiveItemsCount = useMemo(() => {
    return aggregatedDishTotals.reduce((sum, d) => sum + d.totalQty, 0);
  }, [aggregatedDishTotals]);

  const handlePrintPrepSummary = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full space-y-4 pb-6">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500 text-white rounded-xl shadow-xs">
            <Flame size={22} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
              {t('kds.title', 'Kitchen Display System (KDS)')}
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              {activeOrders.length === 1 
                ? t('kds.activeTicketsCount', '{count} active ticket', { count: 1 }) 
                : t('kds.activeTicketsCountPlural', '{count} active tickets', { count: activeOrders.length })} &bull; {totalActiveItemsCount} {t('common.items', 'dishes in prep')}
            </p>
          </div>
        </div>

        {/* Action Controls & View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Prominent 1-Click RUSH MODE Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'AGGREGATE' ? 'TICKETS' : 'AGGREGATE')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md ${
              viewMode === 'AGGREGATE'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white ring-2 ring-orange-400'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
            title="Basculer instantanément en mode synthèse condensée pour le coup de feu"
          >
            <Zap size={16} className="animate-pulse text-amber-200" />
            <span>{viewMode === 'AGGREGATE' ? 'Mode Normal (Tickets)' : '🔥 Mode RUSH (Synthèse)'}</span>
          </button>

          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('TICKETS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'TICKETS'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid size={14} />
              <span>{t('kds.ticketView', 'Tickets Grid')}</span>
            </button>
            <button
              onClick={() => setViewMode('AGGREGATE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'AGGREGATE'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ListOrdered size={14} />
              <span>{t('kds.prepSummaryView', 'Prep Summary')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar (for Tickets view) */}
      {viewMode === 'TICKETS' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all shrink-0 min-h-[38px] cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-gray-900 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('kds.tabAll', 'All Active')} ({activeOrders.length})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all shrink-0 min-h-[38px] cursor-pointer ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('kds.tabPending', 'Pending')}
          </button>
          <button
            onClick={() => setStatusFilter('PREPARING')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all shrink-0 min-h-[38px] cursor-pointer ${
              statusFilter === 'PREPARING'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('kds.tabPreparing', 'In Prep')}
          </button>
          <button
            onClick={() => setStatusFilter('READY')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all shrink-0 min-h-[38px] cursor-pointer ${
              statusFilter === 'READY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('kds.tabReady', 'Ready')}
          </button>
          {completedOrders.length > 0 && (
            <button
              onClick={() => setStatusFilter('SERVED')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all shrink-0 min-h-[38px] cursor-pointer ${
                statusFilter === 'SERVED'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-800'
              }`}
            >
              {t('kds.tabServed', 'Served')} ({completedOrders.length})
            </button>
          )}
        </div>
      )}

      {/* VIEW 1: TICKETS GRID VIEW */}
      {viewMode === 'TICKETS' && (
        filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center text-gray-400 my-auto">
            <ChefHat size={48} className="mx-auto mb-3 opacity-30 text-gray-400" />
            <h3 className="text-base font-black text-gray-700">{t('kds.noActiveTickets', 'No active kitchen tickets! All orders are prepared and served.')}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map(order => {
              const elapsedMins = getElapsedMinutes(order.createdAt);
              const timerClass = getTimerBadgeStyle(elapsedMins);
              const allReady = order.items.every(i => i.kitchenStatus === 'READY' || i.kitchenStatus === 'SERVED');
              const allServed = order.items.every(i => i.kitchenStatus === 'SERVED');

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl border-2 shadow-xs flex flex-col justify-between overflow-hidden transition-all ${
                    allServed 
                      ? 'border-purple-200 opacity-60' 
                      : allReady 
                        ? 'border-emerald-400 ring-2 ring-emerald-100' 
                        : elapsedMins > 12 
                          ? 'border-red-300 ring-2 ring-red-100' 
                          : 'border-gray-200'
                  }`}
                >
                  {/* Ticket Header */}
                  <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center font-black text-base shadow-xs">
                        T{order.tableNumber || '?'}
                      </div>
                      <div>
                        <div className="font-extrabold text-gray-900 text-sm leading-tight">
                          {order.tableLabel || t('tables.tableNumber', `Table ${order.tableNumber || ''}`, { number: order.tableNumber || '' })}
                        </div>
                        <div className="text-[10px] text-gray-500 font-semibold">
                          {t('order.serverLabel', `Server: ${order.openedByUserName || 'Staff'}`, { name: order.openedByUserName || 'Staff' })}
                        </div>
                      </div>
                    </div>

                    {/* Live Timer Badge */}
                    <div className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1 ${timerClass}`}>
                      <Clock size={12} />
                      <span>{elapsedMins}m</span>
                    </div>
                  </div>

                  {/* Ticket Items List */}
                  <div className="p-3.5 flex-1 divide-y divide-gray-100 space-y-2.5">
                    {order.items.map(item => {
                      const isPending = item.kitchenStatus === 'PENDING';
                      const isPreparing = item.kitchenStatus === 'PREPARING';
                      const isReady = item.kitchenStatus === 'READY';
                      const isServed = item.kitchenStatus === 'SERVED';

                      return (
                        <div key={item.id} className="pt-2 first:pt-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              <span className="font-black text-base text-gray-900 shrink-0 w-6">
                                {item.quantity}x
                              </span>
                              <div className="flex-1">
                                <span className={`font-bold text-sm ${isServed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {item.name}
                                </span>
                                {item.notes && (
                                  <div className="text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md mt-1 inline-block border border-amber-300">
                                    ⚠️ {item.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Status Action Controls */}
                          <div className="flex items-center gap-1 pt-1">
                            {isPending && (
                              <button
                                onClick={() => handleUpdateItemStatus(item.id, 'PREPARING')}
                                className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 min-h-[38px] cursor-pointer"
                              >
                                <Flame size={13} />
                                <span>{t('kds.startPrep', 'Start Prep')}</span>
                              </button>
                            )}

                            {isPreparing && (
                              <button
                                onClick={() => handleUpdateItemStatus(item.id, 'READY')}
                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 min-h-[38px] cursor-pointer"
                              >
                                <CheckCircle2 size={13} />
                                <span>{t('kds.markReady', 'Ready')}</span>
                              </button>
                            )}

                            {isReady && (
                              <button
                                onClick={() => handleUpdateItemStatus(item.id, 'SERVED')}
                                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 min-h-[38px] cursor-pointer"
                              >
                                <CheckCheck size={13} />
                                <span>{t('kds.markServed', 'Served')}</span>
                              </button>
                            )}

                            {isServed && (
                              <div className="flex-1 py-1.5 bg-purple-50 text-purple-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 border border-purple-200">
                                <CheckCheck size={13} />
                                <span>{t('kds.markServed', 'Served')}</span>
                              </div>
                            )}

                            {/* Revert status button */}
                            {!isPending && (
                              <button
                                onClick={() => {
                                  const prev = isServed ? 'READY' : isReady ? 'PREPARING' : 'PENDING';
                                  handleUpdateItemStatus(item.id, prev);
                                }}
                                className="p-2 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                                title={t('kds.revertStatus', 'Revert')}
                              >
                                <Undo2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ticket Bump Action Footer */}
                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2">
                    <button
                      onClick={() => handleBatchUpdateStatus(order.id, 'READY')}
                      className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-black text-xs rounded-xl transition-colors flex items-center justify-center gap-1 min-h-[38px] cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      <span>{t('kds.bumpAllReady', 'All Ready')}</span>
                    </button>
                    <button
                      onClick={() => handleBatchUpdateStatus(order.id, 'SERVED')}
                      className="flex-1 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 font-black text-xs rounded-xl transition-colors flex items-center justify-center gap-1 min-h-[38px] cursor-pointer"
                    >
                      <CheckCheck size={13} />
                      <span>{t('kds.bumpAllServed', 'All Served')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* VIEW 2: REDESIGNED CLEAN TABLE-TICKET PREP SUMMARY VIEW (MODE RUSH) */}
      {viewMode === 'AGGREGATE' && (
        <div className="space-y-4">
          {/* Header Card with Print option */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Zap size={20} className="text-orange-500" />
                <span>KITCHEN PREP SUMMARY — 🔥 MODE RUSH</span>
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Consolidated dish prep totals across all active tables. Click "Prêt" to mark all active units of a dish ready.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-orange-100 text-orange-900 font-black text-xs rounded-xl border border-orange-200">
                {totalActiveItemsCount} {t('common.items', 'dishes total')}
              </span>
              <button
                onClick={handlePrintPrepSummary}
                className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer min-h-[36px]"
              >
                <Printer size={14} />
                <span>Print Prep Summary</span>
              </button>
            </div>
          </div>

          {/* Consolidated Dish Aggregator Matrix with Green Checkmark "Prêt" Button */}
          {aggregatedDishTotals.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center text-gray-400">
              <ChefHat size={48} className="mx-auto mb-3 opacity-30 text-gray-400" />
              <h3 className="text-base font-black text-gray-700">All dishes have been prepared. No items currently cooking in Mode RUSH.</h3>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">
                Active Kitchen Dish Workload (Tap "Prêt" to Bump)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {aggregatedDishTotals.map(dish => (
                  <div key={dish.name} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col justify-between space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-extrabold text-sm text-gray-900 leading-tight">
                        {dish.name}
                      </div>
                      <span className="text-2xl font-black text-orange-600 shrink-0">
                        {dish.totalQty}x
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-200/80">
                      <div className="flex gap-1 text-[11px] font-bold">
                        {dish.pendingQty > 0 && <span className="text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">{dish.pendingQty} En attente</span>}
                        {dish.prepQty > 0 && <span className="text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded-md">{dish.prepQty} En cours</span>}
                        {dish.readyQty > 0 && <span className="text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md">{dish.readyQty} Prêt</span>}
                      </div>

                      <button
                        onClick={() => handleBumpDishToReady(dish.name)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                        title={`Marquer tous les ${dish.name} comme prêts`}
                      >
                        <Check size={14} />
                        <span>Prêt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
