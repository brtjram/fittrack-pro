declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username?: string;
    } & Session['user'];
  }

  interface User {
    username?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    username?: string | null;
  }
}
