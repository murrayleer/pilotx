import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  ChatMessage,
  GenerateParams,
  ModelConfig,
  PromptTemplate,
  StorageSchema
} from "@types";
import { extractContent, type ExtractedContent } from "@lib/extract";
import { buildParams, promptTemplates } from "@lib/prompts";
import { getStorage, setStorage, pushHistory, generateId } from "@lib/storage";
import { copyText } from "@lib/dom";

interface SidebarEventDetailMap {
  toggle: void;
  open: void;
  "quick-summarize": void;
  "stream-token": { token: string };
  "stream-done": void;
  "stream-error": { error: string };
  "context-menu": { action: string; selection: string };
}

type SidebarEventName = keyof SidebarEventDetailMap;

type SidebarAPI = {
  dispatch<T extends SidebarEventName>(name: T, detail?: SidebarEventDetailMap[T]): void;
};

interface SidebarAppProps {
  bus: EventTarget;
}

function useBusEvent<T extends SidebarEventName>(bus: EventTarget, name: T, handler: (detail: SidebarEventDetailMap[T]) => void) {
  useEffect(() => {
    const listener = ((event: Event) => {
      handler((event as CustomEvent<SidebarEventDetailMap[T]>).detail);
    }) as EventListener;
    bus.addEventListener(name, listener);
    return () => bus.removeEventListener(name, listener);
  }, [bus, name, handler]);
}

const MarkdownBlock: React.FC<{ content: string; streaming?: boolean }> = ({ content, streaming }) => {
  const formatted = useMemo(() => {
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n\n/g, "<br/><br/>")
      .replace(/\n-/g, "<br/>•");
  }, [content]);
  return (
    <div
      className={`pilotx-scrollbar pilotx-markdown ${streaming ? "pilotx-streaming" : ""}`}
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
};

