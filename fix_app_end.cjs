const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = "    </div>\n  );\n}\n\nexport default App;";
const replacement = "    </div>\n    </BrowserRouter>\n  );\n}\n\nexport default App;";
if (code.includes(target)) {
  code = code.replace(target, replacement);
} else {
  // Let's just find the end of the App component
  code = code.replace("    </div>\n  );\n}", "    </div>\n    </BrowserRouter>\n  );\n}");
}
fs.writeFileSync('src/App.tsx', code);
