'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { signInWithCredentials, signInWithGoogle, type AuthFormState } from '@/app/(auth)/actions/auth-actions';

const initialState: AuthFormState = {};

export function SignInForm() {
  const [state, action, pending] = useActionState(signInWithCredentials, initialState);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-primary transition focus:ring-2"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <Link href="/sign-up" className="text-xs font-medium text-primary hover:underline">Need an account?</Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-primary transition focus:ring-2"
            placeholder="••••••••"
          />
        </div>

        {state.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </button>
      </form>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-semibold transition hover:bg-accent"
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
