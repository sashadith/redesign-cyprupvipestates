"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { analyzeDeveloperFeed } from "@/app/admin/actions";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1B4B43]";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Analyzing…" : "Analyze source"}
    </button>
  );
}

const MODES = [
  { k: "file", label: "Upload XML file" },
  { k: "url", label: "Feed URL" },
  { k: "api", label: "API endpoint" },
] as const;

export default function AnalyzeForm({ developerAccountId }: { developerAccountId: string }) {
  const action = analyzeDeveloperFeed.bind(null, developerAccountId);
  const [state, formAction] = useFormState<{ error?: string } | null>(action as any, null);
  const [mode, setMode] = useState<"file" | "url" | "api">("file");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [authMethod, setAuthMethod] = useState<"bearer" | "x-api-key" | "custom">("bearer");

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
      <input type="hidden" name="mode" value={mode} />

      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.k}
            type="button"
            onClick={() => setMode(m.k)}
            className={`rounded-md px-3 py-1.5 text-sm border ${
              mode === m.k ? "bg-[#1B4B43] text-white border-[#1B4B43]" : "border-[#E5E7EB] text-[#111827] hover:bg-[#F8F9FA]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "file" && (
        <div>
          <label className="block text-sm mb-1">XML file (max 5 MB)</label>
          <input type="file" name="file" accept=".xml,text/xml,application/xml" className={input} />
        </div>
      )}

      {mode === "url" && (
        <div>
          <label className="block text-sm mb-1">XML feed URL</label>
          <input name="url" type="url" placeholder="https://developer.example/feed.xml" className={input} />
        </div>
      )}

      {mode === "api" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm mb-1">Base URL</label>
              <input name="baseUrl" type="url" placeholder="https://bbf.in.qubehub.ai" className={input} />
            </div>
            <div>
              <label className="block text-sm mb-1">Method</label>
              <select name="method" value={method} onChange={(e) => setMethod(e.target.value as any)} className={input}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Endpoint path</label>
            <input name="path" placeholder="/api/agent/v3/feed" className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Auth method</label>
              <select name="authMethod" value={authMethod} onChange={(e) => setAuthMethod(e.target.value as any)} className={input}>
                <option value="bearer">Bearer token</option>
                <option value="x-api-key">x-api-key header</option>
                <option value="custom">Custom header</option>
              </select>
            </div>
            {authMethod === "custom" && (
              <div>
                <label className="block text-sm mb-1">Custom header name</label>
                <input name="authHeaderName" placeholder="X-Auth-Token" className={input} />
              </div>
            )}
            <div>
              <label className="block text-sm mb-1">Credential ref (server env)</label>
              <input name="credentialRef" placeholder="BBF" className={input} />
              <p className="text-[11px] text-[#9CA3AF] mt-1">
                Reads <code>DEV_FEED_KEY_&lt;ref&gt;</code> from the server env. The key is never entered here, stored, or shown.
              </p>
            </div>
          </div>
          {method === "POST" && (
            <div>
              <label className="block text-sm mb-1">Request body (JSON, optional)</label>
              <textarea name="requestBody" rows={3} placeholder='{ "page": 1, "limit": 50 }' className={`${input} font-mono`} />
            </div>
          )}
          <div>
            <label className="block text-sm mb-1">Notes (optional)</label>
            <input name="notes" placeholder="e.g. BBF agent feed" className={input} />
          </div>
        </div>
      )}

      <Submit />
    </form>
  );
}
