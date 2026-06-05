export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header' | 'meta';
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface Chunk {
  header: string;
  lines: DiffLine[];
  startIndex: number;
}

export function parseDiff(raw: string): DiffLine[] {
  const result: DiffLine[] = [];
  let ol = 0, nl = 0;
  for (const line of raw.split('\n')) {
    if (line.startsWith('@@')) {
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
      if (m) { ol = +m[1]; nl = +m[2]; }
      result.push({ type: 'header', content: line });
    } else if (/^(--- |\+\+\+ |Index: |=+$)/.test(line) || line === '') {
      result.push({ type: 'meta', content: line });
    } else if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1), newLine: nl++ });
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1), oldLine: ol++ });
    } else {
      result.push({ type: 'context', content: line.slice(1), oldLine: ol++, newLine: nl++ });
    }
  }
  return result;
}

export function extractChunks(lines: DiffLine[]): Chunk[] {
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].type === 'header') {
      const start = i + 1;
      let j = start;
      while (j < lines.length && lines[j].type !== 'header') j++;
      const chunkLines = lines.slice(start, j);
      if (chunkLines.some(l => l.type === 'add' || l.type === 'remove')) {
        chunks.push({ header: lines[i].content, lines: chunkLines, startIndex: start });
      }
      i = j;
    } else {
      i++;
    }
  }
  return chunks;
}

export function splitPairs(lines: DiffLine[]): Array<{ left?: DiffLine; right?: DiffLine; span: number }> {
  const pairs: Array<{ left?: DiffLine; right?: DiffLine; span: number }> = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.type === 'remove' && lines[i + 1]?.type === 'add') { pairs.push({ left: l, right: lines[i + 1], span: 2 }); i += 2; }
    else if (l.type === 'remove') { pairs.push({ left: l, span: 1 }); i++; }
    else if (l.type === 'add') { pairs.push({ right: l, span: 1 }); i++; }
    else { pairs.push({ left: l, right: l, span: 1 }); i++; }
  }
  return pairs;
}

export function rowStyle(type: DiffLine['type'], accepted?: 'left' | 'right'): React.CSSProperties {
  if (accepted === 'left' && type === 'add') return { background: 'color-mix(in oklch, var(--diff-add-bg) 30%, transparent)', opacity: 0.4 };
  if (accepted === 'right' && type === 'remove') return { background: 'color-mix(in oklch, var(--diff-remove-bg) 30%, transparent)', opacity: 0.4 };
  switch (type) {
    case 'add':    return { background: 'var(--diff-add-bg)', color: 'var(--diff-add-fg)' };
    case 'remove': return { background: 'var(--diff-remove-bg)', color: 'var(--diff-remove-fg)' };
    case 'header': return { background: 'var(--diff-header-bg)', color: 'var(--diff-header-fg)' };
    case 'meta':   return { color: 'var(--diff-meta-fg)' };
    default:       return { color: 'var(--foreground)' };
  }
}

export function sigStyle(type: DiffLine['type']): React.CSSProperties {
  if (type === 'add') return { color: 'var(--diff-add-sig)' };
  if (type === 'remove') return { color: 'var(--diff-remove-sig)' };
  return { color: 'var(--diff-ln-fg)' };
}
