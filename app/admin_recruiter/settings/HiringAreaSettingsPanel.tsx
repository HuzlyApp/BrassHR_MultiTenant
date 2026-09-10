"use client";

import { useEffect, useState } from "react";
import { US_STATE_NAME_TO_CODE } from "@/lib/us-state-names";

type HiringArea = {
  mode: "locations_only" | "locations_plus_states" | "all_allowed_platform";
  extraAllowedStates: string[];
  locations: Array<{ city: string; state: string }>;
};

export default function HiringAreaSettingsPanel() {
  const [area, setArea] = useState<HiringArea | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/hiring-area")
      .then((res) => res.json())
      .then((payload) => setArea(payload as HiringArea))
      .catch(() => setArea(null));
  }, []);

  if (!area) return null;

  async function save() {
    if (!area) return;
    setSaving(true);
    const res = await fetch("/api/admin/hiring-area", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: area.mode,
        extraAllowedStates: area.extraAllowedStates,
      }),
    });
    setSaving(false);
    setMessage(res.ok ? "Saved." : "Could not save hiring area.");
  }

  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
      <h2 className="text-sm font-semibold text-[#1D2739]">Hiring area</h2>
      <p className="mt-1 text-sm text-[#64748B]">We hire and schedule work in these locations.</p>
      <ul className="mt-3 text-sm text-[#334155]">
        {area.locations.map((location) => (
          <li key={`${location.city}-${location.state}`}>
            {location.city}, {location.state}
          </li>
        ))}
        {area.locations.length === 0 ? <li>No locations added yet.</li> : null}
      </ul>
      <label className="mt-4 block text-sm text-[#64748B]">Also allow remote work in</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(US_STATE_NAME_TO_CODE).map(([name, code]) => {
          const checked = area.extraAllowedStates.includes(code);
          return (
            <button
              key={code}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs ${
                checked ? "border-[#012352] bg-[#F1F5F9]" : "border-[#CBD5E1] text-[#64748B]"
              }`}
              onClick={() => {
                const next = new Set(area.extraAllowedStates);
                if (checked) next.delete(code);
                else next.add(code);
                setArea({
                  ...area,
                  mode: next.size ? "locations_plus_states" : "locations_only",
                  extraAllowedStates: Array.from(next),
                });
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-4 h-10 rounded-lg bg-[#012352] px-4 text-sm text-white disabled:opacity-50"
        disabled={saving}
        onClick={() => void save()}
      >
        Save hiring area
      </button>
      {message ? <p className="mt-2 text-xs text-[#64748B]">{message}</p> : null}
    </section>
  );
}
