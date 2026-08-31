const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace("return (\n  <BrowserRouter>\nreturn (", "return (\n  <BrowserRouter>");
code = code.replace("  );\n}  </BrowserRouter>\n  );\n}", "    </BrowserRouter>\n  );\n}");

fs.writeFileSync('src/App.tsx', code);
