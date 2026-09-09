import { isUtf8 } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";
import { InternError } from "./errors.js";
import { McpClient, ToolCallError } from "./mcp.js";

const MAX_PATH_BYTES = 4_095;
const MAX_FILE_BYTES = 256 * 1_024;
const MAX_TOTAL_BYTES = 1_536 * 1_024;
const MAX_FILES = 256;
const ignoredDirectories = new Set([".git", ".intern", "node_modules"]);
const ignoredFiles = new Set([".DS_Store", "id_rsa", "id_ed25519"]);

export interface SourceFile {
  path: string;
  encoding: "utf8" | "base64";
  content: string;
}

export interface PublishOptions {
  site: string;
  directory: string;
  message: string;
  plugins?: Array<{
    plugin: string;
    binding?: string;
    config: Record<string, unknown>;
  }>;
}

export interface PublishResult {
  site: string;
  directory: string;
  changed: boolean;
  created: boolean;
  uploaded: string[];
  deleted: string[];
  ignored: string[];
  publication: unknown;
}

export async function publishDirectory(
  client: McpClient,
  options: PublishOptions,
): Promise<PublishResult> {
  validateSlug(options.site);
  validateMessage(options.message);
  const source = await readSourceDirectory(options.directory);
  const listed = asRecord(await client.callTool("intern_list_sites", {}));
  if (!Array.isArray(listed.sites)) {
    throw new InternError(
      "mcp_protocol_error",
      "intern_list_sites returned an invalid site list",
    );
  }
  const existing = listed.sites.find(
    (candidate) => isRecord(candidate) && candidate.slug === options.site,
  );

  if (!existing) {
    const publication = await client.callTool("intern_create_site", {
      site: options.site,
      plugins: options.plugins ?? [],
      initialSource: {
        files: source.files,
        message: options.message,
        operationLabel: "cli.initial-publish",
      },
    });
    const result = asRecord(publication);
    const state = isRecord(result.publication)
      ? result.publication.state
      : undefined;
    if (state !== "published") {
      throw new InternError(
        "publish_failed",
        `Intern created ${options.site}, but its initial source was not published`,
        publication,
      );
    }
    return {
      site: options.site,
      directory: source.directory,
      changed: true,
      created: true,
      uploaded: source.files.map((file) => file.path),
      deleted: [],
      ignored: source.ignored,
      publication,
    };
  }

  let current: Record<string, unknown>;
  try {
    current = asRecord(
      await client.callTool("intern_get_site_source", { site: options.site }),
    );
  } catch (error) {
    if (error instanceof ToolCallError) throw error;
    throw error;
  }
  if (typeof current.revision !== "string" || !Array.isArray(current.files)) {
    throw new InternError(
      "mcp_protocol_error",
      "intern_get_site_source returned an invalid snapshot",
    );
  }
  const remoteFiles = current.files.map(parseSourceFile);
  const localByPath = new Map(source.files.map((file) => [file.path, file]));
  const remoteByPath = new Map(remoteFiles.map((file) => [file.path, file]));
  const uploaded = source.files
    .filter((file) => !sameFile(file, remoteByPath.get(file.path)))
    .map((file) => file.path);
  const deleted = remoteFiles
    .filter((file) => !localByPath.has(file.path))
    .map((file) => file.path);
  if (uploaded.length === 0 && deleted.length === 0) {
    return {
      site: options.site,
      directory: source.directory,
      changed: false,
      created: false,
      uploaded: [],
      deleted: [],
      ignored: source.ignored,
      publication: { state: "unchanged", revision: current.revision },
    };
  }
  if (uploaded.length + deleted.length > 128) {
    throw new InternError(
      "too_many_changes",
      "An update can change or delete at most 128 files; publish a smaller revision",
    );
  }
  const changedFiles = uploaded.map((filePath) => localByPath.get(filePath)!);
  const publication = await client.callTool("intern_apply_site_revision", {
    site: options.site,
    baseRevision: current.revision,
    files: changedFiles,
    delete: deleted,
    message: options.message,
    operationLabel: "cli.publish",
  });
  return {
    site: options.site,
    directory: source.directory,
    changed: true,
    created: false,
    uploaded,
    deleted,
    ignored: source.ignored,
    publication,
  };
}

