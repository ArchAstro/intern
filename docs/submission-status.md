# Intern directory submissions

Internal publisher handoff. Checked September 11, 2026. A draft, working custom
connection, and public directory listing are different outcomes.

## Published: Smithery

- Listing: https://smithery.ai/servers/archastro/intern
- Canonical upstream: https://tryintern.dev/mcp
- Smithery connection URL: https://intern--archastro.run.tools
- Release receipt: `3fd60b5e-5b80-46fd-9b4f-1aa4c5349897`, successful.
- User completed Smithery's Intern OAuth scan authorization. Scanner retrieved
  `dev.tryintern/intern-remote` version `1.0.0`, 19 tools, and three resources.
- Public read-back: https://api.smithery.ai/servers/archastro%2Fintern returned
  Intern's name, description, icon URL, and 19 tool definitions.
- Listing metadata uses `https://tryintern.dev/apple-icon.png`. No API key or
  other manual configuration is required; the connection uses OAuth.
- Scanner reported unsupported `prompts/list`; this did not prevent release.
  No prompts are advertised by this listing. Tool discovery is not evidence
  that all tools or a fresh-user publishing journey were exercised.

## Submission queue

| Destination | Current evidence | Next action |
| --- | --- | --- |
| Official MCP Registry | `server.json` prepared as `dev.tryintern/intern-remote`; real production discovery passes. | Owner approval for HTTPS ownership proof, then deploy the public proof and authenticate the publisher. Do not change namespaces to avoid verification. |
| Gemini CLI gallery | Gemini 0.46.0 installs this local checkout and discovers remote-first instructions. Public repository does not yet contain `gemini-extension.json`. | Commit/review/merge the package, test the public repository install, then add `gemini-cli-extension` topic. Gallery indexing is not guaranteed approval. |
| OpenAI ChatGPT / Codex catalog | Shared public catalog; submission copy and five positive/three negative reviewer scenarios prepared. Both available browsers show publisher login. | Sign in to the company publisher organization, verify business identity, prepare exact domain challenge and supported reviewer access, run reviewer scenarios, submit. |
| Claude / Cowork directory | Plugin manifest validates with installed Claude CLI. Publisher portal shows login; Team/Enterprise organization access not established. | Obtain company directory-management access and complete actual reviewer journey before submitting the remote connector. |
| Cursor marketplace | Existing root Agent Plugins manifests match the documented distribution route. Publisher page shows “Sign in to apply.” | Company publisher sign-in/application, publish repository package, then submit the repository. |
| Glama connectors | Correct hosted listing route verified. Add Server opens sign-in/sign-up. | Sign in, submit the canonical remote URL as a Connector, and complete any required OAuth scan. Never give a directory a personal access token as a shortcut. |
| Awesome Remote MCP Servers | Remote services belong here, not the original locally runnable MCP list. | First obtain the required Glama connector badge and confirm public signup availability; then prepare the alphabetical entry and submit a PR. |
| Cline marketplace | GitHub submission form exists. Requires actual successful Cline installation and 400×400 PNG logo. No Cline executable found locally. | Test in the actual Cline host, prepare logo asset, then submit without falsely checking its testing attestation. |
| Grok | Custom remote MCP setup is documented. | Keep direct installation instructions available. No official self-service public catalog submission route verified. |
| Muse | User demonstrated a working web connection. | Keep custom-connection guidance. No official self-service public catalog submission route verified; do not claim marketplace inclusion. |
| Windsurf / Devin | Current docs cover remote HTTP/OAuth but distinguish legacy Cascade from new Devin Local configuration. | Version-specific install guidance; no verified self-service marketplace publisher route. |
| PulseMCP | New submissions and listing changes paused on current submission page. | Publish to the Official MCP Registry; PulseMCP says it will ingest entries after reopening. No direct submission now. |
| mcp.so | Current remote submission form charges $39 once. | Owner spending approval before using the paid form. No purchase made. |

## Prepared form values

- Product: Intern
- Publisher: ArchAstro
- Short description: Build private team sites with your agent.
- Website: https://tryintern.dev
- Remote endpoint: https://tryintern.dev/mcp
- Setup: https://tryintern.dev/install
- Agent instructions: https://tryintern.dev/mcp/guide.md
- Public repository: https://github.com/ArchAstro/intern
- Privacy: https://archastro.ai/privacy
- Terms: https://archastro.ai/terms
- Published support contact: support@archastro.ai
- Existing icon: https://tryintern.dev/apple-icon.png (180×180; not a substitute
  for Cline's required 400×400 asset).

Use `docs/listing-kit.md` for description copy and `docs/reviewer-tests.json`
for scenario definitions. Supply reviewer credentials only in a destination's
secure fields. Never attest that prepared scenarios have been executed.

## Verified submission routes

- [Official Registry ownership](https://modelcontextprotocol.io/registry/authentication)
- [Gemini gallery publishing](https://geminicli.com/docs/extensions/releasing/)
- [OpenAI submission requirements](https://developers.openai.com/plugins/deploy/submission)
- [OpenAI publisher portal](https://platform.openai.com/plugins)
- [Shared ChatGPT/Codex plugin catalog](https://learn.chatgpt.com/docs/plugins)
- [Claude submission requirements](https://claude.com/docs/connectors/building/submission)
- [Claude publisher portal](https://claude.ai/admin-settings/directory/submissions/new)
- [Cursor publisher portal](https://cursor.com/marketplace/publish)
- [Cursor plugin reference](https://prod.cursor.com/docs/reference/plugins)
- [Glama connectors](https://glama.ai/mcp/connectors)
- [Glama FAQ](https://glama.ai/mcp/faq)
- [Remote awesome-list contribution requirements](https://github.com/punkpeye/awesome-remote-mcp-servers/blob/main/CONTRIBUTING.md)
- [Cline submission form](https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml)
- [Grok custom connectors](https://docs.x.ai/grok/connectors)
- [Meta's Muse integration description](https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse)
- [Current Devin Desktop MCP instructions](https://docs.devin.ai/desktop/cascade/mcp)
- [PulseMCP submission pause](https://www.pulsemcp.com/submit)
- [mcp.so paid remote submission](https://mcp.so/submit?type=remote-server)

## Verification boundaries

- `test/gemini-install.e2e.mjs`: real native local installation and installed
  configuration, not OAuth or a public-repository install.
- `test/remote-install.e2e.mjs`: real unsigned HTTPS discovery and identity,
  not an authorized tool invocation.
- Smithery release: real authorized tool/resource discovery by its scanner,
  not creation, editing, deletion, sharing, or tenant-isolation testing.
- `claude plugin validate plugin.json --json`: manifest validation only, not
  plugin installation or authorization.
- Public repository publication, domain ownership, reviewer journeys, and
  submissions other than Smithery remain open. No deployment or purchase was
  performed for this handoff.
