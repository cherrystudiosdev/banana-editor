/* eslint-disable @typescript-eslint/no-require-imports -- Electron's test entry is deliberately CommonJS, matching the packaged main bundle. */
// Test-only launch wrapper: isolate user files before loading the real main bundle.
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');
const root = path.resolve(__dirname, '../..');
const userData = process.env.BANANA_E2E_USER_DATA;
if (!userData || !path.isAbsolute(userData)) throw new Error('An isolated E2E userData directory is required');
fs.mkdirSync(userData, { recursive: true });
app.setPath('userData', userData);
app.setName('Banana Editor E2E');
app.getAppPath = () => root;
app.getVersion = () => require(path.join(root, 'package.json')).version;
require(path.join(root, 'dist/main/index.cjs'));
