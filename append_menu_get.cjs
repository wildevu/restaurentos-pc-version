const fs = require('fs');

const endpoints = `
adminRouter.get('/menu', async (req: any, res) => {
  try {
    const { isNull, asc } = require('drizzle-orm');
    const categories = await db.select().from(menuCategories).where(isNull(menuCategories.archivedAt)).orderBy(asc(menuCategories.displayOrder));
    const items = await db.select().from(menuItems).where(isNull(menuItems.archivedAt)).orderBy(asc(menuItems.displayOrder));
    
    res.json({ categories, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
`;

fs.appendFileSync('src/api/admin.ts', endpoints);
