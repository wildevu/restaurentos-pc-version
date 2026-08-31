const fs = require('fs');
let code = fs.readFileSync('src/components/TableDetail.tsx', 'utf8');

const oldFilter = `  const filteredMenu = menu.flatMap(cat => cat.items).filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );`;

const newFilter = `  const filteredMenu = menu.flatMap(cat => cat.items).filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a: any, b: any) => {
    if (!searchTerm) return 0;
    const searchLower = searchTerm.toLowerCase();
    const aNameLower = a.name.toLowerCase();
    const bNameLower = b.name.toLowerCase();
    
    // Priority 1: Exact match
    const aExact = aNameLower === searchLower;
    const bExact = bNameLower === searchLower;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    // Priority 2: Starts with
    const aStarts = aNameLower.startsWith(searchLower);
    const bStarts = bNameLower.startsWith(searchLower);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // Priority 3: Default alphabetical (contains)
    return aNameLower.localeCompare(bNameLower);
  });`;

code = code.replace(oldFilter, newFilter);

fs.writeFileSync('src/components/TableDetail.tsx', code);
