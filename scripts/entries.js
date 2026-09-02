// Reading the entry files is the one thing both scripts do, so it lives here rather than
// twice. Order is stable (sorted by path) so a rebuilt index diffs cleanly.
const fs = require('fs');
const path = require('path');

const ENTRIES_DIR = path.join(__dirname, '..', 'entries');

function readEntries() {
  const found = [];
  for (const kindDir of fs.readdirSync(ENTRIES_DIR).sort()) {
    const dir = path.join(ENTRIES_DIR, kindDir);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(dir, file);
      let entry;
      try {
        entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        found.push({ file: path.relative(ENTRIES_DIR, filePath), parseError: e.message });
        continue;
      }
      found.push({ file: path.relative(ENTRIES_DIR, filePath), dir: kindDir, entry });
    }
  }
  return found;
}

module.exports = { readEntries, ENTRIES_DIR };
