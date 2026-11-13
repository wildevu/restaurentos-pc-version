import assert from 'node:assert/strict';
import { matchesRestaurantOSProcessIdentity } from '../src/utils/restaurantos-process-identity';

const expectedExecutable = 'C:\\Program Files\\RestaurantOS\\runtime\\node.exe';
const expectedServerScript = 'C:\\Program Files\\RestaurantOS\\server.cjs';

assert.equal(
  matchesRestaurantOSProcessIdentity({
    executablePath: 'C:\\Windows\\system32\\taskhostw.exe',
    commandLine: 'taskhostw.exe {222A245B-E637-4AE9-A93F-A59CA119A75E}'
  }, expectedExecutable, expectedServerScript),
  false,
  'A reused PID owned by taskhostw.exe must not be identified as RestaurantOS.'
);

assert.equal(
  matchesRestaurantOSProcessIdentity({
    executablePath: expectedExecutable,
    commandLine: '"' + expectedExecutable + '" "' + expectedServerScript + '"'
  }, expectedExecutable, expectedServerScript),
  true,
  'The bundled Node process running this installation server must be identified as RestaurantOS.'
);

assert.equal(
  matchesRestaurantOSProcessIdentity({
    executablePath: expectedExecutable,
    commandLine: '"' + expectedExecutable + '" "C:\\OtherApp\\server.cjs"'
  }, expectedExecutable, expectedServerScript),
  false,
  'Another application using Node must not be identified as RestaurantOS.'
);

assert.equal(
  matchesRestaurantOSProcessIdentity({
    executablePath: 'C:\\OtherRestaurantOS\\runtime\\node.exe',
    commandLine: '"' + expectedExecutable + '" "' + expectedServerScript + '"'
  }, expectedExecutable, expectedServerScript),
  false,
  'A different Node executable must not be identified as this RestaurantOS installation.'
);

console.log('PID identity regression checks: 4 passed, 0 failed.');
