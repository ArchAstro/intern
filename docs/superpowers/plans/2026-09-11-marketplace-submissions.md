# Intern marketplace submission implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan. Do not commit or publish without the applicable user authorization.

**Goal:** Make the active Intern repository installable as a hosted connector and prepare accurate directory submissions.

**Architecture:** Preserve the deployed `dev.tryintern/intern-remote` identity and canonical remote endpoint. The shared skill prefers connected hosted MCP tools; CLI instructions apply to terminal use or an explicit CLI request. Keep the optional hosted-only submission skill outside automatic root skill discovery. Use existing publisher portals, not custom release machinery.

**Tech Stack:** JSON manifests, Node test runner, Gemini CLI, official directory publisher tools.

## Task 1: Complete the listing package

- [x] Align `server.json` with deployed identity; validate discovery identity in `test/remote-install.e2e.mjs`.
- [x] Prepare five positive and three negative reviewer scenarios in `docs/reviewer-tests.json` and publisher instructions in `docs/listing-kit.md`.
- [x] Validate manifests and reviewer fixture shape with `test/distribution-contract.mjs`.
- [x] Run package tests and independent specification/quality review.

Canonical network proof: `test/remote-install.e2e.mjs`, `a remote listing leads an unsigned visitor to Intern OAuth discovery`. This tests real HTTPS discovery, not authenticated host activation. Full reviewer activation requires Task 2.

## Task 2: Prove the native installation boundary

- [x] Install the local extension with Gemini CLI in an isolated temporary home and confirm its native server configuration.
- [x] Record exact host version and result in the submission handoff.
- [ ] Complete a fresh-user OAuth and private-site journey if an authorized test identity is available; otherwise explicitly leave this gate open for the owner.

Canonical proof: `test/gemini-install.e2e.mjs`, `Gemini installs the hosted extension without requiring a local Intern CLI`. Actual `gemini extensions install` followed by `gemini extensions list` and `gemini mcp list` in the isolated profile. This proves host loading only. Sign-in, token exchange, tools, and publication must be recorded separately, never inferred from metadata tests.

## Task 3: Publish through supported directory paths

- [ ] Determine publisher access for MCP Registry and Smithery; request only missing human-owned approval or credentials.
- [x] Prepare Claude and OpenAI submission fields with policy links and reviewer fixtures.
- [ ] After the listing files are public, enable Gemini gallery discovery using its repository topic.
- [ ] Record actual submission receipts; do not equate a manifest or draft with an approved listing.

Canonical proof: a directory receipt and a read-back of its actual remote URL; Gemini additionally requires installing from the public repository. DNS ownership and policy attestations require owner approval. No receipt means not submitted.

## Verification handoff

Verified September 11, 2026 against the local listing package:

- Gemini CLI 0.46.0: native installation proof passed in a fresh temporary profile. The installed manifest points to the remote MCP endpoint, and the automatically discovered skill prefers hosted tools without installing the CLI. OAuth and publication were not performed.
- `npm run check`: six CLI tests and two distribution tests passed; package build and dry-run packaging passed (28 files).
- `npm run test:remote-install`: real production HTTPS discovery and server-card identity check passed. No user authentication or site mutation.
- Independent specification and quality reviews passed without blocking findings.
- Smithery `archastro/intern` is published after owner-selected company namespace and completed OAuth scan. Release `3fd60b5e-5b80-46fd-9b4f-1aa4c5349897` succeeded with 19 tools and three resources; public metadata read-back verified. See `docs/submission-status.md`.
- Registry ownership proof awaits owner approval. Claude/OpenAI publisher access, reviewer authentication, and submission receipts remain open.
