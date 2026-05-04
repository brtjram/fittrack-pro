import { Header } from '@/components/layout/header';

export const metadata = { title: 'Privacy Policy — FitTrack Pro' };

export default function PrivacyPage() {
  const updated = 'May 4, 2026';

  return (
    <div className="min-h-screen">
      <Header title="Privacy Policy" showBack />
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 text-sm leading-relaxed text-muted-foreground">
        <p className="text-xs">Last updated: {updated}</p>

        <p>
          This Privacy Policy explains how FitTrack Pro (&quot;we&quot;, &quot;our&quot;, &quot;the App&quot;) collects, uses, stores, and
          protects your personal information. By using the App you agree to this policy.
        </p>

        <Section title="1. Data We Collect">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 text-left font-semibold text-foreground w-1/3">Category</th>
                <th className="py-2 text-left font-semibold text-foreground">Examples</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ['Account', 'Name, email address, hashed password'],
                ['Fitness Profile', 'Age, gender, height, weight, fitness goal, activity level, workout split preference'],
                ['Workout Data', 'Exercise sets, weights, reps, session ratings, duration'],
                ['Nutrition Data', 'Food log entries, meal times, calorie and macro targets'],
                ['Body Metrics', 'Weight entries, body fat percentage (optional)'],
                ['Activity Data', 'Daily step counts, active calories, resting heart rate (manual or via Apple Health)'],
                ['Menstrual Cycle', 'Last period date, cycle length — only if you opt in to cycle tracking'],
                ['Device', 'Push notification token (iOS only, for reminders)'],
                ['Usage', 'Pages visited, features used — for improving the App'],
              ].map(([cat, ex]) => (
                <tr key={cat}>
                  <td className="py-2 font-medium text-foreground align-top">{cat}</td>
                  <td className="py-2">{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="2. How We Use Your Data">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Generating personalised workout plans and nutrition targets</li>
            <li>Powering the AI coaching chat (your profile context is sent to Anthropic — see §4)</li>
            <li>Sending push notifications for workouts, meals, and step reminders (only if you enable them)</li>
            <li>Tracking progress over time (weight trends, personal records, step history)</li>
            <li>Improving App features through aggregated, anonymised analytics</li>
          </ul>
          <p className="mt-3">We do not use your health data for advertising or sell it to third parties.</p>
        </Section>

        <Section title="3. Legal Basis for Processing (GDPR)">
          <p>If you are in the European Economic Area or United Kingdom, our legal bases for processing are:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1.5">
            <li><strong className="text-foreground">Contract</strong> — data needed to provide the App&apos;s core features</li>
            <li><strong className="text-foreground">Legitimate interest</strong> — improving the App, preventing abuse</li>
            <li><strong className="text-foreground">Consent</strong> — menstrual cycle data, push notifications, Apple Health integration</li>
          </ul>
        </Section>

        <Section title="4. Third-Party Services">
          <div className="space-y-3">
            <ThirdParty
              name="Anthropic (Claude AI)"
              purpose="Powers the AI coaching chat. Your fitness profile (name, age, gender, weight, goal, experience level) and your messages are sent to Anthropic's API to generate responses. Messages are not stored by us beyond your session."
              link="https://www.anthropic.com/privacy"
            />
            <ThirdParty
              name="Expo (Push Notifications)"
              purpose="Delivers push notifications to your iOS device via the Expo Push Notification service. Only your device token is shared."
              link="https://expo.dev/privacy"
            />
            <ThirdParty
              name="Apple HealthKit"
              purpose="If you enable Apple Health integration, step counts, active calories, and resting heart rate are read from HealthKit on your device. This data is transmitted to our servers only if you explicitly initiate a sync."
              link="https://www.apple.com/legal/privacy/"
            />
          </div>
        </Section>

        <Section title="5. Data Storage & Security">
          <p>
            Your data is stored in a secure database. Passwords are hashed using bcrypt and never stored in
            plain text. Data is transmitted over HTTPS. We take reasonable technical and organisational measures
            to protect your information from unauthorised access.
          </p>
          <p className="mt-3">
            We retain your data for as long as your account is active. You can request deletion at any time
            (see §7).
          </p>
        </Section>

        <Section title="6. Children's Privacy">
          <p>
            The App is not intended for children under 16. We do not knowingly collect data from children under
            16. If we become aware that we have done so, we will delete it promptly.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your location, you may have the right to:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your account and data</li>
            <li>Object to or restrict certain processing</li>
            <li>Data portability (receive your data in a machine-readable format)</li>
            <li>Withdraw consent at any time (e.g. disable cycle tracking or push notifications in Settings)</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, contact{' '}
            <a href="mailto:privacy@fittrackpro.app" className="font-medium text-primary underline-offset-2 hover:underline">
              privacy@fittrackpro.app
            </a>. We will respond within 30 days.
          </p>
        </Section>

        <Section title="8. Cookies & Local Storage">
          <p>
            The App uses a session cookie for authentication and local storage to remember your health disclaimer
            acceptance. No advertising or cross-site tracking cookies are used.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this policy periodically. We will notify you of significant changes via the App or by
            email. Continued use after changes are posted constitutes acceptance.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions about privacy? Contact us at{' '}
            <a href="mailto:privacy@fittrackpro.app" className="font-medium text-primary underline-offset-2 hover:underline">
              privacy@fittrackpro.app
            </a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function ThirdParty({ name, purpose, link }: { name: string; purpose: string; link: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-foreground">{name}</p>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-primary underline-offset-2 hover:underline"
        >
          Privacy policy ↗
        </a>
      </div>
      <p className="mt-1">{purpose}</p>
    </div>
  );
}
