# Compare

Git Browse has three comparison tools, each accessible from the activity rail on the left.

---

## Git Compare

Compare any two refs — branches, tags, or commit SHAs.

![Git Compare](../medium/images/06-git-compare.png)

**To use:**
1. Click the **Git Compare** icon in the activity rail (branch icon)
2. Select a repository
3. Choose a **From** ref and a **To** ref — any branch, tag, `HEAD`, or raw SHA
4. The file list shows every changed file with `+/-` counts and a filter box
5. Click any file to see its diff in unified or split view

**Tip:** In the Branches tab, hover any branch and click the **diff** button to instantly compare it against HEAD.

---

## Folder Compare

Compare two directories on disk — whether they're git repos or not.

![Folder Compare](../medium/images/07-folder-compare.png)

**To use:**
1. Click the **Compare** icon in the activity rail (overlapping squares)
2. Select **Folders** mode
3. Pick a left and right folder
4. Results show every file classified as:
   - **Modified** — exists in both but different
   - **Left only** — only in the left folder
   - **Right only** — only in the right folder
   - **Identical** — same in both (hidden by default)
5. Use the filter chips to show only what you care about
6. Click any file to see its diff

Ignore patterns (e.g. `node_modules`, `.git`) are pre-configured and editable.

The **History** panel remembers your recent folder comparisons.

---

## File Compare

Compare any two files side by side.

1. Click **Compare** → **Files** mode
2. Pick a left and right file (drag and drop works)
3. Diff appears immediately

---

## Clipboard Compare

Paste two blobs of text and diff them — no files needed.

1. Click **Compare** → **Clipboard** mode
2. Paste text into the left and right panels
3. Diff appears immediately

Useful for: comparing two JSON responses, two versions of a config file, environment variables from two machines.

---

[← Back to index](README.md)
