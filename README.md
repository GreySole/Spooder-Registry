# Spooder Registry

The catalogue of modules and plugins [Spooder](https://github.com/GreySole/Spooder) can install.
Spooder fetches [`index.json`](index.json) and shows what is in it on the Modules tab.

## Submitting

Add one file under `entries/modules/` or `entries/plugins/`, named `<id>.json`, and open a pull
request. One file per entry, so two submissions on the same day never conflict and a reviewer
sees exactly one entry in the diff.

```json
{
  "id": "my-thing",
  "kind": "plugin",
  "name": "My Thing",
  "summary": "One line describing what it does.",
  "author": "you",
  "license": "MIT",
  "tags": ["chat"],
  "spooder": "^0.6.0",
  "track": "pinned",
  "plugin": {
    "repo": "you/my-thing",
    "version": "1.0.0",
    "asset": "my-thing-v1.0.0.zip",
    "sha256": "…"
  }
}
```

[`schema/entry.schema.json`](schema/entry.schema.json) is the full definition, and every field
carries a description — point your editor at it and you get completion and inline docs.

`index.json` is generated. Do not edit it; CI rebuilds it when your entry merges.

## pinned or latest

`track` decides who is responsible when a new version ships.

**`pinned`** installs one exact release, whose `sha256` a reviewer checked. A new version needs a
pull request here. This is the right setting for anything not maintained by the Spooder project:
the hash is the only thing standing between a compromised release and code running in someone's
Spooder process.

**`latest`** follows whatever the repo publishes, skipping that check in exchange for not needing
a PR per release. Reasonable for first-party entries, where the registry and the module have the
same maintainer anyway.

## Compatibility

`spooder` is a semver range of the Spooder versions an entry runs on. Spooder shows entries
outside its range but will not install them, so someone told to install something finds it and
an explanation, rather than an empty list.

## What review does and does not cover

CI checks structure, that the repos exist, and that a pinned asset hashes to what the entry
claims. It cannot tell whether the code is safe. That is a person reading it before merge — the
honest limit of a curated list, and the reason plugins, which run in-process with access to your
tokens, are worth reading before they are merged.

## Local checks

```bash
npm install
npm run validate          # structure, repos, assets, hashes
SKIP_NETWORK=1 npm run validate   # structure only, no API calls
npm run build             # regenerate index.json
```
