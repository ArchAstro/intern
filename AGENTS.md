# AGENTS.md

## Scope

This repository owns the standalone `intern` CLI for TryIntern's hosted MCP.
It is independent of the retired local `intern-mcp` server. TryIntern backend
and hosted MCP changes belong in Firstlanding.

## Verification

Run `npm test` for source or test changes. Run `npm pack --dry-run` when
changing packaging, the executable, README, or bundled skills.

Credentials and OAuth codes must never enter logs, fixtures, or source. Keep
site publication private by default, and preserve the hosted service's
revision and authorization fences.

## Git

Do not commit or push unless the user explicitly asks.
