import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InternConfig } from "../src/config.js";
import {
  CredentialStore,
  Credentials,
  type CredentialRecord,
} from "../src/credentials.js";

const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("Intern CLI credentials", () => {
  it("refreshes an expired resource-bound session and stores the rotated token", async () => {
    const config = await testConfig();
    const store = new CredentialStore(config);
    await store.write(record(config, { expiresAtMs: 0 }));
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        access_token: "access-2",
        refresh_token: "refresh-2",
        expires_in: 3600,
        scope: "profile sites:read sites:write",
      }),
    );

    await expect(new Credentials(config, fetchFn).accessToken()).resolves.toBe(
      "access-2",
    );
    expect(fetchFn).toHaveBeenCalledWith(
      `${config.origin}/oauth/token`,
      expect.objectContaining({ method: "POST" }),
    );
    await expect(store.read()).resolves.toMatchObject({
      tokens: { accessToken: "access-2", refreshToken: "refresh-2" },
    });
  });

  it("refuses a stored token endpoint outside the bound issuer", async () => {
    const config = await testConfig();
    await fs.mkdir(config.configRoot, { recursive: true });
    await fs.writeFile(
      path.join(config.configRoot, "credentials.json"),
      JSON.stringify({
        ...record(config),
        tokenEndpoint: "https://attacker.example/token",
      }),
    );

    await expect(new CredentialStore(config).read()).rejects.toMatchObject({
      code: "credentials_invalid",
    });
  });
});

async function testConfig(): Promise<InternConfig> {
  const configRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "intern-credentials-"),
  );
  roots.push(configRoot);
  return {
    origin: "https://intern.example",
    resource: "https://intern.example/mcp",
    configRoot,
  };
}

function record(
  config: InternConfig,
  tokenOverrides: Partial<CredentialRecord["tokens"]> = {},
): CredentialRecord {
  return {
    version: 1,
    issuer: config.origin,
    resource: config.resource,
    clientId: "client-1",
    tokenEndpoint: `${config.origin}/oauth/token`,
    tokens: {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAtMs: Date.now() + 3_600_000,
      scope: "profile sites:read sites:write",
      ...tokenOverrides,
    },
  };
}
