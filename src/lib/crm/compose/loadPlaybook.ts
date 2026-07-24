// Reads the playbook markdown files from disk at request time rather than
// bundling them into the JS build — so tone/rules can be tweaked without a
// full deploy (edit the file directly on the release directory; that edit
// survives until the NEXT deploy, which re-checks-out the tree from git —
// commit the change too if it should stick). This works because the app
// runs as a persistent Node process from a full source checkout on the VPS
// (release-directory + symlink model, see DEPLOYMENT.md), not a serverless
// bundle that would prune unreferenced files — `process.cwd()` always
// resolves to the live release root, which still has the full repo tree
// post-build.
import fs from "node:fs";
import path from "node:path";
import type { LeadState } from "./leadState";

const PLAYBOOK_DIR = path.join(process.cwd(), "src/lib/crm/compose/playbook");

function readFile(name: string): string {
  try {
    return fs.readFileSync(path.join(PLAYBOOK_DIR, name), "utf8");
  } catch {
    return ""; // missing file degrades gracefully rather than crashing generation
  }
}

const BY_STATE_HEADING: Record<LeadState, string> = {
  NEW: "## NEW — first response",
  CONTACTED_FRESH: "## CONTACTED — fresh (recent contact, still an open thread)",
  CONTACTED_COLD: "## CONTACTED — cold (monday.com import backlog, often months old)",
  PRESENTATION_UNOPENED: "## Presentation sent, never opened",
  PRESENTATION_OPENED_NO_REACTION: "## Presentation opened, no reaction since",
};

const BY_LANGUAGE_HEADING: Record<string, string> = {
  de: "## German (de)",
  ru: "## Russian (ru)",
  en: "## English (en)",
  pl: "## Polish (pl)",
};

/** Pull just the section under one `## Heading` up to the next `## `, from a whole markdown file's text. */
function extractSection(fullText: string, heading: string): string {
  const start = fullText.indexOf(heading);
  if (start === -1) return "";
  const rest = fullText.slice(start);
  const nextHeadingIdx = rest.indexOf("\n## ", heading.length);
  return (nextHeadingIdx === -1 ? rest : rest.slice(0, nextHeadingIdx)).trim();
}

export function loadPlaybook(state: LeadState, language: string): {
  voice: string;
  psychology: string;
  antiSlop: string;
  callOffer: string;
  byState: string;
  byLanguage: string;
  examples: string;
} {
  const byStateFull = readFile("by-state.md");
  const byLanguageFull = readFile("by-language.md");
  const lang = BY_LANGUAGE_HEADING[language] ? language : "en";

  return {
    voice: readFile("voice.md"),
    psychology: readFile("psychology.md"),
    antiSlop: readFile("anti-slop.md"),
    callOffer: readFile("call-offer.md"),
    byState: extractSection(byStateFull, BY_STATE_HEADING[state]) || byStateFull,
    byLanguage: extractSection(byLanguageFull, BY_LANGUAGE_HEADING[lang]) || byLanguageFull,
    examples: readFile("examples.md"),
  };
}
