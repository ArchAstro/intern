import type { InternConfig } from "./config.js";
import { Credentials } from "./credentials.js";
import { InternError } from "./errors.js";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

interface ToolCallResult {
  structuredContent?: unknown;
  content?: Array<{ type?: string; text?: string }>;
  isError?: boolean;
}

export class ToolCallError extends InternError {
  constructor(readonly output: unknown) {
    const error =
      isRecord(output) && isRecord(output.error) ? output.error : undefined;
    super(
      typeof error?.code === "string" ? error.code : "tool_failed",
      typeof error?.message === "string"
        ? error.message
        : "Intern tool call failed",
      output,
    );
  }
}

export class McpClient {
  private sequence = 0;

  constructor(
    private readonly config: InternConfig,
    private readonly credentials: Credentials,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async listTools(): Promise<unknown> {
    return resultField(await this.rpc("tools/list", {}), "tools");
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const response = asRecord(
      await this.rpc("tools/call", { name, arguments: args }),
    );
    const output =
      response.structuredContent ?? textOutput(response as ToolCallResult);
    if (response.isError === true) throw new ToolCallError(output);
    return output;
  }

  async listResources(): Promise<{
    resources: unknown;
    resourceTemplates: unknown;
  }> {
    const resources = resultField(
      await this.rpc("resources/list", {}),
      "resources",
    );
    const resourceTemplates = resultField(
      await this.rpc("resources/templates/list", {}),
      "resourceTemplates",
    );
    return { resources, resourceTemplates };
  }

  async readResource(uri: string): Promise<unknown> {
    return resultField(await this.rpc("resources/read", { uri }), "contents");
  }

  private async rpc(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const id = ++this.sequence;
    let token = await this.credentials.accessToken();
    let response = await this.request(id, method, params, token);
    if (response.status === 401 && !this.config.accessToken) {
      token = await this.credentials.accessToken(true);
      response = await this.request(id, method, params, token);
    }
    if (!response.ok) {
      const body = await response.text();
      throw new InternError(
        response.status === 401 ? "auth_required" : "mcp_http_error",
        response.status === 401
          ? "Intern authorization is no longer valid; run `intern login` again"
          : `Intern service request failed with HTTP ${response.status}`,
        safeRemoteBody(body),
      );
    }
    const envelope = parseEnvelope(
      await response.text(),
      response.headers.get("content-type"),
      id,
    );
    if (envelope.error) {
      throw new InternError(
        "mcp_protocol_error",
        envelope.error.message ?? "Intern service returned a protocol error",
        envelope.error,
      );
    }
    if (!("result" in envelope)) {
      throw new InternError(
        "mcp_protocol_error",
        "Intern service response omitted a result",
      );
    }
    return envelope.result;
  }

  private request(
    id: number,
    method: string,
    params: Record<string, unknown>,
    token: string,
  ): Promise<Response> {
    return this.fetchFn(this.config.resource, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "intern-cli/0.1",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
  }
}

function parseEnvelope(
  body: string,
  contentType: string | null,
  expectedId: number,
): JsonRpcResponse {
  let value: unknown;
  if (contentType?.includes("text/event-stream")) {
    const events = body
      .split(/\r?\n\r?\n/)
      .map((event) =>
        event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n"),
      )
      .filter(Boolean);
    const candidate = events.at(-1);
    if (!candidate)
      throw new InternError(
        "mcp_protocol_error",
        "Intern service returned an empty event stream",
      );
    value = parseJSON(candidate);
  } else {
    value = parseJSON(body);
  }
  if (!isRecord(value) || value.jsonrpc !== "2.0" || value.id !== expectedId) {
    throw new InternError(
      "mcp_protocol_error",
      "Intern service returned an invalid JSON-RPC response",
    );
  }
  return value as unknown as JsonRpcResponse;
}

function parseJSON(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new InternError(
      "mcp_protocol_error",
      "Intern service returned invalid JSON",
    );
  }
}

function textOutput(result: ToolCallResult): unknown {
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function resultField(value: unknown, field: string): unknown {
  const result = asRecord(value);
  if (!(field in result)) {
    throw new InternError(
      "mcp_protocol_error",
      `Intern service response omitted ${field}`,
    );
  }
  return result[field];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value))
    throw new InternError(
      "mcp_protocol_error",
      "Intern service returned an invalid result",
    );
  return value;
}

function safeRemoteBody(body: string): string | undefined {
  const trimmed = body.trim();
  return trimmed.length > 0 && trimmed.length <= 2_000 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
