import type { RuntimeMessage, AIRequestPayload, ChatMessage } from "@types";
import { streamCompletion, generateCompletion } from "@lib/aiRouter";
import { getActiveConfig, getStorage } from "@lib/storage";
import logger from "@lib/logger";

const MENU_ACTIONS: Record<string, { title: string; template: string }> = {
  summarize: {
    title: "Summarize with PilotX",
    template: "Summarize the following selection. Keep it concise.\n{{selection}}"
  },
  explain: {
    title: "Explain with PilotX",
    template: "Explain the following text in clear language:\n{{selection}}"
  },
  translate: {
    title: "Translate with PilotX",
    template: "Translate the following text to English:\n{{selection}}"
  },
  rewrite: {
    title: "Rewrite with PilotX",
    template: "Rewrite the text with improved clarity:\n{{selection}}"
  },
  email: {
    title: "Draft email with PilotX",
    template: "Write an email response referencing this text:\n{{selection}}"
  }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const [id, item] of Object.entries(MENU_ACTIONS)) {
      chrome.contextMenus.create({
        id,
        title: item.title,
        contexts: ["selection"]
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !info.menuItemId || typeof info.selectionText !== "string") return;
  const action = MENU_ACTIONS[info.menuItemId as string];
  if (!action) return;
  const config = await getActiveConfig();
  const params = {
    prompt: action.template.replace("{{selection}}", info.selectionText),
    stream: false
  };
  try {
    const result = await generateCompletion(config, params);
    chrome.tabs.sendMessage(tab.id, {
      type: "pilotx-context-menu",
      action: info.menuItemId,
      selection: result
    } satisfies RuntimeMessage);
  } catch (error) {
    chrome.tabs.sendMessage(tab.id, {
      type: "pilotx-stream-error",
      error: (error as Error).message
    } satisfies RuntimeMessage);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (command === "toggle-sidebar") {
    chrome.tabs.sendMessage(tab.id, { type: "pilotx-toggle" } satisfies RuntimeMessage);
  }
  if (command === "quick-summarize") {
    chrome.tabs.sendMessage(tab.id, { type: "pilotx-quick-summarize" } satisfies RuntimeMessage);
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (message.type === "pilotx-stream") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ error: "Missing tab" });
      return;
    }
    handleStreamRequest(message.payload, tabId);
    return true;
  }
  if (message.type === "pilotx-update-shortcuts") {
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "pilotx-set-config") {
    chrome.storage.local.set({ activeConfigId: message.id }, () => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

async function handleStreamRequest(payload: AIRequestPayload, tabId: number) {
  const config = payload.config ?? (await getActiveConfig());
  const conversation: ChatMessage[] = payload.conversation ?? [];
  logger.debug("handleStreamRequest", { tabId, provider: config.provider });
  await streamCompletion(
    config,
    payload.params,
    {
      onToken(token) {
        chrome.tabs.sendMessage(tabId, { type: "pilotx-stream-token", token } satisfies RuntimeMessage);
      },
      onDone() {
        chrome.tabs.sendMessage(tabId, { type: "pilotx-stream-done" } satisfies RuntimeMessage);
      },
      onError(error) {
        chrome.tabs.sendMessage(tabId, {
          type: "pilotx-stream-error",
          error: error.message
        } satisfies RuntimeMessage);
      }
    },
    conversation
  );
}

chrome.runtime.onMessageExternal?.addListener((message, sender, sendResponse) => {
  if (message?.type === "pilotx-config") {
    getStorage().then((storage) => sendResponse(storage.configs));
    return true;
  }
  return false;
});
