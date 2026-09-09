import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSourceDirectory } from "../src/publish.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("publish source boundary", () => {
  it("refuses symlinks instead of reading files outside the selected directory", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "intern-source-"));
    roots.push(root);
    await fs.writeFile(path.join(root, "index.html"), "safe");
    await fs.symlink(
      path.join(os.tmpdir(), "outside-secret"),
      path.join(root, "secret-link"),
    );

    await expect(readSourceDirectory(root)).rejects.toMatchObject({
      code: "unsafe_source",
    });
  });
});
