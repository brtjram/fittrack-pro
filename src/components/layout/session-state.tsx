import { auth, signOut } from '@/auth';

export async function SessionState() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3 text-sm">
      <p className="truncate text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{session.user.name ?? session.user.email}</span>
      </p>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/sign-in' });
        }}
      >
        <button type="submit" className="rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-accent">
          Sign out
        </button>
      </form>
    </div>
  );
}
