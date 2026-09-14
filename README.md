# Intern CLI

`intern` gives coding agents and people direct access to TryIntern's hosted
tools, without requiring MCP support in the coding agent. It talks directly to
`https://tryintern.dev/mcp`.

## Connect through MCP

If your agent supports remote MCP, add `https://tryintern.dev/mcp` and follow
the sign-in prompt. No local MCP package is needed. See the
[connection guide](https://tryintern.dev/mcp/guide.md) for host-specific setup.

This repository also holds the hosted connector's marketplace manifests.
See the [listing kit](docs/listing-kit.md). These files describe the hosted
service, not a local MCP server supplied by the CLI.

Gemini CLI also discovers the repository's `skills/intern` instructions when
installing the extension. This shared skill uses an existing hosted MCP
connection directly; its CLI instructions apply to terminal use without that
connection or an explicit CLI request. The hosted extension does not require
installing the npm package.

## Install

```sh
npm install --global --@archastro:registry=https://registry.npmjs.org @archastro/intern
intern login
```

Login opens TryIntern in your browser and stores the resulting OAuth refresh
session in `~/.config/intern/credentials.json` with mode `0600`.

## Publish a site

Point `publish` at a deploy-ready static directory. New slugs are created and
published in one call. Existing slugs are updated against their exact current
revision, uploading changed files and deleting files absent from the directory.

```sh
intern publish ./dist --site launch-room
```

Sites stay private unless visibility is changed explicitly:

```sh
intern visibility launch-room public
intern invite launch-room teammate@example.com
```

`.git`, `.intern`, `node_modules`, local environment files, private keys, and
symlinks are not published. Source limits are checked before any remote write.

## Use from a coding agent

All output is JSON. The live remote MCP schemas are authoritative:

```sh
intern tools
intern call intern_auth_status '{}'
intern call intern_create_site --input-file request.json
printf '%s' '{"site":"launch-room"}' | intern call intern_get_site_source
```

`intern call` exposes every hosted tool, including tools added after this CLI
was installed. `intern resources` and `intern read` expose the MCP resource
surface as well.

Common shortcuts:

```text
intern status
intern sites
intern source SITE
intern plugins [SITE]
intern guide
intern fetch URL
intern guests SITE
intern revoke SITE GRANT_ID
intern delete SITE --yes
```

Use `INTERN_ACCESS_TOKEN` for an ephemeral bearer override. Development and
self-hosted tests can set `INTERN_BASE_URL` or pass `--origin`.
