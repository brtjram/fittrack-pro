import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { analyzeFoodPhoto } from '@/lib/services/food-photo-service';

// Base64 payload cap — keeps requests well under typical serverless body-size
// limits and vision API token cost. Clients should resize images before
// upload (web: canvas resize, mobile: expo-image-manipulator) rather than
// relying on this as the primary size control.
const MAX_BASE64_LENGTH = 6_000_000; // ~4.5MB decoded

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json().catch(() => null);
  const { image, mediaType, description } = body ?? {};

  if (typeof image !== 'string' || typeof mediaType !== 'string') {
    return NextResponse.json({ error: 'Missing required fields: image (base64), mediaType.' }, { status: 400 });
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'Image is too large. Please use a smaller photo.' }, { status: 413 });
  }

  try {
    const result = await analyzeFoodPhoto(image, mediaType, typeof description === 'string' ? description : undefined);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Photo analysis failed.' }, { status: 500 });
  }
}
