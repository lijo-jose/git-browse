# git-browse

A local Git repository browser built with Next.js. Browse commits, inspect diffs, and navigate your repo's file tree — all in a clean three-panel UI.

## Features

- Three-panel layout: file tree, git log/status, and diff viewer — both the Explorer sidebar and Diff panel are independently collapsible
- Browse commit history with an inline expandable file list per commit — click a commit to see all changed files with full paths, click a file to diff it, click again to collapse
- Browse staged/unstaged changes with per-file diffs
- Side-by-side diff view for any file or commit
- Remembers the last opened repository across sessions
- **Branch management** — create, switch, and delete branches from the Branches tab
- **Discard changes** — discard unstaged changes per file from the Changes tab
- **Commit graph toolbar** — visual commit graph navigation in the Log tab
- **Repository info tab** — at-a-glance repo metadata (remotes, HEAD, stash count)
- **Git add, commit, and push** — stage files, write a commit message, and push without leaving the UI
- **Create and push tags** — tag a commit and push the tag to the remote
- **Themes** — switch between light, dark, and system themes
- **Collapsible Explorer sidebar** — pin and unpin repositories for quick access; right-click any folder to open it in VS Code
- **Repository groups** — organise pinned repos into named groups in the Explorer sidebar
- **Active branch in Explorer** — each pinned repo shows its current branch at a glance
- **Ahead/behind indicators** — sync button and branch list show how far ahead or behind the remote you are
- **Git remote link** — top bar displays a clickable link to the repo's remote URL
- **Compare files/folders** — side-by-side comparison of any two files or directories
- **Git compare** — diff any two branches or commits
- **Grep / search** — full-text search across the working tree
- **Interactive rebase** — launch `git rebase -i` from the UI
- **Git clone** — clone a remote repository and branch out directly from the UI
- **User guide** — built-in help panel with keyboard shortcuts and usage tips

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `E` | Toggle Explorer sidebar |
| `D` | Toggle Diff panel |
| `L` | Switch to Log tab |
| `B` | Switch to Branches tab |
| `C` | Switch to Changes tab |
| `R` | Refresh current repository |
| `P` | Push to remote |
| `U` | Pull from remote |
| `T` | Create a new tag |

## Getting Started

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Building

```bash
npm run build
npm start
```

The project uses `output: standalone` — the build produces a self-contained bundle in `.next/standalone/` that can be run without re-installing dependencies.

## Releases

Releases are built automatically via GitHub Actions:

- **Tag push** — push a `v*` tag to trigger a build and attach the release package to a GitHub Release:
  ```bash
  git tag v1.0.0 && git push origin v1.0.0
  ```
- **Manual** — trigger the `Release` workflow from the GitHub Actions UI to produce a downloadable artifact.

The release tarball contains the standalone Next.js bundle and is runnable with:

```bash
tar -xzf git-browse-v1.0.0.tar.gz
node server.js
```

## Tech Stack

- [Next.js 16](https://nextjs.org) with React 19
- [Tailwind CSS v4](https://tailwindcss.com)
- [simple-git](https://github.com/steveukx/git-js) for Git operations
- [shadcn/ui](https://ui.shadcn.com) components

## License

MIT
