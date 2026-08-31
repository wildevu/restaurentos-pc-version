const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// The CommandError is in src/db/queries
content = content.replace(
  "const { processCommand } = require('./src/db/queries');",
  "const { processCommand, CommandError } = require('./src/db/queries');"
);
content = content.replace(
  "import { processCommand } from './src/db/queries';",
  "import { processCommand, CommandError } from './src/db/queries';"
);

const oldCatch = `} catch (err: any) {
        logger.error(\`Command failed: \${err.message}\`);
        if (callback) callback({ success: false, error: err.message });
      }`;

const newCatch = `} catch (err: any) {
        logger.error(\`Command failed: \${err.message}\`);
        const isRetryable = err instanceof CommandError ? err.isRetryable : true; // Assume unknown errors are retryable
        if (callback) callback({ success: false, retryable: isRetryable, error: err.message });
      }`;

content = content.replace(oldCatch, newCatch);
fs.writeFileSync('server.ts', content);
