const fs = require('fs');
let content = fs.readFileSync('src/db/queries.ts', 'utf8');

// Find processCommand
const parts = content.split("export async function processCommand(");
const afterProcessCommand = parts[1];

// Find business logic start
const txStartIdx = afterProcessCommand.indexOf("switch (command.type) {");
const txEndIdx = afterProcessCommand.indexOf("// Update Hub State Version");

const businessLogic = afterProcessCommand.substring(txStartIdx, txEndIdx);

let newQueries = parts[0] + 
`async function runTransactionWithRetry<T>(
  fn: (tx: any) => Promise<T>,
  retries = 5
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await db.transaction(fn, { behavior: 'immediate' });
    } catch (err: any) {
      if (err.message && err.message.includes('SQLITE_BUSY')) {
        await new Promise(r => setTimeout(r, 50 * Math.pow(2, i)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Database transaction failed after retries due to lock contention');
}

export async function processCommand(command: z.infer<typeof CommandPayloadSchema>, user: any, clientInstallationId?: string) {
  return await runTransactionWithRetry(async (tx) => {
    const now = new Date();
    
    // 1. Idempotency Check & Claim (Atomic within the transaction)
    const res = await tx.insert(idempotencyKeys).values({
      id: command.actionId,
      restaurantId: user.restaurantId,
      actorUserId: user.id,
      operation: command.type,
      createdAt: now,
      stateVersion: null
    }).onConflictDoNothing().run();

    if (res.rowsAffected === 0) {
      // Duplicate! It must have been committed by a previous transaction.
      const existing = await tx.select().from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.restaurantId, user.restaurantId), eq(idempotencyKeys.id, command.actionId)))
        .get();
      
      if (existing && existing.stateVersion !== null) {
        return { 
          success: true, 
          duplicate: true, 
          actionId: command.actionId, 
          stateVersion: existing.stateVersion 
        };
      } else {
        // This should theoretically never happen now because we never commit a null stateVersion.
        throw new Error('Command found in invalid state');
      }
    }

    // 2. Business Logic
` + businessLogic + `
    // 3. Update Hub State Version
    const versionRes = await tx.update(hubState)
      .set({ version: sql\`\${hubState.version} + 1\`, updatedAt: now })
      .where(eq(hubState.restaurantId, user.restaurantId))
      .returning({ version: hubState.version })
      .get();

    let stateVersion = versionRes?.version;
    if (stateVersion === undefined) {
      stateVersion = 1;
      await tx.insert(hubState).values({ restaurantId: user.restaurantId, version: stateVersion, updatedAt: now });
    }

    // 4. Record successful idempotency completion
    await tx.update(idempotencyKeys)
      .set({ stateVersion })
      .where(and(eq(idempotencyKeys.restaurantId, user.restaurantId), eq(idempotencyKeys.id, command.actionId)));

    return { 
      success: true,
      duplicate: false, 
      actionId: command.actionId,
      stateVersion,
      state: await getFrontendStateTx(tx, stateVersion) 
    };
  });
}
`;

fs.writeFileSync('src/db/queries.ts', newQueries);
