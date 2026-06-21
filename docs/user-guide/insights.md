# Insights

The Insights page shows analytics for the current repository, built entirely from local git data — no external services.

![Insights page](../../images/Screenshot%202026-06-21%20at%209.18.38%20AM.png)

**To open:** Go to the **Info** tab in the Repository panel → click **View detailed insights →**

---

## Headline stats

Four cards at the top show at a glance:

| Card | What it shows |
|---|---|
| Total Commits | All commits reachable from HEAD |
| Contributors | Unique authors across all commits |
| Files Tracked | Number of files currently tracked by git |
| Local Branches | Number of local branches |

---

## Commit Activity

A GitHub-style 52-week heatmap. Each cell is one day; darker green means more commits on that day. Hover any cell for the date and exact count.

---

## Branch Network

An SVG graph of every branch and how they relate — color-coded lanes, larger dots for branch tips, diamond markers for tags. The visual equivalent of `git log --oneline --graph --all`.

---

## Top Contributors

Ranked by commit count across all time. Each contributor has a proportional bar showing their share relative to the top contributor.

---

## Hotspot Files

The files changed most often in the last 2000 non-merge commits, ranked by change count. A high number on a single file can indicate either a critical file or a design problem worth investigating.

---

## Commit Types

If your project uses [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, etc.), this section shows a color-coded breakdown of commit types across the last 500 commits.

---

[← Back to index](README.md)
