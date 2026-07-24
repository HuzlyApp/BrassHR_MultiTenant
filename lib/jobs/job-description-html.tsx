/** Shared helpers for job description HTML vs plain text. */

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function jobDescriptionPlainText(value: string): string {
  const raw = value ?? "";
  if (!looksLikeHtml(raw)) return raw.trim();
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function JobDescriptionHtml({
  html,
  className = "",
  emptyLabel = "—",
}: {
  html: string;
  className?: string;
  emptyLabel?: string;
}) {
  const content = html.trim();
  if (!content) return <p className={className}>{emptyLabel}</p>;

  if (!looksLikeHtml(content)) {
    return <p className={`whitespace-pre-wrap ${className}`}>{content}</p>;
  }

  return (
    <div
      className={`job-description-html prose prose-sm max-w-none text-sm leading-6 text-slate-700 ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
