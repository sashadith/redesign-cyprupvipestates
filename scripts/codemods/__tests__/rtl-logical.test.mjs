import { test } from "node:test";
import assert from "node:assert/strict";
import { transformCss } from "../rtl-logical.mjs";

test("margin-left / padding-right become logical inline properties", () => {
  assert.equal(transformCss("margin-left: auto;"), "margin-inline-start: auto;");
  assert.equal(transformCss("padding-right: 10px;"), "padding-inline-end: 10px;");
});

test("margin/padding shorthands are left untouched", () => {
  assert.equal(transformCss(".x { margin: 0 auto; }"), ".x { margin: 0 auto; }");
  assert.equal(transformCss(".x { padding: 4px 8px 4px 8px; }"), ".x { padding: 4px 8px 4px 8px; }");
});

test("border-left/right (with or without a suffix) become border-inline-start/end", () => {
  assert.equal(transformCss("border-left-color: red;"), "border-inline-start-color: red;");
  assert.equal(transformCss("border-right-width: 2px;"), "border-inline-end-width: 2px;");
  assert.equal(transformCss("border-left: 1px solid red;"), "border-inline-start: 1px solid red;");
});

test("border-radius corners are never touched", () => {
  assert.equal(transformCss(".x { border-top-left-radius: 4px; }"), ".x { border-top-left-radius: 4px; }");
  assert.equal(transformCss(".x { border-bottom-right-radius: 4px; }"), ".x { border-bottom-right-radius: 4px; }");
});

test("text-align left/right become start/end", () => {
  assert.equal(transformCss("text-align: right;"), "text-align: end;");
  assert.equal(transformCss("text-align: left;"), "text-align: start;");
});

test("float left/right become inline-start/inline-end", () => {
  assert.equal(transformCss("float: left;"), "float: inline-start;");
  assert.equal(transformCss("float: right;"), "float: inline-end;");
});

test("bare left:/right: physical offsets are never touched", () => {
  assert.equal(transformCss(".x { left: 0; }"), ".x { left: 0; }");
  assert.equal(transformCss(".x { right: 10px; }"), ".x { right: 10px; }");
});

test("background-position and translateX are never touched", () => {
  assert.equal(transformCss(".x { background-position: right center; }"), ".x { background-position: right center; }");
  assert.equal(transformCss(".x { transform: translateX(-50%); }"), ".x { transform: translateX(-50%); }");
});

test("SCSS nested blocks are preserved structurally", () => {
  const src = `.card {\n  margin-left: 8px;\n  &:hover {\n    border-right-color: blue;\n  }\n}\n`;
  const expected = `.card {\n  margin-inline-start: 8px;\n  &:hover {\n    border-inline-end-color: blue;\n  }\n}\n`;
  assert.equal(transformCss(src), expected);
});

test("multiple declarations in one rule are all converted", () => {
  const src = "margin-left:0;margin-right:0;";
  const expected = "margin-inline-start:0;margin-inline-end:0;";
  assert.equal(transformCss(src), expected);
});
