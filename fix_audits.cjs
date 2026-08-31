const fs = require('fs');
let content = fs.readFileSync('src/db/queries.ts', 'utf8');

// Fix DECREMENT quantity reached zero
content = content.replace(
  "metadata: JSON.stringify({ reason: 'quantity_reached_zero' })",
  "metadata: JSON.stringify({ reason: 'quantity_reached_zero', menuItemId: item.menuItemId, productName: item.productNameSnapshot, previousQuantity: item.quantity })"
);

// Fix DECREMENT normal
content = content.replace(
  "action: 'ITEM_DECREMENTED', entityType: 'ORDER_ITEM', entityId: orderItemId, createdAt: now",
  "action: 'ITEM_DECREMENTED', entityType: 'ORDER_ITEM', entityId: orderItemId, metadata: JSON.stringify({ menuItemId: item.menuItemId, productName: item.productNameSnapshot, previousQuantity: item.quantity }), createdAt: now"
);

// Fix REMOVE
content = content.replace(
  "metadata: JSON.stringify({ reason: 'explicit_remove' })",
  "metadata: JSON.stringify({ reason: 'explicit_remove', menuItemId: item.menuItemId, productName: item.productNameSnapshot, previousQuantity: item.quantity })"
);

fs.writeFileSync('src/db/queries.ts', content);
console.log("Updated audits");
