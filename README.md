# Intern CLI

`intern` gives coding agents and people the same hosted tools available from
TryIntern's remote MCP, without requiring MCP support in the coding agent.
It talks directly to `https://tryintern.dev/mcp`; it is unrelated to the retired
local `intern-mcp` server.

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
