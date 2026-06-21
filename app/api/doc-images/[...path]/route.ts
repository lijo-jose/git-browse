import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_DIRS = [
  path.join(process.cwd(), 'docs', 'medium', 'images'),
  path.join(process.cwd(), 'images'),
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const filename = segments.join('/');

  for (const dir of ALLOWED_DIRS) {
    const filePath = path.join(dir, filename);
    // Prevent path traversal
    if (!filePath.startsWith(dir)) continue;
    try {
      const data = await fs.readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mime =
        ext === '.png' ? 'image/png' :
        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
        ext === '.webp' ? 'image/webp' :
        ext === '.gif' ? 'image/gif' : 'application/octet-stream';
      return new NextResponse(data, { headers: { 'Content-Type': mime } });
    } catch {
      continue;
    }
  }

  return new NextResponse('Not found', { status: 404 });
}
