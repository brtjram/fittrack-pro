import { AuthShell } from '@/components/auth/auth-shell';
import { SignInForm } from '@/components/auth/sign-in-form';

export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue tracking your workouts and nutrition."
      footerText="Don't have an account?"
      footerLinkText="Create one"
      footerLinkHref="/sign-up"
    >
      <SignInForm />
    </AuthShell>
  );
}
