const fs = require('fs');
let content = fs.readFileSync('src/db/queries.ts', 'utf8');

content = content.replace(
  "throw new CommandError('Database transaction failed after retries due to lock contention');",
  "throw new CommandError('Database transaction failed after retries due to lock contention', true);"
);

// We need to also change `throw new CommandError('Unknown command type');` to `false`
content = content.replace(
  "throw new CommandError('Unknown command type');",
  "throw new CommandError('Unknown command type', false);"
);

// And the duplicate check theoretically never happen
content = content.replace(
  "throw new CommandError('Command found in invalid state');",
  "throw new CommandError('Command found in invalid state', true);"
);

fs.writeFileSync('src/db/queries.ts', content);
