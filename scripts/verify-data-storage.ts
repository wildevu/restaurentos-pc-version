import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function run(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'restaurantos-storage-check-'));
  const dataDir = path.join(root, 'ProgramData', 'RestaurantOS');
  const dbPath = path.join(dataDir, 'data', 'restaurantos.db');
  const oldDataDir = process.env.RESTAURANTOS_DATA_DIR;
  const oldDbPath = process.env.DB_PATH;

  try {
    process.env.RESTAURANTOS_DATA_DIR = dataDir;
    process.env.DB_PATH = dbPath;

    // Import after setting paths because production paths are resolved once at startup.
    const paths = await import('../src/paths');
    assert.equal(paths.DATA_DIR, dataDir);
    assert.equal(paths.DB_PATH, dbPath);

    paths.ensureDirectories({ strict: true, verifyWritable: true });
    for (const dir of [
      paths.DATA_DIR,
      paths.DB_DIR,
      path.dirname(paths.DB_PATH),
      paths.BACKUP_DIR,
      paths.LOG_DIR,
      paths.CONFIG_DIR
    ]) {
      assert.ok(fs.statSync(dir).isDirectory(), `required directory exists: ${dir}`);
    }

    const dbHandle = fs.openSync(paths.DB_PATH, 'a+');
    try {
      fs.writeSync(dbHandle, Buffer.from('storage verification'));
      fs.fsyncSync(dbHandle);
    } finally {
      fs.closeSync(dbHandle);
    }
    assert.ok(fs.statSync(paths.DB_PATH).isFile(), 'database file can be created and opened');

    const probes = fs.readdirSync(paths.DB_DIR).filter(name => name.startsWith('.restaurantos-write-check-'));
    assert.deepEqual(probes, [], 'temporary write probes are removed');

    console.log('PASS: RestaurantOS data directories and database file are writable.');
  } finally {
    if (oldDataDir === undefined) delete process.env.RESTAURANTOS_DATA_DIR;
    else process.env.RESTAURANTOS_DATA_DIR = oldDataDir;
    if (oldDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = oldDbPath;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
