import { mountSidebar } from "./sidebar";
import "./sidebar.css";
import { getStorage } from "@lib/storage";

const hostId = "pilotx-sidebar-host";
let host = document.getElementById(hostId);
if (!host) {
  host = document.createElement("div");
  host.id = hostId;
  document.documentElement.appendChild(host);
}

const sidebar = mountSidebar(host);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "pilotx-toggle":
      sidebar.dispatch("toggle");
      break;
    case "pilotx-quick-summarize":
      sidebar.dispatch("quick-summarize");
      break;
    case "pilotx-open-panel":
      sidebar.dispatch("open");
      break;
    case "pilotx-stream-token":
      sidebar.dispatch("stream-token", { token: message.token });
      break;
    case "pilotx-stream-done":
      sidebar.dispatch("stream-done");
      break;
    case "pilotx-stream-error":
      sidebar.dispatch("stream-error", { error: message.error });
      break;
    case "pilotx-context-menu":
      sidebar.dispatch("context-menu", { action: message.action, selection: message.selection });
      break;
    default:
      break;
  }
});

(async () => {
  const storage = await getStorage();
  const isSerp = /google\./i.test(location.hostname) || /bing\./i.test(location.hostname);
  if (storage.features.serpAugmentation && isSerp) {
    sidebar.dispatch("open");
    sidebar.dispatch("quick-summarize");
  }
})();
