import React, { useState, useMemo } from 'react';
import { executeCommand } from '../offline';
import type { Table, Order, MenuItem } from '../types';
import { 
  ChevronLeft, 
  Receipt, 
  Plus, 
  Minus, 
  Trash2, 
  Edit2, 
  Check, 
  Search, 
  Sparkles, 
  AlertCircle, 
  ChefHat, 
  X,
  MessageSquare
} from 'lucide-react';

interface Props {
  table: Table;
  order: Order | null;
  menu: any[];
  onBack: () => void;
}

const QUICK_NOTES = ['No Onions', 'Extra Spicy', 'No Ice', 'Less Salt', 'Gluten Free', 'Well Done', 'Dressing on Side', 'To-Go Box'];

export function TableDetail({ table, order, menu, onBack }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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
    dispatchCommand('OPEN_TABLE', { tableId: table.id });
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
    if (confirm('Are you sure you want to completely remove this item?')) {
      dispatchCommand('REMOVE_ITEM', { tableId: table.id, orderItemId });
    }
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

  const handleCloseTable = () => {
    if (confirm(`Are you sure you want to close Table ${table.number} and finalize this order?`)) {
      dispatchCommand('CLOSE_TABLE', { tableId: table.id }, () => onBack());
    }
  };

  // Fast filtered & ranked menu items
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
        const aStarts = aName.startsWith(term);
        const bStarts = bName.startsWith(term);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aName.localeCompare(bName);
      });
  }, [menu, selectedCategoryId, searchTerm]);

  const calculateTotal = () => {
    if (!order || !order.items) return 0;
    return order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  };

  const getKitchenStatusChip = (status?: string) => {
    switch (status) {
      case 'SERVED':
        return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-purple-100 text-purple-800 uppercase tracking-wider">Served</span>;
      case 'READY':
        return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider">Ready</span>;
      case 'PREPARING':
        return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wider">Preparing</span>;
      case 'PENDING':
      default:
        return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-orange-100 text-orange-800 uppercase tracking-wider">Pending</span>;
    }
  };

  if (table.status === 'EMPTY') {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-6 bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
          <span className="text-3xl font-black">{table.number}</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Table {table.number}</h2>
          {table.label && <p className="text-sm font-medium text-gray-500">{table.label}</p>}
          <p className="text-gray-500 mt-2 text-sm">This table is currently available for new guests.</p>
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <button 
            onClick={handleOpenTable}
            disabled={isProcessing}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-xl transition-all shadow-sm"
          >
            Open Table & Begin Order
          </button>
          <button 
            onClick={onBack}
            className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-sm transition-colors border border-gray-200"
          >
            Back to Tables Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] lg:flex-row gap-6 relative">
      {/* Order Panel */}
      <div className="flex flex-col flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-gray-900">Table {table.number}</h2>
                {table.label && (
                  <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-medium">
                    {table.label}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                Staff: {order?.openedByUserName || 'Active'}
              </span>
            </div>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
            Active Order
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(!order || !order.items || order.items.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <Receipt size={48} className="mb-3 opacity-30" />
              <p className="font-semibold text-gray-600">No items added yet</p>
              <p className="text-xs text-gray-400 mt-1">Select items from the menu on the right</p>
            </div>
          ) : (
            order.items.map((item: any) => (
              <div key={item.id} className="p-3 bg-gray-50/70 border border-gray-200 rounded-xl space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-gray-900 text-white rounded-lg font-bold text-xs">
                      {item.quantity}x
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm block leading-tight">{item.name}</span>
                        {getKitchenStatusChip(item.kitchenStatus)}
                      </div>
                      <span className="text-xs font-semibold text-gray-500 mt-0.5 block">
                        ${(item.price * item.quantity).toFixed(2)} (${item.price.toFixed(2)} ea)
                      </span>
                    </div>
                  </div>

                  {/* Quantity and Remove Buttons */}
                  <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200 shadow-2xs">
                    <button 
                      onClick={() => handleDecrement(item.id)} 
                      disabled={isProcessing}
                      className="p-1.5 hover:bg-gray-100 active:scale-90 rounded-md text-gray-700 transition-all"
                    >
                      <Minus size={14} />
                    </button>
                    <button 
                      onClick={() => handleIncrement(item.id)} 
                      disabled={isProcessing}
                      className="p-1.5 hover:bg-gray-100 active:scale-90 rounded-md text-gray-700 transition-all"
                    >
                      <Plus size={14} />
                    </button>
                    <button 
                      onClick={() => handleRemove(item.id)} 
                      disabled={isProcessing}
                      className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-md text-gray-400 transition-all ml-0.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                {/* Item Notes / Special Instructions */}
                <div className="pt-1 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button 
                    onClick={() => handleOpenNoteEditor(item)}
                    className="flex items-center gap-1.5 text-xs text-left group hover:opacity-80 transition-opacity"
                  >
                    <MessageSquare size={13} className={item.notes ? "text-amber-600" : "text-gray-400"} />
                    <span className={item.notes ? "font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" : "italic text-gray-400"}>
                      {item.notes ? item.notes : "+ Add special instructions (e.g. no onions)"}
                    </span>
                  </button>
                  <button
                    onClick={() => handleOpenNoteEditor(item)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
          <div className="flex justify-between items-center text-lg font-black text-gray-900 px-1">
            <span>Total</span>
            <span className="text-xl">${calculateTotal().toFixed(2)}</span>
          </div>
          <button 
            onClick={handleCloseTable}
            disabled={!order || isProcessing}
            className="w-full py-3.5 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white font-bold rounded-xl transition-all shadow-sm"
          >
            Close Table & Complete Order
          </button>
        </div>
      </div>

      {/* Menu Panel */}
      <div className="flex flex-col flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Fast Search & Categories Header */}
        <div className="p-4 border-b border-gray-100 space-y-3 bg-white">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Quick search menu items (e.g. Burger, Latte)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-transparent focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none text-sm font-medium"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategoryId === null ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Items
            </button>
            {menu.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategoryId === cat.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 content-start">
          {filteredMenu.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-gray-400 text-sm">
              No menu items match your search.
            </div>
          ) : (
            filteredMenu.map((item: any) => (
              <button
                key={item.id}
                onClick={() => handleAddItem(item)}
                disabled={isProcessing}
                className="flex flex-col text-left p-3.5 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/40 transition-all active:scale-[0.98] group bg-white shadow-2xs"
              >
                <div className="flex justify-between items-start w-full gap-1">
                  <span className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors text-sm leading-tight">
                    {item.name}
                  </span>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex-shrink-0">
                    ${item.price.toFixed(2)}
                  </span>
                </div>
                {item.description && (
                  <span className="text-xs text-gray-400 mt-1 line-clamp-1">{item.description}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Special Instructions Note Editor Modal */}
      {editingNoteItemId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="text-blue-600" size={20} />
                <h3 className="font-bold text-gray-900 text-lg">Special Instructions</h3>
              </div>
              <button 
                onClick={() => setEditingNoteItemId(null)}
                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Kitchen Note / Instructions
              </label>
              <textarea
                value={noteValue}
                onChange={e => setNoteValue(e.target.value)}
                placeholder="e.g. No onions, extra crispy, allergy info..."
                rows={3}
                autoFocus
                className="w-full p-3 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl text-sm outline-none font-medium"
              />
            </div>

            {/* Quick Chips */}
            <div>
              <span className="text-xs text-gray-400 font-semibold block mb-2">Quick Tags:</span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_NOTES.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNoteValue(prev => prev ? `${prev}, ${tag}` : tag)}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setNoteValue('');
                  setEditingNoteItemId(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
              >
                Save Instructions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
