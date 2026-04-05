'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { signUpWithCredentials, signInWithGoogle, type AuthFormState } from '@/app/(auth)/actions/auth-actions';

const initialState: AuthFormState = {};

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpWithCredentials, initialState);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-primary transition focus:ring-2"
            placeholder="Your name"
          />
        </div>

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
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-primary transition focus:ring-2"
            placeholder="At least 8 characters"
          />
        </div>

        {state.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create account
        </button>
      </form>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-semibold transition hover:bg-accent"
        >
          Sign up with Google
        </button>
      </form>
    </div>
  );
}
