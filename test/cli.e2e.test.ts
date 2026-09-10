import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

interface SourceFile {
  path: string;
  encoding: "utf8" | "base64";
  content: string;
}

const processes = new Set<ChildProcessWithoutNullStreams>();
const servers = new Set<http.Server>();
const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const child of processes) child.kill("SIGKILL");
  processes.clear();
  await Promise.all(
    [...servers].map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
  servers.clear();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe("Intern CLI hosted publishing", () => {
  it("authorizes a coding agent and publishes then revises a real static directory over MCP HTTP", async () => {
    const root = await temporaryDirectory();
    const configRoot = path.join(root, "config");
    const siteRoot = path.join(root, "site");
    await fs.mkdir(path.join(siteRoot, "assets"), { recursive: true });
    await fs.mkdir(path.join(siteRoot, "node_modules", "ignored"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(siteRoot, "index.html"),
      "<!doctype html><h1>Launch room</h1>",
    );
    await fs.writeFile(
      path.join(siteRoot, "assets", "pixel.bin"),
      Buffer.from([0, 255, 1]),
    );
    await fs.writeFile(path.join(siteRoot, ".env"), "SECRET=must-not-leave\n");
    await fs.writeFile(
      path.join(siteRoot, "node_modules", "ignored", "file.js"),
      "nope",
    );

    let currentFiles: SourceFile[] | null = null;
    let currentRevision = "";
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> =
      [];
    let callbackUri = "";
    let origin = "";

    const server = http.createServer(async (request, response) => {
      const requestUrl = new URL(
        request.url ?? "/",
        origin || "http://127.0.0.1",
      );
      if (
        request.method === "GET" &&
        requestUrl.pathname === "/.well-known/oauth-protected-resource/mcp"
      ) {
        json(response, {
          resource: `${origin}/mcp`,
          authorization_servers: [origin],
        });
        return;
      }
      if (
        request.method === "GET" &&
        requestUrl.pathname === "/.well-known/oauth-authorization-server"
      ) {
        json(response, {
          issuer: origin,
          authorization_endpoint: `${origin}/oauth/authorize`,
          token_endpoint: `${origin}/oauth/token`,
          registration_endpoint: `${origin}/oauth/register`,
        });
        return;
      }
      if (
        request.method === "POST" &&
        requestUrl.pathname === "/oauth/register"
      ) {
        const registration = JSON.parse(await requestBody(request)) as {
          redirect_uris: string[];
        };
        callbackUri = registration.redirect_uris[0]!;
        json(response, {
          client_id: "intern-cli-e2e",
          scope:
            "profile offline_access sites:read sites:write entitlements:read",
        });
        return;
      }
      if (
        request.method === "GET" &&
        requestUrl.pathname === "/oauth/authorize"
      ) {
        expect(requestUrl.searchParams.get("client_id")).toBe("intern-cli-e2e");
        expect(requestUrl.searchParams.get("resource")).toBe(`${origin}/mcp`);
        const callback = new URL(callbackUri);
        callback.searchParams.set("code", "one-time-code");
        callback.searchParams.set(
          "state",
          requestUrl.searchParams.get("state")!,
        );
        callback.searchParams.set("iss", origin);
        response.writeHead(302, { location: callback.toString() }).end();
        return;
      }
      if (request.method === "POST" && requestUrl.pathname === "/oauth/token") {
        const form = new URLSearchParams(await requestBody(request));
        expect(form.get("grant_type")).toBe("authorization_code");
        expect(form.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{64}$/);
        json(response, {
          access_token: "access-e2e",
          refresh_token: "refresh-e2e",
          expires_in: 3600,
          scope:
            "profile offline_access sites:read sites:write entitlements:read",
        });
        return;
      }
      if (request.method === "POST" && requestUrl.pathname === "/mcp") {
        expect(request.headers.authorization).toBe("Bearer access-e2e");
        const rpc = JSON.parse(await requestBody(request)) as {
          id: number;
          method: string;
          params: {
            name: string;
            arguments: Record<string, unknown>;
          };
        };
        if (rpc.method === "tools/list") {
          response.writeHead(200, { "content-type": "text/event-stream" });
          response.end(
            `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: { tools: [{ name: "intern_create_site" }] } })}\n\n`,
          );
          return;
        }
        expect(rpc.method).toBe("tools/call");
        calls.push(rpc.params);
        const result = toolResult(rpc.params.name, rpc.params.arguments);
        json(response, {
          jsonrpc: "2.0",
          id: rpc.id,
          result: { structuredContent: result },
        });
        return;
      }
      response.writeHead(404).end();
    });

    function toolResult(name: string, args: Record<string, unknown>): unknown {
      if (name === "intern_auth_status") {
        return {
          authorized: true,
          user: {
            id: "user-1",
            email: "ada@example.com",
            name: "Ada",
            orgRole: "admin",
          },
          org: { id: "org-1", slug: "example", state: "active" },
        };
      }
      if (name === "intern_list_sites") {
        return { sites: currentFiles ? [{ slug: "launch-room" }] : [] };
      }
      if (name === "intern_create_site") {
        const initial = args.initialSource as { files: SourceFile[] };
        currentFiles = initial.files;
        currentRevision = "a".repeat(40);
        return {
          site: {
            slug: "launch-room",
            url: "https://launch-room.example.tryintern.dev",
          },
          plugins: [],
          pluginErrors: [],
          provisioningInProgress: false,
          publication: {
            state: "published",
            revision: currentRevision,
            siteUrl: "https://launch-room.example.tryintern.dev",
          },
        };
      }
      if (name === "intern_get_site_source") {
        return {
          site: "launch-room",
          revision: currentRevision,
          files: currentFiles,
        };
      }
      if (name === "intern_apply_site_revision") {
        expect(args.baseRevision).toBe("a".repeat(40));
        const changed = args.files as SourceFile[];
        const deleted = new Set(args.delete as string[]);
        const next = new Map(
          (currentFiles ?? [])
            .filter((file) => !deleted.has(file.path))
            .map((file) => [file.path, file]),
        );
        for (const file of changed) next.set(file.path, file);
        currentFiles = [...next.values()];
        currentRevision = "b".repeat(40);
        return {
          site: "launch-room",
          revision: currentRevision,
          siteUrl: "https://launch-room.example.tryintern.dev",
        };
      }
      throw new Error(`Unexpected tool ${name}`);
    }

    origin = await listen(server);

    const packageMetadata = JSON.parse(
      await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    const version = await runCLI(["--version"], {});
    expect(version).toMatchObject({
      code: 0,
      stdout: `${packageMetadata.version}\n`,
      stderr: "",
    });

    // Authenticate through a real CLI process and its ephemeral loopback callback.
    const loginProcess = startCLI(["login", "--no-open", "--origin", origin], {
      INTERN_CONFIG_DIR: configRoot,
    });
    const authorizationUrl = await stderrURL(loginProcess);
    const browserResponse = await fetch(authorizationUrl);
    expect(browserResponse.status).toBe(200);
    expect(await browserResponse.text()).toContain("Intern CLI is connected");
    const loginResult = await finish(loginProcess);
    expect(loginResult.code).toBe(0);
    expect(JSON.parse(loginResult.stdout)).toMatchObject({
      authorized: true,
      user: { email: "ada@example.com" },
    });
    expect(
      (await fs.stat(path.join(configRoot, "credentials.json"))).mode & 0o777,
    ).toBe(0o600);

    // Publish UTF-8 and binary files across the real CLI-to-MCP HTTP boundary.
    const first = await runCLI(
      ["publish", siteRoot, "--site", "launch-room", "--origin", origin],
      { INTERN_CONFIG_DIR: configRoot },
    );
    expect(first.code).toBe(0);
    expect(JSON.parse(first.stdout)).toMatchObject({
      site: "launch-room",
      created: true,
      changed: true,
      uploaded: ["assets/pixel.bin", "index.html"],
      ignored: [".env", "node_modules/"],
    });
    expect(currentFiles).toEqual([
      { path: "assets/pixel.bin", encoding: "base64", content: "AP8B" },
      {
        path: "index.html",
        encoding: "utf8",
        content: "<!doctype html><h1>Launch room</h1>",
      },
    ]);

    // Revise the same site with compare-and-swap, including one deletion.
    await fs.rm(path.join(siteRoot, "assets", "pixel.bin"));
    await fs.writeFile(
      path.join(siteRoot, "index.html"),
      "<!doctype html><h1>Launch room v2</h1>",
    );
    const second = await runCLI(
      [
        "publish",
        siteRoot,
        "--site",
        "launch-room",
        "--message",
        "Publish v2",
        "--origin",
        origin,
      ],
      { INTERN_CONFIG_DIR: configRoot },
    );
    expect(second.code).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({
      created: false,
      changed: true,
      uploaded: ["index.html"],
      deleted: ["assets/pixel.bin"],
      publication: { revision: "b".repeat(40) },
    });
    expect(currentFiles).toEqual([
      {
        path: "index.html",
        encoding: "utf8",
        content: "<!doctype html><h1>Launch room v2</h1>",
      },
    ]);

    // Live discovery remains available instead of freezing the remote tool list in the CLI.
    const tools = await runCLI(["tools", "--origin", origin], {
      INTERN_CONFIG_DIR: configRoot,
    });
    expect(tools.code).toBe(0);
    expect(JSON.parse(tools.stdout)).toEqual({
      tools: [{ name: "intern_create_site" }],
    });
    expect(calls.map((call) => call.name)).toEqual([
      "intern_auth_status",
      "intern_list_sites",
      "intern_create_site",
      "intern_list_sites",
      "intern_get_site_source",
      "intern_apply_site_revision",
    ]);
  }, 20_000);
});

async function temporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "intern-cli-e2e-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function listen(server: http.Server): Promise<string> {
  servers.add(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("missing server address");
  return `http://127.0.0.1:${address.port}`;
}

function startCLI(
  args: string[],
  env: Record<string, string>,
): ChildProcessWithoutNullStreams {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const child = spawn(
    process.execPath,
    [path.join(packageRoot, "dist/index.js"), ...args],
    {
      cwd: packageRoot,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  child.stdin.end();
  processes.add(child);
  return child;
}

async function runCLI(
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return finish(startCLI(args, env));
}

async function finish(
  child: ChildProcessWithoutNullStreams,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const code = await new Promise<number | null>((resolve) =>
    child.once("exit", resolve),
  );
  processes.delete(child);
  return { code, stdout, stderr };
}

async function stderrURL(
  child: ChildProcessWithoutNullStreams,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(
      () => reject(new Error(`authorization URL not emitted: ${stderr}`)),
      5_000,
    );
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/https?:\/\/[^\s]+\/oauth\/authorize\?[^\s]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(
        new Error(`login exited before authorization with ${code}: ${stderr}`),
      );
    });
  });
}

async function requestBody(request: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function json(response: http.ServerResponse, value: unknown): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}
