const fs = require('fs');

const endpoints = `
adminRouter.post('/menu/categories', async (req: any, res) => {
  try {
    const { name, displayOrder } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const id = uuidv4();
    await db.insert(menuCategories).values({
      id,
      name,
      displayOrder: displayOrder || 0
    });
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'MENU_CATEGORY_CREATED',
      entityType: 'MENU_CATEGORY',
      entityId: id,
      metadata: JSON.stringify({ name }),
      createdAt: new Date(),
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put('/menu/categories/:id', async (req: any, res) => {
  try {
    const { name, displayOrder, archive } = req.body;
    const { id } = req.params;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (archive !== undefined) updateData.archivedAt = archive ? new Date() : null;

    if (Object.keys(updateData).length > 0) {
      await db.update(menuCategories).set(updateData).where(eq(menuCategories.id, id));
    }
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: archive ? 'MENU_CATEGORY_ARCHIVED' : 'MENU_CATEGORY_UPDATED',
      entityType: 'MENU_CATEGORY',
      entityId: id,
      metadata: JSON.stringify(updateData),
      createdAt: new Date(),
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/menu/items', async (req: any, res) => {
  try {
    const { categoryId, name, description, price, isAvailable, displayOrder } = req.body;
    if (!categoryId || !name || price === undefined) return res.status(400).json({ error: 'Missing required fields' });
    
    const id = uuidv4();
    const now = new Date();
    await db.insert(menuItems).values({
      id,
      categoryId,
      name,
      description: description || null,
      price: Number(price),
      isAvailable: isAvailable !== false,
      displayOrder: displayOrder || 0,
      createdAt: now,
      updatedAt: now,
    });
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'MENU_ITEM_CREATED',
      entityType: 'MENU_ITEM',
      entityId: id,
      metadata: JSON.stringify({ name }),
      createdAt: now,
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put('/menu/items/:id', async (req: any, res) => {
  try {
    const { categoryId, name, description, price, isAvailable, displayOrder, archive, restore } = req.body;
    const { id } = req.params;
    
    const updateData: any = { updatedAt: new Date() };
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = Number(price);
    if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    
    if (archive === true) updateData.archivedAt = new Date();
    if (restore === true) updateData.archivedAt = null;

    let action = 'MENU_ITEM_UPDATED';
    if (archive === true) action = 'MENU_ITEM_ARCHIVED';
    else if (restore === true) action = 'MENU_ITEM_RESTORED';
    else if (isAvailable !== undefined) action = 'MENU_ITEM_AVAILABILITY_CHANGED';

    await db.update(menuItems).set(updateData).where(eq(menuItems.id, id));
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action,
      entityType: 'MENU_ITEM',
      entityId: id,
      metadata: JSON.stringify(updateData),
      createdAt: new Date(),
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/menu/import', async (req: any, res) => {
  try {
    const { mode, rows } = req.body; // mode: 'REPLACE' or 'MERGE'
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No valid rows provided' });
    }
    
    const now = new Date();

    await db.transaction(async (tx: any) => {
      if (mode === 'REPLACE') {
        // Soft delete all existing active menu items and categories
        await tx.update(menuCategories).set({ archivedAt: now }).where(not(sql\`archived_at IS NOT NULL\`));
        await tx.update(menuItems).set({ archivedAt: now, updatedAt: now }).where(not(sql\`archived_at IS NOT NULL\`));
      }

      // We need to resolve categories by name to category IDs
      const categoryCache = new Map<string, string>(); // name (lowercase) -> id
      
      const existingCategories = await tx.select().from(menuCategories).where(not(sql\`archived_at IS NOT NULL\`));
      for (const cat of existingCategories) {
        categoryCache.set(cat.name.trim().toLowerCase(), cat.id);
      }

      // Group items by category from the CSV
      const newItems = [];
      let importedCats = 0;
      let importedItems = 0;

      for (const row of rows) {
        const catName = row.category.trim();
        let catId = categoryCache.get(catName.toLowerCase());
        
        if (!catId) {
          catId = uuidv4();
          await tx.insert(menuCategories).values({
            id: catId,
            name: catName,
            displayOrder: parseInt(row.displayOrder) || importedCats
          });
          categoryCache.set(catName.toLowerCase(), catId);
          importedCats++;
        }
        
        const itemName = row.name.trim();
        
        if (mode === 'MERGE') {
          // Check for duplicate
          const existing = await tx.select().from(menuItems).where(and(eq(menuItems.categoryId, catId), eq(menuItems.name, itemName), not(sql\`archived_at IS NOT NULL\`)));
          if (existing.length > 0) {
            // Update existing or skip? Requirement: update them or skip. Let's update.
            await tx.update(menuItems).set({
              price: Number(row.price),
              description: row.description || null,
              isAvailable: row.isAvailable,
              displayOrder: parseInt(row.displayOrder) || 0,
              updatedAt: now
            }).where(eq(menuItems.id, existing[0].id));
            importedItems++;
            continue;
          }
        }
        
        // Insert new item
        await tx.insert(menuItems).values({
          id: uuidv4(),
          categoryId: catId,
          name: itemName,
          description: row.description || null,
          price: Number(row.price),
          isAvailable: row.isAvailable,
          displayOrder: parseInt(row.displayOrder) || importedItems,
          createdAt: now,
          updatedAt: now
        });
        importedItems++;
      }

      await tx.insert(auditEvents).values({
        id: uuidv4(),
        restaurantId: req.user.restaurantId,
        actorUserId: req.user.id,
        action: 'MENU_IMPORTED',
        entityType: 'RESTAURANT',
        entityId: req.user.restaurantId,
        metadata: JSON.stringify({ mode, importedCats, importedItems }),
        createdAt: now,
      });
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
`;

fs.appendFileSync('src/api/admin.ts', endpoints);
