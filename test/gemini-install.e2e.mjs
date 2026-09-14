import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("Gemini installs the hosted extension without requiring a local Intern CLI", async () => {
  // Use an empty native profile, not the developer's existing Gemini settings.
  const profile = await mkdtemp(path.join(tmpdir(), "intern-gemini-proof-"));
  const source = fileURLToPath(new URL("../", import.meta.url));
  const binary = process.env.GEMINI_TEST_BINARY || "gemini";
  const options = {
    cwd: profile,
    env: { ...process.env, GEMINI_CLI_HOME: profile },
    encoding: "utf8",
    timeout: 60_000,
  };
  const version = spawnSync(binary, ["--version"], options);
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), "0.46.0", "revalidate this proof before changing the native host version");

  // Cross the real installer boundary. Approve only this local, reviewed source.
  const install = spawnSync(binary, ["extensions", "install", source, "--consent"], {
    ...options,
    input: "y\n",
  });
  assert.equal(install.status, 0, install.stderr + install.stdout);
  const listing = spawnSync(binary, ["extensions", "list"], options);
  assert.equal(listing.status, 0, listing.stderr);
  assert.match(listing.stdout + listing.stderr, /intern/);

  // Inspect what the host actually installed, including automatically loaded skills.
  const root = path.join(profile, ".gemini", "extensions", "intern");
  const manifest = JSON.parse(await readFile(path.join(root, "gemini-extension.json"), "utf8"));
  assert.equal(manifest.mcpServers.intern.httpUrl, "https://tryintern.dev/mcp");
  assert.equal(manifest.mcpServers.intern.command, undefined);
  const skill = await readFile(path.join(root, "skills", "intern", "SKILL.md"), "utf8");
  assert.ok(skill.includes("intern_auth_status"));
  assert.match(skill, /If hosted Intern MCP tools are connected, use them directly\./);
  assert.match(skill, /Do not install or\s+log in to the CLI for this path\./);

  // A fresh host can load the URL before OAuth. Disconnected is not activation proof.
  const servers = spawnSync(binary, ["mcp", "list"], options);
  assert.equal(servers.status, 0, servers.stderr);
  assert.match(servers.stdout + servers.stderr, /https:\/\/tryintern\.dev\/mcp/);
  console.log(`Verified Gemini ${version.stdout.trim()} native installation; profile retained at ${profile}. OAuth and publication were not performed.`);
});
