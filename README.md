# FitTrack Pro

Expert workout planner, smart nutrition tracker, and analytics dashboard. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Workout Planner** - AI-generated workout plans with progressive overload, deload weeks, and PR tracking. Supports PPL, Upper/Lower, Full Body, and Bro Split templates.
- **Nutrition Tracker** - Daily food logging with macro tracking (calories, protein, carbs, fat). Adaptive calorie adjustments based on weight trends.
- **Analytics Dashboard** - Weight trend charts, strength progression, daily step tracking, and activity analysis.
- **Apple Health Sync** - Integrates with iOS Shortcuts to sync steps, active calories, and heart rate data.
- **Supplement Guide** - Evidence-based supplement recommendations tailored to your fitness goals.
- **Authentication** - Secure username/password (plus email) and Google sign-in via Auth.js.
- **Dark Mode** - Full dark/light/system theme support.
- **Mobile-First** - Responsive design with floating navigation and swipe gestures.

## Tech Stack

- **Next.js 16** with App Router and TypeScript
- **Tailwind CSS v4** for styling
- **Dexie.js** (IndexedDB) for client-side data persistence
- **Recharts** for charts and visualizations
- **Auth.js v5** with Prisma adapter for authentication
- **Prisma v7** with SQLite for the user/auth database

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd sales-co-pilot

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate a secure AUTH_SECRET
openssl rand -base64 32
# Paste the output into .env as AUTH_SECRET

# Generate Prisma client and create database
npx prisma generate
npx prisma db push

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

### Google OAuth Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy the Client ID and Client Secret into `.env`

## Deploying to Vercel

### 1. Create a Turso database (free)

Vercel serverless functions have no persistent filesystem, so you need a cloud database. Turso provides free hosted LibSQL (SQLite-compatible):

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Sign up / log in
turso auth signup   # or: turso auth login

# Create a database
turso db create fittrack-pro

# Get the connection URL
turso db show fittrack-pro --url
# Output: libsql://fittrack-pro-yourname.turso.io

# Create an auth token
turso db tokens create fittrack-pro
# Output: eyJhbGci...
```

### 2. Push the schema to Turso

```bash
# Set the production DATABASE_URL temporarily
DATABASE_URL="libsql://fittrack-pro-yourname.turso.io" \
DATABASE_AUTH_TOKEN="your-token" \
npx prisma db push
```

### 3. Deploy to Vercel

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com/new)
3. Add environment variables in the Vercel dashboard:
   - `DATABASE_URL` — your Turso URL (`libsql://fittrack-pro-yourname.turso.io`)
   - `DATABASE_AUTH_TOKEN` — your Turso auth token
   - `AUTH_SECRET` — generate with `openssl rand -base64 32`
   - `AUTH_TRUST_HOST` — set to `true`
   - `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (if using Google sign-in)
4. Update the Google OAuth redirect URI to `https://your-domain.vercel.app/api/auth/callback/google`
5. Deploy

## Project Structure

```
src/
  app/                    # Next.js App Router pages
    page.tsx              # Dashboard
    workouts/             # Workout planner pages
    nutrition/            # Nutrition tracker pages
    analytics/            # Analytics dashboard
    settings/             # User settings & Apple Health sync
    login/                # Authentication page
    api/                  # API routes (auth, registration, health sync)
  components/             # React components
    layout/               # Navigation, header, shell
    workouts/             # Workout-related components
    nutrition/            # Nutrition-related components
    analytics/            # Charts and analytics components
    shared/               # Reusable components
  lib/
    algorithms/           # Progressive overload, macro calculator, etc.
    data/                 # Exercise database, food database, supplements
    stores/               # Dexie CRUD operations
    db.ts                 # Dexie database schema
    auth.ts               # Auth.js configuration
    prisma.ts             # Prisma client
  types/                  # TypeScript interfaces
```

## Units

- **Body weight & lifting weights:** lbs (pounds)
- **Nutrition:** grams (g) for macros, kcal for calories
- **Height:** cm
