import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import pg from "pg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Account {
  connectionId: string;
  passwordHash: string | null;
  authenticatorSecret: string | null;
  authenticatedAt: string | null;
  passwordAuthAt: string | null;
  authenticatorAuthAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Avatar {
  name: string;
  accountConnectionId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Backend interface
// ---------------------------------------------------------------------------

interface DbBackend {
  init(): Promise<void>;
  run(sql: string, params: unknown[]): Promise<void>;
  get<T>(sql: string, params: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params: unknown[]): Promise<T[]>;
  transaction(queries: { sql: string; params: unknown[] }[]): Promise<void>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// SQLite backend (local development)
// ---------------------------------------------------------------------------

class SqliteBackend implements DbBackend {
  private db!: Database.Database;

  constructor(private dbPath: string) {}

  async init(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        "connectionId" TEXT PRIMARY KEY,
        "passwordHash" TEXT,
        "authenticatorSecret" TEXT,
        "authenticatedAt" TEXT,
        "passwordAuthAt" TEXT,
        "authenticatorAuthAt" TEXT,
        "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
        "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS avatars (
        name TEXT PRIMARY KEY COLLATE NOCASE,
        "accountConnectionId" TEXT NOT NULL,
        "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY ("accountConnectionId") REFERENCES accounts("connectionId")
      );
    `);
  }

  async run(sql: string, params: unknown[]): Promise<void> {
    this.db.prepare(sql).run(...params);
  }

  async get<T>(sql: string, params: unknown[]): Promise<T | undefined> {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  async all<T>(sql: string, params: unknown[]): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async transaction(queries: { sql: string; params: unknown[] }[]): Promise<void> {
    const txn = this.db.transaction(() => {
      for (const q of queries) {
        this.db.prepare(q.sql).run(...q.params);
      }
    });
    txn();
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL backend (production)
// ---------------------------------------------------------------------------

class PgBackend implements DbBackend {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        "connectionId" TEXT PRIMARY KEY,
        "passwordHash" TEXT,
        "authenticatorSecret" TEXT,
        "authenticatedAt" TEXT,
        "passwordAuthAt" TEXT,
        "authenticatorAuthAt" TEXT,
        "createdAt" TEXT NOT NULL DEFAULT (NOW()::TEXT),
        "updatedAt" TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE TABLE IF NOT EXISTS avatars (
        name TEXT PRIMARY KEY,
        "accountConnectionId" TEXT NOT NULL,
        "createdAt" TEXT NOT NULL DEFAULT (NOW()::TEXT),
        FOREIGN KEY ("accountConnectionId") REFERENCES accounts("connectionId")
      );
    `);
  }

  async run(sql: string, params: unknown[]): Promise<void> {
    await this.pool.query(sql, params);
  }

  async get<T>(sql: string, params: unknown[]): Promise<T | undefined> {
    const result = await this.pool.query(sql, params);
    return result.rows[0] as T | undefined;
  }

  async all<T>(sql: string, params: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async transaction(queries: { sql: string; params: unknown[] }[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const q of queries) {
        await client.query(q.sql, q.params);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// ---------------------------------------------------------------------------
// Db — public API (async, backend-agnostic)
// ---------------------------------------------------------------------------

export class Db {
  private backend!: DbBackend;
  private isPg = false;

  private constructor() {}

  static async create(databaseUrl: string): Promise<Db> {
    const db = new Db();
    if (databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://")) {
      db.isPg = true;
      db.backend = new PgBackend(databaseUrl);
    } else {
      const dbPath = databaseUrl.startsWith("sqlite:") ? databaseUrl.slice("sqlite:".length) : databaseUrl;
      db.backend = new SqliteBackend(dbPath);
    }
    await db.backend.init();
    return db;
  }

  // Placeholder helper: SQLite uses ?, PG uses $1,$2,...
  private p(index: number): string {
    return this.isPg ? `$${index}` : "?";
  }

  private now(): string {
    return this.isPg ? "NOW()::TEXT" : "datetime('now')";
  }

  private ciEquals(col: string, paramIdx: number): string {
    return this.isPg ? `LOWER(${col}) = LOWER(${this.p(paramIdx)})` : `${col} = ${this.p(paramIdx)} COLLATE NOCASE`;
  }

  // -----------------------------------------------------------------------
  // Account operations
  // -----------------------------------------------------------------------

  async getAccount(connectionId: string): Promise<Account | undefined> {
    return this.backend.get<Account>(
      `SELECT * FROM accounts WHERE "connectionId" = ${this.p(1)}`,
      [connectionId]
    );
  }

  async ensureAccount(connectionId: string): Promise<Account> {
    let account = await this.getAccount(connectionId);
    if (!account) {
      const now = new Date().toISOString();
      await this.backend.run(
        `INSERT INTO accounts ("connectionId", "createdAt", "updatedAt") VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)})`,
        [connectionId, now, now]
      );
      account = (await this.getAccount(connectionId))!;
    }
    return account;
  }

  async hasAuthMethods(connectionId: string): Promise<boolean> {
    const account = await this.getAccount(connectionId);
    if (!account) return false;
    return !!(account.passwordHash || account.authenticatorSecret);
  }

  async isAuthenticated(connectionId: string): Promise<boolean> {
    const account = await this.getAccount(connectionId);
    if (!account) return false;
    return !!account.authenticatedAt;
  }

  async setAuthenticated(connectionId: string): Promise<void> {
    await this.backend.run(
      `UPDATE accounts SET "authenticatedAt" = ${this.now()}, "updatedAt" = ${this.now()} WHERE "connectionId" = ${this.p(1)}`,
      [connectionId]
    );
  }

  async setPasswordAuth(connectionId: string): Promise<void> {
    await this.backend.run(
      `UPDATE accounts SET "passwordAuthAt" = ${this.now()}, "authenticatedAt" = ${this.now()}, "updatedAt" = ${this.now()} WHERE "connectionId" = ${this.p(1)}`,
      [connectionId]
    );
  }

  async setAuthenticatorAuth(connectionId: string): Promise<void> {
    await this.backend.run(
      `UPDATE accounts SET "authenticatorAuthAt" = ${this.now()}, "authenticatedAt" = ${this.now()}, "updatedAt" = ${this.now()} WHERE "connectionId" = ${this.p(1)}`,
      [connectionId]
    );
  }

  async logout(connectionId: string): Promise<void> {
    await this.backend.run(
      `UPDATE accounts SET "authenticatedAt" = NULL, "updatedAt" = ${this.now()} WHERE "connectionId" = ${this.p(1)}`,
      [connectionId]
    );
  }

  // Password

  async setPassword(connectionId: string, plainPassword: string): Promise<void> {
    const hash = crypto.createHash("sha256").update(plainPassword).digest("hex");
    await this.backend.run(
      `UPDATE accounts SET "passwordHash" = ${this.p(1)}, "updatedAt" = ${this.now()} WHERE "connectionId" = ${this.p(2)}`,
      [hash, connectionId]
    );
  }

  async verifyPassword(connectionId: string, plainPassword: string): Promise<boolean> {
    const account = await this.getAccount(connectionId);
    if (!account?.passwordHash) return false;
    const hash = crypto.createHash("sha256").update(plainPassword).digest("hex");
    return account.passwordHash === hash;
  }

  // Authenticator

  async setAuthenticatorSecret(connectionId: string, secret: string): Promise<void> {
    await this.backend.run(
      `UPDATE accounts SET "authenticatorSecret" = ${this.p(1)}, "updatedAt" = ${this.now()} WHERE "connectionId" = ${this.p(2)}`,
      [secret, connectionId]
    );
  }

  async getAuthenticatorSecret(connectionId: string): Promise<string | null> {
    const account = await this.getAccount(connectionId);
    return account?.authenticatorSecret ?? null;
  }

  // -----------------------------------------------------------------------
  // Avatar operations
  // -----------------------------------------------------------------------

  async getAvatar(name: string): Promise<Avatar | undefined> {
    return this.backend.get<Avatar>(
      `SELECT * FROM avatars WHERE ${this.ciEquals("name", 1)}`,
      [name]
    );
  }

  async listAvatars(connectionId: string): Promise<Avatar[]> {
    return this.backend.all<Avatar>(
      `SELECT * FROM avatars WHERE "accountConnectionId" = ${this.p(1)} ORDER BY name`,
      [connectionId]
    );
  }

  async createAvatar(name: string, connectionId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.backend.run(
      `INSERT INTO avatars (name, "accountConnectionId", "createdAt") VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)})`,
      [name, connectionId, now]
    );
  }

  async deleteAvatar(name: string): Promise<void> {
    await this.backend.run(
      `DELETE FROM avatars WHERE ${this.ciEquals("name", 1)}`,
      [name]
    );
  }

  // -----------------------------------------------------------------------
  // Account merge (for restore)
  // -----------------------------------------------------------------------

  async mergeAccounts(oldConnectionId: string, newConnectionId: string): Promise<void> {
    await this.backend.transaction([
      {
        sql: `UPDATE avatars SET "accountConnectionId" = ${this.p(1)} WHERE "accountConnectionId" = ${this.p(2)}`,
        params: [newConnectionId, oldConnectionId],
      },
      {
        sql: `DELETE FROM accounts WHERE "connectionId" = ${this.p(1)}`,
        params: [oldConnectionId],
      },
    ]);
  }

  async findAccountByAvatar(avatarName: string): Promise<string | undefined> {
    const avatar = await this.getAvatar(avatarName);
    return avatar?.accountConnectionId;
  }

  async close(): Promise<void> {
    await this.backend.close();
  }
}
