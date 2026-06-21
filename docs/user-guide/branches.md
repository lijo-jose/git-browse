# Branches, Tags & Stash

The Branches tab lists all local and remote branches, lets you manage them, and shows tags. The Stash tab manages your stash entries.

![Branches tab](../medium/images/03-branches-divergence.png)

---

## Reading the branch list

Each branch shows:
- **Name** and last commit subject
- **HEAD badge** on the current branch
- **↑N ↓N** divergence relative to your current HEAD — how many commits ahead or behind each branch is
- **diff** button — click to instantly compare that branch against HEAD in the Git Compare page

Branches are sorted by recency (most recent commit first).

---

## Switching branches

Click any branch name to check it out. If you have uncommitted changes, Git Browse will warn you.

---

## Creating a branch

Click **New branch** at the bottom of the Branches tab. Enter a name and choose where to branch from (current HEAD by default).

---

## Merging and rebasing

Right-click any branch for the context menu:

- **Merge into current** — merges the selected branch into your current branch
- **Rebase onto** — rebases your current branch onto the selected branch
- **Interactive rebase** — opens the interactive rebase dialog (see below)
- **Delete** — deletes the branch (with confirmation)

---

## Interactive rebase

The **Interactive rebase** dialog lets you reorder, squash, reword, fixup, and drop commits using buttons instead of editing a `pick` list in a terminal editor.

Use this to clean up a feature branch before opening a pull request.

---

## Tags

Tags are listed below branches in the Branches tab, with their date and commit subject.

**To create a tag:**
1. Press `T` or click **New tag** (or use ⌘K → "Create tag")
2. Enter a tag name (e.g. `v1.2.0`) and optional message
3. Click **Create & push** to tag HEAD and push the tag to origin in one step

![New tag dialog](../medium/images/04-new-tag-dialog.png)

---

## Stash

The Stash tab lists all stash entries with their messages.

- **Push** — stash your current working tree changes
- **Apply** — apply a stash without removing it from the list
- **Pop** — apply and remove the stash
- **Drop** — delete a stash entry

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `B` | Switch to Branches tab |
| `T` | Create a new tag |

---

[← Back to index](README.md)