export async function readSourceDirectory(directory: string): Promise<{
  directory: string;
  files: SourceFile[];
  ignored: string[];
}> {
  const root = await fs.realpath(directory);
  const stat = await fs.stat(root);
  if (!stat.isDirectory())
    throw new InternError(
      "invalid_directory",
      `${directory} is not a directory`,
    );
  const files: SourceFile[] = [];
  const ignored: string[] = [];
  let totalBytes = 0;

  async function walk(relativeDirectory: string): Promise<void> {
    const absoluteDirectory = path.join(root, relativeDirectory);
    const entries = await fs.readdir(absoluteDirectory, {
      withFileTypes: true,
    });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      if (entry.isSymbolicLink()) {
        throw new InternError(
          "unsafe_source",
          `Refusing to publish symbolic link ${relativePath}`,
        );
      }
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) {
          ignored.push(`${relativePath}/`);
        } else {
          await walk(relativePath);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      if (shouldIgnoreFile(entry.name)) {
        ignored.push(relativePath);
        continue;
      }
      if (Buffer.byteLength(relativePath) > MAX_PATH_BYTES) {
        throw new InternError(
          "source_too_large",
          `Source path exceeds 4095 bytes: ${relativePath}`,
        );
      }
      const bytes = await fs.readFile(
        path.join(root, ...relativePath.split("/")),
      );
      if (bytes.byteLength > MAX_FILE_BYTES) {
        throw new InternError(
          "source_too_large",
          `${relativePath} exceeds the 256 KiB file limit`,
        );
      }
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new InternError(
          "source_too_large",
          "Site source exceeds the 1536 KiB total limit",
        );
      }
      files.push(
        isUtf8(bytes)
          ? {
              path: relativePath,
              encoding: "utf8",
              content: bytes.toString("utf8"),
            }
          : {
              path: relativePath,
              encoding: "base64",
              content: bytes.toString("base64"),
            },
      );
      if (files.length > MAX_FILES) {
        throw new InternError(
          "source_too_large",
          "Site source contains more than 256 files",
        );
      }
    }
  }

  await walk("");
  if (files.length === 0) {
    throw new InternError(
      "empty_source",
      "The publish directory contains no site files",
    );
  }
  return { directory: root, files, ignored };
}

function shouldIgnoreFile(name: string): boolean {
  if (ignoredFiles.has(name) || name.endsWith(".pem") || name.endsWith(".key"))
    return true;
  return name.startsWith(".env") && name !== ".env.example";
}

function sameFile(left: SourceFile, right: SourceFile | undefined): boolean {
  if (!right) return false;
  return decoded(left).equals(decoded(right));
}

function decoded(file: SourceFile): Buffer {
  return Buffer.from(
    file.content,
    file.encoding === "utf8" ? "utf8" : "base64",
  );
}

function parseSourceFile(value: unknown): SourceFile {
  if (
    !isRecord(value) ||
    typeof value.path !== "string" ||
    (value.encoding !== "utf8" && value.encoding !== "base64") ||
    typeof value.content !== "string"
  ) {
    throw new InternError(
      "mcp_protocol_error",
      "Intern returned an invalid source file",
    );
  }
  return value as unknown as SourceFile;
}

function validateSlug(value: string): void {
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(value)) {
    throw new InternError(
      "invalid_site",
      "Site must start with a letter and contain at most 63 lowercase letters, digits, or hyphens",
    );
  }
}

function validateMessage(value: string): void {
  if (Buffer.byteLength(value) < 1 || Buffer.byteLength(value) > 120) {
    throw new InternError(
      "invalid_message",
      "Publish message must be between 1 and 120 bytes",
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value))
    throw new InternError(
      "mcp_protocol_error",
      "Intern returned an invalid result",
    );
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
