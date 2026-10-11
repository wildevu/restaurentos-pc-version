import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  Clock, 
  ChevronRight, 
  X, 
  Receipt,
  Download,
  AlertCircle,
  Flame,
  DollarSign,
  TrendingUp,
  ShoppingBag
} from 'lucide-react';

export function OrderHistory({ authToken }: { authToken?: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CLOSED' | 'OPEN'>('CLOSED');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const getEffectiveToken = () => authToken || localStorage.getItem('restaurantos_auth_token') || localStorage.getItem('token') || '';

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getEffectiveToken();
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/admin/orders/history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load order history');
      const data = await res.json();
      setOrders(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const calculateTableDuration = (createdAt: string, updatedAt?: string) => {
    if (!createdAt) return '—';
    const start = new Date(createdAt).getTime();
    const end = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);
    const totalMinutes = Math.floor(diffMs / (1000 * 60));

    if (totalMinutes < 1) return '< 1m';
    if (totalMinutes < 60) return `${totalMinutes}m`;

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const calculateKitchenPrepTime = (order: any) => {
    if (!order || !order.items || order.items.length === 0) return '—';

    // Evaluate timestamps across items
    const times = order.items
      .map((item: any) => {
        if (!item.createdAt) return null;
        const created = new Date(item.createdAt).getTime();
        const updated = item.kitchenStatusUpdatedAt
          ? new Date(item.kitchenStatusUpdatedAt).getTime()
          : item.updatedAt
          ? new Date(item.updatedAt).getTime()
          : created;
        return Math.max(0, Math.floor((updated - created) / (1000 * 60)));
      })
      .filter((m: number | null): m is number => m !== null);

    if (times.length === 0) return '—';
    const maxMins = Math.max(...times);
    if (maxMins < 1) return '< 1m';
    if (maxMins < 60) return `${maxMins}m`;

    const hours = Math.floor(maxMins / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Today's Bilan Metrics Calculation
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => {
    if (!o.createdAt) return false;
    const orderDateStr = new Date(o.createdAt).toISOString().slice(0, 10);
    return orderDateStr === todayStr && o.status === 'CLOSED';
  });

  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const todayOrdersCount = todayOrders.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Order History & Logs</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            View completed and historic service orders, items, notes, table turn times, and kitchen preparation metrics.
          </p>
        </div>
      </div>

      {/* TODAY'S BILAN SUMMARY CARD (REVENUE & ORDERS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Today's Revenue */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-sm border border-emerald-500/30 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider block">
              Today's Gross Revenue (Bilan)
            </span>
            <div className="text-3xl font-black mt-1">
              ${todayRevenue.toFixed(2)}
            </div>
            <p className="text-[11px] text-emerald-200 mt-1 font-medium">
              Calculated from completed orders today ({todayStr})
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Today's Orders Count */}
        <div className="bg-gradient-to-br from-slate-900 to-gray-800 text-white p-5 rounded-2xl shadow-sm border border-gray-700 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
              Today's Completed Orders
            </span>
            <div className="text-3xl font-black mt-1">
              {todayOrdersCount} <span className="text-sm font-bold text-gray-400">orders</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">
              Closed orders served today ({todayStr})
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search table, staff, item name or special note..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl text-sm font-medium outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatusFilter('CLOSED')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'CLOSED' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Completed (Closed)
          </button>
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'OPEN' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Currently Open
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Statuses
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm font-medium">
            Loading order records...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm font-medium">
            No matching orders found in history.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4">Order Time</th>
                  <th className="py-3.5 px-4">Table</th>
                  <th className="py-3.5 px-4">Status & Table Time</th>
                  <th className="py-3.5 px-4">Kitchen Prep Time</th>
                  <th className="py-3.5 px-4">Staff</th>
                  <th className="py-3.5 px-4">Items Count</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => {
                  const createdDate = new Date(order.createdAt);
                  const prepTime = calculateKitchenPrepTime(order);

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-gray-900 whitespace-nowrap">
                        <div>{createdDate.toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400 font-normal">{createdDate.toLocaleTimeString()}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-gray-900">Table {order.tableNumber}</span>
                        {order.tableLabel && (
                          <span className="text-xs text-gray-500 block">{order.tableLabel}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${
                            order.status === 'CLOSED'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {order.status}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 rounded-md" title="Total table turn time">
                            <Clock size={12} className="text-amber-600 shrink-0" />
                            {calculateTableDuration(order.createdAt, order.updatedAt)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold bg-orange-50 text-orange-900 border border-orange-200 rounded-md" title="Kitchen Prep Duration">
                          <Flame size={12} className="text-orange-600 shrink-0" />
                          {prepTime}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">
                        <div className="font-medium">{order.openedByName || 'Staff'}</div>
                        {order.closedByName && order.closedByName !== order.openedByName && (
                          <div className="text-xs text-gray-400">Closed by: {order.closedByName}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-800">
                        {order.totalItems} item{order.totalItems === 1 ? '' : 's'}
                      </td>
                      <td className="py-3.5 px-4 font-black text-gray-900">
                        ${order.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Details</span>
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-gray-50 border-b border-gray-200 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-black text-gray-900">
                    Table {selectedOrder.tableNumber} Order Details
                  </h3>
                  <span className="px-2.5 py-0.5 bg-gray-200 text-gray-700 text-xs font-bold rounded-md">
                    {selectedOrder.status}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 rounded-md">
                    <Clock size={12} className="text-amber-600 shrink-0" />
                    Table: {calculateTableDuration(selectedOrder.createdAt, selectedOrder.updatedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-mono font-bold bg-orange-50 text-orange-900 border border-orange-200 rounded-md">
                    <Flame size={12} className="text-orange-600 shrink-0" />
                    Kitchen: {calculateKitchenPrepTime(selectedOrder)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Opened {new Date(selectedOrder.createdAt).toLocaleString()} by {selectedOrder.openedByName || 'Staff'}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-700 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Items Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Itemized Breakdown</h4>
              {selectedOrder.items.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  No items recorded on this order ticket.
                </div>
              ) : (
                selectedOrder.items.map((item: any) => (
                  <div key={item.id} className="p-3.5 bg-gray-50/80 border border-gray-200 rounded-xl flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="w-7 h-7 bg-gray-900 text-white rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {item.quantity}x
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">{item.name}</span>
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                            {item.kitchenStatus || 'READY'}
                          </span>
                        </div>
                        {item.notes && (
                          <div className="mt-1 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 font-semibold inline-block">
                            Note: {item.notes}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          Unit: ${item.price.toFixed(2)} • Added by: {item.addedByName || 'Staff'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-black text-gray-900 text-sm">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 font-semibold block">Total Ticket Items</span>
                <span className="text-base font-bold text-gray-900">{selectedOrder.totalItems} items</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 font-semibold block">Total Amount</span>
                <span className="text-2xl font-black text-gray-900">${selectedOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
