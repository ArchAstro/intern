import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("bundled Intern skill", () => {
  it("teaches an agent to install, authenticate, publish, and discover the live CLI contract", async () => {
    const [skill, packageJSON] = await Promise.all([
      fs.readFile("skills/intern/SKILL.md", "utf8"),
      fs.readFile("package.json", "utf8").then((value) => JSON.parse(value)),
    ]);

    expect(skill).toMatch(/^---\nname: intern\ndescription: .+\n---\n/);
    expect(skill).toContain(
      "npm install --global --@archastro:registry=https://registry.npmjs.org @archastro/intern",
    );
    expect(skill).toContain("intern login");
    expect(skill).toContain("intern status");
    expect(skill).toContain("intern publish ./dist --site launch-room");
    expect(skill).toContain("intern tools");
    expect(skill).toContain("intern call intern_apply_site_revision");
    expect(skill).toContain("Keep sites private");
    expect(skill).toContain('"Published with Intern"');
    expect(skill).toContain("https://tryintern.dev/#quickstart");
    expect(skill).toContain('referrerpolicy="no-referrer"');
    expect(skill).toContain("instead of adding another");
    expect(packageJSON.files).toContain("skills");
  });
});
