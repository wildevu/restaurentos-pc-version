import React, { useState } from 'react';
import type { Table, Order } from '../types';
import { Users, Utensils, CheckCircle2, Clock, MapPin } from 'lucide-react';

interface Props {
  tables: Table[];
  orders?: Order[];
  onSelectTable: (id: string) => void;
}

export function TableGrid({ tables, orders = [], onSelectTable }: Props) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EMPTY'>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');

  const activeTables = tables.filter(t => !t.archivedAt);
  const activeCount = activeTables.filter(t => t.status === 'ACTIVE').length;
  const emptyCount = activeTables.filter(t => t.status === 'EMPTY').length;

  const sections = Array.from(new Set(activeTables.map(t => t.section || 'Main Dining')));

  const filteredTables = activeTables.filter(t => {
    if (statusFilter === 'ACTIVE' && t.status !== 'ACTIVE') return false;
    if (statusFilter === 'EMPTY' && t.status !== 'EMPTY') return false;
    if (sectionFilter !== 'ALL' && (t.section || 'Main Dining') !== sectionFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Tables Overview</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeCount} active table{activeCount === 1 ? '' : 's'} &bull; {emptyCount} available
          </p>
        </div>

        {/* Section & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Section Chips */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-xs overflow-x-auto">
            <button
              onClick={() => setSectionFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                sectionFilter === 'ALL' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Areas
            </button>
            {sections.map(sec => (
              <button
                key={sec}
                onClick={() => setSectionFilter(sec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  sectionFilter === sec ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({activeTables.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === 'ACTIVE' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('EMPTY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === 'EMPTY' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Empty ({emptyCount})
            </button>
          </div>
        </div>
      </div>

      {filteredTables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
          <p className="font-medium text-sm">No tables match the selected filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTables.map(table => {
            const isEmpty = table.status === 'EMPTY';
            const order = orders.find(o => o.tableId === table.id && o.status === 'OPEN');
            const itemCount = table.itemCount ?? (order?.items ? order.items.reduce((s, i) => s + i.quantity, 0) : 0);

            // Kitchen preparation summary for this table
            let kitchenSummary = null;
            if (order && order.items.length > 0) {
              const allServed = order.items.every(i => i.kitchenStatus === 'SERVED');
              const allReady = order.items.every(i => i.kitchenStatus === 'READY' || i.kitchenStatus === 'SERVED');
              const hasPreparing = order.items.some(i => i.kitchenStatus === 'PREPARING');
              
              if (allServed) {
                kitchenSummary = { label: 'All Served', color: 'text-purple-700 bg-purple-100 border-purple-200' };
              } else if (allReady) {
                kitchenSummary = { label: 'Ready to Serve', color: 'text-emerald-700 bg-emerald-100 border-emerald-200' };
              } else if (hasPreparing) {
                kitchenSummary = { label: 'Kitchen Preparing', color: 'text-blue-700 bg-blue-100 border-blue-200' };
              } else {
                kitchenSummary = { label: 'Order Queued', color: 'text-amber-700 bg-amber-100 border-amber-200' };
              }
            }

            return (
              <button
                key={table.id}
                onClick={() => onSelectTable(table.id)}
                className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.98] flex flex-col justify-between min-h-[150px] shadow-xs cursor-pointer ${
                  isEmpty 
                    ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md' 
                    : 'border-blue-500 bg-blue-50/70 hover:bg-blue-50 hover:shadow-md ring-1 ring-blue-200'
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-black text-gray-900">{table.number}</span>
                      {table.label && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200/80 text-gray-700 rounded font-medium truncate max-w-[100px]">
                          {table.label}
                        </span>
                      )}
                    </div>
                    {table.section && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                        <MapPin size={11} /> {table.section}
                      </span>
                    )}
                  </div>
                  <div className={`p-2 rounded-xl shrink-0 ${isEmpty ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>
                    {isEmpty ? <Users size={18} /> : <Utensils size={18} />}
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full ${
                      isEmpty 
                        ? 'bg-gray-100 text-gray-600' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      {isEmpty ? 'Available' : 'Active Order'}
                    </span>

                    {!isEmpty && itemCount > 0 && (
                      <span className="text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-2xs">
                        {itemCount} item{itemCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  {kitchenSummary && (
                    <div className={`text-[11px] font-bold px-2 py-0.5 rounded border inline-block ${kitchenSummary.color}`}>
                      {kitchenSummary.label}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
