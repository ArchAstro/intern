import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("hosted listings share the remote endpoint and the active repository", async () => {
  const read = async (file) => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));
  const registry = await read("server.json");
  const plugin = await read("plugin.json");
  const mcp = await read("mcp.json");
  const gemini = await read("gemini-extension.json");
  const repository = "https://github.com/ArchAstro/intern";
  const endpoint = "https://tryintern.dev/mcp";
  assert.equal(registry.repository.url, repository);
  assert.equal(plugin.repository, repository);
  assert.equal(registry.name, "dev.tryintern/intern-remote");
  assert.deepEqual(registry.remotes, [{ type: "streamable-http", url: endpoint }]);
  assert.deepEqual(mcp.mcpServers.intern, { type: "streamable-http", url: endpoint });
  assert.deepEqual(gemini.mcpServers.intern, { httpUrl: endpoint });
  assert.equal(plugin.license, "MIT");
  // Gemini discovers this shared skill; it must prefer its connected MCP tools.
  const skills = await readdir(new URL("../skills/", import.meta.url), { withFileTypes: true });
  assert.deepEqual(skills.filter((entry) => entry.isDirectory()).map((entry) => entry.name), ["intern"]);
  const hostedSkill = await readFile(new URL("../docs/hosted-skill/publish-team-site/SKILL.md", import.meta.url), "utf8");
  assert.ok(hostedSkill.includes("Use the hosted Intern MCP connection"));
  const sharedSkill = await readFile(new URL("../skills/intern/SKILL.md", import.meta.url), "utf8");
  assert.ok(sharedSkill.includes("If hosted Intern MCP tools are connected, use them directly."));
  assert.ok(sharedSkill.includes("Do not install or\nlog in to the CLI for this path."));
  for (const manifest of [registry, plugin, mcp, gemini]) {
    assert.ok(!JSON.stringify(manifest).includes("intern-mcp"));
    assert.ok(!JSON.stringify(manifest).includes('"command"'));
  }
});

test("reviewer scenarios specify five positive and three negative cases without claiming execution", async () => {
  const scenarios = JSON.parse(await readFile(new URL("../docs/reviewer-tests.json", import.meta.url), "utf8"));
  assert.equal(scenarios.status, "prepared_not_executed");
  assert.equal(scenarios.positive.length, 5);
  assert.equal(scenarios.negative.length, 3);
  const cases = [...scenarios.positive, ...scenarios.negative];
  assert.equal(new Set(cases.map((scenario) => scenario.id)).size, 8);
  for (const scenario of cases) {
    assert.ok(scenario.prompt.length > 0);
    assert.ok(Array.isArray(scenario.expectedTools));
    assert.ok(scenario.expectedResults.length > 0);
  }
});
