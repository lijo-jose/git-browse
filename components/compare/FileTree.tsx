'use client';

import { useCallback, useEffect, useState } from 'react';

export interface CompareEntry {
  relativePath: string;
  status: 'left-only' | 'right-only' | 'identical' | 'modified';
  leftPath?: string;
  rightPath?: string;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  entry?: CompareEntry;
}

interface Props {
  entries: CompareEntry[];
  statusFilter: 'all' | 'modified' | 'left-only' | 'right-only';
  selected: CompareEntry | null;
  onSelect: (e: CompareEntry) => void;
}

function buildTree(entries: CompareEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();
  for (const entry of entries) {
    const parts = entry.relativePath.split('/');
    let siblings = root;
    let cumPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      cumPath = cumPath ? `${cumPath}/${parts[i]}` : parts[i];
      if (!dirMap.has(cumPath)) {
        const node: TreeNode = { name: parts[i], path: cumPath, isDirectory: true, children: [] };
        dirMap.set(cumPath, node);
        siblings.push(node);
      }
      siblings = dirMap.get(cumPath)!.children;
    }
    siblings.push({ name: parts[parts.length - 1], path: entry.relativePath, isDirectory: false, children: [], entry });
  }
  return root;
}

function nodeHasVisible(node: TreeNode, filter: Props['statusFilter']): boolean {
  if (!node.isDirectory) return filter === 'all' || node.entry?.status === filter;
  return node.children.some(c => nodeHasVisible(c, filter));
}

function getAllDirPaths(node: TreeNode): string[] {
  if (!node.isDirectory) return [];
  return [node.path, ...node.children.flatMap(getAllDirPaths)];
}

const STATUS_CFG = {
  modified:    { dot: '#f59e0b', sym: '~' },
  'left-only':   { dot: '#f87171', sym: '−' },
  'right-only':  { dot: '#34d399', sym: '+' },
  identical:   { dot: 'var(--text-dim)', sym: '=' },
};

function TreeNodeRow({ node, depth, selected, onSelect, statusFilter, expandedDirs, onToggleDir }: {
  node: TreeNode;
  depth: number;
  selected: CompareEntry | null;
  onSelect: (e: CompareEntry) => void;
  statusFilter: Props['statusFilter'];
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}) {
  if (node.isDirectory) {
    const expanded = expandedDirs.has(node.path);
    if (!nodeHasVisible(node, statusFilter)) return null;

    const fileCount = node.children.flatMap(c => c.isDirectory ? [] : [c]).filter(c => nodeHasVisible(c, statusFilter)).length;
    const dirCount  = node.children.filter(c => c.isDirectory && nodeHasVisible(c, statusFilter)).length;
    const total = fileCount + dirCount;

    return (
      <>
        <button
          onClick={() => onToggleDir(node.path)}
          className="w-full flex items-center gap-1.5 py-1.5 text-left transition-colors select-none"
          style={{ paddingLeft: 8 + depth * 14, color: 'var(--text-soft)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
        >
          <svg
            width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" className="shrink-0 transition-transform duration-150"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--text-dim)' }}
          ><path d="M4 2l4 4-4 4"/></svg>

          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="shrink-0"
            style={{ color: expanded ? 'var(--primary)' : 'var(--text-soft)', opacity: 0.8 }}>
            {expanded
              ? <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/>
              : <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
            }
          </svg>

          <span className="text-[11px] font-semibold truncate flex-1">{node.name}</span>

          {total > 0 && (
            <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded-full tabular-nums"
              style={{ background: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
              {total}
            </span>
          )}
        </button>

        {expanded && node.children.map(child => (
          <TreeNodeRow key={child.path} node={child} depth={depth + 1}
            selected={selected} onSelect={onSelect} statusFilter={statusFilter}
            expandedDirs={expandedDirs} onToggleDir={onToggleDir} />
        ))}
      </>
    );
  }

  /* File row */
  const entry = node.entry!;
  if (statusFilter !== 'all' && entry.status !== statusFilter) return null;

  const isActive = selected?.relativePath === node.path;
  const cfg = STATUS_CFG[entry.status];

  return (
    <button
      onClick={() => onSelect(entry)}
      className="w-full flex items-center gap-2 py-1.5 text-left transition-all"
      style={{
        paddingLeft: 10 + depth * 14,
        borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent',
        background: isActive ? 'color-mix(in oklch, var(--primary) 8%, transparent)' : '',
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = ''; }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      <span className="font-mono text-[11px] truncate flex-1"
        style={{ color: isActive ? 'var(--primary)' : 'var(--foreground)' }}>
        {node.name}
      </span>
      <span className="text-[10px] font-bold shrink-0 pr-2" style={{ color: cfg.dot }}>{cfg.sym}</span>
    </button>
  );
}

export default function FileTree({ entries, statusFilter, selected, onSelect }: Props) {
  const tree = buildTree(entries);

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
    const dirs = new Set<string>();
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) if (n.isDirectory) { dirs.add(n.path); collect(n.children); }
    }
    collect(buildTree(entries));
    return dirs;
  });

  useEffect(() => {
    setExpandedDirs(prev => {
      const dirs = new Set<string>(prev);
      function collect(nodes: TreeNode[]) {
        for (const n of nodes) if (n.isDirectory) { dirs.add(n.path); collect(n.children); }
      }
      collect(buildTree(entries));
      return dirs;
    });
  }, [entries]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  const allDirPaths = tree.flatMap(getAllDirPaths);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Expand / Collapse all toolbar */}
      <div className="flex items-center justify-end gap-1 px-3 py-1 shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setExpandedDirs(new Set(allDirPaths))}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md transition-colors"
          style={{ color: 'var(--text-dim)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
          title="Expand all"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
          Expand all
        </button>
        <span style={{ color: 'var(--border-subtle)' }}>·</span>
        <button
          onClick={() => setExpandedDirs(new Set())}
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md transition-colors"
          style={{ color: 'var(--text-dim)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'}
          title="Collapse all"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 15l-6-6-6 6"/></svg>
          Collapse
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {tree.map(node => (
          <TreeNodeRow key={node.path} node={node} depth={0}
            selected={selected} onSelect={onSelect} statusFilter={statusFilter}
            expandedDirs={expandedDirs} onToggleDir={toggleDir} />
        ))}
      </div>
    </div>
  );
}
