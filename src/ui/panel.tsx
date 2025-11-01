import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Conversation } from "@types";
import { getStorage, clearHistory } from "@lib/storage";
import "../../styles/tailwind.css";

const Panel: React.FC = () => {
  const [history, setHistory] = useState<Conversation[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const storage = await getStorage();
    setHistory(storage.history);
    setEnabled(storage.historyEnabled);
  };

  const handleClear = async () => {
    await clearHistory();
    await load();
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">PilotX History</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Recent conversations stored locally.</p>
        </div>
        <button
          className="pilotx-btn"
          onClick={() => chrome.runtime.openOptionsPage()}
          type="button"
        >
          Open options
        </button>
      </header>
      {!enabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/50">
          History is disabled. Enable it in the options page.
        </div>
      )}
      <section className="space-y-4">
        {history.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No conversations stored yet.</p>
        ) : (
          history.map((item) => (
            <article key={item.id} className="pilotx-card space-y-2">
              <header className="flex items-center justify-between text-sm">
                <h2 className="font-medium text-slate-800 dark:text-slate-100">{item.title}</h2>
                <span className="text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </header>
              <div className="space-y-2">
                {item.messages.map((msg, index) => (
                  <div key={index} className="rounded-lg bg-slate-100/60 px-3 py-2 text-xs dark:bg-slate-800/70">
                    <strong className="uppercase text-slate-500 dark:text-slate-400">{msg.role}</strong>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{msg.content}</p>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </section>
      <footer className="flex justify-end">
        <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={handleClear}>
          Clear history
        </button>
      </footer>
    </main>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <Panel />
  </React.StrictMode>
);
