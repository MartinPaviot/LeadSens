"use client";

import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";

export const MARKDOWN_CLASS =
  "text-[13.5px] leading-relaxed prose prose-sm dark:prose-invert max-w-none " +
  "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
  "[&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 " +
  "[&_strong]:font-semibold [&_em]:italic " +
  "[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-medium " +
  "[&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground";

export function StreamingMarkdownText() {
  return <MarkdownTextPrimitive smooth className={MARKDOWN_CLASS} />;
}
