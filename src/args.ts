import fs from "node:fs/promises";
import { InternError } from "./errors.js";

export interface ParsedArguments {
  command: string;
  positionals: string[];
  options: Map<string, string[]>;
}

const valueOptions = new Set([
  "origin",
  "input",
  "input-file",
  "site",
  "message",
  "plugin",
]);
const booleanOptions = new Set([
  "compact",
  "no-open",
  "yes",
  "help",
  "version",
]);

export function parseArguments(argv: string[]): ParsedArguments {
  const positionals: string[] = [];
  const options = new Map<string, string[]>();
  let optionsEnded = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!optionsEnded && argument === "--") {
      optionsEnded = true;
      continue;
    }
    if (!optionsEnded && argument.startsWith("--")) {
      const equal = argument.indexOf("=");
      const name = argument.slice(2, equal === -1 ? undefined : equal);
      if (!valueOptions.has(name) && !booleanOptions.has(name)) {
        throw new InternError("usage", `Unknown option --${name}`);
      }
      if (booleanOptions.has(name)) {
        if (equal !== -1)
          throw new InternError("usage", `--${name} does not take a value`);
        append(options, name, "true");
        continue;
      }
      const value = equal === -1 ? argv[++index] : argument.slice(equal + 1);
      if (value === undefined)
        throw new InternError("usage", `--${name} requires a value`);
      append(options, name, value);
      continue;
    }
    positionals.push(argument);
  }
  return {
    command: positionals.shift() ?? "help",
    positionals,
    options,
  };
}

export function option(
  args: ParsedArguments,
  name: string,
): string | undefined {
  return args.options.get(name)?.at(-1);
}

export function options(args: ParsedArguments, name: string): string[] {
  return args.options.get(name) ?? [];
}

export function flag(args: ParsedArguments, name: string): boolean {
  return args.options.has(name);
}

export async function parseToolInput(
  args: ParsedArguments,
): Promise<Record<string, unknown>> {
  const inline = option(args, "input") ?? args.positionals[1];
  const inputFile = option(args, "input-file");
  if (inline !== undefined && inputFile !== undefined) {
    throw new InternError(
      "usage",
      "Use only one of inline JSON and --input-file",
    );
  }
  let raw: string | undefined;
  if (inline !== undefined) raw = inline;
  else if (inputFile !== undefined)
    raw =
      inputFile === "-"
        ? await readStdin()
        : await fs.readFile(inputFile, "utf8");
  else if (!process.stdin.isTTY) raw = await readStdin();
  if (raw === undefined || !raw.trim()) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("not an object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new InternError("invalid_json", "Tool input must be a JSON object");
  }
}

function append(map: Map<string, string[]>, name: string, value: string): void {
  map.set(name, [...(map.get(name) ?? []), value]);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
