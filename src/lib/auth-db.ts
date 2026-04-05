import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import postgres, { type Sql } from 'postgres';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  image: string | null;
}

let sqlClient: Sql | null = null;
let initialized = false;

function getSqlClient(): Sql {
  if (sqlClient) {
    return sqlClient;
  }

  const connectionString = process.env.AUTH_DB_URL;

  if (!connectionString) {
    throw new Error('Missing AUTH_DB_URL environment variable.');
  }

  sqlClient = postgres(connectionString, {
    ssl: connectionString.includes('localhost') ? 'prefer' : 'require',
  });

  return sqlClient;
}

async function ensureUsersTable() {
  if (initialized) {
    return;
  }

  const sql = getSqlClient();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT,
      image TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  initialized = true;
}

function mapUser(row: Record<string, unknown> | undefined): AuthUser | null {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    passwordHash: row.password_hash ? String(row.password_hash) : null,
    image: row.image ? String(row.image) : null,
  };
}

function hashPassword(password: string): string {
  const salt = randomUUID();
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }

  const passwordBuffer = scryptSync(password, salt, 64);
  const hashBuffer = Buffer.from(hash, 'hex');

  if (passwordBuffer.length !== hashBuffer.length) {
    return false;
  }

  return timingSafeEqual(passwordBuffer, hashBuffer);
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  await ensureUsersTable();

  const sql = getSqlClient();

  const [row] = await sql<Record<string, unknown>[]>`
    SELECT id, email, name, password_hash, image
    FROM users
    WHERE email = ${email.trim().toLowerCase()}
    LIMIT 1
  `;

  return mapUser(row);
}

export async function createUserWithPassword(params: { email: string; password: string; name?: string }): Promise<AuthUser> {
  await ensureUsersTable();

  const now = new Date().toISOString();
  const email = params.email.trim().toLowerCase();
  const name = params.name?.trim() || null;
  const id = randomUUID();
  const passwordHash = hashPassword(params.password);

  const sql = getSqlClient();

  const [row] = await sql<Record<string, unknown>[]>`
    INSERT INTO users (id, email, name, password_hash, image, created_at, updated_at)
    VALUES (${id}, ${email}, ${name}, ${passwordHash}, NULL, ${now}, ${now})
    RETURNING id, email, name, password_hash, image
  `;

  const user = mapUser(row);
  if (!user) {
    throw new Error('Failed to create user record.');
  }

  return user;
}

export async function upsertGoogleUser(params: { email: string; name?: string; image?: string }): Promise<AuthUser> {
  await ensureUsersTable();

  const now = new Date().toISOString();
  const email = params.email.trim().toLowerCase();
  const name = params.name?.trim() || null;
  const image = params.image?.trim() || null;
  const id = randomUUID();

  const sql = getSqlClient();

  const [row] = await sql<Record<string, unknown>[]>`
    INSERT INTO users (id, email, name, password_hash, image, created_at, updated_at)
    VALUES (${id}, ${email}, ${name}, NULL, ${image}, ${now}, ${now})
    ON CONFLICT (email)
    DO UPDATE SET
      name = EXCLUDED.name,
      image = EXCLUDED.image,
      updated_at = EXCLUDED.updated_at
    RETURNING id, email, name, password_hash, image
  `;

  const user = mapUser(row);
  if (!user) {
    throw new Error('Failed to upsert Google user.');
  }

  return user;
}

export async function verifyUserCredentials(email: string, password: string): Promise<AuthUser | null> {
  const user = await getUserByEmail(email);
  if (!user?.passwordHash) {
    return null;
  }

  return verifyPassword(password, user.passwordHash) ? user : null;
}
