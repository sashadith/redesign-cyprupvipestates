"use client";

import { useState, useTransition } from "react";
import { saveMapLocationAction } from "./actions";

export default function MapLocationField({
  developmentId,
  initialLat,
  initialLng,
}: {
  developmentId: string;
  initialLat: number | null;
  initialLng: number | null;
}) {
  const [text, setText] = useState(initialLat != null && initialLng != null ? `${initialLat}, ${initialLng}` : "");
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = () =>
    start(async () => {
      const r = await saveMapLocationAction(developmentId, text);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok && r.lat != null && r.lng != null) { setLat(r.lat); setLng(r.lng); }
    });

  return (
    <div>
      <label className="block text-xs font-medium text-[#6B7280] mb-1">
        Map location <span className="font-normal text-[#9CA3AF]">— paste a Google Maps link or &ldquo;lat, lng&rdquo;, then Analyze &amp; Save</span>
      </label>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://maps.google.com/…  or  34.7720, 32.4297"
          className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#1B4B43] focus:outline-none"
        />
        <button
          type="button"
          onClick={run}
          disabled={pending || !text.trim()}
          className="shrink-0 rounded-md bg-[#1B4B43] text-white text-sm font-medium px-3 py-2 hover:bg-[#142E2D] disabled:bg-[#D1D5DB] disabled:cursor-not-allowed whitespace-nowrap"
        >
          {pending ? "Analyzing…" : "Analyze & Save"}
        </button>
        {lat != null && lng != null && (
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md border border-[#E5E7EB] text-sm px-3 py-2 hover:bg-[#F8F9FA] whitespace-nowrap"
          >
            Open in Maps ↗
          </a>
        )}
      </div>
      {msg && <p className={`text-xs mt-1 ${msg.ok ? "text-[#166534]" : "text-[#C0392B]"}`}>{msg.text}</p>}
    </div>
  );
}
