import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Photos are private blobs — never expose the raw blob URL to the client.
// This proxies the fetch server-side after confirming the requesting user
// actually owns the row, so a guessed/leaked id can't pull someone else's
// progress photo.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const photo = await prisma.progressPhoto.findFirst({ where: { id, userId } });
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const result = await get(photo.blobPathname, { access: 'private' });
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: 'Photo not found in storage' }, { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
