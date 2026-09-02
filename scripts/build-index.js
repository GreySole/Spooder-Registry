#!/usr/bin/env node
// Compiles entries/**.json into a single index.json.
//
// The app reads only this file - one request for the whole catalogue instead of one per entry,
// which is the difference between a check that fits in GitHub's unauthenticated rate limit and
// one that does not. Entries stay separate files so two submissions never touch the same one.
const fs = require('fs');
const path = require('path');
const { readEntries } = require('./entries');

const OUT = path.join(__dirname, '..', 'index.json');

const found = readEntries();
const broken = found.filter((f) => f.parseError);
if (broken.length > 0) {
  for (const b of broken) console.error(`${b.file}: ${b.parseError}`);
  process.exit(1);
}

const index = {
  schemaVersion: 1,
  // Deliberately not a timestamp: a rebuild that changes nothing should produce no diff, or
  // every merge churns the file and the app re-downloads an identical catalogue.
  entries: found.map((f) => f.entry),
};

const serialized = JSON.stringify(index, null, 2) + '\n';
const previous = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;

fs.writeFileSync(OUT, serialized);
console.log(
  `[build-index] ${index.entries.length} entries` +
    (previous === serialized ? ' (unchanged)' : ' (updated)'),
);
