// Prints the files list for the artifact publish call from a batchN-files.json written by a generator.
// Usage (from the folder that contains project/): node scripts/publish-list.cjs batch6-files.json
const path = require('path');
const fs = require('fs');
const list = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify(list.map((r) => ({ as: r, path: path.resolve(r).split(path.sep).join('/') }))));
