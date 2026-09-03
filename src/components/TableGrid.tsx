import React, { useState } from 'react';
import type { Table, Order } from '../types';
import { useI18n } from '../i18n';
import { Users, Utensils, MapPin, Search, X, Bell, CheckCircle2, Flame, Clock } from 'lucide-react';

interface Props {
  tables: Table[];
  orders?: Order[];
  onSelectTable: (id: string) => void;
}

export function TableGrid({ tables, orders = [], onSelectTable }: Props) {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EMPTY'>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const activeTables = tables.filter(tbl => !tbl.archivedAt);
  const activeCount = activeTables.filter(tbl => tbl.status === 'ACTIVE').length;
  const emptyCount = activeTables.filter(tbl => tbl.status === 'EMPTY').length;

  const sections = Array.from(new Set(activeTables.map(tbl => tbl.section || t('common.allAreas', 'Main Dining'))));

  const filteredTables = activeTables.filter(tbl => {
    if (statusFilter === 'ACTIVE' && tbl.status !== 'ACTIVE') return false;
    if (statusFilter === 'EMPTY' && tbl.status !== 'EMPTY') return false;
    if (sectionFilter !== 'ALL' && (tbl.section || t('common.allAreas', 'Main Dining')) !== sectionFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const numMatch = String(tbl.number).includes(q);
      const labelMatch = tbl.label?.toLowerCase().includes(q);
      return numMatch || labelMatch;
    }
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{t('tables.title', 'Tables & Orders')}</h2>
          <p className="text-gray-500 text-xs sm:text-sm font-medium mt-0.5">
            {activeCount === 1 ? t('tables.activeCount', '{count} active table', { count: 1 }) : t('tables.activeCountPlural', '{count} active tables', { count: activeCount })} &bull; {t('tables.availableCount', '{count} available', { count: emptyCount })}
          </p>
        </div>

        {/* Quick Search on Mobile & Desktop */}
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('tables.quickSearch', 'Quick table #...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      </div>

      {/* Filter Controls: Optimized for Touch on Mobile */}
      <div className="space-y-2">
        {/* Status Filters */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`flex-1 py-2 sm:py-1.5 rounded-lg text-xs font-extrabold transition-all min-h-[40px] flex items-center justify-center cursor-pointer ${
              statusFilter === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('tables.allFilter', 'All')} ({activeTables.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`flex-1 py-2 sm:py-1.5 rounded-lg text-xs font-extrabold transition-all min-h-[40px] flex items-center justify-center cursor-pointer ${
              statusFilter === 'ACTIVE' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('tables.activeFilter', 'Active')} ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('EMPTY')}
            className={`flex-1 py-2 sm:py-1.5 rounded-lg text-xs font-extrabold transition-all min-h-[40px] flex items-center justify-center cursor-pointer ${
              statusFilter === 'EMPTY' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('tables.emptyFilter', 'Empty')} ({emptyCount})
          </button>
        </div>

        {/* Section Chips */}
        {sections.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            <button
              onClick={() => setSectionFilter('ALL')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors shrink-0 min-h-[38px] cursor-pointer ${
                sectionFilter === 'ALL' 
                  ? 'bg-gray-900 text-white shadow-xs' 
                  : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('tables.allAreas', 'All Areas')}
            </button>
            {sections.map(sec => (
              <button
                key={sec}
                onClick={() => setSectionFilter(sec)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors shrink-0 min-h-[38px] cursor-pointer ${
                  sectionFilter === sec 
                    ? 'bg-gray-900 text-white shadow-xs' 
                    : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tables Grid */}
      {filteredTables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">
          <Utensils size={32} className="mx-auto mb-2 opacity-30 text-gray-400" />
          <p className="font-semibold text-sm">{t('tables.noTablesMatch', 'No tables match your filter.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredTables.map(table => {
            const isEmpty = table.status === 'EMPTY';
            const order = orders.find(o => o.tableId === table.id && o.status === 'OPEN');
            const itemCount = table.itemCount ?? (order?.items ? order.items.reduce((s, i) => s + i.quantity, 0) : 0);

            // Real-Time Partial Readiness Status for Waiter
            let readyBadge = null;
            let kitchenSummary = null;

            if (order && order.items && order.items.length > 0) {
              const readyItems = order.items.filter(i => i.kitchenStatus === 'READY');
              const servedItems = order.items.filter(i => i.kitchenStatus === 'SERVED');
              const prepItems = order.items.filter(i => i.kitchenStatus === 'PREPARING');
              const readyCount = readyItems.reduce((sum, i) => sum + i.quantity, 0);

              const allServed = order.items.every(i => i.kitchenStatus === 'SERVED');
              const allReadyOrServed = order.items.every(i => i.kitchenStatus === 'READY' || i.kitchenStatus === 'SERVED');

              if (readyCount > 0) {
                if (allReadyOrServed && !allServed) {
                  readyBadge = {
                    text: `🔔 ${t('tables.allReadyBadge', 'All ready')}`,
                    color: 'bg-emerald-600 text-white border-emerald-700 animate-pulse font-black'
                  };
                } else {
                  readyBadge = {
                    text: `🔔 ${t('tables.partialReadyBadge', '{count} ready', { count: readyCount })}`,
                    color: 'bg-emerald-500 text-white border-emerald-600 animate-bounce font-black'
                  };
                }
              } else if (allServed) {
                kitchenSummary = { label: t('tables.allServedBadge', 'All Served'), color: 'text-purple-700 bg-purple-100 border-purple-200' };
              } else if (prepItems.length > 0) {
                kitchenSummary = { label: t('tables.kitchenPrepBadge', 'Kitchen Prep'), color: 'text-orange-700 bg-orange-100 border-orange-200' };
              } else {
                kitchenSummary = { label: t('tables.queuedBadge', 'Queued'), color: 'text-amber-700 bg-amber-100 border-amber-200' };
              }
            }

            return (
              <button
                key={table.id}
                onClick={() => onSelectTable(table.id)}
                className={`relative p-4 sm:p-5 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.97] flex flex-col justify-between min-h-[140px] sm:min-h-[155px] shadow-xs cursor-pointer ${
                  isEmpty 
                    ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md' 
                    : readyBadge
                      ? 'border-emerald-500 bg-emerald-50/60 hover:bg-emerald-50 hover:shadow-md ring-2 ring-emerald-300'
                      : 'border-blue-500 bg-blue-50/80 hover:bg-blue-50 hover:shadow-md ring-1 ring-blue-300'
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-gray-900">
                        {table.number}
                      </span>
                      {table.label && (
                        <span className="text-[11px] px-1.5 py-0.5 bg-gray-200/80 text-gray-700 rounded-md font-bold truncate max-w-[80px]">
                          {table.label}
                        </span>
                      )}
                    </div>
                    {table.section && (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 font-medium mt-0.5">
                        <MapPin size={11} /> {table.section}
                      </span>
                    )}
                  </div>
                  <div className={`p-2 rounded-xl shrink-0 ${
                    isEmpty 
                      ? 'bg-gray-100 text-gray-400' 
                      : readyBadge 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'bg-blue-600 text-white shadow-xs'
                  }`}>
                    {isEmpty ? <Users size={16} /> : readyBadge ? <Bell size={16} /> : <Utensils size={16} />}
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] font-extrabold rounded-full ${
                      isEmpty 
                        ? 'bg-gray-100 text-gray-600' 
                        : 'bg-blue-600 text-white'
                    }`}>
                      {isEmpty ? t('tables.availableBadge', 'Available') : t('tables.activeBadge', 'Active')}
                    </span>

                    {!isEmpty && itemCount > 0 && (
                      <span className="text-xs font-bold text-gray-800 bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-2xs">
                        {itemCount === 1 ? t('tables.itemsCount', '{count} item', { count: 1 }) : t('tables.itemsCountPlural', '{count} items', { count: itemCount })}
                      </span>
                    )}
                  </div>

                  {readyBadge ? (
                    <div className={`text-[11px] px-2 py-0.5 rounded-lg border shadow-xs inline-flex items-center gap-1 ${readyBadge.color}`}>
                      {readyBadge.text}
                    </div>
                  ) : kitchenSummary ? (
                    <div className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border inline-block ${kitchenSummary.color}`}>
                      {kitchenSummary.label}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
