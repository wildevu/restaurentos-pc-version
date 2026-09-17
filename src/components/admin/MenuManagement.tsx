import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, Upload, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';

export function MenuManagement({ authToken }: { authToken: string }) {
  const { t, formatCurrency, currency } = useI18n();
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionErrorMsg, setActionErrorMsg] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals state
  const [showCatModal, setShowCatModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Category delete state
  const [showDeleteCatModal, setShowDeleteCatModal] = useState(false);
  const [catToDelete, setCatToDelete] = useState<any>(null);
  const [deleteCatAction, setDeleteCatAction] = useState<'ARCHIVE_ITEMS' | 'MOVE_ITEMS'>('ARCHIVE_ITEMS');
  const [targetReassignCatId, setTargetReassignCatId] = useState<string>('');

  // Item delete state
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  // Form states
  const [catName, setCatName] = useState('');
  const [catDisplayOrder, setCatDisplayOrder] = useState('0');

  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCostPrice, setItemCostPrice] = useState('');
  const [itemAvail, setItemAvail] = useState(true);
  const [itemOrder, setItemOrder] = useState('0');

  // Import state
  const [csvRaw, setCsvRaw] = useState('');
  const [importMode, setImportMode] = useState<'REPLACE' | 'MERGE'>('MERGE');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [previewStats, setPreviewStats] = useState<{ newCount: number; updateCount: number; duplicateCount: number } | null>(null);

  const showToast = (msg: string, isErr = false) => {
    if (isErr) {
      setActionErrorMsg(msg);
      setTimeout(() => setActionErrorMsg(''), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

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
      showToast(t('menu.categorySavedSuccess', 'Category saved successfully.'));
      fetchMenu();
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  const handleDeleteCat = (cat: any) => {
    setCatToDelete(cat);
    setDeleteCatAction('ARCHIVE_ITEMS');
    const otherCats = categories.filter(c => c.id !== cat.id);
    setTargetReassignCatId(otherCats[0]?.id || '');
    setShowDeleteCatModal(true);
  };

  const executeCatDelete = async (catId: string, actionOnItems: 'ARCHIVE_ITEMS' | 'MOVE_ITEMS', targetCatId?: string) => {
    setIsDeleting(true);
    try {
      const payload: any = { actionOnItems };
      if (actionOnItems === 'MOVE_ITEMS') {
        if (!targetCatId) {
          showToast(t('menu.destinationCategoryLabel', 'Destination Category:'), true);
          setIsDeleting(false);
          return;
        }
        payload.targetCategoryId = targetCatId;
      }

      const res = await fetch(`/api/admin/menu/categories/${catId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      
      // Optimistically remove category from state
      setCategories(prev => prev.filter(c => c.id !== catId));
      if (actionOnItems === 'ARCHIVE_ITEMS') {
        setItems(prev => prev.filter(i => i.categoryId !== catId));
      } else if (targetCatId) {
        setItems(prev => prev.map(i => i.categoryId === catId ? { ...i, categoryId: targetCatId } : i));
      }

      setShowDeleteCatModal(false);
      setCatToDelete(null);
      showToast(t('menu.categoryDeletedSuccess', 'Category deleted successfully.'));
      fetchMenu();
    } catch (err: any) {
      showToast(err.message, true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCategoryId) {
      showToast(t('menu.selectCategoryPlaceholder', 'Select category...'), true);
      return;
    }
    const priceNum = parseFloat(itemPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast(t('common.error', 'Error'), true);
      return;
    }

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
          costPrice: itemCostPrice ? parseFloat(itemCostPrice) : null,
          isAvailable: itemAvail,
          displayOrder: parseInt(itemOrder) || 0
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowItemModal(false);
      showToast(t('menu.itemSavedSuccess', 'Menu item saved successfully.'));
      fetchMenu();
    } catch (err: any) {
      showToast(err.message, true);
    }
  };

  const handleDeleteItem = (item: any) => {
    setItemToDelete(item);
    setShowDeleteItemModal(true);
  };

  const executeItemDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/menu/items/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error((await res.json()).error);

      // Optimistically remove item from state
      setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
      setShowDeleteItemModal(false);
      setItemToDelete(null);
      if (showItemModal) setShowItemModal(false);
      showToast(t('menu.itemDeletedSuccess', 'Menu item deleted successfully.'));
      fetchMenu();
    } catch (err: any) {
      showToast(err.message, true);
    } finally {
      setIsDeleting(false);
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
      showToast(err.message, true);
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
      setItemCostPrice(item.costPrice ? item.costPrice.toFixed(2) : '');
      setItemAvail(item.isAvailable);
      setItemOrder(item.displayOrder.toString());
    } else {
      setItemCategoryId(categories[0]?.id || '');
      setItemName('');
      setItemDesc('');
      setItemPrice('');
      setItemCostPrice('');
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
      const cName = catObj ? catObj.name.trim().toLowerCase() : '';
      existingMap.set(`${cName}:::${it.name.trim().toLowerCase()}`, it);
    }

    let newCount = 0;
    let updateCount = 0;
    let duplicateCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
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
      <div className="flex items-center justify-center py-20 text-gray-500 font-bold">
        <RefreshCw size={24} className="animate-spin mr-2" /> {t('common.loading', 'Loading...')}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">{t('menu.title', 'Menu Management')}</h2>
          <p className="text-sm text-gray-500 mt-1 font-medium">{t('menu.subtitle', 'Configure restaurant food & beverage offerings, categories, and fast pricing.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-xs shadow-2xs"
            title="Download blank sample CSV template"
          >
            <Download size={14} /> {t('menu.templateBtn', 'Template')}
          </button>
          <button
            onClick={exportMenuCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-xs shadow-2xs"
            title="Export full live menu with current prices to CSV"
          >
            <Download size={14} /> {t('menu.exportCsvBtn', 'Export Menu CSV')}
          </button>
          <button
            onClick={() => { setShowImportModal(true); setCsvRaw(''); setParsedRows([]); setImportErrors([]); setPreviewStats(null); }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-xs shadow-xs"
          >
            <Upload size={14} /> {t('menu.importCsvBtn', 'Import CSV')}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl mb-6 text-sm flex items-center gap-2 border border-red-200">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl mb-6 text-sm flex items-center justify-between gap-2 border border-emerald-200 shadow-xs">
          <div className="flex items-center gap-2 font-bold">
            <Check size={18} className="text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-4 bg-red-50 text-red-800 rounded-xl mb-6 text-sm flex items-center justify-between gap-2 border border-red-200 shadow-xs">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle size={18} className="text-red-600" />
            <span>{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg('')} className="text-red-600 hover:text-red-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Categories Section */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <div>
          <h3 className="text-lg font-black text-gray-900">
            {t('menu.categoriesSection', `Categories (${categories.length})`).replace('{count}', String(categories.length))}
          </h3>
          <p className="text-xs text-gray-500 font-medium">{t('menu.categoriesDesc', 'Organize food and drink into logical sections.')}</p>
        </div>
        <button 
          onClick={() => openCatModal()} 
          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-xs transition-colors"
        >
          <Plus size={15} /> {t('menu.addCategoryBtn', 'Add Category')}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden mb-10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('menu.categoryNameLabel', 'Category Name')}</th>
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('menu.displayOrderLabel', 'Display Order')}</th>
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('common.items', 'Items')}</th>
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">{t('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm font-medium">
                  {t('menu.noCategoriesYet', 'No categories created yet. Add one or import a CSV.')}
                </td>
              </tr>
            ) : (
              categories.map(cat => {
                const itemCount = items.filter(i => i.categoryId === cat.id && !i.archivedAt).length;
                return (
                  <tr key={cat.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{cat.name}</td>
                    <td className="px-6 py-4 text-gray-500 font-semibold">{cat.displayOrder}</td>
                    <td className="px-6 py-4 text-gray-600 text-sm font-medium">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold">
                        {itemCount} {t('common.items', 'items')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => openCatModal(cat)} 
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer" 
                          title={t('menu.editCategoryBtn', 'Edit Category')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCat(cat)} 
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer" 
                          title={t('menu.deleteCategoryBtn', 'Delete Category')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
          <h3 className="text-lg font-black text-gray-900">
            {t('menu.itemsSection', `Menu Items (${items.length})`).replace('{count}', String(items.length))}
          </h3>
          <p className="text-xs text-gray-500 font-medium">{t('menu.itemsDesc', 'Active dishes and drinks available to waiters.')}</p>
        </div>
        <button 
          onClick={() => openItemModal()} 
          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-xs transition-colors"
        >
          <Plus size={15} /> {t('menu.addItemBtn', 'Add Item')}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('menu.itemNameLabel', 'Item Name')} & {t('common.description', 'Description')}</th>
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('menu.categorySelectLabel', 'Category')}</th>
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('common.price', 'Price')}</th>
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('common.status', 'Status')}</th>
              <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">{t('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm font-medium">
                  {t('menu.noItemsYet', 'No active menu items found. Click \'Add Item\' or import a menu CSV.')}
                </td>
              </tr>
            ) : (
              items.map(item => {
                const cat = categories.find(c => c.id === item.categoryId);
                return (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{item.name}</div>
                      {item.description && <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5">{item.description}</div>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm font-semibold">{cat ? cat.name : t('order.noCategory', 'Uncategorized')}</td>
                    <td className="px-6 py-4 font-black text-gray-900">{formatCurrency(item.price)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAvailable(item)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                          item.isAvailable ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                        title="Click to toggle availability"
                      >
                        {item.isAvailable ? t('menu.statusAvailable', 'Available') : t('menu.statusUnavailable', 'Unavailable')}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => openItemModal(item)} 
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer" 
                          title={t('menu.editItemBtn', 'Edit Item')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(item)} 
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer" 
                          title={t('menu.deleteItemBtn', 'Delete Item')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Category Edit / Create Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-black text-gray-900 mb-4">
              {editingCat ? t('menu.editCategoryTitle', 'Edit Category') : t('menu.newCategoryTitle', 'New Category')}
            </h3>
            <form onSubmit={handleSaveCat} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t('menu.categoryNameLabel', 'Category Name')}
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  placeholder={t('menu.categoryNamePlaceholder', 'e.g. Appetizers, Main Course')}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Cost Price / COGS ({currency}) <span className="text-gray-400 font-normal lowercase">(optional for margin analysis)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemCostPrice}
                  onChange={e => setItemCostPrice(e.target.value)}
                  placeholder="e.g. 3.20"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t('menu.displayOrderLabel', 'Display Order')}
                </label>
                <input
                  type="number"
                  value={catDisplayOrder}
                  onChange={e => setCatDisplayOrder(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                {editingCat ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCatModal(false);
                      handleDeleteCat(editingCat);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                    <span>{t('menu.deleteCategoryBtn', 'Delete Category')}</span>
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowCatModal(false)} 
                    className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
                  >
                    {t('common.save', 'Save')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Edit / Create Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-gray-900 mb-4">
              {editingItem ? t('menu.editItemTitle', 'Edit Item') : t('menu.newItemTitle', 'New Item')}
            </h3>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t('menu.categorySelectLabel', 'Category')}
                </label>
                <select
                  value={itemCategoryId}
                  onChange={e => setItemCategoryId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="" disabled>{t('menu.selectCategoryPlaceholder', 'Select category...')}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t('menu.itemNameLabel', 'Item Name')}
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder={t('menu.itemNamePlaceholder', 'e.g. Grilled Salmon')}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t('menu.descriptionLabel', 'Description (Optional)')}
                </label>
                <textarea
                  value={itemDesc}
                  onChange={e => setItemDesc(e.target.value)}
                  rows={2}
                  placeholder={t('menu.descriptionPlaceholder', 'e.g. Served with roasted vegetables and lemon butter')}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t('menu.priceLabel', `Price (${currency})`).replace('{currency}', currency)}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemPrice}
                  onChange={e => setItemPrice(e.target.value)}
                  placeholder="e.g. 12.50"
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t('menu.displayOrderLabel', 'Display Order')}
                </label>
                <input
                  type="number"
                  value={itemOrder}
                  onChange={e => setItemOrder(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="itemAvail"
                  checked={itemAvail}
                  onChange={e => setItemAvail(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="itemAvail" className="text-sm font-bold text-gray-800 cursor-pointer">
                  {t('menu.availableCheckbox', 'Available for Ordering')}
                </label>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(editingItem)}
                    className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                    <span>{t('menu.deleteItemBtn', 'Delete Item')}</span>
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowItemModal(false)} 
                    className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer"
                  >
                    {t('common.save', 'Save')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-gray-900">{t('menu.importModalTitle', 'Import Menu via CSV')}</h3>
              <button onClick={() => setShowImportModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                {t('menu.importModeLabel', '1. Select Import Mode')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`p-3.5 border rounded-xl cursor-pointer flex flex-col transition-all ${importMode === 'MERGE' ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="mode" checked={importMode === 'MERGE'} onChange={() => { setImportMode('MERGE'); validateAndParseCSV(); }} />
                    <span className="font-bold text-gray-900 text-sm">{t('menu.modeMergeTitle', 'Merge / Add')}</span>
                  </div>
                  <span className="text-xs text-gray-500 mt-1 pl-5">{t('menu.modeMergeDesc', 'Adds new items and updates matching category/name items without deleting current menu.')}</span>
                </label>
                <label className={`p-3.5 border rounded-xl cursor-pointer flex flex-col transition-all ${importMode === 'REPLACE' ? 'border-red-600 bg-red-50/50 ring-2 ring-red-500/20' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="mode" checked={importMode === 'REPLACE'} onChange={() => { setImportMode('REPLACE'); validateAndParseCSV(); }} />
                    <span className="font-bold text-red-700 text-sm">{t('menu.modeReplaceTitle', 'Replace Menu')}</span>
                  </div>
                  <span className="text-xs text-gray-500 mt-1 pl-5">{t('menu.modeReplaceDesc', 'Safely archives all existing active items and imports the new menu completely.')}</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {t('menu.csvInputLabel', '2. CSV File or Text')}
                </label>
                <label className="text-xs font-bold text-blue-600 hover:underline cursor-pointer">
                  <span>{t('menu.uploadCsvFile', 'Upload .csv file')}</span>
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
                className="w-full h-36 px-3.5 py-2.5 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs font-medium text-gray-900"
              />
            </div>

            {importErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4 text-xs max-h-36 overflow-y-auto font-medium">
                <p className="font-bold mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={15} /> 
                  {t('menu.validationErrorsTitle', `Validation Errors Found (${importErrors.length})`).replace('{count}', String(importErrors.length))}
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            {parsedRows.length > 0 && importErrors.length === 0 && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl mb-4 text-xs">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <Check size={15} className="text-emerald-600" /> 
                  {t('menu.validationPassedTitle', `Validation Passed: ${parsedRows.length} rows ready`).replace('{count}', String(parsedRows.length))}
                </p>
                {previewStats && (
                  <div className="flex gap-4 mt-2 text-emerald-800 font-bold">
                    {importMode === 'MERGE' ? (
                      <>
                        <span>• {t('menu.newItemsToCreate', `New items to create: ${previewStats.newCount}`).replace('{count}', String(previewStats.newCount))}</span>
                        <span>• {t('menu.existingItemsToUpdate', `Existing items to update: ${previewStats.updateCount}`).replace('{count}', String(previewStats.updateCount))}</span>
                      </>
                    ) : (
                      <>
                        <span>• {t('menu.itemsToActivate', `New items to activate: ${parsedRows.length}`).replace('{count}', String(parsedRows.length))}</span>
                        <span>• {t('menu.itemsToArchive', `Existing active items to archive: ${items.length}`).replace('{count}', String(items.length))}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setShowImportModal(false)} 
                className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button 
                type="button" 
                disabled={importErrors.length > 0 || parsedRows.length === 0 || importing}
                onClick={commitCSV} 
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50 text-xs shadow-xs transition-all cursor-pointer"
              >
                {importing ? t('menu.importingBtn', 'Importing...') : t('menu.commitImportBtn', 'Commit Import')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Delete Modal */}
      {showDeleteCatModal && catToDelete && (() => {
        const activeItemsInCat = items.filter(i => i.categoryId === catToDelete.id && !i.archivedAt);
        const hasItems = activeItemsInCat.length > 0;

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">{t('menu.deleteCatConfirmTitle', 'Delete Category')}</h3>
                  <p className="text-xs text-gray-500 font-bold mt-0.5">"{catToDelete.name}"</p>
                </div>
              </div>

              {hasItems ? (
                <>
                  <p className="text-sm text-gray-600 leading-relaxed font-medium">
                    {t('menu.deleteCatWarning', `This category contains ${activeItemsInCat.length} active menu item(s). Please choose how you would like to handle these items:`)
                      .replace('{count}', String(activeItemsInCat.length))}
                  </p>

                  <div className="space-y-3 pt-2">
                    <label 
                      className={`p-3.5 border rounded-xl cursor-pointer flex items-start gap-3 transition-all ${
                        deleteCatAction === 'ARCHIVE_ITEMS' ? 'border-red-500 bg-red-50/50 ring-2 ring-red-500/20' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="deleteAction" 
                        checked={deleteCatAction === 'ARCHIVE_ITEMS'} 
                        onChange={() => setDeleteCatAction('ARCHIVE_ITEMS')}
                        className="mt-1" 
                      />
                      <div>
                        <span className="font-bold text-sm text-gray-900">{t('menu.deleteCatAndItemsOption', 'Delete Category & All Nested Items')}</span>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">{t('menu.deleteCatAndItemsDesc', 'Removes the category and deletes/archives all its items from active waiter ordering.')}</p>
                      </div>
                    </label>

                    <label 
                      className={`p-3.5 border rounded-xl cursor-pointer flex items-start gap-3 transition-all ${
                        deleteCatAction === 'MOVE_ITEMS' ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="deleteAction" 
                        checked={deleteCatAction === 'MOVE_ITEMS'} 
                        onChange={() => setDeleteCatAction('MOVE_ITEMS')}
                        className="mt-1" 
                      />
                      <div className="flex-1">
                        <span className="font-bold text-sm text-gray-900">{t('menu.reassignItemsOption', 'Reassign Items to Another Category')}</span>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">{t('menu.reassignItemsDesc', 'Move all items into a different active category, then delete this empty category.')}</p>
                        
                        {deleteCatAction === 'MOVE_ITEMS' && (
                          <div className="mt-3">
                            <label className="block text-xs font-bold text-gray-700 mb-1">{t('menu.destinationCategoryLabel', 'Destination Category:')}</label>
                            <select
                              value={targetReassignCatId}
                              onChange={(e) => setTargetReassignCatId(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {categories.filter(c => c.id !== catToDelete.id).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </>
              ) : (
                <div className="py-2">
                  <p className="text-sm text-gray-700 font-medium leading-relaxed">
                    {t('menu.deleteCatPrompt', `Delete category "${catToDelete.name}"?`).replace('{name}', catToDelete.name)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('menu.deleteCatAndItemsDesc', 'This category will be permanently removed.')}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  disabled={isDeleting}
                  onClick={() => { setShowDeleteCatModal(false); setCatToDelete(null); }} 
                  className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button 
                  type="button" 
                  disabled={isDeleting}
                  onClick={() => executeCatDelete(catToDelete.id, hasItems ? deleteCatAction : 'ARCHIVE_ITEMS', targetReassignCatId)}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>{t('menu.confirmDeleteCategoryBtn', 'Confirm & Delete Category')}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Item Delete Modal */}
      {showDeleteItemModal && itemToDelete && (() => {
        const itemCat = categories.find(c => c.id === itemToDelete.categoryId);
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">{t('menu.deleteItemConfirmTitle', 'Delete Menu Item')}</h3>
                  <p className="text-xs text-gray-500 font-bold mt-0.5">{itemToDelete.name}</p>
                </div>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-medium">{t('menu.categorySelectLabel', 'Category')}:</span>
                  <span className="font-bold text-gray-900">{itemCat ? itemCat.name : t('order.noCategory', 'Uncategorized')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-medium">{t('common.price', 'Price')}:</span>
                  <span className="font-bold text-gray-900">{formatCurrency(itemToDelete.price)}</span>
                </div>
              </div>

              <p className="text-sm text-gray-600 font-medium leading-relaxed">
                {t('menu.deleteItemConfirmPrompt', `Are you sure you want to delete "${itemToDelete.name}"? It will be permanently removed from the active menu.`)
                  .replace('{name}', itemToDelete.name)}
              </p>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  disabled={isDeleting}
                  onClick={() => { setShowDeleteItemModal(false); setItemToDelete(null); }} 
                  className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button 
                  type="button" 
                  disabled={isDeleting}
                  onClick={executeItemDelete}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>{t('menu.confirmDeleteItemBtn', 'Confirm & Delete Item')}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
