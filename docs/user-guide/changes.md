# Changes

The Changes tab shows your working tree — modified, added, and deleted files — and lets you stage, commit, and push.

![Changes tab](../../public/doc-images/05-changes-tab.png)

---

## Viewing diffs

Click any file in the Changes tab to see its diff in the right panel. The diff shows unstaged changes by default. Staged files show what will be included in the next commit.

Toggle between **unified** and **split** view using the buttons at the top of the diff panel. Enable **Wrap** for long lines.

---

## Staging files

- **Stage a single file** — click the checkbox next to the file, or click the `+` icon
- **Stage all files** — click **Stage all** at the top of the list
- **Unstage** — click the checkbox again on a staged file

---

## Committing

1. Stage the files you want to include
2. Type a commit message in the input at the bottom of the Changes tab
3. Click **Commit**

After committing, the Sync button in the top bar will show `↑1` — your cue to push when ready.

---

## Discarding changes

Right-click any unstaged file and choose **Discard changes** to revert it to the last committed state. A confirmation dialog shows exactly what will be discarded.

---

## Push

After committing, click the **Pull** button's caret (▾) and choose **Push**, or press `P`.

If your branch has no upstream set yet, Git Browse will show a dialog with the exact `git push --set-upstream origin <branch>` command it will run, and ask you to confirm.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `C` | Switch to Changes tab |
| `P` | Push to remote |
| `U` | Pull from remote |

---

[← Back to index](README.md)
