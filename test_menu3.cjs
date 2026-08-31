async function run() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner2', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const catRes = await fetch('http://localhost:3000/api/admin/menu/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: 'Test Category', displayOrder: 1 })
  });
  console.log("catRes Status:", catRes.status);
  console.log("catRes Text:", await catRes.text());
  process.exit(0);
}
setTimeout(run, 500);
