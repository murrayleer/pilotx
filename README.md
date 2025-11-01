# PilotX – AI Copilot for the Web

PilotX is a Manifest V3 Chrome extension that injects an AI sidebar into any page. Summarise articles, run Q&A, transform text
with templates, and manage multiple AI providers without relying on platform credits.

## Features

- 🧠 **Configurable AI router** – Use OpenAI, Azure OpenAI, OpenRouter, or any OpenAI-compatible endpoint (Ollama, vLLM,
  LM Studio, nginx gateways).
- 📰 **One-click summaries** – Stream TL;DR, bullet points, and outlines based on the current page.
- ❓ **Grounded Q&A** – Ask questions about the page content and receive contextual answers. Follow-up messages preserve the
  last few exchanges.
- ✍️ **Templates** – Built-in presets for translation, explanations, rewrites, emails, and meeting notes. Create your own with
  liquid-style placeholders.
- 📚 **History panel** – Optionally store the last N conversations locally and browse them from the dedicated panel.
- 🔍 **SERP augmentation** – When enabled, Google/Bing results pages display an auto-summarised sidebar.
- 🖱️ **Context menu helpers** – Right-click selected text to trigger explain/translate/summarise/email actions.
- ⌨️ **Shortcuts** – Default: `Alt+Shift+S` toggles the sidebar, `Alt+Shift+J` runs a quick summary (editable from the options
  page).

## Project structure

```
pilotx/
├─ manifest.json
├─ README.md
├─ LICENSE
├─ package.json
├─ tsconfig.json
├─ tsconfig.base.json
├─ vite.config.ts
├─ postcss.config.cjs
├─ tailwind.config.cjs
├─ styles/
│  └─ tailwind.css
├─ assets/
│  ├─ icon16.png
│  ├─ icon48.png
│  └─ icon128.png
├─ src/
│  ├─ background/service-worker.ts
│  ├─ content/
│  │  ├─ content-script.ts
│  │  ├─ sidebar.css
│  │  └─ sidebar.tsx
│  ├─ lib/
│  │  ├─ aiRouter.ts
│  │  ├─ dom.ts
│  │  ├─ extract.ts
│  │  ├─ logger.ts
│  │  ├─ prompts.ts
│  │  ├─ sse.ts
│  │  └─ storage.ts
│  ├─ types/index.d.ts
│  └─ ui/
│     ├─ panel.html / panel.tsx
│     ├─ popup.html / popup.tsx
│     └─ options.html / options.tsx
└─ scripts/
   ├─ build.mjs
   └─ zip.mjs
```

## Development

```bash
npm install
npm run dev  # launches Vite dev server for UI entries
```

The sidebar is bundled into the content script and cannot be hot-reloaded; rebuild when logic changes.

### Build

```bash
npm run build
```

This command cleans `dist/`, runs Vite, and copies the manifest and CSS. Minimal placeholder icons are generated on the fly (no binary assets stored in git) before being included. Load `dist/` in Chrome (Extensions → Developer mode → Load unpacked).

### Package zip

```bash
npm run zip
```

Outputs `pilotx.zip` ready for the Chrome Web Store.

## Configuration

1. Install the extension (Developer mode → Load unpacked → select `dist/`).
2. Open the options page from the toolbar popup.
3. Add one or more providers:
   - **OpenAI** – Base URL `https://api.openai.com/v1`, your API key, model (e.g. `gpt-4o-mini`).
   - **Azure OpenAI** – Azure endpoint (e.g. `https://your-resource.openai.azure.com`), deployment name, API version, key.
   - **OpenRouter** – Base URL `https://openrouter.ai/api/v1`, API key from OpenRouter, choose a model slug.
   - **Custom / Local** – Any OpenAI-compatible gateway. Example for Ollama/vLLM reverse proxy:
     - Base URL: `http://localhost:8000/v1`
     - API key: optional (depends on your gateway)
     - Model: `llama-3.1-70b-instruct` or any supported name

4. Configure templates, history retention, SERP augmentation, and shortcuts.
5. Enable history if you want to store recent conversations (kept in `chrome.storage.local`).

### Streaming support

All providers are queried via the OpenAI Chat Completions API and default to streaming (SSE). Ensure your endpoint supports
`stream: true`. If it does not, edit the template or request settings to set `stream` to `false`.

### Security & privacy

- PilotX never ships with embedded keys.
- All requests go straight from your browser to the configured endpoint. Review the provider's security posture before use.
- Disable history if you do not want local storage of conversations.
- CSP/permissions: `host_permissions` is `*://*/*` to allow summarising any page. Fetch calls only target the configured base URL.

## Troubleshooting

- **No response / streaming stuck** – Check DevTools → Extensions → Service Worker logs for API errors. Ensure your key/model is
  correct and the endpoint allows CORS from `chrome-extension://*`.
- **Azure 401** – Verify deployment name and API version. The base URL must not end with `/openai` (use the resource root).
- **Custom SSL** – Self-signed certs must be trusted by Chrome, or use `http://localhost` during development.
- **Shortcuts not working** – After updating shortcuts in the options page, open `chrome://extensions/shortcuts` to map them.

## Contributing

1. Fork & clone.
2. Create feature branch.
3. Run `npm run build` before committing.
4. Submit PR with details.

## License

[MIT](./LICENSE)
