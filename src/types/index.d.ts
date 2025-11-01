export type ProviderType = "openai" | "azure" | "openrouter" | "custom";

export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
  azure?: {
    apiVersion: string;
    deployment: string;
  };
  timeoutMs?: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  body: string;
  placeholders?: string[];
}

export interface GenerateParams {
  system?: string;
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface StorageSchema {
  configs: ModelConfig[];
  activeConfigId?: string;
  prompts: PromptTemplate[];
  history: Conversation[];
  historyEnabled: boolean;
  historyLimit: number;
  shortcuts: {
    toggleSidebar: string;
    quickSummarize: string;
  };
  features: {
    serpAugmentation: boolean;
    allowNetworkFetch: boolean;
  };
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export interface AIRequestPayload {
  params: GenerateParams;
  config: ModelConfig;
  conversation?: ChatMessage[];
  mode?: "page" | "web";
}

export type RuntimeMessage =
  | { type: "pilotx-toggle" }
  | { type: "pilotx-quick-summarize" }
  | { type: "pilotx-open-panel" }
  | { type: "pilotx-stream", payload: AIRequestPayload }
  | { type: "pilotx-stream-token", token: string }
  | { type: "pilotx-stream-done" }
  | { type: "pilotx-stream-error", error: string }
  | { type: "pilotx-context", context: string }
  | { type: "pilotx-set-config", id: string }
  | { type: "pilotx-context-menu", action: string, selection: string }
  | { type: "pilotx-update-shortcuts" };
