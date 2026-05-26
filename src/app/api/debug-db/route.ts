import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL,
    has_auth_token: !!process.env.DATABASE_AUTH_TOKEN,
  });
}
