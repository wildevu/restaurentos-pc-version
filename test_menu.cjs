const http = require('http');

async function run() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  // TEST A: Create category and item
  const catRes = await fetch('http://localhost:3000/api/admin/menu/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: 'Test Category', displayOrder: 1 })
  });
  const catData = await catRes.json();
  console.log("TEST A - Category Created:", catData);

  const itemRes = await fetch('http://localhost:3000/api/admin/menu/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ categoryId: catData.id, name: 'Test Item', price: 999, isAvailable: true })
  });
  const itemData = await itemRes.json();
  console.log("TEST A - Item Created:", itemData);

  // TEST B: Edit Item
  const editRes = await fetch(`http://localhost:3000/api/admin/menu/items/${itemData.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: 'Edited Test Item', price: 1099 })
  });
  const editData = await editRes.json();
  console.log("TEST B - Item Edited:", editData);

  // TEST C: Availability
  const availRes = await fetch(`http://localhost:3000/api/admin/menu/items/${itemData.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ isAvailable: false })
  });
  const availData = await availRes.json();
  console.log("TEST C - Item Availability Changed:", availData);

  // TEST D: Archive Item
  const archRes = await fetch(`http://localhost:3000/api/admin/menu/items/${itemData.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ archive: true })
  });
  const archData = await archRes.json();
  console.log("TEST D - Item Archived:", archData);

  // TEST E/F/G/H: CSV Valid Import
  const csvRows = [
    { category: 'Beverages', name: 'Water', description: 'Fresh water', price: 100, isAvailable: true, displayOrder: 1 },
    { category: 'Beverages', name: 'Soda', description: 'Fizzy soda', price: 200, isAvailable: true, displayOrder: 2 },
  ];
  const importRes = await fetch('http://localhost:3000/api/admin/menu/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ mode: 'MERGE', rows: csvRows })
  });
  const importData = await importRes.json();
  console.log("TEST E - CSV Valid Import:", importData);

  // Fetch final menu state
  const menuRes = await fetch('http://localhost:3000/api/admin/menu', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const menuData = await menuRes.json();
  console.log("FINAL MENU STATE:", JSON.stringify(menuData, null, 2));

  process.exit(0);
}
setTimeout(run, 3000);
