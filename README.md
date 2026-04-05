# FitTrack Pro

A mobile-first fitness tracker built with the Next.js App Router.

## Features

- Email/password authentication with secure password hashing (Node.js `scrypt`).
- Google sign-in via Auth.js.
- Route protection with Next.js `proxy.ts`.
- Session-aware UI with signed-in state + sign-out control.
- PostgreSQL-backed user model for credentials + Google account upserts.

## Authentication setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in the required values in `.env.local`:

   - `AUTH_SECRET`: random, long secret value.
   - `AUTH_URL`: app URL (local is `http://localhost:3000`).
   - `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`: from Google Cloud OAuth credentials.
   - `AUTH_DB_URL`: PostgreSQL connection string for auth user storage.

4. Configure Google OAuth redirect URL:

   ```
   http://localhost:3000/api/auth/callback/google
   ```

5. Run the app:

   ```bash
   npm run dev
   ```

6. Visit:

   - `http://localhost:3000/sign-up` to create an account.
   - `http://localhost:3000/sign-in` to sign in.

## Development

```bash
npm run lint
npm run build
```

## Notes

- App routes are protected at the server edge using `src/proxy.ts`.
- Auth.js is configured in `src/auth.ts` and exposed through `src/app/api/auth/[...nextauth]/route.ts`.
- Users are stored in PostgreSQL via `src/lib/auth-db.ts`.
