import type { ModelConfig, GenerateParams, StreamCallbacks, ChatMessage } from "@types";
import { parseSSE } from "@lib/sse";
import logger from "@lib/logger";

const PROVIDER_HEADERS: Record<ModelConfig["provider"], (config: ModelConfig) => Record<string, string>> = {
  openai: (config) => ({ Authorization: `Bearer ${config.apiKey}` }),
  openrouter: (config) => ({ Authorization: `Bearer ${config.apiKey}`, "HTTP-Referer": "https://pilotx.local" }),
  custom: (config) => (config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
  azure: (config) => ({ "api-key": config.apiKey })
};

const DEFAULT_TIMEOUT = 60_000;

export interface RequestOptions {
  controller?: AbortController;
}

export function buildMessages(params: GenerateParams, conversation: ChatMessage[] = []): any[] {
  const messages: ChatMessage[] = [];
  if (params.system) {
    messages.push({ role: "system", content: params.system, createdAt: Date.now() });
  }
  if (params.context) {
    messages.push({
      role: "system",
      content: `Context provided by the page. Answer faithfully and cite uncertainty when needed.\n${params.context}`,
      createdAt: Date.now()
    });
  }
  const trimmedHistory = conversation.slice(-6);
  messages.push(...trimmedHistory);
  messages.push({ role: "user", content: params.prompt, createdAt: Date.now() });
  return messages.map(({ role, content }) => ({ role, content }));
}

function buildUrl(config: ModelConfig): string {
  if (config.provider === "azure") {
    const apiVersion = config.azure?.apiVersion ?? "2024-02-01";
    const deployment = config.azure?.deployment ?? config.model;
    return `${config.baseUrl.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  }
  return `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function buildBody(config: ModelConfig, params: GenerateParams, conversation?: ChatMessage[]) {
  return {
    model: config.model,
    stream: params.stream ?? true,
    temperature: params.temperature ?? 0.4,
    max_tokens: params.maxTokens,
    messages: buildMessages(params, conversation)
  };
}

export async function streamCompletion(
  config: ModelConfig,
  params: GenerateParams,
  callbacks: StreamCallbacks,
  conversation: ChatMessage[] = [],
  options: RequestOptions = {}
) {
  const controller = options.controller ?? new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT);
  const url = buildUrl(config);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...PROVIDER_HEADERS[config.provider](config),
    ...config.extraHeaders
  };

  const body = buildBody(config, { ...params, stream: true }, conversation);

  logger.debug("streamCompletion", { url, body });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      throw buildError(config, response.status, text || response.statusText);
    }

    await parseSSE(response.body, callbacks, { signal: controller.signal });
  } catch (error) {
    if ((error as any)?.name === "AbortError") {
      callbacks.onError(new Error("Request aborted"));
    } else {
      callbacks.onError(error as Error);
    }
  } finally {
    clearTimeout(timeout);
  }

  return controller;
}

export async function generateCompletion(
  config: ModelConfig,
  params: GenerateParams,
  conversation: ChatMessage[] = []
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT);
  const url = buildUrl(config);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...PROVIDER_HEADERS[config.provider](config),
    ...config.extraHeaders
  };
  const body = buildBody(config, { ...params, stream: false }, conversation);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      throw buildError(config, response.status, raw || response.statusText);
    }
    const data = await response.json();
    const text = extractText(data);
    if (!text) throw buildError(config, response.status, "Empty response");
    return text;
  } catch (error) {
    if ((error as any)?.name === "AbortError") {
      throw new Error("Request aborted");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractText(payload: any): string {
  if (!payload) return "";
  const choice = payload.choices?.[0];
  if (!choice) return "";
  const message = choice.message ?? choice.delta ?? choice;
  if (!message) return "";
  if (typeof message === "string") return message;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) => (typeof part === "string" ? part : part?.text ?? ""))
      .join("");
  }
  return message.content ?? message.text ?? "";
}

function buildError(config: ModelConfig, status: number, message: string) {
  const error = new Error(message || `Request failed with status ${status}`) as Error & {
    status: number;
    provider: string;
    endpoint: string;
    raw?: string;
  };
  error.status = status;
  error.provider = config.provider;
  error.endpoint = buildUrl(config);
  error.raw = message;
  return error;
}
