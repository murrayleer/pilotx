import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { StorageSchema } from "@types";
import { getStorage } from "@lib/storage";
import "../../styles/tailwind.css";

const Popup: React.FC = () => {
  const [storage, setStorageState] = useState<StorageSchema | null>(null);

  useEffect(() => {
    getStorage().then(setStorageState);
  }, []);

  const activeConfig = storage?.configs.find((c) => c.id === storage?.activeConfigId);

  const sendCommand = (type: string) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return;
      chrome.tabs.sendMessage(tabId, { type });
    });
  };

  return (
    <div className="w-80 space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">PilotX</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">{activeConfig ? activeConfig.name : "No provider configured"}</p>
      </header>
      <div className="space-y-2">
        <button className="pilotx-btn w-full" onClick={() => sendCommand("pilotx-toggle")}>Toggle sidebar</button>
        <button className="pilotx-btn w-full" onClick={() => sendCommand("pilotx-quick-summarize")}>
          Quick summarize
        </button>
        <button
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Options
        </button>
        <button
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL("ui/panel.html") })}
        >
          Open history panel
        </button>
      </div>
      <footer className="text-xs text-slate-500 dark:text-slate-400">
        Shortcuts: {storage?.shortcuts.toggleSidebar ?? "Alt+Shift+S"} (sidebar), {storage?.shortcuts.quickSummarize ?? "Alt+Shift+J"}
        (summary)
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
