# Dataview Graph Sync

Keeps [Dataview](https://github.com/blacksmithgu/obsidian-dataview) query results visible in Obsidian's graph view via hidden wikilinks.

## The problem

Dataview queries are dynamic — they don't create real `[[wikilinks]]` in your notes. This means files returned by a `FROM` query never show up as connected in the graph view, even though they're logically related.

## How it works

This plugin scans every note in your vault for `dataview` code blocks, resolves each `FROM` clause against the live Dataview API, and injects a hidden block of wikilinks at the bottom of the file:

```
%%dataview-graph-links
[[Note A]] [[Note B]] [[Note C]]
dataview-graph-links%%
```

Obsidian's `%%...%%` comment syntax makes the block invisible in reading mode, but the wikilinks inside are indexed for the graph. The block is kept in sync automatically and removed if you delete the query.

## Requirements

- Obsidian 0.15.0 or later
- [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin installed and enabled

## Installation

This plugin is not yet in the community plugin registry. Install it manually:

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/TuurKeersebilck/obsidian-dataview-graph-sync/releases)
2. Copy both files into `.obsidian/plugins/dataview-graph-sync/` in your vault
3. Enable the plugin in **Settings → Community plugins**

## Notes

- Only the `FROM` clause is used to resolve links. `WHERE`, `SORT`, and other filters are not applied — the injected links represent the full source set, not the filtered result.
- The plugin waits 3 seconds after Obsidian starts before the first sync, to give Dataview time to load.
- Changes are debounced by 1.5 seconds to avoid excessive writes on rapid edits.
