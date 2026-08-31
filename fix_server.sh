sed -i -e '/import { z } from '\''zod'\'';/a\
import { CommandPayloadSchema } from '\''./src/schemas'\'';\
import { processCommand, getFrontendStateTx } from '\''./src/db/queries'\'';\
import { db } from '\''./src/db/index'\'';\
' server.ts

# Remove the old socket event handlers inside io.on('connection') 
# and replace them with the COMMAND handler
perl -0777 -pi -e 's/    socket.on\('"'"'OPEN_TABLE'"'"'.*?socket.emit\('"'"'STATE_UPDATE'"'"', await getFrontendState\(\)\);\n    }\);\n/    socket.on('"'"'COMMAND'"'"', async (payload, callback) => {\n      try {\n        const command = CommandPayloadSchema.parse(payload);\n        const result = await processCommand(command, socket.user, socket.handshake.auth.clientInstallationId);\n        if (callback) callback({ success: true, duplicate: result.duplicate });\n        if (!result.duplicate) {\n          io.emit('"'"'STATE_UPDATE'"'"', result.state);\n        }\n      } catch (err: any) {\n        logger.error(`Command failed: ${err.message}`);\n        if (callback) callback({ success: false, error: err.message });\n      }\n    });\n/s' server.ts

# We also need to fix where `getFrontendState` is called for the initial connection.
sed -i 's/socket.emit('\''STATE_UPDATE'\'', await getFrontendState());/socket.emit('\''STATE_UPDATE'\'', await db.transaction(async (tx) => await getFrontendStateTx(tx)));/g' server.ts
