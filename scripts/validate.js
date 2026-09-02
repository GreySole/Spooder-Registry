#!/usr/bin/env node
// Validates every entry: structure against the schema, then the things a schema cannot check -
// that the repo exists, that a pinned release asset is really there, and that its hash matches
// what the entry claims.
//
// What this deliberately does not check is whether the code is safe. That is a person reading
// it before merge, and it is the honest limit of a curated registry.
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
// The 2020-12 build, matching the $schema the entry schema declares - ajv's default
// export only understands draft-07 and throws on an unknown meta-schema.
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { readEntries } = require('./entries');

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'schema', 'entry.schema.json'), 'utf8'),
);

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateStructure = ajv.compile(schema);

const problems = [];
const note = (file, message) => problems.push(`${file}: ${message}`);

// GitHub's API is rate limited to 60/hour unauthenticated, which CI can exceed on a busy day.
// Actions provides a token, so use it when present.
function gh(url) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'Spooder-Registry', Accept: 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(gh(res.headers.location));
        }
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

function sha256OfUrl(url) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'Spooder-Registry', Accept: 'application/octet-stream' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(sha256OfUrl(res.headers.location));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`download failed with ${res.statusCode}`));
        }
        const hash = crypto.createHash('sha256');
        res.on('data', (c) => hash.update(c));
        res.on('end', () => resolve(hash.digest('hex')));
      })
      .on('error', reject);
  });
}

async function checkArtifact(file, label, artifact, track) {
  const repoRes = await gh(`https://api.github.com/repos/${artifact.repo}`);
  if (repoRes.status === 404) {
    note(file, `${label}: repo ${artifact.repo} not found or not public`);
    return;
  }
  if (repoRes.status !== 200) {
    note(file, `${label}: could not read ${artifact.repo} (HTTP ${repoRes.status})`);
    return;
  }

  // A 'latest' entry follows whatever the repo publishes, so there is no fixed asset to check -
  // only that releases exist at all, since without one there is nothing to install.
  const tag = track === 'pinned' ? `tags/v${artifact.version}` : 'latest';
  const relRes = await gh(`https://api.github.com/repos/${artifact.repo}/releases/${tag}`);
  if (relRes.status === 404) {
    note(
      file,
      track === 'pinned'
        ? `${label}: no release tagged v${artifact.version} on ${artifact.repo}`
        : `${label}: ${artifact.repo} has no published release yet`,
    );
    return;
  }

  if (track !== 'pinned') return;

  const release = JSON.parse(relRes.body);
  const asset = (release.assets || []).find((a) => a.name === artifact.asset);
  if (!asset) {
    note(file, `${label}: release v${artifact.version} has no asset named '${artifact.asset}'`);
    return;
  }

  const actual = await sha256OfUrl(asset.browser_download_url);
  if (actual !== artifact.sha256) {
    note(file, `${label}: sha256 mismatch\n    entry:  ${artifact.sha256}\n    actual: ${actual}`);
  }
}

(async () => {
  const found = readEntries();
  const ids = new Map();

  for (const f of found) {
    if (f.parseError) {
      note(f.file, `not valid JSON - ${f.parseError}`);
      continue;
    }
    const entry = f.entry;

    if (!validateStructure(entry)) {
      for (const err of validateStructure.errors) {
        note(f.file, `${err.instancePath || '/'} ${err.message}`);
      }
      continue;
    }

    // The filename is how a reviewer finds an entry, so it has to match what it declares.
    const expected = `${entry.kind}s/${entry.id}.json`;
    if (f.file !== expected) {
      note(f.file, `should be named ${expected} to match its id and kind`);
    }
    if (ids.has(entry.id)) {
      note(f.file, `duplicate id '${entry.id}', already used by ${ids.get(entry.id)}`);
    }
    ids.set(entry.id, f.file);

    if (process.env.SKIP_NETWORK === '1') continue;

    for (const label of ['server', 'webui', 'plugin']) {
      if (entry[label]) {
        await checkArtifact(f.file, label, entry[label], entry.track);
      }
    }
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`[validate] ${found.length} entries OK`);
})();
