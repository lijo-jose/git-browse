import { notFound } from 'next/navigation';
import { readDocFile, parseMarkdown } from '@/lib/docs';
import { DocContent } from '../page';

const VALID_SLUGS = [
  'explorer',
  'commit-log',
  'changes',
  'branches',
  'compare',
  'search',
  'insights',
  'settings',
  'keyboard-shortcuts',
];

export function generateStaticParams() {
  return VALID_SLUGS.map(slug => ({ slug }));
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!VALID_SLUGS.includes(slug)) notFound();
  const content = await readDocFile(slug);
  const html = await parseMarkdown(content);
  return <DocContent html={html} />;
}
