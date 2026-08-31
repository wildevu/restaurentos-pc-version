import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Archive, Check, X, Upload, Download, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';

export function MenuManagement({ authToken }: { authToken: string }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Modals state
  const [showCatModal, setShowCatModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [editingCat, setEditingCat] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form states
  const [catName, setCatName] = useState('');
  const [catDisplayOrder, setCatDisplayOrder] = useState('0');

  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemAvail, setItemAvail] = useState(true);
  const [itemOrder, setItemOrder] = useState('0');

  // Import state
  const [csvRaw, setCsvRaw] = useState('');
  const [importMode, setImportMode] = useState<'REPLACE' | 'MERGE'>('MERGE');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [previewStats, setPreviewStats] = useState<{ newCount: number; updateCount: number; duplicateCount: number } | null>(null);

  const fetchMenu = () => {
    fetch('/api/admin/menu', { headers: { 'Authorization': `Bearer ${authToken}` } })
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else {
          setCategories(data.categories || []);
          setItems(data.items || []);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMenu();
  }, [authToken]);

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingCat ? `/api/admin/menu/categories/${editingCat.id}` : '/api/admin/menu/categories';
      const method = editingCat ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ name: catName.trim(), displayOrder: parseInt(catDisplayOrder) || 0 })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowCatModal(false);
      fetchMenu();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleArchiveCat = async (id: string) => {
    if (!confirm('Archive this category? Active items in this category will not be shown in waiter ordering.')) return;
    try {
      const res = await fetch(`/api/admin/menu/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ archive: true })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      fetchMenu();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCategoryId) return alert('Select a category');
    const priceNum = parseFloat(itemPrice);
    if (isNaN(priceNum) || priceNum < 0) return alert('Enter a valid price');

    try {
      const url = editingItem ? `/api/admin/menu/items/${editingItem.id}` : '/api/admin/menu/items';
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          categoryId: itemCategoryId,
          name: itemName.trim(),
          description: itemDesc.trim() || null,
          price: priceNum,
          isAvailable: itemAvail,
          displayOrder: parseInt(itemOrder) || 0
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowItemModal(false);
      fetchMenu();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleArchiveItem = async (id: string) => {
    if (!confirm('Archive this item? It will be removed from the active ordering menu but preserved historically.')) return;
    try {
      const res = await fetch(`/api/admin/menu/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ archive: true })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      fetchMenu();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestoreItem = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/menu/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ restore: true })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      fetchMenu();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleAvailable = async (item: any) => {
    try {
      const res = await fetch(`/api/admin/menu/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ isAvailable: !item.isAvailable })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      fetchMenu();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openCatModal = (cat?: any) => {
    setEditingCat(cat || null);
    setCatName(cat ? cat.name : '');
    setCatDisplayOrder(cat ? cat.displayOrder.toString() : '0');
    setShowCatModal(true);
  };

  const openItemModal = (item?: any) => {
    setEditingItem(item || null);
    if (item) {
      setItemCategoryId(item.categoryId);
      setItemName(item.name);
      setItemDesc(item.description || '');
      setItemPrice(item.price.toFixed(2));
      setItemAvail(item.isAvailable);
      setItemOrder(item.displayOrder.toString());
    } else {
      setItemCategoryId(categories[0]?.id || '');
      setItemName('');
      setItemDesc('');
      setItemPrice('');
      setItemAvail(true);
      setItemOrder('0');
    }
    setShowItemModal(true);
  };

  const downloadTemplate = () => {
    const csvContent = "category,name,description,price,isAvailable,displayOrder\nCoffee,Espresso,Strong single espresso,2.50,true,1\nCoffee,Cappuccino,Espresso with milk foam,3.50,true,2\nFood,Chicken Sandwich,Grilled chicken sandwich,6.50,true,1";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "menu_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportMenuCSV = async () => {
    try {
      const res = await fetch('/api/admin/menu/export', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to export menu CSV');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `restaurant_menu_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvRaw(content);
        validateAndParseCSV(content);
      }
    };
    reader.readAsText(file);
  };

  const validateAndParseCSV = (rawText = csvRaw) => {
    const lines = rawText.trim().split('\n');
    if (lines.length < 2) {
      setImportErrors(['CSV must have a header row and at least one data row.']);
      setParsedRows([]);
      setPreviewStats(null);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const expectedHeaders = ['category', 'name', 'description', 'price', 'isavailable', 'displayorder'];
    
    // Check if expected headers exist
    const hasAllHeaders = expectedHeaders.every(h => headers.includes(h));
    if (!hasAllHeaders) {
      setImportErrors(['Missing required headers. Ensure header line is: category,name,description,price,isAvailable,displayOrder']);
      setParsedRows([]);
      setPreviewStats(null);
      return;
    }

    const errors: string[] = [];
    const rows = [];

    // Existing active items index for duplicate detection
    const existingMap = new Map<string, any>();
    for (const it of items) {
      const catObj = categories.find(c => c.id === it.categoryId);
      const catName = catObj ? catObj.name.trim().toLowerCase() : '';
      existingMap.set(`${catName}:::${it.name.trim().toLowerCase()}`, it);
    }

    let newCount = 0;
    let updateCount = 0;
    let duplicateCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // skip blank lines
      
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
      
      const { category, name, price, isavailable, displayorder, description } = row;
      
      if (!category) {
        errors.push(`Row ${i + 1}: Missing 'category'`);
      }
      if (!name) {
        errors.push(`Row ${i + 1}: Missing 'name'`);
      }
      
      let numPrice = parseFloat(price);
      if (isNaN(numPrice) || price === '') {
        errors.push(`Row ${i + 1}: Invalid numeric price '${price}'`);
      } else {
        // If price is passed as cents integer > 50 without decimal (e.g. 250), convert to 2.50
        if (!price.includes('.') && numPrice >= 50) {
          numPrice = numPrice / 100;
        }
      }

      const isAvailLower = (isavailable || 'true').toLowerCase();
      if (isAvailLower !== 'true' && isAvailLower !== 'false' && isAvailLower !== '1' && isAvailLower !== '0') {
        errors.push(`Row ${i + 1}: Invalid boolean for isAvailable '${isavailable}'. Use 'true' or 'false'.`);
      }

      const isAvailableBool = isAvailLower === 'true' || isAvailLower === '1';
      const orderInt = parseInt(displayorder) || 0;

      const itemKey = `${(category || '').toLowerCase()}:::${(name || '').toLowerCase()}`;
      if (existingMap.has(itemKey)) {
        updateCount++;
        duplicateCount++;
      } else {
        newCount++;
      }

      rows.push({
        category: category || '',
        name: name || '',
        description: description || '',
        price: isNaN(numPrice) ? 0 : numPrice,
        isAvailable: isAvailableBool,
        displayOrder: orderInt
      });
    }

    setImportErrors(errors);
    if (errors.length === 0) {
      setParsedRows(rows);
      setPreviewStats({ newCount, updateCount, duplicateCount });
    } else {
      setParsedRows([]);
      setPreviewStats(null);
    }
  };

  const commitCSV = async () => {
    if (importErrors.length > 0) return alert('Fix errors before importing.');
    if (parsedRows.length === 0) return alert('No valid data parsed.');
    
    setImporting(true);
    try {
      const res = await fetch('/api/admin/menu/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ mode: importMode, rows: parsedRows })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowImportModal(false);
      setCsvRaw('');
      setParsedRows([]);
      setPreviewStats(null);
      fetchMenu();
    } catch (err: any) {
      alert(err.message);
    }
    setImporting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <RefreshCw size={24} className="animate-spin mr-2" /> Loading menu...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Menu Management</h2>
          <p className="text-sm text-gray-500 mt-1">Configure restaurant food & beverage offerings, categories, and fast pricing.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-xs"
            title="Download blank sample CSV template"
          >
            <Download size={14} /> Template
          </button>
          <button
            onClick={exportMenuCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-xs"
            title="Export full live menu with current prices to CSV"
          >
            <Download size={14} /> Export Menu CSV
          </button>
          <button
            onClick={() => { setShowImportModal(true); setCsvRaw(''); setParsedRows([]); setImportErrors([]); setPreviewStats(null); }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-xs shadow-sm"
          >
            <Upload size={14} /> Import CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl mb-6 text-sm flex items-center gap-2">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Categories Section */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Categories ({categories.length})</h3>
          <p className="text-xs text-gray-500">Organize food and drink into logical sections.</p>
        </div>
        <button onClick={() => openCatModal()} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-100">
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Category Name</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Display Order</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Items</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">
                  No categories created yet. Add one or import a CSV.
                </td>
              </tr>
            ) : (
              categories.map(cat => {
                const itemCount = items.filter(i => i.categoryId === cat.id).length;
                return (
                  <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-gray-900">{cat.name}</td>
                    <td className="px-6 py-3.5 text-gray-500">{cat.displayOrder}</td>
                    <td className="px-6 py-3.5 text-gray-500 text-sm">{itemCount} items</td>
                    <td className="px-6 py-3.5 text-right flex justify-end gap-2">
                      <button onClick={() => openCatModal(cat)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="Edit Category">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleArchiveCat(cat.id)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors" title="Archive Category">
                        <Archive size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Menu Items Section */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Menu Items ({items.length})</h3>
          <p className="text-xs text-gray-500">Active dishes and drinks available to waiters.</p>
        </div>
        <button onClick={() => openItemModal()} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-100">
          <Plus size={16} /> Add Item
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Item Name & Description</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Price</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">
                  No active menu items found. Click 'Add Item' or import a menu CSV.
                </td>
              </tr>
            ) : (
              items.map(item => {
                const cat = categories.find(c => c.id === item.categoryId);
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.description && <div className="text-xs text-gray-500 truncate max-w-xs">{item.description}</div>}
                    </td>
                    <td className="px-6 py-3.5 text-gray-600 text-sm">{cat ? cat.name : 'Unknown'}</td>
                    <td className="px-6 py-3.5 font-semibold text-gray-900">${item.price.toFixed(2)}</td>
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => handleToggleAvailable(item)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          item.isAvailable ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                        title="Click to toggle availability"
                      >
                        {item.isAvailable ? 'Available' : 'Unavailable'}
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-right flex justify-end gap-2 items-center">
                      <button onClick={() => openItemModal(item)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="Edit Item">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleArchiveItem(item.id)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors" title="Archive Item">
                        <Archive size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Category Edit Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{editingCat ? 'Edit Category' : 'New Category'}</h3>
            <form onSubmit={handleSaveCat} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  placeholder="e.g. Appetizers, Main Course"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={catDisplayOrder}
                  onChange={e => setCatDisplayOrder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowCatModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Edit Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{editingItem ? 'Edit Item' : 'New Item'}</h3>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={itemCategoryId}
                  onChange={e => setItemCategoryId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>Select category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="e.g. Grilled Salmon"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={itemDesc}
                  onChange={e => setItemDesc(e.target.value)}
                  rows={2}
                  placeholder="e.g. Served with roasted vegetables and lemon butter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemPrice}
                  onChange={e => setItemPrice(e.target.value)}
                  placeholder="e.g. 12.50"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={itemOrder}
                  onChange={e => setItemOrder(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="itemAvail"
                  checked={itemAvail}
                  onChange={e => setItemAvail(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="itemAvail" className="text-sm font-medium text-gray-700">Available for Ordering</label>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowItemModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Import Menu via CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">1. Select Import Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`p-3 border rounded-xl cursor-pointer flex flex-col transition-all ${importMode === 'MERGE' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="mode" checked={importMode === 'MERGE'} onChange={() => { setImportMode('MERGE'); validateAndParseCSV(); }} />
                    <span className="font-semibold text-gray-900 text-sm">Merge / Add</span>
                  </div>
                  <span className="text-xs text-gray-500 mt-1 pl-5">Adds new items and updates matching category/name items without deleting current menu.</span>
                </label>
                <label className={`p-3 border rounded-xl cursor-pointer flex flex-col transition-all ${importMode === 'REPLACE' ? 'border-red-600 bg-red-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="mode" checked={importMode === 'REPLACE'} onChange={() => { setImportMode('REPLACE'); validateAndParseCSV(); }} />
                    <span className="font-semibold text-red-700 text-sm">Replace Menu</span>
                  </div>
                  <span className="text-xs text-gray-500 mt-1 pl-5">Safely archives all existing active items and imports the new menu completely.</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-semibold text-gray-700">2. CSV File or Text</label>
                <label className="text-xs text-blue-600 hover:underline cursor-pointer">
                  <span>Upload .csv file</span>
                  <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <textarea
                value={csvRaw}
                onChange={e => {
                  setCsvRaw(e.target.value);
                  validateAndParseCSV(e.target.value);
                }}
                placeholder="category,name,description,price,isAvailable,displayOrder&#10;Coffee,Espresso,Strong single espresso,2.50,true,1&#10;Coffee,Cappuccino,Espresso with milk foam,3.50,true,2"
                className="w-full h-36 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
              />
            </div>

            {importErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4 text-xs max-h-36 overflow-y-auto">
                <p className="font-bold mb-1.5 flex items-center gap-1.5"><AlertTriangle size={15} /> Validation Errors Found ({importErrors.length})</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            {parsedRows.length > 0 && importErrors.length === 0 && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl mb-4 text-xs">
                <p className="font-bold flex items-center gap-1.5 mb-1"><Check size={15} className="text-emerald-600" /> Validation Passed: {parsedRows.length} rows ready</p>
                {previewStats && (
                  <div className="flex gap-4 mt-2 text-emerald-800 font-medium">
                    {importMode === 'MERGE' ? (
                      <>
                        <span>• New items to create: {previewStats.newCount}</span>
                        <span>• Existing items to update: {previewStats.updateCount}</span>
                      </>
                    ) : (
                      <>
                        <span>• New items to activate: {parsedRows.length}</span>
                        <span>• Existing active items to archive: {items.length}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button type="button" onClick={() => setShowImportModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium">Cancel</button>
              <button 
                type="button" 
                disabled={importErrors.length > 0 || parsedRows.length === 0 || importing}
                onClick={commitCSV} 
                className="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm shadow-sm transition-all"
              >
                {importing ? 'Importing...' : 'Commit Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
