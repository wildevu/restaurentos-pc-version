const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldCatch = `} catch (err: any) {
        logger.error(\`Command failed: \${err.message}\`);
        const isRetryable = err instanceof CommandError ? err.isRetryable : true; // Assume unknown errors are retryable
        if (callback) callback({ success: false, retryable: isRetryable, error: err.message });
      }`;

const newCatch = `} catch (err: any) {
        logger.error(\`Command failed: \${err.message}\`);
        let isRetryable = true;
        if (err && err.name === 'CommandError') {
          isRetryable = err.isRetryable;
        } else if (err && err.name === 'ZodError') {
          isRetryable = false;
        }
        if (callback) callback({ success: false, retryable: isRetryable, error: err.message });
      }`;

content = content.replace(oldCatch, newCatch);
fs.writeFileSync('server.ts', content);
