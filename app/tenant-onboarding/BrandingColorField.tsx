"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { isValidBrandingHex } from "@/lib/tenant/branding-validation";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

type Hsv = { h: number; s: number; v: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function normalizeHex(raw: string): string | null {
  const trimmed = raw.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!isValidBrandingHex(withHash)) return null;
  return withHash.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function hexToHsv(hex: string): Hsv {
  const rgb = hexToRgb(hex) ?? { r: 188, g: 139, b: 65 };
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

function hsvToHex(hsv: Hsv): string {
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function hueCss(h: number): string {
  const { r, g, b } = hsvToRgb(h, 1, 1);
  return `rgb(${r}, ${g}, ${b})`;
}

type BrandingColorFieldProps = {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (hex: string) => void;
};

export default function BrandingColorField({
  label,
  value,
  defaultValue,
  onChange,
}: BrandingColorFieldProps) {
  const pickerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState(value.toUpperCase());
  const [rgbInput, setRgbInput] = useState(() => {
    const rgb = hexToRgb(value) ?? { r: 0, g: 0, b: 0 };
    return { r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) };
  });

  const syncFromHex = (hex: string) => {
    const normalized = normalizeHex(hex) ?? normalizeHex(defaultValue) ?? "#BC8B41";
    const nextHsv = hexToHsv(normalized);
    const rgb = hexToRgb(normalized)!;
    setDraft(normalized);
    setHsv(nextHsv);
    setHexInput(normalized);
    setRgbInput({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) });
  };

  const syncFromHsv = (next: Hsv) => {
    const hex = hsvToHex(next);
    const rgb = hsvToRgb(next.h, next.s, next.v);
    setHsv(next);
    setDraft(hex);
    setHexInput(hex);
    setRgbInput({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) });
  };

  useEffect(() => {
    if (open) return;
    syncFromHex(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only mirror external value when closed
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        syncFromHex(value);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        syncFromHex(value);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const openPicker = () => {
    syncFromHex(value);
    setOpen(true);
  };

  const updateSvFromPointer = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    syncFromHsv({ ...hsv, s, v });
  };

  const updateHueFromPointer = (clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 359.999);
    syncFromHsv({ ...hsv, h });
  };

  const bindDrag = (
    onMove: (event: PointerEvent) => void
  ) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    onMove(event.nativeEvent);
    const move = (e: PointerEvent) => onMove(e);
    const up = () => {
      target.releasePointerCapture(event.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const commitHexInput = () => {
    const normalized = normalizeHex(hexInput);
    if (normalized) syncFromHex(normalized);
    else setHexInput(draft);
  };

  const commitRgbChannel = (channel: "r" | "g" | "b") => {
    const r = clamp(Number.parseInt(rgbInput.r, 10) || 0, 0, 255);
    const g = clamp(Number.parseInt(rgbInput.g, 10) || 0, 0, 255);
    const b = clamp(Number.parseInt(rgbInput.b, 10) || 0, 0, 255);
    syncFromHex(rgbToHex(r, g, b));
  };

  return (
    <div ref={rootRef} className="relative block">
      <span className="mb-[8px] block text-[13px] font-medium text-[#475569]" style={interStyle}>
        {label}
      </span>
      <div className="flex items-center gap-3 rounded-[10px] border border-[#e2e8f0] bg-white p-3">
        <button
          type="button"
          aria-label={`Edit ${label} color`}
          aria-expanded={open}
          aria-controls={pickerId}
          onClick={() => (open ? setOpen(false) : openPicker())}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-md border border-[#cbd5e1] shadow-sm"
          style={{ backgroundColor: value }}
        />
        <span className="font-mono text-[12px] uppercase text-[#64748b]" style={interStyle}>
          {value}
        </span>
      </div>

      {open ? (
        <div
          id={pickerId}
          role="dialog"
          aria-label={`${label} color picker`}
          className="absolute bottom-[calc(100%+14px)] left-1/2 z-40 w-[min(100vw-2rem,292px)] -translate-x-1/2 rounded-[16px] border border-[#e8edf4] bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
        >
          <div
            ref={svRef}
            className="relative h-[168px] w-full cursor-crosshair touch-none overflow-hidden rounded-[12px]"
            style={{
              backgroundImage: `
                linear-gradient(to top, #000, transparent),
                linear-gradient(to right, #fff, ${hueCss(hsv.h)})
              `,
            }}
            onPointerDown={bindDrag((e) => updateSvFromPointer(e.clientX, e.clientY))}
          >
            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.25)]"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                backgroundColor: draft,
              }}
            />
          </div>

          <div
            ref={hueRef}
            className="relative mt-3 h-[14px] w-full cursor-pointer touch-none rounded-full"
            style={{
              background:
                "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
            }}
            onPointerDown={bindDrag((e) => updateHueFromPointer(e.clientX))}
          >
            <span
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(15,23,42,0.35)]"
              style={{
                left: `${(hsv.h / 360) * 100}%`,
                backgroundColor: hueCss(hsv.h),
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {(
              [
                { key: "hex", label: "Hex", value: hexInput },
                { key: "r", label: "R", value: rgbInput.r },
                { key: "g", label: "G", value: rgbInput.g },
                { key: "b", label: "B", value: rgbInput.b },
              ] as const
            ).map((field) => (
              <label key={field.key} className="min-w-0">
                <span className="mb-1 block text-[11px] font-semibold text-[#0f172a]" style={interStyle}>
                  {field.label}
                </span>
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (field.key === "hex") setHexInput(next);
                    else setRgbInput((prev) => ({ ...prev, [field.key]: next }));
                  }}
                  onBlur={() => {
                    if (field.key === "hex") commitHexInput();
                    else commitRgbChannel(field.key);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (field.key === "hex") commitHexInput();
                      else commitRgbChannel(field.key);
                    }
                  }}
                  className="h-9 w-full rounded-[8px] border border-[#e2e8f0] bg-white px-2 text-[12px] text-[#0f172a] outline-none focus:border-[#012352]"
                  style={interStyle}
                />
              </label>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => syncFromHex(defaultValue)}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-[#012352] bg-white px-2 text-[13px] font-semibold text-[#012352] transition hover:bg-[#f8fafc]"
              style={interStyle}
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} />
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              className="to-on-brand inline-flex h-10 cursor-pointer items-center justify-center rounded-[10px] bg-[#012352] px-2 text-[13px] font-semibold text-white transition hover:brightness-110"
              style={interStyle}
            >
              Save Changes
            </button>
          </div>

          <span
            className="pointer-events-none absolute left-1/2 top-full -mt-px h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-[#e8edf4] bg-white"
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  );
}
