# Repository Settings

Repository Settings lets you manage git identity, remotes, and security options for the current repo.

**To open:** Click the **Info** tab in the Repository panel → click the settings (⚙) icon, or use ⌘K → "Repository settings".

---

## Git Identity

![Repository Settings — Git Identity](../../images/screenshot-2026-06-21-at-9.15.40-am.png)

View and update the `user.name` and `user.email` used for commits.

The **Current** section shows the values currently in effect and where they come from — **local** (this repo only) or **global** (all repos on this machine).

**To update:**
1. Edit the Name and Email fields
2. Choose scope: **Local** (overrides just this repo) or **Global** (applies machine-wide)
3. Click **Save**

Use local scope when you need a different identity for a specific repo (e.g. a work repo where you want your work email).

---

## Remotes

View, add, edit, and remove git remotes for the current repository.

Each remote shows its fetch and push URLs. Actions available:

- **Edit** — update the remote URL in place
- **Remove** — delete the remote (two-step confirm)
- **Add remote** — add a new remote with a name and URL

---

## Security — Danger Zone

![Repository Settings — Security](../../images/screenshot-2026-06-21-at-9.18.22-am.png)

The danger zone controls whether remote operations require a confirmation dialog.

| State | Behaviour |
|---|---|
| **Locked** (default) | Push and pull show a confirmation dialog with the exact command before running |
| **Unlocked** | Push and pull run immediately on the first click |

The current state is shown by a lock icon in the top bar.

**When to unlock:** During a release session or heavy rebase work where you're running many syncs in sequence and confirmation dialogs are just noise.

**When to keep locked:** On shared branches where a mistaken push has real consequences.

This setting is persisted in your browser per machine.

---

[← Back to index](README.md)
