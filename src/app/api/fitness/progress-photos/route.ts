import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

const ANGLES = ['front', 'side', 'back'] as const;
type Angle = (typeof ANGLES)[number];

// Same cap as the food-photo analyze route — keeps requests well under
// typical serverless body-size limits.
const MAX_BASE64_LENGTH = 6_000_000; // ~4.5MB decoded

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(request.url);
  const date = url.searchParams.get('date');

  const photos = await prisma.progressPhoto.findMany({
    where: { userId, ...(date ? { date } : {}) },
    orderBy: { date: 'desc' },
    select: { id: true, date: true, angle: true, createdAt: true },
  });

  return NextResponse.json(photos);
}

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json().catch(() => null);
  const { date, angle, image, mediaType } = body ?? {};

  if (typeof date !== 'string' || typeof image !== 'string' || typeof mediaType !== 'string' || !ANGLES.includes(angle)) {
    return NextResponse.json({ error: `Missing/invalid fields: date, angle (one of ${ANGLES.join('/')}), image, mediaType.` }, { status: 400 });
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'Image is too large. Please use a smaller photo.' }, { status: 413 });
  }

  const ext = mediaType === 'image/png' ? 'png' : 'jpg';
  // Deterministic pathname (no random suffix) + allowOverwrite so re-shooting
  // the same angle on the same day replaces the blob instead of orphaning it.
  const pathname = `progress-photos/${userId}/${date}-${angle as Angle}.${ext}`;

  try {
    const buffer = Buffer.from(image, 'base64');
    const blob = await put(pathname, buffer, {
      access: 'private',
      contentType: mediaType,
      allowOverwrite: true,
    });

    const photo = await prisma.progressPhoto.upsert({
      where: { userId_date_angle: { userId, date, angle } },
      update: { blobPathname: blob.pathname },
      create: { userId, date, angle, blobPathname: blob.pathname },
    });

    return NextResponse.json({ id: photo.id, date: photo.date, angle: photo.angle, createdAt: photo.createdAt });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save photo.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const photo = await prisma.progressPhoto.findFirst({ where: { id, userId } });
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await del(photo.blobPathname);
  await prisma.progressPhoto.delete({ where: { id: photo.id } });

  return NextResponse.json({ success: true });
}
