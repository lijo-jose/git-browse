# Explorer

The Explorer is the left panel. It lets you browse your filesystem, pin repositories, and organise them into groups.

![Explorer with groups](../../images/screenshot-2026-06-21-at-9.14.21-am.png)

---

## Browsing folders

When you open Git Browse, the Explorer shows your home directory. Click any folder to expand it. Folders that contain a git repository show a `GIT` badge.

Click a repo folder to load it in the centre panel.

---

## Pinning repositories

Right-click any folder and choose **Pin** to keep it at the top of the Explorer across sessions. Pinned repos show their current branch name and a dirty indicator so you can see their state at a glance before clicking into them.

To unpin, right-click and choose **Unpin**.

---

## Repository groups

If you work across multiple related repos, you can organise pinned repos into named groups.

**To create a group:**
1. Right-click any pinned repo → **Add to group** → **New group**
2. Give the group a name

Groups are collapsible and persist across sessions. Each repo inside a group shows its active branch and ahead/behind counts.

**To rename or delete a group**, right-click the group header.

---

## Ahead/behind indicators

Each pinned repo (and each repo inside a group) shows live ahead/behind counts against its upstream:

- `↓2` — 2 commits to pull
- `↑1` — 1 local commit to push

These update automatically after every fetch/pull/push and when the window regains focus.

---

## Open in VS Code

Right-click any folder in the Explorer and choose **Open in VS Code** to open it in a new VS Code window.

---

## Ignoring folders

Right-click any folder and check **Ignored** to hide it from the Explorer listing. Useful for build output directories, `node_modules`, etc.

---

## Keyboard shortcut

| Key | Action |
|---|---|
| `E` | Toggle Explorer panel |

---

[← Back to index](README.md)
