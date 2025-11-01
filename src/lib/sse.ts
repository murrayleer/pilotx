import type { StreamCallbacks } from "@types";

export interface StreamOptions {
  signal?: AbortSignal;
}

/**
 * Parse a text/event-stream response and emit incremental tokens.
 */
export async function parseSSE(stream: ReadableStream<Uint8Array>, callbacks: StreamCallbacks, options: StreamOptions = {}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    while (true) {
      if (options.signal?.aborted) throw new Error("aborted");
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        handleChunk(chunk, callbacks);
      }
    }
    if (buffer.trim()) {
      handleChunk(buffer, callbacks);
    }
    callbacks.onDone();
  } catch (error) {
    if ((error as Error).message === "aborted") {
      callbacks.onError(new Error("Request cancelled"));
    } else {
      callbacks.onError(error as Error);
    }
  } finally {
    reader.releaseLock();
  }
}

function handleChunk(raw: string, callbacks: StreamCallbacks) {
  const lines = raw.split(/\n+/).map((line) => line.trim());
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line === "data: [DONE]") {
      callbacks.onDone();
      return;
    }
    if (!line.startsWith("data:")) continue;
    const data = line.replace(/^data:\s*/, "");
    try {
      const payload = JSON.parse(data);
      const text = extractContent(payload);
      if (text) callbacks.onToken(text);
    } catch (error) {
      console.warn("PilotX SSE parse warning", error, { line });
    }
  }
}

function extractContent(payload: any): string {
  if (!payload) return "";
  if (Array.isArray(payload.choices)) {
    for (const choice of payload.choices) {
      const delta = choice.delta ?? choice.message ?? choice;
      if (!delta) continue;
      if (typeof delta === "string") return delta;
      if (delta.content) return typeof delta.content === "string" ? delta.content : flattenContent(delta.content);
      if (delta.text) return delta.text;
    }
  }
  if (payload.message?.content) {
    return typeof payload.message.content === "string"
      ? payload.message.content
      : flattenContent(payload.message.content);
  }
  if (payload.delta?.content) {
    return typeof payload.delta.content === "string" ? payload.delta.content : flattenContent(payload.delta.content);
  }
  if (payload.content) {
    return typeof payload.content === "string" ? payload.content : flattenContent(payload.content);
  }
  return "";
}

function flattenContent(content: any): string {
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.text) return item.text;
        if (item?.type === "text") return item.text ?? "";
        return "";
      })
      .join("");
  }
  if (typeof content === "string") return content;
  if (content?.text) return content.text;
  return "";
}
