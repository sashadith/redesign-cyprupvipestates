import { test } from "node:test";
import assert from "node:assert/strict";
import { contentBlocksToMarkdown, extractSources } from "@/lib/blog/blocksToMarkdown";

const span = (text: string, marks: string[] = []) => ({ _type: "span", text, marks });
const block = (style: string, children: any[], extra: any = {}) => ({ _type: "block", style, children, markDefs: [], ...extra });

const blocks = [
  { _type: "textContent", content: [
    block("h2", [span("Buying costs")]),
    block("normal", [span("Transfer fees are "), span("set by law", ["strong"]), span(" — see "), span("the Land Registry", ["l1"]), span(".")], { markDefs: [{ _key: "l1", _type: "link", href: "https://www.moi.gov.cy/dls" }] }),
    block("normal", [span("Also "), span("our guide", ["l2"]), span(" and "), span("LinkedIn", ["l3"])], { markDefs: [{ _key: "l2", _type: "link", href: "https://cyprusvipestates.com/blog/other" }, { _key: "l3", _type: "link", href: "https://www.linkedin.com/company/cve" }] }),
    block("normal", [span("First")], { listItem: "bullet", level: 1 }),
    block("normal", [span("Second")], { listItem: "bullet", level: 1 }),
    block("normal", [span("Step one")], { listItem: "number", level: 1 }),
    block("blockquote", [span("A quote")]),
    { _type: "image", asset: { _ref: "image-abc123-800x600-jpg" }, alt: "Paphos" },
  ] },
  { _type: "tableBlock", columns: ["Price", "Fee"], rows: [{ cells: ["€300,000", "3%"] }, { cells: ["€500,000 | more", "5%"] }] },
  { _type: "faqBlock", faq: { items: [{ question: "Is VAT due?", answer: [block("normal", [span("Yes, 19% on new builds; see "), span("PwC", ["f1"])], { markDefs: [{ _key: "f1", _type: "link", href: "https://www.pwc.com.cy/tax" }] })] }, { question: "", answer: "ignored" }] } },
  { _type: "doubleTextBlock", leftContent: { blockContent: { content: [block("h3", [span("Left")])] } }, rightContent: { type: "image", image: { asset: { url: "/uploads/images/x.jpg" }, alt: "Right" } } },
  { _type: "imageFullBlock", title: "Hero", imageMain: { picture: { alt: "", asset: { _ref: "image-def456-1600x900-webp" } } } },
  { _type: "buttonBlock", buttonText: "Contact us", url: "https://cyprusvipestates.com/contact" },
  { _type: "textContent", content: [block("h2", [span("Sources")]), block("normal", [span("Report", ["s1"])], { markDefs: [{ _key: "s1", _type: "link", href: "https://www.moi.gov.cy/dls#top" }] })] },
];

test("renders headings, marks, links, lists, quotes, images, tables, FAQ and double blocks as clean Markdown", () => {
  const { markdown } = contentBlocksToMarkdown(blocks);
  assert.match(markdown, /^## Buying costs\n/);
  assert.ok(markdown.includes("Transfer fees are **set by law** — see [the Land Registry](https://www.moi.gov.cy/dls)."));
  assert.ok(markdown.includes("- First\n- Second\n\n1. Step one"));
  assert.ok(markdown.includes("> A quote"));
  assert.ok(markdown.includes("![Paphos](/uploads/images/abc123-800x600.jpg)"));
  assert.ok(markdown.includes("| Price | Fee |\n| --- | --- |\n| €300,000 | 3% |\n| €500,000 \\| more | 5% |"));
  assert.ok(markdown.includes("### Is VAT due?\n\nYes, 19% on new builds; see [PwC](https://www.pwc.com.cy/tax)"));
  assert.ok(markdown.includes("### Left"));
  assert.ok(markdown.includes("![Right](/uploads/images/x.jpg)"));
  assert.ok(markdown.includes("![Hero](/uploads/images/def456-1600x900.webp)"));
  assert.ok(!markdown.includes("Contact us"));
  assert.ok(!/<[a-z]/i.test(markdown), "no HTML tags");
});

test("sources are external links only, deduplicated by URL, with text and section; own domain and social profiles excluded", () => {
  const { links, wordCount } = contentBlocksToMarkdown(blocks);
  const { sources, internalLinks } = extractSources(links);
  assert.deepEqual(sources, [
    { text: "the Land Registry", url: "https://www.moi.gov.cy/dls", section: "Buying costs" },
    { text: "PwC", url: "https://www.pwc.com.cy/tax", section: "Buying costs" },
  ]);
  assert.deepEqual(internalLinks, [{ text: "our guide", url: "https://cyprusvipestates.com/blog/other", section: "Buying costs" }]);
  assert.ok(wordCount > 20);
});

test("empty or non-array content yields empty output, not a throw", () => {
  assert.deepEqual(contentBlocksToMarkdown(null), { markdown: "", links: [], wordCount: 0 });
  assert.deepEqual(contentBlocksToMarkdown([{ _type: "textContent", content: [] }]).markdown, "");
});
