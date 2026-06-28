# Activity & Error Recovery

Git Browse keeps a running record of every git command it executes and turns raw git failures into plain-English guidance. Two features work together here: the **Operation Drawer** and **smart error recovery**.

---

## Operation Drawer

A thin status bar sits at the bottom of the window. It always shows the **most recent** operation — its label, the exact git command, how long it took, and a coloured status dot:

| Dot | Status | Meaning |
|---|---|---|
| 🔵 (pulsing) | `running` | The command is still in progress |
| 🟢 | `done` | The command finished successfully |
| 🔴 | `error` | The command failed |

Click the bar to expand the full **Operations** list — every command from this session, newest first. Each row shows its status pill, duration, and how long ago it ran. For commands that produced output or an error, click the ▼ caret to expand the full result or error text.

**Clear** empties the list and collapses the drawer.

The drawer only appears once you've run at least one operation, and it persists across tab switches so you can always check what just happened.

---

## Smart error recovery

When a git command fails, Git Browse classifies the error and shows an actionable suggestion instead of a wall of git output — both in the failure toast and inline in the Operation Drawer (highlighted under the failed command).

Recognised situations include:

| Situation | Suggestion |
|---|---|
| **Authentication** | Check your SSH key or personal access token and confirm you have access. |
| **Non-fast-forward** | The remote has commits you don't — pull (or rebase) first, then push again. |
| **Merge conflict** | Open the Changes panel to see the conflicted files and resolve them. |
| **Dirty working tree** | Uncommitted changes would be overwritten — stash or commit them first. |
| **Network** | Check your internet connection or VPN and try again. |
| **No upstream** | Use "Push (set upstream)" to publish this branch to the remote. |
| **Nothing to commit** | Stage some files first. |
| **Rebase in progress** | Resolve conflicts, then continue, skip, or abort the current rebase. |
| **Detached HEAD** | Checkout a branch before pushing. |
| **Repository / remote not found** | Check the remote URL in Repository Settings. |
| **Destination already exists** | Choose a different name or location when cloning. |

If an error isn't one Git Browse recognises, it shows the raw git message so nothing is hidden.

---

[← Back to index](README.md)
