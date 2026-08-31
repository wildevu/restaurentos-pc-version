const fs = require('fs');
let code = fs.readFileSync('src/api/admin.ts', 'utf8');

// Ensure we import sessions
code = code.replace("import { users, restaurants, tables, auditEvents, hubState }", "import { users, restaurants, tables, auditEvents, hubState, sessions }");

const target = "if (!parsed.isActive && targetUser.isActive) {\n      updates.disabledAt = new Date();\n      updates.disabledByUserId = req.user.id;\n    }";
const replacement = target + "\n\n    if (!parsed.isActive) {\n      await db.update(sessions).set({ revokedAt: new Date(), revokedReason: 'User deactivated' }).where(and(eq(sessions.userId, targetUserId), sql`revoked_at IS NULL`));\n    }";

code = code.replace(target, replacement);
fs.writeFileSync('src/api/admin.ts', code);
