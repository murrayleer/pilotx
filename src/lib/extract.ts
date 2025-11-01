import { getPageMeta } from "@lib/dom";

const TEXT_SELECTOR = "article,main,section,div,p,li,pre,code,blockquote";

export interface ExtractedContent {
  title: string;
  url: string;
  lang: string;
  description: string;
  text: string;
  html: string;
}

/**
 * Extract structured text from the current document.
 */
export function extractContent(limit = 12_000): ExtractedContent {
  const meta = getPageMeta();
  const root = document.querySelector("article") ?? document.querySelector("main") ?? document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (["script", "style", "noscript", "svg", "canvas"].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (el.closest("header, footer, nav, aside")) return NodeFilter.FILTER_SKIP;
      if (el.matches(TEXT_SELECTOR)) return NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_SKIP;
    }
  });

  const fragments: string[] = [];
  while (walker.nextNode() && fragments.join(" ").length < limit) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      fragments.push(node.textContent?.trim() ?? "");
    } else if (node instanceof HTMLElement) {
      if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(node.tagName)) {
        fragments.push(`\n${node.textContent?.trim() ?? ""}\n`);
      } else if (node.tagName === "IMG") {
        const alt = node.getAttribute("alt");
        if (alt) fragments.push(`[Image: ${alt}]`);
      }
    }
  }

  const text = fragments
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const html = root.innerHTML.slice(0, limit * 4);

  return {
    ...meta,
    text,
    html
  };
}
