import { readDocFile, parseMarkdown } from '@/lib/docs';

export default async function DocsIndexPage() {
  const content = await readDocFile('README');
  const html = await parseMarkdown(content);
  return <DocContent html={html} />;
}

export function DocContent({ html }: { html: string }) {
  return (
    <article
      className="prose max-w-3xl mx-auto px-8 py-10"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
