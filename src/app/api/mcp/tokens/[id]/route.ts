import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  await prisma.apiToken.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
