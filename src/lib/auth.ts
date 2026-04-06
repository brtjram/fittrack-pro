import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { normalizeIdentifier } from '@/lib/security';

const hasGoogleCredentials =
  !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

type TokenWithUser = { id?: string; username?: string | null };
type SessionWithUser = {
  user?: { id?: string; username?: string } | null;
};

type HandlerFn = (...args: unknown[]) => unknown;
type HandlerSet = { GET: HandlerFn; POST: HandlerFn };

function hasHandlers(value: unknown): value is { handlers: HandlerSet } {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as { handlers?: Partial<HandlerSet> };
  return !!maybe.handlers?.GET && !!maybe.handlers?.POST;
}

const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    ...(hasGoogleCredentials
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
          }),
        ]
      : []),
    Credentials({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.password) return null;

        const identifierInput = credentials.identifier;
        if (typeof identifierInput !== 'string' || !identifierInput.trim()) return null;

        const identifier = normalizeIdentifier(identifierInput);
        const password = credentials.password as string;

        try {
          const user = await prisma.user.findFirst({
            where: {
              OR: [{ email: identifier }, { username: identifier }],
            },
          });

          if (!user || !user.hashedPassword) return null;

          const isValid = await bcrypt.compare(password, user.hashedPassword);
          if (!isValid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            username: user.username,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: TokenWithUser; user?: { id?: string; username?: string | null } }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }: { session: SessionWithUser; token: TokenWithUser }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.username = token.username ?? undefined;
      }
      return session;
    },
  },
};

const nextAuthFactory = NextAuth as unknown as (config: typeof authConfig) => unknown;
const nextAuthResult = nextAuthFactory(authConfig);

export const handlers: HandlerSet = hasHandlers(nextAuthResult)
  ? nextAuthResult.handlers
  : {
      GET: nextAuthResult as HandlerFn,
      POST: nextAuthResult as HandlerFn,
    };

export const googleEnabled = hasGoogleCredentials;
