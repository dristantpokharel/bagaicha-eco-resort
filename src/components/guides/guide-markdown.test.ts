import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuideMarkdown } from "./guide-markdown";

const html = (source: string) => renderToStaticMarkup(createElement(GuideMarkdown, { source }));

describe("GuideMarkdown", () => {
  it("renders headings, lists and internal links", () => {
    const out = html("# Top\n\n## Sub\n\n- a\n- b\n\n[Explore](/explore)");
    expect(out).not.toContain("<h1");
    expect(out).toContain("<h2");
    expect(out).toContain("<li>");
    expect(out).toContain('href="/explore"');
  });
  it("drops scripts and raw HTML", () => {
    const out = html("hi <script>alert(1)</script> <iframe src='https://x.test'></iframe> <img src=x onerror=alert(1)>");
    expect(out).not.toMatch(/<script|<iframe|onerror/);
  });
  it("blocks javascript: links", () => {
    expect(html("[x](javascript:alert(1))")).not.toContain("javascript:");
  });
  it("keeps Media library images and drops other image hosts", () => {
    const out = html("![ok](https://res.cloudinary.com/demo/image/upload/v1/a.jpg)\n\n![bad](https://evil.test/a.png)");
    expect(out).toContain("res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_1200/v1/a.jpg");
    expect(out).not.toContain("evil.test");
  });
  it("opens external links safely", () => {
    expect(html("[x](https://example.test)")).toContain('rel="noopener noreferrer"');
  });
});
