# git-tree

A local Git repository browser built with Next.js. Browse commits, inspect diffs, and navigate your repo's file tree — all in a clean three-panel UI.

## Features

- Three-panel layout: file tree, git log/status, and diff viewer
- Browse commit history and staged/unstaged changes
- Side-by-side diff view for any file or commit
- Remembers the last opened repository across sessions

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
tar -xzf git-tree-v1.0.0.tar.gz
node server.js
```

## Tech Stack

- [Next.js 16](https://nextjs.org) with React 19
- [Tailwind CSS v4](https://tailwindcss.com)
- [simple-git](https://github.com/steveukx/git-js) for Git operations
- [shadcn/ui](https://ui.shadcn.com) components

## License

MIT