const SidebarApp: React.FC<SidebarAppProps> = ({ bus }) => {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(360);
  const [storage, setStorageState] = useState<StorageSchema | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [context, setContext] = useState<ExtractedContent | null>(null);
  const [mode, setMode] = useState<"summary" | "ask" | "template">("summary");
  const [input, setInput] = useState("");
  const [tone, setTone] = useState("neutral");
  const [wordLimit, setWordLimit] = useState(180);
  const [language, setLanguage] = useState("English");
  const [allowNetwork, setAllowNetwork] = useState(false);
  const [serpEnabled, setSerpEnabled] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(360);
  const contextRef = useRef<ExtractedContent | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);
  const conversationRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    (async () => {
      const store = await getStorage();
      setStorageState(store);
      setConfig(store.configs.find((c) => c.id === store.activeConfigId) ?? store.configs[0] ?? null);
      setAllowNetwork(store.features.allowNetworkFetch);
      setSerpEnabled(store.features.serpAugmentation);
    })();
  }, []);

  useEffect(() => {
    const handleChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== "local") return;
      if (changes.configs || changes.activeConfigId || changes.prompts || changes.features || changes.history) {
        getStorage().then((store) => {
          setStorageState(store);
          setConfig(store.configs.find((c) => c.id === store.activeConfigId) ?? store.configs[0] ?? null);
          setAllowNetwork(store.features.allowNetworkFetch);
          setSerpEnabled(store.features.serpAugmentation);
        });
      }
    };
    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  useEffect(() => {
    const data = extractContent();
    setContext(data);
    contextRef.current = data;
  }, []);

  useEffect(() => {
    if (!open || !messageRef.current) return;
    messageRef.current.scrollTop = messageRef.current.scrollHeight;
  }, [currentAnswer, open]);

  useBusEvent(bus, "toggle", () => setOpen((prev) => !prev));
  useBusEvent(bus, "open", () => setOpen(true));
  useBusEvent(bus, "quick-summarize", () => {
    setOpen(true);
    setMode("summary");
    triggerSummary();
  });
  useBusEvent(bus, "stream-token", ({ token }) => {
    setStreaming(true);
    setCurrentAnswer((prev) => prev + token);
  });
  useBusEvent(bus, "stream-done", () => {
    setStreaming(false);
    finalizeConversation();
  });
  useBusEvent(bus, "stream-error", ({ error: err }) => {
    setStreaming(false);
    setError(err);
  });
  useBusEvent(bus, "context-menu", ({ action, selection }) => {
    setOpen(true);
    setMode("template");
    setCurrentAnswer(selection);
    setStreaming(false);
    setError(null);
  });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!startX.current) return;
      const delta = startX.current - event.clientX;
      setWidth(Math.min(520, Math.max(260, startWidth.current + delta)));
    };
    const handleMouseUp = () => {
      startX.current = 0;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const templates = storage?.prompts ?? [];

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  const handleStartResize = (event: React.MouseEvent<HTMLDivElement>) => {
    startX.current = event.clientX;
    startWidth.current = width;
  };

  const currentConfigName = config?.name ?? "Configure provider";

  const sendStream = async (params: GenerateParams, userMessage?: string) => {
    if (!config) {
      setError("Please configure an AI provider in the options page.");
      return;
    }
    setError(null);
    setStreaming(true);
    setCurrentAnswer("");
    if (userMessage) {
      setConversation((prev) => [
        ...prev,
        { role: "user", content: userMessage, createdAt: Date.now() }
      ]);
    }
    const baseConversation = conversationRef.current;
    const convo = userMessage
      ? [...baseConversation, { role: "user", content: userMessage, createdAt: Date.now() }]
      : [...baseConversation];
    chrome.runtime.sendMessage(
      {
        type: "pilotx-stream",
        payload: {
          params,
          config,
          conversation: convo,
          mode: allowNetwork ? "web" : "page"
        }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message);
          setStreaming(false);
        } else if (response?.error) {
          setError(response.error);
          setStreaming(false);
        }
      }
    );
  };

  const finalizeConversation = async () => {
    if (!currentAnswer.trim()) return;
    const assistant: ChatMessage = { role: "assistant", content: currentAnswer, createdAt: Date.now() };
    setConversation((prev) => [...prev, assistant]);
    if (storage?.historyEnabled) {
      await pushHistory({
        id: generateId(),
        title: contextRef.current?.title ?? "Page",
        createdAt: Date.now(),
        messages: [...conversationRef.current, assistant]
      });
    }
  };

  const triggerSummary = () => {
    if (!contextRef.current) return;
    const prompt = promptTemplates.summarize({
      pageTitle: contextRef.current.title,
      url: contextRef.current.url,
      wordLimit,
      tone,
      language
    });
    const params = buildParams(prompt, contextRef.current.text, {});
    setConversation([]);
    sendStream(params, "Summarize this page");
  };

  const handleAsk = () => {
    if (!input.trim() || !contextRef.current) return;
    const prompt = promptTemplates.qa({ question: input.trim(), language });
    const params = buildParams(prompt, contextRef.current.text, {});
    sendStream(params, input.trim());
    setInput("");
  };

  const handleTemplate = () => {
    if (!template || !contextRef.current) return;
    const prompt = template.body
      .replace("{{language}}", language)
      .replace("{{tone}}", tone)
      .replace("{{word_limit}}", String(wordLimit))
      .replace("{{context}}", contextRef.current.text);
    const params = buildParams(prompt, contextRef.current.text, {});
    sendStream(params, template.name);
  };

  const handleCopy = () => {
    if (!currentAnswer) return;
    copyText(currentAnswer);
  };

  const toggleNetwork = async () => {
    const next = !allowNetwork;
    setAllowNetwork(next);
    setStorageState((prev) => (prev ? { ...prev, features: { ...prev.features, allowNetworkFetch: next } } : prev));
    await setStorage({ features: { ...(storage?.features ?? {}), allowNetworkFetch: next } });
  };

  const toggleSerp = async () => {
    const next = !serpEnabled;
    setSerpEnabled(next);
    setStorageState((prev) => (prev ? { ...prev, features: { ...prev.features, serpAugmentation: next } } : prev));
    await setStorage({ features: { ...(storage?.features ?? {}), serpAugmentation: next } });
  };

  return (
    <aside
      className={`pilotx-sidebar ${open ? "open" : ""} ${document.documentElement.matches(".dark, [data-theme='dark']") ? "dark" : ""}`}
      style={{ width }}
      role="complementary"
      aria-label="PilotX AI sidebar"
    >
      <div className="pilotx-resizer" ref={resizerRef} onMouseDown={handleStartResize} />
      <div className="pilotx-handle" onClick={() => setOpen((v) => !v)} role="button" tabIndex={0}>
        PilotX
      </div>
      <div className="pilotx-content">
        <header className="border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">PilotX Copilot</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{currentConfigName}</p>
            </div>
            <button className="pilotx-btn" onClick={triggerSummary} disabled={streaming}>
              Summarize
            </button>
          </div>
          <div className="mt-2 flex gap-2 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={allowNetwork} onChange={toggleNetwork} /> Allow web search
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={serpEnabled} onChange={toggleSerp} /> SERP sidebar
            </label>
          </div>
        </header>
        <nav className="flex items-center gap-2 px-4 py-2 text-sm">
          <button
            className={`rounded-md px-2 py-1 text-sm ${mode === "summary" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
            onClick={() => setMode("summary")}
          >
            Summary
          </button>
          <button
            className={`rounded-md px-2 py-1 text-sm ${mode === "ask" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
            onClick={() => setMode("ask")}
          >
            Ask
          </button>
          <button
            className={`rounded-md px-2 py-1 text-sm ${mode === "template" ? "bg-slate-200 dark:bg-slate-700" : ""}`}
            onClick={() => setMode("template")}
          >
            Templates
          </button>
        </nav>
        <section className="flex-1 overflow-y-auto px-4 py-2" ref={messageRef}>
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/60">
              {error}
            </div>
          ) : currentAnswer ? (
            <MarkdownBlock content={currentAnswer} streaming={streaming} />
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode === "summary" && "Click Summarize to get TL;DR and outline for this page."}
              {mode === "ask" && "Ask a question about this page to get grounded answers."}
              {mode === "template" && "Pick a template to transform the page content."}
            </p>
          )}
        </section>
        <footer className="border-t border-slate-200 bg-white/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/80">
          {mode === "summary" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <label className="flex-1 text-xs">
                  Tone
                  <input className="pilotx-input" value={tone} onChange={(e) => setTone(e.target.value)} />
                </label>
                <label className="flex-1 text-xs">
                  Language
                  <input className="pilotx-input" value={language} onChange={(e) => setLanguage(e.target.value)} />
                </label>
                <label className="w-20 text-xs">
                  Words
                  <input
                    className="pilotx-input"
                    type="number"
                    value={wordLimit}
                    onChange={(e) => setWordLimit(Number(e.target.value))}
                  />
                </label>
              </div>
              <button className="pilotx-btn w-full" onClick={triggerSummary} disabled={streaming}>
                {streaming ? "Working..." : "Generate summary"}
              </button>
            </div>
          )}
          {mode === "ask" && (
            <div className="space-y-2">
              <textarea
                className="pilotx-input min-h-[80px]"
                placeholder="Ask about this page..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="flex justify-between">
                <button className="pilotx-btn" onClick={handleAsk} disabled={streaming || !input.trim()}>
                  {streaming ? "Answering..." : "Ask"}
                </button>
                <button className="rounded-md border border-slate-200 px-3 py-1 text-xs" onClick={handleCopy}>
                  Copy
                </button>
              </div>
            </div>
          )}
          {mode === "template" && (
            <div className="space-y-2">
              <select
                className="pilotx-input"
                value={template?.id ?? ""}
                onChange={(e) => {
                  const tpl = templates.find((p) => p.id === e.target.value) ?? null;
                  setTemplate(tpl);
                }}
              >
                <option value="">Select a template</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
              <button className="pilotx-btn w-full" onClick={handleTemplate} disabled={!template || streaming}>
                {streaming ? "Generating..." : "Run template"}
              </button>
            </div>
          )}
        </footer>
      </div>
    </aside>
  );
};

export function mountSidebar(host: HTMLElement): SidebarAPI {
  const bus = new EventTarget();
  const root = createRoot(host);
  root.render(
    <React.StrictMode>
      <SidebarApp bus={bus} />
    </React.StrictMode>
  );
  return {
    dispatch(name, detail) {
      bus.dispatchEvent(new CustomEvent(name, { detail }));
    }
  };
}
