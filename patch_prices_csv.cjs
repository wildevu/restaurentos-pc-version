const fs = require('fs');
let code = fs.readFileSync('src/components/admin/MenuManagement.tsx', 'utf8');

// The template is already what the prompt specified, except maybe I should ensure the import divides by 100.
code = code.replace(
  "price: numPrice,",
  "price: numPrice / 100,"
);

code = code.replace(
  "const csvContent = \"category,name,description,price,isAvailable,displayOrder\\nCoffee,Espresso,Strong single espresso,250,true,1\\nCoffee,Cappuccino,Espresso with milk foam,350,true,2\\nFood,Chicken Sandwich,Grilled chicken sandwich,650,true,1\";",
  "const csvContent = \"category,name,description,price,isAvailable,displayOrder\\nCoffee,Espresso,Strong single espresso,250,true,1\\nCoffee,Cappuccino,Espresso with milk foam,350,true,2\\nFood,Chicken Sandwich,Grilled chicken sandwich,650,true,1\";"
);

// If the form says "Price (in cents)" I'll change it to "Price (in cents, e.g. 250 for $2.50)"
code = code.replace(
  "Price (in cents)",
  "Price (in cents, e.g. 250 for $2.50)"
);

// In the edit form we will show the stored decimal price but multiplied by 100, so the user inputs cents consistently.
code = code.replace(
  "setItemPrice(item.price.toString());",
  "setItemPrice(Math.round(item.price * 100).toString());"
);

code = code.replace(
  "price: Number(itemPrice),",
  "price: Number(itemPrice) / 100,"
);

fs.writeFileSync('src/components/admin/MenuManagement.tsx', code);
