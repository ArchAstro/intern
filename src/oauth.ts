import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { OAUTH_SCOPES, type InternConfig } from "./config.js";
import {
  Credentials,
  parseTokens,
  type CredentialRecord,
} from "./credentials.js";
import { InternError } from "./errors.js";

interface AuthorizationServerMetadata {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string;
}

interface LoginOptions {
  openBrowser?: boolean;
  timeoutMs?: number;
  notify?: (message: string) => void;
}

interface OAuthCallback {
  redirectUri: string;
  wait(): Promise<string>;
  close(): Promise<void>;
}

export async function login(
  config: InternConfig,
  credentials: Credentials,
  options: LoginOptions = {},
  fetchFn: typeof fetch = fetch,
): Promise<CredentialRecord> {
  const metadata = await discover(config, fetchFn);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const callback = await listenForCallback(
    state,
    metadata.issuer,
    options.timeoutMs ?? 5 * 60_000,
  );

  try {
    const clientId = await registerClient(
      metadata.registrationEndpoint,
      callback.redirectUri,
      fetchFn,
    );
    const authorizationURL = new URL(metadata.authorizationEndpoint);
    for (const [key, value] of Object.entries({
      response_type: "code",
      client_id: clientId,
      redirect_uri: callback.redirectUri,
      scope: OAUTH_SCOPES.join(" "),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: config.resource,
    }))
      authorizationURL.searchParams.set(key, value);

    options.notify?.(
      `Open this URL to connect Intern:\n${authorizationURL.toString()}`,
    );
    if (options.openBrowser !== false) openBrowser(authorizationURL.toString());
    const code = await callback.wait();
    const response = await fetchFn(metadata.tokenEndpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: callback.redirectUri,
        code_verifier: verifier,
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new InternError(
        "oauth_exchange_failed",
        `Intern authorization failed (${remoteError(body, response.status)})`,
      );
    }
    const record: CredentialRecord = {
      version: 1,
      issuer: metadata.issuer,
      resource: config.resource,
      clientId,
      tokenEndpoint: metadata.tokenEndpoint,
      tokens: parseTokens(body),
    };
    await credentials.save(record);
    return record;
  } finally {
    await callback.close();
  }
}

async function discover(
  config: InternConfig,
  fetchFn: typeof fetch,
): Promise<AuthorizationServerMetadata> {
  const protectedResource = await fetchJSON(
    new URL(
      "/.well-known/oauth-protected-resource/mcp",
      config.origin,
    ).toString(),
    fetchFn,
  );
  if (
    !isRecord(protectedResource) ||
    protectedResource.resource !== config.resource ||
    !Array.isArray(protectedResource.authorization_servers) ||
    protectedResource.authorization_servers.length !== 1 ||
    typeof protectedResource.authorization_servers[0] !== "string"
  ) {
    throw new InternError(
      "oauth_discovery_failed",
      "Intern returned invalid protected-resource metadata",
    );
  }
  const issuer = sameOriginURL(
    protectedResource.authorization_servers[0],
    config.origin,
  );
  const authorization = await fetchJSON(
    new URL("/.well-known/oauth-authorization-server", issuer).toString(),
    fetchFn,
  );
  if (!isRecord(authorization) || authorization.issuer !== issuer) {
    throw new InternError(
      "oauth_discovery_failed",
      "Intern returned invalid authorization-server metadata",
    );
  }
  return {
    issuer,
    authorizationEndpoint: metadataEndpoint(
      authorization.authorization_endpoint,
      issuer,
    ),
    tokenEndpoint: metadataEndpoint(authorization.token_endpoint, issuer),
    registrationEndpoint: metadataEndpoint(
      authorization.registration_endpoint,
      issuer,
    ),
  };
}

async function registerClient(
  endpoint: string,
  redirectUri: string,
  fetchFn: typeof fetch,
): Promise<string> {
  const response = await fetchFn(endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Intern CLI",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !isRecord(body) || typeof body.client_id !== "string") {
    throw new InternError(
      "oauth_registration_failed",
      `Intern could not register this CLI (${remoteError(body, response.status)})`,
    );
  }
  return body.client_id;
}

async function listenForCallback(
  expectedState: string,
  expectedIssuer: string,
  timeoutMs: number,
): Promise<OAuthCallback> {
  let settle: ((value: string) => void) | undefined;
  let reject: ((error: Error) => void) | undefined;
  const result = new Promise<string>((resolve, rejectResult) => {
    settle = resolve;
    reject = rejectResult;
  });
  let completed = false;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "GET" || url.pathname !== "/callback") {
      response.writeHead(404).end("Not found");
      return;
    }
    const error = url.searchParams.get("error");
    const state = url.searchParams.get("state");
    const issuer = url.searchParams.get("iss");
    const code = url.searchParams.get("code");
    if (state !== expectedState || issuer !== expectedIssuer) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end(
        "This authorization response did not match the Intern CLI request.",
      );
      return;
    }
    completed = true;
    if (error || !code) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      response.end(
        "Intern authorization was not approved. You can close this window.",
      );
      reject?.(
        new InternError(
          "oauth_denied",
          `Intern authorization was denied (${error ?? "missing_code"})`,
        ),
      );
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      "<!doctype html><title>Intern connected</title><p>Intern CLI is connected. You can close this window.</p>",
    );
    settle?.(code);
  });
  await new Promise<void>((resolve, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const timer = setTimeout(() => {
    if (!completed)
      reject?.(
        new InternError(
          "oauth_timeout",
          "Timed out waiting for Intern authorization",
        ),
      );
  }, timeoutMs);
  const address = server.address() as AddressInfo;
  return {
    redirectUri: `http://127.0.0.1:${address.port}/callback`,
    wait: () => result,
    close: async () => {
      clearTimeout(timer);
      if (!server.listening) return;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? { file: "open", args: [url] }
      : process.platform === "win32"
        ? { file: "cmd", args: ["/c", "start", "", url] }
        : { file: "xdg-open", args: [url] };
  try {
    const child = spawn(command.file, command.args, {
      detached: true,
      stdio: "ignore",
    });
    child.on("error", () => {});
    child.unref();
  } catch {
    // The URL has already been printed for terminals without a browser opener.
  }
}

async function fetchJSON(url: string, fetchFn: typeof fetch): Promise<unknown> {
  const response = await fetchFn(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: { accept: "application/json" },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new InternError(
      "oauth_discovery_failed",
      `Intern OAuth discovery failed (${remoteError(body, response.status)})`,
    );
  }
  return body;
}

function metadataEndpoint(value: unknown, issuer: string): string {
  if (typeof value !== "string") {
    throw new InternError(
      "oauth_discovery_failed",
      "Intern OAuth metadata omitted an endpoint",
    );
  }
  return sameOriginURL(value, issuer);
}

function sameOriginURL(value: string, expectedOrigin: string): string {
  const url = new URL(value);
  if (url.origin !== expectedOrigin || url.username || url.password) {
    throw new InternError(
      "oauth_discovery_failed",
      "Intern OAuth metadata pointed outside its issuer",
    );
  }
  return url.toString().replace(/\/$/, "");
}

function remoteError(value: unknown, status: number): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : `HTTP ${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
