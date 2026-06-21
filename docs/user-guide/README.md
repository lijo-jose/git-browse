# Git Browse — User Guide

**Git Browse** is a local git repository browser that runs in your browser. No accounts, no cloud — point it at any folder on your machine and get a fast, keyboard-friendly UI over your repos.

![Git Browse](../../images/Screenshot%202026-06-21%20at%209.14.21%20AM.png)

---

## Quick Start

```bash
git clone https://github.com/lijo-jose/git-browse
cd git-browse
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Documentation

| Guide | What it covers |
|---|---|
| [Explorer](explorer.md) | Browsing folders, pinning repos, groups, VS Code integration |
| [Commit Log](commit-log.md) | Commit graph, browsing history, diffs |
| [Changes](changes.md) | Staging, committing, discarding changes |
| [Branches & Tags](branches.md) | Creating, switching, merging, rebasing, tagging, stashing |
| [Compare](compare.md) | Git compare, folder compare, file compare, clipboard diff |
| [Search](search.md) | Grep file contents, find files by name |
| [Insights](insights.md) | Commit heatmap, contributors, hotspot files, branch network |
| [Repository Settings](settings.md) | Git identity, remotes, danger zone |
| [Keyboard Shortcuts](keyboard-shortcuts.md) | All keyboard shortcuts |

---

## The Layout

Git Browse uses a three-panel layout:

- **Left — Explorer**: Browse your filesystem. Pin repos, organise them into groups.
- **Centre — Repository**: Tabs for Log, Changes, Branches, Stash, and Info.
- **Right — Diff**: The diff viewer. Click any file or commit to see its diff here.

Both the Explorer and Diff panels are independently collapsible (`E` and `D`).

---

## Links

- [GitHub](https://github.com/lijo-jose/git-browse)
- [Releases](https://github.com/lijo-jose/git-browse/releases)
- [Product page](https://www.lijojose.com/open-source/git-browse)
