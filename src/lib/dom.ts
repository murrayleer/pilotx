export function injectStyles(href: string): HTMLLinkElement {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
  return link;
}

export function createShadowHost(id: string, className?: string): HTMLElement {
  let host = document.getElementById(id);
  if (!host) {
    host = document.createElement("div");
    host.id = id;
    if (className) host.className = className;
    document.documentElement.appendChild(host);
  }
  return host;
}

export function extractSelection(): string {
  return window.getSelection?.()?.toString() ?? "";
}

export function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function getPageMeta() {
  return {
    title: document.title,
    url: location.href,
    lang: document.documentElement.lang || navigator.language,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? ""
  };
}
