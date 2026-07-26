import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { buildExport, type ExportSection, type ExportFormat, type ExportRange } from '@/lib/services/export-service';

const VALID_SECTIONS: ExportSection[] = ['meals', 'workouts', 'weighins'];

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') === 'json' ? 'json' : 'csv') as ExportFormat;
  const range = (searchParams.get('range') === 'all' ? 'all' : '90') as ExportRange;
  const sections = (searchParams.get('sections') ?? VALID_SECTIONS.join(','))
    .split(',')
    .filter((s): s is ExportSection => VALID_SECTIONS.includes(s as ExportSection));

  if (sections.length === 0) {
    return NextResponse.json({ error: 'No valid sections requested.' }, { status: 400 });
  }

  const { content, mimeType, filenameExt } = await buildExport(userId, sections, format, range);
  const filename = `fittrack-export-${new Date().toISOString().split('T')[0]}.${filenameExt}`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
