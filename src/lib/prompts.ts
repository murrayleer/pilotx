import type { GenerateParams } from "@types";

type SummarizeOptions = {
  pageTitle: string;
  url: string;
  wordLimit?: number;
  tone?: string;
  language?: string;
};

type QAOptions = {
  question: string;
  language?: string;
};

type RewriteOptions = {
  goal: string;
  audience?: string;
  language?: string;
};

type EmailOptions = {
  receiver?: string;
  language?: string;
};

type MeetingOptions = {
  language?: string;
};

export const promptTemplates = {
  summarize({ pageTitle, url, wordLimit = 200, tone = "neutral", language = "English" }: SummarizeOptions): string {
    return `You are PilotX, an accurate researcher. Summarize the current page titled "${pageTitle}" (${url}). Provide:
1. Key bullet points (max 6)
2. TL;DR (<= ${wordLimit} words)
3. Structured outline with headings when available.
Maintain a ${tone} tone and reply in ${language}. Never fabricate facts and mention when context is missing.`;
  },
  qa({ question, language = "English" }: QAOptions): string {
    return `Answer the question using ONLY the provided context. If the answer is not present, say you are unsure.
Question: ${question}
Reply in ${language}.`;
  },
  rewrite({ goal, audience = "general", language = "English" }: RewriteOptions): string {
    return `Rewrite the provided text for ${audience}. Goal: ${goal}. Keep factual accuracy and reply in ${language}.`;
  },
  emailDraft({ receiver = "the recipient", language = "English" }: EmailOptions): string {
    return `Draft a concise email to ${receiver}. Include subject and body. Keep it courteous, clear, and in ${language}.`;
  },
  meetingMinutes({ language = "English" }: MeetingOptions): string {
    return `Summarize the notes as meeting minutes. Provide agenda, decisions, action items, and open questions. Respond in ${language}.`;
  }
};

export function buildParams(prompt: string, context?: string, overrides: Partial<GenerateParams> = {}): GenerateParams {
  return {
    prompt,
    context,
    stream: true,
    ...overrides
  };
}
