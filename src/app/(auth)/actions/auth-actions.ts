'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { createUserWithPassword, getUserByEmail } from '@/lib/auth-db';

export interface AuthFormState {
  error?: string;
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function signInWithCredentials(_: AuthFormState | undefined, formData: FormData): Promise<AuthFormState> {
  const email = readString(formData, 'email');
  const password = readString(formData, 'password');
  const callbackUrl = readString(formData, 'callbackUrl') || '/';

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Invalid email or password.' };
    }
    throw error;
  }

  return {};
}

export async function signInWithGoogle(): Promise<void> {
  await signIn('google', { redirectTo: '/' });
}

export async function signUpWithCredentials(_: AuthFormState | undefined, formData: FormData): Promise<AuthFormState> {
  const name = readString(formData, 'name');
  const email = readString(formData, 'email');
  const password = readString(formData, 'password');

  if (!name) {
    return { error: 'Please enter your name.' };
  }

  if (!email) {
    return { error: 'Please enter your email.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  if (await getUserByEmail(email)) {
    return { error: 'An account already exists for that email.' };
  }

  await createUserWithPassword({ name, email, password });

  await signIn('credentials', {
    email,
    password,
    redirectTo: '/',
  });

  return {};
}
