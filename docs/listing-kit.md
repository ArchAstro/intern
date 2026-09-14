# Intern hosted connector

Use this copy for the hosted MCP listing. The CLI is a separate way to access
the same service from agents with terminal access.

Actual publication receipts and the remaining queue are in
[`submission-status.md`](submission-status.md). Do not infer submission status
from the presence of these files.

## Listing copy

Name: Intern

Tagline: Send a site, not a deck

Description: Build private team sites with your agent.

Long description: Turn an idea into a dashboard, launch room, report, or team
site. Connect your agent to Intern, sign in, and tell it what to build. Sites
are private by default. Share them when you are ready.

- Website: https://tryintern.dev
- Remote MCP: https://tryintern.dev/mcp
- Setup: https://tryintern.dev/install
- Agent guide: https://tryintern.dev/mcp/guide.md
- Repository: https://github.com/ArchAstro/intern
- Privacy: https://archastro.ai/privacy
- Terms: https://archastro.ai/terms
- Publisher contact: support@archastro.ai (published on the terms page)

## Submission files

| File | Target |
| --- | --- |
| `server.json` | Official MCP Registry, remote Streamable HTTP server |
| `plugin.json` and `mcp.json` | Agent Plugins-compatible directories |
| `gemini-extension.json` | Gemini CLI extension |
| `docs/hosted-skill/publish-team-site/SKILL.md` | Optional instructions for connected hosted MCP tools |

These files were migrated from the retired Intern MCP repository. Their
presence is not evidence of directory approval or a completed submission.
Do not advertise the retired npm package as an installation option.

The hosted skill is a submission artifact, outside the automatically discovered
`skills/` directory and the npm package. Package it explicitly if a destination
supports skills. Gemini CLI also discovers root `skills/intern`; that shared
skill chooses connected hosted MCP tools first and uses CLI instructions only
for terminal use without that connection or an explicit CLI request. Installing
the skill alone does not install or authenticate a hosted MCP connection.

## Publisher workflow (internal; not listing copy)

Official routes checked September 11, 2026:

| Destination | Route and required publisher action |
| --- | --- |
| Claude Connectors Directory | Use the [remote connector submission portal in organization settings](https://claude.com/docs/connectors/building/submission). A Team or Enterprise organization is required. An Owner or Primary Owner submits; Enterprise can delegate directory access through a custom role. Supply the remote URL, listing assets, policies, and a populated reviewer account, and exercise every tool before attesting to testing. |
| OpenAI | Use the [plugin submission portal workflow](https://developers.openai.com/plugins/deploy/submission) with a verified developer/business publisher identity. For remote MCP, serve the portal's exact token at `https://tryintern.dev/.well-known/openai-apps-challenge` (or an allowed parent challenge origin); never overwrite another app's token. Scan tools and supply five positive and three negative cases from `docs/reviewer-tests.json`. Reviewer access must complete without MFA, SMS, email confirmation, or a private network. |
| Gemini CLI gallery | Publish `gemini-extension.json` at the root of the public repository, then add the `gemini-cli-extension` GitHub topic for [gallery discovery](https://geminicli.com/docs/extensions/releasing/). Test installation from the repository URL with Gemini CLI, including the discovered shared skill and its hosted connection instructions. Topic discovery does not prove gallery acceptance. |
| Smithery | Use [URL publishing](https://smithery.ai/docs/build/publish) at https://smithery.ai/new with `https://tryintern.dev/mcp`. This uses the existing hosted Streamable HTTP service; complete OAuth when prompted for scanning. The public server card is `https://tryintern.dev/mcp/server-card`. |
| Official MCP Registry | Publish root `server.json` as `dev.tryintern/intern-remote`, matching the production server card. The reverse-domain namespace `dev.tryintern` needs control of `tryintern.dev`; use the Registry's [DNS or HTTPS ownership authentication](https://modelcontextprotocol.io/registry/authentication). HTTPS verification uses `/.well-known/mcp-registry-auth`; DNS uses a TXT record. Keep signing keys outside the repository. GitHub organization access alone does not establish this namespace. Ownership proof and publication require separate authorization. |

The public terms page verifies the publisher contact email above; it does not
establish an Intern support SLA. A dedicated public support URL and the final
publisher identity still need confirmation if a portal requires them.

## Pending evidence (internal; not listing copy)

`docs/reviewer-tests.json` is a scenario specification with synthetic fixture
content and expected results, not a test-run receipt. Prepare a dedicated
reviewer organization, resolve its fixture URLs from actual tool responses,
and provide credentials only through the destination's secure review fields.
Do not weaken production authentication to accommodate reviewers. If the
current sign-in requires an email challenge, reviewer access remains a blocker
until a supported account path satisfies the destination's requirements.

Publisher verification, challenge-token hosting, Registry ownership proof,
clean-host authenticated creation/edit/read results, destination submissions,
and approval receipts remain unverified by this package. Do not mark them done
from a manifest check or the read-only discovery test.

## Before submitting

Use the destination's current publisher portal and requirements. Confirm
publisher ownership, policy links, reviewer access, and final copy with the
product owner. Registry ownership verification and any DNS changes need
separate approval. Do not change the registry namespace casually.

Run `npm run test:distribution` for local manifest checks and
`npm run test:remote-install` for read-only production OAuth discovery.
The latter crosses real HTTPS boundaries but does not approve access, exchange
tokens, or publish a site.

Then test a clean installation in the actual host: sign in as a new user,
approve access, request a site, and verify its private URL. Installation alone
must not create a sample site. If someone asks what Intern can do, offer a
sample and wait for acceptance.

Record the host/version, result, and submission receipt. Never put reviewer
credentials in this repository.
