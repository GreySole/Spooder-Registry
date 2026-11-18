// Reading the entry files is the one thing both scripts do, so it lives here rather than
// twice. Order is stable (sorted by path) so a rebuilt index diffs cleanly.
const fs = require('fs');
const path = require('path');

const ENTRIES_DIR = path.join(__dirname, '..', 'entries');

// Entries may sit in subfolders - a plugin 'owner/name' lives at plugins/owner/name.json - so
// this walks each kind folder rather than reading one level.
function listJson(dir) {
  const out = [];
  for (const item of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) out.push(...listJson(full));
    else if (item.endsWith('.json')) out.push(full);
  }
  return out;
}

function readEntries() {
  const found = [];
  for (const kindDir of fs.readdirSync(ENTRIES_DIR).sort()) {
    const dir = path.join(ENTRIES_DIR, kindDir);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const filePath of listJson(dir)) {
      const file = path.relative(ENTRIES_DIR, filePath).split(path.sep).join('/');
      let entry;
      try {
        entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        found.push({ file, parseError: e.message });
        continue;
      }
      found.push({ file, dir: kindDir, entry });
    }
  }
  return found;
}

module.exports = { readEntries, ENTRIES_DIR };
