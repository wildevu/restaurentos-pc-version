import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Archive, CheckCircle, ArrowUp, ArrowDown, Trash2, RotateCcw, Filter, LayoutGrid } from 'lucide-react';

export function TableManagement({ authToken }: { authToken: string }) {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  
  const [number, setNumber] = useState(1);
  const [label, setLabel] = useState('');
  const [section, setSection] = useState('Main Dining');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [archived, setArchived] = useState(false);
  
  // Filter state
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('ALL');
  const [showArchivedFilter, setShowArchivedFilter] = useState(false);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/tables', { headers: { 'Authorization': `Bearer ${authToken}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to load tables');
      } else {
        setTables(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [authToken]);

  const uniqueSections = Array.from(new Set(tables.map(t => t.section || 'Main Dining')));

  const handleOpenNew = () => {
    setEditingTable(null);
    const nextNum = tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1;
    setNumber(nextNum);
    setLabel('');
    setSection(uniqueSections[0] || 'Main Dining');
    setDisplayOrder(nextNum);
    setArchived(false);
    setShowModal(true);
  };
  
  const handleOpenEdit = (table: any) => {
    setEditingTable(table);
    setNumber(table.number);
    setLabel(table.label || '');
    setSection(table.section || 'Main Dining');
    setDisplayOrder(table.displayOrder || table.number);
    setArchived(!!table.archivedAt);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    const url = editingTable ? `/api/admin/tables/${editingTable.id}` : `/api/admin/tables`;
    const method = editingTable ? 'PUT' : 'POST';
    
    const body: any = {
      number: Number(number),
      label: label.trim() || null,
      section: section.trim() || 'Main Dining',
      displayOrder: Number(displayOrder)
    };
    if (editingTable) {
      body.archived = archived;
    }
    
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to save table');
      else {
        setShowModal(false);
        setSuccessMsg(editingTable ? 'Table updated successfully' : 'Table created successfully');
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchTables();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleArchive = async (table: any) => {
    setError('');
    const willArchive = !table.archivedAt;
    try {
      const res = await fetch(`/api/admin/tables/${table.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ archived: willArchive })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update table archive state');
      } else {
        fetchTables();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (table: any) => {
    if (!window.confirm(`Are you sure you want to delete or archive Table ${table.number}?`)) return;
    setError('');
    try {
      const res = await fetch(`/api/admin/tables/${table.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to delete table');
      else {
        fetchTables();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredTables.length) return;

    const current = filteredTables[index];
    const adjacent = filteredTables[targetIndex];

    const orderings = [
      { id: current.id, displayOrder: adjacent.displayOrder || targetIndex },
      { id: adjacent.id, displayOrder: current.displayOrder || index }
    ];

    try {
      const res = await fetch('/api/admin/tables/reorder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderings })
      });
      if (res.ok) {
        fetchTables();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredTables = tables.filter(t => {
    if (!showArchivedFilter && t.archivedAt) return false;
    if (showArchivedFilter && !t.archivedAt) return false;
    if (selectedSectionFilter !== 'ALL' && (t.section || 'Main Dining') !== selectedSectionFilter) return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-amber-500" /> Dining Room & Table Layout
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure tables, dining areas/sections, sequence order, and availability.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-neutral-950 font-semibold text-xs rounded-xl hover:bg-amber-400 shadow-md shadow-amber-500/10 transition-colors"
        >
          <Plus size={16} /> Add Table
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs">{error}</div>}
      {successMsg && <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs">{successMsg}</div>}

      {/* Filter and Section Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-800/80 border border-neutral-700/80 p-3 rounded-xl mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
          <span className="text-xs font-medium text-neutral-300">Section:</span>
          <select
            value={selectedSectionFilter}
            onChange={e => setSelectedSectionFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Sections ({tables.length})</option>
            {uniqueSections.map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchivedFilter(!showArchivedFilter)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showArchivedFilter
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-medium'
                : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {showArchivedFilter ? 'Showing Archived Tables' : 'View Archived Tables'}
          </button>
        </div>
      </div>

      <div className="bg-neutral-800/80 border border-neutral-700/80 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-400">Loading tables...</div>
        ) : filteredTables.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400">
            No {showArchivedFilter ? 'archived' : 'active'} tables found in this section.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-900/60 border-b border-neutral-700/80">
                <th className="px-5 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Order</th>
                <th className="px-5 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Table #</th>
                <th className="px-5 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Section</th>
                <th className="px-5 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Label</th>
                <th className="px-5 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Current Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-700/50">
              {filteredTables.map((table, idx) => (
                <tr key={table.id} className="hover:bg-neutral-700/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveOrder(idx, 'up')}
                        className="p-1 text-neutral-400 hover:text-white disabled:opacity-20 disabled:hover:text-neutral-400 transition-colors"
                        title="Move Up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        disabled={idx === filteredTables.length - 1}
                        onClick={() => handleMoveOrder(idx, 'down')}
                        className="p-1 text-neutral-400 hover:text-white disabled:opacity-20 disabled:hover:text-neutral-400 transition-colors"
                        title="Move Down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <span className="text-xs font-mono text-neutral-500 ml-1">{table.displayOrder || table.number}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-white text-sm">
                    Table {table.number}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-700/60 border border-neutral-600 text-neutral-200">
                      {table.section || 'Main Dining'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-neutral-300">
                    {table.label || <span className="text-neutral-500 italic">No label</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {table.archivedAt ? (
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-500 font-medium">
                        <Archive size={13} /> Archived
                      </span>
                    ) : table.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> Active Order
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                        <CheckCircle size={13} /> Empty / Ready
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(table)}
                        className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-700/50 rounded-lg transition-colors"
                        title="Edit Table"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(table)}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-700/50 rounded-lg transition-colors"
                        title={table.archivedAt ? 'Restore Table' : 'Archive Table'}
                      >
                        {table.archivedAt ? <RotateCcw size={15} /> : <Archive size={15} />}
                      </button>
                      <button
                        disabled={table.status === 'ACTIVE'}
                        onClick={() => handleDelete(table)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-700/50 rounded-lg disabled:opacity-30 transition-colors"
                        title="Delete Table"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 border border-neutral-700 rounded-2xl shadow-2xl max-w-md w-full p-6 text-neutral-100">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingTable ? `Edit Table ${editingTable.number}` : 'Add New Table'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Table Number *</label>
                <input
                  type="number"
                  value={number}
                  onChange={e => setNumber(Number(e.target.value))}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                  min={1}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Dining Section / Area</label>
                <input
                  type="text"
                  list="sections-list"
                  value={section}
                  onChange={e => setSection(e.target.value)}
                  placeholder="e.g. Main Dining, Patio, Bar"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  required
                />
                <datalist id="sections-list">
                  {uniqueSections.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Custom Label (Optional)</label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Booth by Window, High Top 4"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Display Sequence Order</label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={e => setDisplayOrder(Number(e.target.value))}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {editingTable && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="archived"
                    checked={archived}
                    onChange={e => setArchived(e.target.checked)}
                    className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-amber-500 focus:ring-0"
                  />
                  <label htmlFor="archived" className="text-xs font-medium text-neutral-300">
                    Archived (Hide from active waiter table grid)
                  </label>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 mt-2 border-t border-neutral-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs text-neutral-300 hover:bg-neutral-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 text-neutral-950 font-semibold text-xs rounded-xl hover:bg-amber-400 transition-colors"
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
