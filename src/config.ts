import os from "node:os";
import path from "node:path";

export const DEFAULT_INTERN_ORIGIN = "https://tryintern.dev";
export const OAUTH_SCOPES = [
  "profile",
  "offline_access",
  "sites:read",
  "sites:write",
  "entitlements:read",
] as const;

export interface InternConfig {
  origin: string;
  resource: string;
  configRoot: string;
  accessToken?: string;
}

export function loadConfig(overrides: { origin?: string } = {}): InternConfig {
  const rawOrigin =
    overrides.origin ?? process.env.INTERN_BASE_URL ?? DEFAULT_INTERN_ORIGIN;
  const origin = normalizeOrigin(rawOrigin);
  return {
    origin,
    resource: new URL("/mcp", origin).toString(),
    configRoot:
      process.env.INTERN_CONFIG_DIR ??
      path.join(
        process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
        "intern",
      ),
    accessToken: process.env.INTERN_ACCESS_TOKEN?.trim() || undefined,
  };
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Intern origin must contain only a scheme, host, and optional port",
    );
  }
  if (url.protocol !== "https:" && !isLoopback(url)) {
    throw new Error(
      "Intern origin must use HTTPS unless it is a loopback test server",
    );
  }
  return url.origin;
}

function isLoopback(url: URL): boolean {
  return (
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]" ||
      url.hostname === "localhost")
  );
}
