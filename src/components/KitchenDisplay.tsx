import React, { useState, useEffect } from 'react';
import { executeCommand } from '../offline';
import type { Order, OrderItem } from '../types';
import { ChefHat, Clock, CheckCircle2, Flame, AlertCircle, CheckCheck, Undo2, Volume2, VolumeX, Sparkles } from 'lucide-react';

interface Props {
  orders: Order[];
  onBack?: () => void;
  isStandalone?: boolean;
}

export function KitchenDisplay({ orders, onBack, isStandalone }: Props) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PREPARING' | 'READY' | 'SERVED'>('ALL');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [now, setNow] = useState<number>(Date.now());
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  // Update timer every 10 seconds for live elapsed calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const openOrders = orders.filter(o => o.status === 'OPEN' && o.items && o.items.length > 0);

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

  const getElapsedMinutes = (createdAtStr?: string) => {
    if (!createdAtStr) return 0;
    const orderTime = new Date(createdAtStr).getTime();
    if (isNaN(orderTime)) return 0;
    return Math.max(0, Math.floor((now - orderTime) / 60000));
  };

  const getTimerBadgeStyle = (elapsedMins: number) => {
    if (elapsedMins < 5) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    } else if (elapsedMins < 12) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    } else {
      return 'bg-red-100 text-red-800 border-red-200 animate-pulse';
    }
  };

  // Filter orders based on status tab
  const filteredOrders = openOrders.filter(order => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') return order.items.some(i => i.kitchenStatus === 'PENDING');
    if (statusFilter === 'PREPARING') return order.items.some(i => i.kitchenStatus === 'PREPARING');
    if (statusFilter === 'READY') return order.items.some(i => i.kitchenStatus === 'READY');
    if (statusFilter === 'SERVED') return order.items.every(i => i.kitchenStatus === 'SERVED');
    return true;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-100 text-orange-600 rounded-xl">
            <ChefHat size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Kitchen Display System (KDS)</h1>
            <p className="text-xs text-gray-500 font-medium">
              {openOrders.length} active order ticket{openOrders.length === 1 ? '' : 's'} in kitchen queue
            </p>
          </div>
        </div>

        {/* Filter Chips & Audio controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              soundEnabled ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
            title={soundEnabled ? 'Chime Alert Enabled' : 'Chime Alert Muted'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span className="hidden sm:inline">{soundEnabled ? 'Audio Chime ON' : 'Muted'}</span>
          </button>

          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({openOrders.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'PENDING'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('PREPARING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'PREPARING'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Preparing
            </button>
            <button
              onClick={() => setStatusFilter('READY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'READY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Ready
            </button>
            <button
              onClick={() => setStatusFilter('SERVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'SERVED'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Served
            </button>
          </div>

          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors"
            >
              Exit Kitchen
            </button>
          )}
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckCheck size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Kitchen is all caught up!</h2>
          <p className="text-gray-500 text-sm mt-1 max-w-sm">
            No pending or active orders matching the selected filter. Incoming tickets will appear here live in real-time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-6">
          {filteredOrders.map(order => {
            const elapsedMins = getElapsedMinutes(order.createdAt);
            const allItemsServed = order.items.every(i => i.kitchenStatus === 'SERVED');
            const allItemsReady = order.items.every(i => i.kitchenStatus === 'READY' || i.kitchenStatus === 'SERVED');
            const hasPreparing = order.items.some(i => i.kitchenStatus === 'PREPARING');

            return (
              <div
                key={order.id}
                className={`flex flex-col bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                  allItemsServed
                    ? 'border-purple-200 bg-purple-50/20'
                    : allItemsReady
                    ? 'border-emerald-300 ring-2 ring-emerald-100'
                    : hasPreparing
                    ? 'border-blue-300 ring-1 ring-blue-50'
                    : 'border-gray-200'
                }`}
              >
                {/* Order Card Header */}
                <div className="p-4 bg-gray-50/80 border-b border-gray-100 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-gray-900">
                        Table {order.tableNumber ?? '?'}
                      </span>
                      {order.tableLabel && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-medium">
                          {order.tableLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Waiter: <span className="font-medium text-gray-700">{order.openedByUserName || 'Staff'}</span>
                    </div>
                  </div>

                  <div className={`px-2.5 py-1 rounded-full border text-xs font-bold flex items-center gap-1 ${getTimerBadgeStyle(elapsedMins)}`}>
                    <Clock size={12} />
                    <span>{elapsedMins}m ago</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="flex-1 p-3 space-y-2.5 overflow-y-auto max-h-[380px]">
                  {order.items.map(item => {
                    const isItemUpdating = updatingItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all ${
                          item.kitchenStatus === 'SERVED'
                            ? 'bg-purple-50/60 border-purple-200 opacity-70'
                            : item.kitchenStatus === 'READY'
                            ? 'bg-emerald-50/60 border-emerald-200'
                            : item.kitchenStatus === 'PREPARING'
                            ? 'bg-blue-50/70 border-blue-200 shadow-xs'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 flex-1">
                            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
                              {item.quantity}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-gray-900 text-sm block leading-tight">
                                {item.name}
                              </span>

                              {/* Special Instructions / Notes */}
                              {item.notes && (
                                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded text-xs font-bold uppercase tracking-wider">
                                  <AlertCircle size={12} className="flex-shrink-0 text-amber-700" />
                                  <span>{item.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Status Badge */}
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider flex-shrink-0 ${
                              item.kitchenStatus === 'SERVED'
                                ? 'bg-purple-100 text-purple-800'
                                : item.kitchenStatus === 'READY'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.kitchenStatus === 'PREPARING'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {item.kitchenStatus}
                          </span>
                        </div>

                        {/* Interactive Status Controls for this item */}
                        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-end gap-1.5">
                          {item.kitchenStatus === 'PENDING' && (
                            <button
                              onClick={() => handleUpdateItemStatus(item.id, 'PREPARING')}
                              disabled={isItemUpdating}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Flame size={12} />
                              <span>Start Prep</span>
                            </button>
                          )}

                          {item.kitchenStatus === 'PREPARING' && (
                            <>
                              <button
                                onClick={() => handleUpdateItemStatus(item.id, 'PENDING')}
                                disabled={isItemUpdating}
                                className="p-1 hover:bg-gray-100 text-gray-500 rounded-lg text-xs cursor-pointer"
                                title="Revert to Pending"
                              >
                                <Undo2 size={13} />
                              </button>
                              <button
                                onClick={() => handleUpdateItemStatus(item.id, 'READY')}
                                disabled={isItemUpdating}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <CheckCircle2 size={12} />
                                <span>Mark Ready</span>
                              </button>
                            </>
                          )}

                          {item.kitchenStatus === 'READY' && (
                            <>
                              <button
                                onClick={() => handleUpdateItemStatus(item.id, 'PREPARING')}
                                disabled={isItemUpdating}
                                className="p-1 hover:bg-gray-100 text-gray-500 rounded-lg text-xs cursor-pointer"
                                title="Back to Preparing"
                              >
                                <Undo2 size={13} />
                              </button>
                              <button
                                onClick={() => handleUpdateItemStatus(item.id, 'SERVED')}
                                disabled={isItemUpdating}
                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-semibold text-xs rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <CheckCheck size={12} />
                                <span>Mark Served</span>
                              </button>
                            </>
                          )}

                          {item.kitchenStatus === 'SERVED' && (
                            <button
                              onClick={() => handleUpdateItemStatus(item.id, 'READY')}
                              disabled={isItemUpdating}
                              className="px-2 py-1 text-gray-600 hover:bg-gray-100 text-xs rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Undo2 size={12} />
                              <span>Undo Served</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Batch Order Action Footer */}
                <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleBatchUpdateStatus(order.id, 'PREPARING')}
                    className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Prep All
                  </button>
                  <button
                    onClick={() => handleBatchUpdateStatus(order.id, 'READY')}
                    className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    All Ready
                  </button>
                  <button
                    onClick={() => handleBatchUpdateStatus(order.id, 'SERVED')}
                    className="flex-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    All Served
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
