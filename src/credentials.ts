import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { InternConfig } from "./config.js";
import { InternError } from "./errors.js";

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
  scope: string;
}

export interface CredentialRecord {
  version: 1;
  issuer: string;
  resource: string;
  clientId: string;
  tokenEndpoint: string;
  tokens: OAuthTokens;
}

const refreshWindowMs = 60_000;

export class CredentialStore {
  constructor(private readonly config: InternConfig) {}

  async read(): Promise<CredentialRecord | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await fs.readFile(this.file(), "utf8"));
    } catch (error) {
      if (hasCode(error, "ENOENT")) return null;
      throw new InternError(
        "credentials_invalid",
        "Stored Intern credentials are unreadable; run `intern login` again",
      );
    }
    const record = parseRecord(parsed);
    if (
      !record ||
      record.issuer !== this.config.origin ||
      record.resource !== this.config.resource ||
      !isIssuerEndpoint(record.tokenEndpoint, record.issuer)
    ) {
      throw new InternError(
        "credentials_invalid",
        "Stored Intern credentials do not belong to this Intern origin; run `intern login` again",
      );
    }
    return record;
  }

  async write(record: CredentialRecord): Promise<void> {
    if (
      !parseRecord(record) ||
      record.issuer !== this.config.origin ||
      record.resource !== this.config.resource ||
      !isIssuerEndpoint(record.tokenEndpoint, record.issuer)
    ) {
      throw new Error("Refusing to store invalid Intern credentials");
    }
    await fs.mkdir(this.config.configRoot, { recursive: true, mode: 0o700 });
    await fs.chmod(this.config.configRoot, 0o700);
    const temporary = path.join(
      this.config.configRoot,
      `.credentials.${process.pid}.${randomUUID()}`,
    );
    try {
      await fs.writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, {
        flag: "wx",
        mode: 0o600,
      });
      await fs.chmod(temporary, 0o600);
      await fs.rename(temporary, this.file());
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
  }

  async remove(): Promise<boolean> {
    try {
      await fs.rm(this.file());
      return true;
    } catch (error) {
      if (hasCode(error, "ENOENT")) return false;
      throw error;
    }
  }

  private file(): string {
    return path.join(this.config.configRoot, "credentials.json");
  }
}

export class Credentials {
  private readonly store: CredentialStore;

  constructor(
    private readonly config: InternConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.store = new CredentialStore(config);
  }

  async accessToken(forceRefresh = false): Promise<string> {
    if (this.config.accessToken) return this.config.accessToken;
    const record = await this.store.read();
    if (!record) {
      throw new InternError(
        "auth_required",
        "Intern is not connected; run `intern login`",
      );
    }
    if (
      !forceRefresh &&
      record.tokens.expiresAtMs > Date.now() + refreshWindowMs
    ) {
      return record.tokens.accessToken;
    }
    const response = await this.fetchFn(record.tokenEndpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: record.clientId,
        refresh_token: record.tokens.refreshToken,
      }),
    });
    const body = await responseJSON(response);
    if (!response.ok) {
      throw new InternError(
        "auth_required",
        `Intern session refresh failed; run \`intern login\` again (${oauthError(body, response.status)})`,
      );
    }
    const tokens = parseTokens(body);
    const updated = { ...record, tokens };
    await this.store.write(updated);
    return tokens.accessToken;
  }

  save(record: CredentialRecord): Promise<void> {
    return this.store.write(record);
  }

  logout(): Promise<boolean> {
    return this.store.remove();
  }
}

export function parseTokens(value: unknown): OAuthTokens {
  if (!isRecord(value))
    throw new InternError(
      "oauth_invalid_response",
      "OAuth server returned invalid JSON",
    );
  const accessToken = value.access_token;
  const refreshToken = value.refresh_token;
  const expiresIn = value.expires_in;
  const scope = value.scope;
  if (
    typeof accessToken !== "string" ||
    !accessToken ||
    typeof refreshToken !== "string" ||
    !refreshToken ||
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0 ||
    typeof scope !== "string"
  ) {
    throw new InternError(
      "oauth_invalid_response",
      "OAuth server returned incomplete credentials",
    );
  }
  return {
    accessToken,
    refreshToken,
    expiresAtMs: Date.now() + expiresIn * 1_000,
    scope,
  };
}

function parseRecord(value: unknown): CredentialRecord | null {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.tokens))
    return null;
  if (
    typeof value.issuer !== "string" ||
    typeof value.resource !== "string" ||
    typeof value.clientId !== "string" ||
    typeof value.tokenEndpoint !== "string" ||
    typeof value.tokens.accessToken !== "string" ||
    typeof value.tokens.refreshToken !== "string" ||
    typeof value.tokens.expiresAtMs !== "number" ||
    typeof value.tokens.scope !== "string"
  )
    return null;
  return value as unknown as CredentialRecord;
}

function oauthError(value: unknown, status: number): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : `HTTP ${status}`;
}

async function responseJSON(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIssuerEndpoint(value: string, issuer: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === issuer && !url.username && !url.password;
  } catch {
    return false;
  }
}

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
