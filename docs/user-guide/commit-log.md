# Commit Log

The Log tab shows the commit graph for the current repository.

![Commit graph](../medium/images/01-main-three-panel.png)

---

## Reading the graph

Each row is a commit. The coloured lines and dots on the left form the branch graph. Branch tips are marked with a larger dot and a label. Tags appear as purple badges.

- **Click a commit** to expand the list of files it changed
- **Click a file** in the expanded list to see its diff in the right panel
- **Click the file again** to collapse

---

## All branches vs current branch

The **All branches** toggle at the top of the Log tab switches between:

- **Off** — shows only commits reachable from the current branch
- **On** — shows the full graph across all branches

Use "All branches" to get a visual map of how your branches relate to each other.

---

## Fetch all

The **Fetch all** button runs `git fetch --all` to update remote tracking refs without merging. After fetching, ahead/behind counts update everywhere in the app.

---

## Commit details

When you expand a commit you see:
- Full commit hash, author, date, and message
- Files changed with `+` / `-` counts
- Click any file for its diff

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `L` | Switch to Log tab |
| `R` | Refresh the repository |

---

[← Back to index](README.md)
