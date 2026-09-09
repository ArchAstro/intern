#!/usr/bin/env node
import { createRequire } from "node:module";
import {
  parseArguments,
  flag,
  option,
  options,
  parseToolInput,
} from "./args.js";
import { loadConfig } from "./config.js";
import { Credentials } from "./credentials.js";
import { InternError } from "./errors.js";
import { McpClient, ToolCallError } from "./mcp.js";
import { login } from "./oauth.js";
import { publishDirectory } from "./publish.js";

const version = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;

export async function run(argv: string[]): Promise<number> {
  const args = parseArguments(argv);
  if (flag(args, "version") || args.command === "version") {
    process.stdout.write(`${version}\n`);
    return 0;
  }
  if (flag(args, "help") || args.command === "help") {
    process.stdout.write(HELP);
    return 0;
  }

  const config = loadConfig({ origin: option(args, "origin") });
  const credentials = new Credentials(config);
  const client = new McpClient(config, credentials);
  const compact = flag(args, "compact");
  let output: unknown;

  switch (args.command) {
    case "login": {
      requirePositionals(args.positionals, 0, "intern login");
      await login(config, credentials, {
        openBrowser: !flag(args, "no-open"),
        notify: (message) => process.stderr.write(`${message}\n`),
      });
      output = await client.callTool("intern_auth_status", {});
      break;
    }
    case "logout": {
      requirePositionals(args.positionals, 0, "intern logout");
      const removed = await credentials.logout();
      output = {
        signedOut: !config.accessToken,
        credentialsRemoved: removed,
        environmentOverride: Boolean(config.accessToken),
      };
      break;
    }
    case "status":
      requirePositionals(args.positionals, 0, "intern status");
      output = await authorizationStatus(client);
      break;
    case "auth":
      if (args.positionals[0] !== "status" || args.positionals.length !== 1) {
        throw usage("Usage: intern auth status");
      }
      output = await authorizationStatus(client);
      break;
    case "tools":
      requirePositionals(args.positionals, 0, "intern tools");
      output = { tools: await client.listTools() };
      break;
    case "call": {
      const tool = args.positionals[0];
      if (!tool || args.positionals.length > 2) {
        throw usage(
          "Usage: intern call <tool-name> [JSON] [--input-file PATH]",
        );
      }
      output = await client.callTool(tool, await parseToolInput(args));
      break;
    }
    case "resources":
      requirePositionals(args.positionals, 0, "intern resources");
      output = await client.listResources();
      break;
    case "read": {
      const uri = onlyPositional(
        args.positionals,
        "Usage: intern read <resource-uri>",
      );
      output = { contents: await client.readResource(uri) };
      break;
    }
    case "sites":
      requirePositionals(args.positionals, 0, "intern sites");
      output = await client.callTool("intern_list_sites", {});
      break;
    case "guide":
      requirePositionals(args.positionals, 0, "intern guide");
      output = await client.callTool("intern_get_authoring_guide", {});
      break;
    case "plugins": {
      if (args.positionals.length > 1)
        throw usage("Usage: intern plugins [site]");
      const site = args.positionals[0];
      output = site
        ? await client.callTool("intern_list_site_plugins", { site })
        : await client.callTool("intern_list_available_plugins", {});
      break;
    }
    case "source": {
      const site = onlyPositional(
        args.positionals,
        "Usage: intern source <site>",
      );
      output = await client.callTool("intern_get_site_source", { site });
      break;
    }
    case "fetch": {
      const url = onlyPositional(args.positionals, "Usage: intern fetch <url>");
      output = await client.callTool("intern_fetch_url", { url });
      break;
    }
    case "publish": {
      if (args.positionals.length > 1) {
        throw usage(
          "Usage: intern publish [directory] --site <slug> [--message TEXT]",
        );
      }
      const site = option(args, "site");
      if (!site) throw usage("intern publish requires --site <slug>");
      output = await publishDirectory(client, {
        site,
        directory: args.positionals[0] ?? ".",
        message: option(args, "message") ?? `Publish ${site} from Intern CLI`,
        plugins: options(args, "plugin").map(parsePlugin),
      });
      break;
    }
    case "visibility": {
      if (
        args.positionals.length !== 2 ||
        !["private", "public"].includes(args.positionals[1]!)
      ) {
        throw usage("Usage: intern visibility <site> private|public");
      }
      output = await client.callTool("intern_set_site_visibility", {
        site: args.positionals[0],
        visibility: args.positionals[1],
      });
      break;
    }
    case "invite": {
      if (args.positionals.length !== 2)
        throw usage("Usage: intern invite <site> <email>");
      output = await client.callTool("intern_invite_site_guest", {
        site: args.positionals[0],
        email: args.positionals[1],
      });
      break;
    }
    case "guests": {
      const site = onlyPositional(
        args.positionals,
        "Usage: intern guests <site>",
      );
      output = await client.callTool("intern_list_site_guests", { site });
      break;
    }
    case "revoke": {
      if (args.positionals.length !== 2)
        throw usage("Usage: intern revoke <site> <grant-id>");
      output = await client.callTool("intern_revoke_site_guest", {
        site: args.positionals[0],
        grant: args.positionals[1],
      });
      break;
    }
    case "delete": {
      const site = onlyPositional(
        args.positionals,
        "Usage: intern delete <site> --yes",
      );
      if (!flag(args, "yes")) throw usage("Permanent deletion requires --yes");
      output = await client.callTool("intern_delete_site", { site });
      break;
    }
    default:
      throw usage(
        `Unknown command ${args.command}. Run \`intern help\` for usage.`,
      );
  }

  printJSON(output, compact);
  return 0;
}

