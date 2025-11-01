import type { StorageSchema, ModelConfig, Conversation, PromptTemplate } from "@types";

const DEFAULT_CONFIG: ModelConfig = {
  id: "default",
  name: "Custom Endpoint",
  provider: "custom",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  timeoutMs: 60_000
};

const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: "summarize",
    name: "Summarize",
    description: "Concise multi-section summary",
    body: "You are PilotX, an accurate assistant. Summarize the provided context as bullet points and a TL;DR. Respect the requested tone ({{tone}}) and language ({{language}}). Limit to {{word_limit}} words. Context:\n{{context}}",
    placeholders: ["tone", "language", "word_limit"]
  },
  {
    id: "translate",
    name: "Translate",
    description: "Translate the selection",
    body: "Translate the provided text to {{language}} while keeping meaning and formatting. Text:\n{{context}}",
    placeholders: ["language"]
  },
  {
    id: "email",
    name: "Email Draft",
    description: "Draft a professional email",
    body: "You are writing a helpful email based on the notes below. Provide subject and body. Use {{tone}} tone. Notes:\n{{context}}",
    placeholders: ["tone"]
  }
];

const DEFAULT_STORAGE: StorageSchema = {
  configs: [DEFAULT_CONFIG],
  activeConfigId: DEFAULT_CONFIG.id,
  prompts: DEFAULT_PROMPTS,
  history: [],
  historyEnabled: false,
  historyLimit: 20,
  shortcuts: {
    toggleSidebar: "Alt+Shift+S",
    quickSummarize: "Alt+Shift+J"
  },
  features: {
    serpAugmentation: true,
    allowNetworkFetch: false
  }
};

export async function getStorage(): Promise<StorageSchema> {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_STORAGE, (value) => {
      resolve(value as StorageSchema);
    });
  });
}

export async function setStorage(update: Partial<StorageSchema>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(update, () => resolve());
  });
}

export async function getActiveConfig(): Promise<ModelConfig> {
  const store = await getStorage();
  const config = store.configs.find((c) => c.id === store.activeConfigId) ?? store.configs[0];
  return config;
}

export async function upsertConfig(config: ModelConfig): Promise<void> {
  const store = await getStorage();
  const idx = store.configs.findIndex((c) => c.id === config.id);
  if (idx >= 0) {
    store.configs[idx] = config;
  } else {
    store.configs.push(config);
  }
  await setStorage({ configs: store.configs, activeConfigId: config.id });
}

export async function deleteConfig(id: string): Promise<void> {
  const store = await getStorage();
  store.configs = store.configs.filter((c) => c.id !== id);
  if (store.activeConfigId === id) {
    store.activeConfigId = store.configs[0]?.id;
  }
  await setStorage({ configs: store.configs, activeConfigId: store.activeConfigId });
}

export async function pushHistory(conv: Conversation): Promise<void> {
  const store = await getStorage();
  if (!store.historyEnabled) return;
  const history = [conv, ...store.history.filter((c) => c.id !== conv.id)].slice(0, store.historyLimit);
  await setStorage({ history });
}

export async function clearHistory(): Promise<void> {
  await setStorage({ history: [] });
}

export function generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export { DEFAULT_STORAGE };
