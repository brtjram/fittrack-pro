import { AuthShell } from '@/components/auth/auth-shell';
import { SignUpForm } from '@/components/auth/sign-up-form';

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start your personalized fitness tracking in under a minute."
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkHref="/sign-in"
    >
      <SignUpForm />
    </AuthShell>
  );
}
