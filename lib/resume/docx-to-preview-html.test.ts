import { beforeEach, describe, expect, it, vi } from "vitest";

const convertToHtmlMock = vi.hoisted(() =>
  vi.fn(async () => ({ value: "<p>Jane Doe</p><p>Systems Engineer</p>" }))
);

vi.mock("mammoth", () => ({
  default: { convertToHtml: convertToHtmlMock },
}));

import {
  buildDocxResumePreviewHtml,
  wrapResumePreviewHtml,
  wordResumePreviewFallbackHtml,
} from "@/lib/resume/docx-to-preview-html";

describe("docx resume preview HTML", () => {
  beforeEach(() => {
    convertToHtmlMock.mockClear();
  });

  it("wraps converted Word HTML so the browser can render it inline", async () => {
    const html = await buildDocxResumePreviewHtml(Buffer.from("fake-docx"));
    expect(convertToHtmlMock).toHaveBeenCalledOnce();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<p>Jane Doe</p>");
    expect(html).toContain("charset");
  });

  it("keeps a document wrapper around body markup", () => {
    const html = wrapResumePreviewHtml("<p>Hello</p>");
    expect(html).toContain('<div class="resume-preview"><p>Hello</p></div>');
  });

  it("escapes fallback copy so a failed conversion still shows in the iframe", () => {
    const html = wordResumePreviewFallbackHtml('Cannot preview <script>alert("x")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
