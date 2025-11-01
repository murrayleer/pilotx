import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ModelConfig, PromptTemplate, StorageSchema } from "@types";
import { DEFAULT_STORAGE, deleteConfig, getStorage, setStorage, upsertConfig } from "@lib/storage";
import "../../styles/tailwind.css";

const providerLabels: Record<ModelConfig["provider"], string> = {
  openai: "OpenAI",
  azure: "Azure OpenAI",
  openrouter: "OpenRouter",
  custom: "Custom / OpenAI-compatible"
};

const blankConfig: ModelConfig = {
  id: "",
  name: "",
  provider: "custom",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  timeoutMs: 60_000
};

const Options: React.FC = () => {
  const [storage, setStorageState] = useState<StorageSchema>(DEFAULT_STORAGE);
  const [configForm, setConfigForm] = useState<ModelConfig>(blankConfig);
  const [isEditing, setIsEditing] = useState(false);
  const [promptForm, setPromptForm] = useState<PromptTemplate>({ id: "", name: "", body: "" });
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const state = await getStorage();
    setStorageState(state);
  };

  const handleConfigEdit = (config?: ModelConfig) => {
    if (config) {
      setConfigForm(config);
      setIsEditing(true);
    } else {
      setConfigForm({ ...blankConfig, id: crypto.randomUUID() });
      setIsEditing(false);
    }
  };

  const handleConfigSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!configForm.name.trim() || !configForm.baseUrl.trim()) return;
    const payload: ModelConfig = {
      ...configForm,
      id: configForm.id || crypto.randomUUID()
    };
    await upsertConfig(payload);
    await load();
    setIsEditing(false);
    setConfigForm(blankConfig);
  };

  const handleConfigDelete = async (id: string) => {
    await deleteConfig(id);
    await load();
  };

  const handlePromptSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!promptForm.name.trim() || !promptForm.body.trim()) return;
    const prompts = [...storage.prompts];
    if (editingPromptId) {
      const index = prompts.findIndex((p) => p.id === editingPromptId);
      if (index >= 0) prompts[index] = { ...promptForm, id: editingPromptId };
    } else {
      prompts.push({ ...promptForm, id: crypto.randomUUID() });
    }
    await setStorage({ prompts });
    setPromptForm({ id: "", name: "", body: "" });
    setEditingPromptId(null);
    await load();
  };

  const handlePromptEdit = (prompt: PromptTemplate) => {
    setPromptForm(prompt);
    setEditingPromptId(prompt.id);
  };

  const handlePromptDelete = async (id: string) => {
    const prompts = storage.prompts.filter((p) => p.id !== id);
    await setStorage({ prompts });
    await load();
  };

  const handleShortcutUpdate = async (key: "toggleSidebar" | "quickSummarize", value: string) => {
    await setStorage({ shortcuts: { ...storage.shortcuts, [key]: value } });
    await load();
  };

  const providerConfigs = useMemo(() => storage.configs, [storage.configs]);

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">PilotX Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage AI providers, prompts, history, and keyboard shortcuts. All data stays on your device unless you call your own
          API endpoints.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Model providers</h2>
          <button className="pilotx-btn" onClick={() => handleConfigEdit()}>
            Add provider
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {providerConfigs.map((config) => (
            <article key={config.id} className="pilotx-card space-y-2">
              <header className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{config.name}</h3>
                  <p className="text-xs text-slate-500">{providerLabels[config.provider]}</p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs" onClick={() => handleConfigEdit(config)}>
                    Edit
                  </button>
                  <button className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600" onClick={() => handleConfigDelete(config.id)}>
                    Delete
                  </button>
                </div>
              </header>
              <dl className="space-y-1 text-xs text-slate-500">
                <div>
                  <dt>Base URL</dt>
                  <dd className="truncate text-slate-700 dark:text-slate-300">{config.baseUrl}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{config.model}</dd>
                </div>
                {config.provider === "azure" && config.azure && (
                  <div>
                    <dt>Azure deployment</dt>
                    <dd>{config.azure.deployment}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
        <form className="pilotx-card space-y-3" onSubmit={handleConfigSubmit}>
          <h3 className="text-lg font-semibold">{isEditing ? "Edit provider" : "New provider"}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Display name
              <input className="pilotx-input" value={configForm.name} onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })} />
            </label>
            <label className="text-sm">
              Provider
              <select
                className="pilotx-input"
                value={configForm.provider}
                onChange={(e) => setConfigForm({ ...configForm, provider: e.target.value as ModelConfig["provider"] })}
              >
                {Object.entries(providerLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm">
            Base URL
            <input className="pilotx-input" value={configForm.baseUrl} onChange={(e) => setConfigForm({ ...configForm, baseUrl: e.target.value })} />
          </label>
          <label className="text-sm">
            API Key
            <input className="pilotx-input" value={configForm.apiKey} onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })} />
          </label>
          <label className="text-sm">
            Model
            <input className="pilotx-input" value={configForm.model} onChange={(e) => setConfigForm({ ...configForm, model: e.target.value })} />
          </label>
          {configForm.provider === "azure" && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Azure deployment
                <input
                  className="pilotx-input"
                  value={configForm.azure?.deployment ?? ""}
                  onChange={(e) => setConfigForm({
                    ...configForm,
                    azure: { ...configForm.azure, deployment: e.target.value, apiVersion: configForm.azure?.apiVersion ?? "2024-02-01" }
                  })}
                />
              </label>
              <label className="text-sm">
                API version
                <input
                  className="pilotx-input"
                  value={configForm.azure?.apiVersion ?? "2024-02-01"}
                  onChange={(e) => setConfigForm({
                    ...configForm,
                    azure: { ...configForm.azure, apiVersion: e.target.value, deployment: configForm.azure?.deployment ?? configForm.model }
                  })}
                />
              </label>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Timeout (ms)
              <input
                className="pilotx-input"
                type="number"
                value={configForm.timeoutMs ?? 60_000}
                onChange={(e) => setConfigForm({ ...configForm, timeoutMs: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm">
              Extra headers (JSON)
              <input
                className="pilotx-input"
                placeholder='{"X-Custom":"value"}'
                value={JSON.stringify(configForm.extraHeaders ?? {})}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value || "{}");
                    setConfigForm({ ...configForm, extraHeaders: parsed });
                  } catch {
                    // ignore
                  }
                }}
              />
            </label>
          </div>
          <button className="pilotx-btn w-full" type="submit">
            {isEditing ? "Update provider" : "Save provider"}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Prompt templates</h2>
          <span className="text-xs text-slate-500">Use {"{{placeholder}}"} tokens for dynamic values.</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {storage.prompts.map((prompt) => (
            <article key={prompt.id} className="pilotx-card space-y-2">
              <header className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{prompt.name}</h3>
                <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs" onClick={() => handlePromptEdit(prompt)}>
                    Edit
                  </button>
                  <button className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600" onClick={() => handlePromptDelete(prompt.id)}>
                    Delete
                  </button>
                </div>
              </header>
              <p className="text-xs text-slate-500 whitespace-pre-wrap">{prompt.body}</p>
            </article>
          ))}
        </div>
        <form className="pilotx-card space-y-3" onSubmit={handlePromptSubmit}>
          <h3 className="text-lg font-semibold">{editingPromptId ? "Edit template" : "New template"}</h3>
          <label className="text-sm">
            Name
            <input className="pilotx-input" value={promptForm.name} onChange={(e) => setPromptForm({ ...promptForm, name: e.target.value })} />
          </label>
          <label className="text-sm">
            Description
            <input className="pilotx-input" value={promptForm.description ?? ""} onChange={(e) => setPromptForm({ ...promptForm, description: e.target.value })} />
          </label>
          <label className="text-sm">
            Body
            <textarea className="pilotx-input min-h-[120px]" value={promptForm.body} onChange={(e) => setPromptForm({ ...promptForm, body: e.target.value })} />
          </label>
          <button className="pilotx-btn w-full" type="submit">
            {editingPromptId ? "Update template" : "Save template"}
          </button>
        </form>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="pilotx-card space-y-3">
          <h2 className="text-xl font-semibold">History</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={storage.historyEnabled}
              onChange={async (e) => {
                await setStorage({ historyEnabled: e.target.checked });
                await load();
              }}
            />
            Enable local history (stored in chrome.storage.local)
          </label>
          <label className="text-sm">
            Keep recent conversations
            <input
              className="pilotx-input"
              type="number"
              value={storage.historyLimit}
              onChange={async (e) => {
                await setStorage({ historyLimit: Number(e.target.value) });
                await load();
              }}
            />
          </label>
        </article>
        <article className="pilotx-card space-y-3">
          <h2 className="text-xl font-semibold">Keyboard shortcuts</h2>
          <p className="text-xs text-slate-500">
            Update the preferred shortcut here and then map it via chrome://extensions/shortcuts.
          </p>
          <label className="text-sm">
            Toggle sidebar
            <input
              className="pilotx-input"
              value={storage.shortcuts.toggleSidebar}
              onChange={(e) => handleShortcutUpdate("toggleSidebar", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Quick summarize
            <input
              className="pilotx-input"
              value={storage.shortcuts.quickSummarize}
              onChange={(e) => handleShortcutUpdate("quickSummarize", e.target.value)}
            />
          </label>
        </article>
      </section>

      <section className="pilotx-card space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Privacy & Safety</h2>
        <p>
          PilotX never ships with API keys. All requests are sent directly to the endpoints you configure. Review the terms of
          your AI provider and ensure compliance before use.
        </p>
        <p>
          To connect to OpenAI-compatible servers (e.g. Ollama, vLLM, LM Studio), set the Base URL to your gateway such as
          <code className="ml-1 rounded bg-slate-200 px-1 py-0.5 text-xs">http://localhost:8000/v1</code> and provide an API key if
          required.
        </p>
        <p>
          Streamed responses use server-sent events. If your provider does not support SSE, disable streaming by editing the
          templates in advanced mode.
        </p>
      </section>
    </main>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
