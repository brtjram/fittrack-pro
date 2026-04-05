import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { upsertGoogleUser, verifyUserCredentials } from '@/lib/auth-db';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});


function toOptionalString(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/sign-in',
  },
  providers: [
    Credentials({
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const user = await verifyUserCredentials(parsed.data.email, parsed.data.password);
        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    Google,
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === 'google' && user.email) {
        const dbUser = await upsertGoogleUser({
          email: user.email,
          name: toOptionalString(user.name) ?? toOptionalString(typeof profile?.name === 'string' ? profile.name : undefined),
          image: toOptionalString(user.image) ?? toOptionalString(typeof profile?.image === 'string' ? profile.image : undefined),
        });

        user.id = dbUser.id;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