async function authorizationStatus(client: McpClient): Promise<unknown> {
  try {
    return await client.callTool("intern_auth_status", {});
  } catch (error) {
    if (error instanceof InternError && error.code === "auth_required") {
      return { authorized: false };
    }
    throw error;
  }
}

function parsePlugin(value: string): {
  plugin: string;
  binding?: string;
  config: Record<string, unknown>;
} {
  const [plugin, binding, ...rest] = value.split(":");
  if (!plugin || rest.length > 0)
    throw usage(`Invalid plugin ${value}; use key or key:binding`);
  return { plugin, ...(binding ? { binding } : {}), config: {} };
}

function onlyPositional(values: string[], message: string): string {
  if (values.length !== 1) throw usage(message);
  return values[0]!;
}

function requirePositionals(
  values: string[],
  count: number,
  command: string,
): void {
  if (values.length !== count) throw usage(`Usage: ${command}`);
}

function usage(message: string): InternError {
  return new InternError("usage", message);
}

function printJSON(value: unknown, compact: boolean): void {
  process.stdout.write(
    `${JSON.stringify(value, null, compact ? undefined : 2)}\n`,
  );
}

const HELP = `Intern CLI ${version}

Usage:
  intern login [--no-open]             Connect through TryIntern browser OAuth
  intern logout                        Remove stored credentials
  intern status                        Show the current user and organization
  intern publish [DIR] --site SLUG     Create or update a site from static files
  intern sites                         List sites
  intern source SITE                   Read editable source
  intern plugins [SITE]                List available or installed plugins
  intern guide                         Read the current authoring guide
  intern fetch URL                     Read an authorized served Intern URL
  intern visibility SITE private|public
  intern invite SITE EMAIL
  intern guests SITE
  intern revoke SITE GRANT_ID
  intern delete SITE --yes

Live MCP surface:
  intern tools                         List every hosted Intern tool and schema
  intern call TOOL [JSON]              Call any hosted tool
  intern call TOOL --input-file PATH   Read tool arguments from a JSON file or -
  intern resources                     List hosted resources and templates
  intern read URI                      Read a hosted resource

Options:
  --origin URL       Override https://tryintern.dev (or set INTERN_BASE_URL)
  --compact          Emit compact JSON
  --plugin KEY[:BINDING]  Request a plugin while creating a site; repeatable

Credentials are stored in ~/.config/intern with mode 0600. Set
INTERN_ACCESS_TOKEN for an ephemeral bearer override. Command results are JSON.
`;

async function main(): Promise<void> {
  try {
    process.exitCode = await run(process.argv.slice(2));
  } catch (error) {
    if (error instanceof ToolCallError) {
      process.stderr.write(`${JSON.stringify(error.output, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    const code = error instanceof InternError ? error.code : "internal_error";
    const message = error instanceof Error ? error.message : String(error);
    const details = error instanceof InternError ? error.details : undefined;
    process.stderr.write(
      `${JSON.stringify({ error: { code, message, ...(details === undefined ? {} : { details }) } }, null, 2)}\n`,
    );
    process.exitCode = code === "usage" ? 2 : 1;
  }
}

await main();
