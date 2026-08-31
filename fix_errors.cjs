const fs = require('fs');
let content = fs.readFileSync('src/db/queries.ts', 'utf8');

// Insert a CommandError class at the top
content = content.replace(
  "export async function getFrontendStateTx",
  `export class CommandError extends Error {
  public isRetryable: boolean;
  constructor(message: string, isRetryable: boolean = false) {
    super(message);
    this.name = 'CommandError';
    this.isRetryable = isRetryable;
  }
}

export async function getFrontendStateTx`
);

// Replace throw new Error with throw new CommandError inside business logic
content = content.replace(/throw new Error\(/g, "throw new CommandError(");

fs.writeFileSync('src/db/queries.ts', content);
