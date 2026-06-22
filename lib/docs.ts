import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';

const DOCS_DIR = path.join(process.cwd(), 'docs', 'user-guide');

export async function readDocFile(slug: string): Promise<string> {
  const filePath = path.join(DOCS_DIR, `${slug === 'index' ? 'README' : slug}.md`);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export async function parseMarkdown(content: string): Promise<string> {
  // Rewrite relative image paths to point to the correct public URL
  const rewritten = content
    .replace(/\(\.\.\/\.\.\/public\/doc-images\//g, '(/doc-images/')
    .replace(/\(\.\.\/\.\.\/images\//g, '(/doc-images/')
    .replace(/\(\.\.\/medium\/images\//g, '(/doc-images/')
    .replace(/\(\.\.\/images\//g, '(/doc-images/');

  return marked(rewritten);
}
