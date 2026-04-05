import Link from 'next/link';

interface AuthShellProps {
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
  children: React.ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  footerText,
  footerLinkText,
  footerLinkHref,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">FitTrack Pro</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {children}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {footerText}{' '}
          <Link href={footerLinkHref} className="font-semibold text-primary hover:underline">
            {footerLinkText}
          </Link>
        </p>
      </div>
    </div>
  );
}
