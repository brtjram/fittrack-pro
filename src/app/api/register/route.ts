import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { normalizeIdentifier, validatePassword, validateUsername } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const { name, email, username, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeIdentifier(email);
    const rawUsername = username || normalizedEmail.split('@')[0];
    const usernameValidation = validateUsername(rawUsername);
    if (!usernameValidation.valid) {
      return NextResponse.json(
        { error: usernameValidation.message },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    let nextUsername = usernameValidation.normalized;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: nextUsername },
      });

      if (!existingUsername) break;

      if (username) {
        return NextResponse.json(
          { error: 'An account with this username already exists' },
          { status: 409 }
        );
      }

      nextUsername = `${usernameValidation.normalized}${Math.floor(1000 + Math.random() * 9000)}`;
    }


    const finalUsernameCheck = await prisma.user.findUnique({
      where: { username: nextUsername },
    });

    if (finalUsernameCheck) {
      return NextResponse.json(
        { error: 'Unable to allocate a unique username. Please try again.' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name || null,
        email: normalizedEmail,
        username: nextUsername,
        hashedPassword,
      },
    });

    return NextResponse.json(
      {
        message: 'Account created successfully',
        userId: user.id,
        username: user.username,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
