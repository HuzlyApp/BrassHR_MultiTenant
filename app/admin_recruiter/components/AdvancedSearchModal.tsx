"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Search, X } from "lucide-react";
import MapBoxAdvanced from "@/app/components/MapboxAdvanced";

type Worker = {
  id: string;
  first_name: string;
  last_name: string;
  lat: number;
  lng: number;
  job_role: string;
  city?: string | null;
  state?: string | null;
  distance_meters?: number | null;
};

type MapboxFeature = {
  place_name: string;
  center: [number, number];
};

type DistanceUnit = "miles" | "km";

type AdvancedSearchModalProps = {
  open: boolean;
  onClose: () => void;
  onViewResults: (params: { lat: number; lng: number; radius: number; place?: string }) => void;
  initialParams?: { lat?: number; lng?: number; radius?: number; place?: string };
};

function parseMapboxFeature(input: unknown): MapboxFeature | null {
  if (input == null || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const place_name = r.place_name;
  const center = r.center;
  if (typeof place_name !== "string") return null;
  if (!Array.isArray(center) || center.length < 2) return null;
  const lng = Number(center[0]);
  const lat = Number(center[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { place_name, center: [lng, lat] };
}

function toMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return "Failed to fetch workers";
}

function parseWorker(input: unknown): Worker | null {
  if (input == null || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const id = r.id;
  const first_name = r.first_name;
  const last_name = r.last_name;
  const job_role = r.job_role;
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (typeof id !== "string") return null;
  if (typeof first_name !== "string") return null;
  if (typeof last_name !== "string") return null;
  if (typeof job_role !== "string") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id,
    first_name,
    last_name,
    job_role,
    lat,
    lng,
    city: typeof r.city === "string" ? r.city : r.city === null ? null : undefined,
    state: typeof r.state === "string" ? r.state : r.state === null ? null : undefined,
    distance_meters: typeof r.distance_meters === "number" ? r.distance_meters : null,
  };
}

function normalizeWorkersResponse(data: unknown): Worker[] {
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as { workers?: unknown })?.workers)
      ? (((data as { workers: unknown[] }).workers ?? []) as unknown[])
      : [];
  return arr.map(parseWorker).filter((w): w is Worker => w !== null);
}

export default function AdvancedSearchModal({
  open,
  onClose,
  onViewResults,
  initialParams,
}: AdvancedSearchModalProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [center, setCenter] = useState<[number, number]>([121.0437, 14.6760]);
  const [radiusMiles, setRadiusMiles] = useState<number>(10);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("miles");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const radiusInMiles = distanceUnit === "miles" ? radiusMiles : radiusMiles * 0.621371;

  useEffect(() => {
    if (!open) return;
    if (Number.isFinite(initialParams?.lng) && Number.isFinite(initialParams?.lat)) {
      setCenter([Number(initialParams?.lng), Number(initialParams?.lat)]);
    }
    if (Number.isFinite(initialParams?.radius) && Number(initialParams?.radius) > 0) {
      setRadiusMiles(Number(initialParams?.radius));
    }
    const place = (initialParams?.place ?? "").trim();
    setPlaceLabel(place);
    setPlaceQuery(place);
  }, [open, initialParams?.lat, initialParams?.lng, initialParams?.radius, initialParams?.place]);

  useEffect(() => {
    if (!open) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!initialParams?.lat || !initialParams?.lng) {
          setCenter([pos.coords.longitude, pos.coords.latitude]);
        }
      },
      () => {}
    );
  }, [open, initialParams?.lat, initialParams?.lng]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function run() {
      const q = placeQuery.trim();
      if (q.length < 3) {
        setSuggestions([]);
        return;
      }
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) return;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            q
          )}.json?access_token=${encodeURIComponent(token)}&autocomplete=true&limit=5`
        );
        const data = await res.json();
        if (cancelled) return;
        const features: unknown[] = Array.isArray((data as { features?: unknown })?.features)
          ? ((data as { features: unknown[] }).features ?? [])
          : [];
        const feats: MapboxFeature[] = features
          .map(parseMapboxFeature)
          .filter((v): v is MapboxFeature => v !== null);
        setSuggestions(feats);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [open, placeQuery]);

  const resultsHref = useMemo(() => "/admin_recruiter/candidates", []);

  async function searchWorkers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search-workers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: center[1],
          lng: center[0],
          radius: radiusInMiles,
          ...(placeLabel.trim() ? { place: placeLabel.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch workers");
      setWorkers(normalizeWorkersResponse(data));
    } catch (err) {
      setError(toMessage(err));
    }
    setLoading(false);
  }

  function reset() {
    setRadiusMiles(10);
    setDistanceUnit("miles");
    setWorkers([]);
    setError(null);
    setPlaceQuery("");
    setPlaceLabel("");
    setSuggestions([]);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:bg-black/20 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="advanced-search-title"
    >
      <div className="flex max-h-[92dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-t-[20px] border border-zinc-200 bg-white text-gray-600 shadow-xl sm:max-h-[90vh] sm:rounded-[20px]">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 sm:px-[28px] sm:py-4">
          <div
            id="advanced-search-title"
            className="text-lg font-semibold leading-7 text-[#1F2937] sm:text-2xl sm:leading-8"
          >
            Advanced Search
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white sm:h-[30px] sm:w-[30px]"
            aria-label="Close"
          >
            <X className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-[28px] sm:py-5">
          <div className="h-[220px] w-full overflow-hidden rounded-[8px] border border-zinc-200 sm:mx-auto sm:h-[314px] sm:max-w-[560px]">
            <MapBoxAdvanced
              center={center}
              workers={workers}
              radius={radiusInMiles}
              onCenterChange={(c) => setCenter(c)}
              interactive
              onMapError={(msg) => setMapError(msg)}
            />
          </div>

          <div className="w-full sm:mx-auto sm:max-w-[560px]">
            <div className="mb-2 text-sm font-normal leading-5 text-gray-700">Show me worker within</div>

            {/* Mobile — stacked fields */}
            <div className="flex flex-col gap-3 sm:hidden">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={radiusMiles}
                  min={1}
                  onChange={(e) => setRadiusMiles(Number(e.target.value))}
                  className="h-11 w-full rounded-[8px] border border-zinc-200 px-3 text-sm outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                  aria-label="Distance"
                />
                <select
                  value={distanceUnit}
                  onChange={(e) => setDistanceUnit(e.target.value as DistanceUnit)}
                  className="h-11 w-full rounded-[8px] border border-zinc-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                  aria-label="Distance unit"
                >
                  <option value="miles">Miles</option>
                  <option value="km">Kilometers</option>
                </select>
              </div>
              <div className="text-sm text-gray-500">of</div>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder="Search city or address"
                  className="h-11 w-full rounded-[8px] border border-zinc-200 pl-10 pr-10 text-sm outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                {suggestions.length > 0 ? (
                  <div className="absolute top-full z-10 mt-2 max-h-48 w-full overflow-y-auto rounded-[8px] border border-zinc-200 bg-white shadow-lg">
                    {suggestions.map((s) => (
                      <button
                        key={s.place_name}
                        onClick={() => {
                          setPlaceLabel(s.place_name);
                          setPlaceQuery(s.place_name);
                          setSuggestions([]);
                          setCenter([s.center[0], s.center[1]]);
                        }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-50"
                      >
                        {s.place_name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Desktop — single row */}
            <div className="hidden grid-cols-[94px_96px_28px_1fr] gap-3 sm:grid">
              <input
                type="number"
                value={radiusMiles}
                min={1}
                onChange={(e) => setRadiusMiles(Number(e.target.value))}
                className="h-11 w-full rounded-[8px] border border-zinc-200 px-4 text-sm outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              />
              <select
                value={distanceUnit}
                onChange={(e) => setDistanceUnit(e.target.value as DistanceUnit)}
                className="h-11 w-full rounded-[8px] border border-zinc-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
              >
                <option value="miles">Miles</option>
                <option value="km">Kilometers</option>
              </select>
              <div className="flex h-11 items-center justify-center text-sm text-gray-500">of</div>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder="Search city or address"
                  className="h-11 w-full rounded-[8px] border border-zinc-200 pl-10 pr-10 text-sm outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                {suggestions.length > 0 ? (
                  <div className="absolute top-full z-10 mt-2 w-full overflow-hidden rounded-[8px] border border-zinc-200 bg-white shadow-lg">
                    {suggestions.map((s) => (
                      <button
                        key={s.place_name}
                        onClick={() => {
                          setPlaceLabel(s.place_name);
                          setPlaceQuery(s.place_name);
                          setSuggestions([]);
                          setCenter([s.center[0], s.center[1]]);
                        }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-zinc-50"
                      >
                        {s.place_name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:mx-auto sm:max-w-[560px] sm:grid-cols-2">
            <button
              onClick={reset}
              className="h-11 rounded-[8px] border border-[#0D9488] px-4 text-sm font-semibold text-[#0D9488] hover:bg-teal-50"
            >
              Reset
            </button>
            <button
              onClick={searchWorkers}
              className="h-11 rounded-[8px] bg-[#0D9488] px-4 text-sm font-semibold text-white hover:bg-[#0B7F77]"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="text-center text-sm">
            Total: <span className="font-medium">{workers.length}</span> Results{" "}
            {placeLabel ? (
              <>
                found in <span className="font-medium">{placeLabel}</span>
              </>
            ) : null}
          </div>

          <div className="w-full sm:mx-auto sm:max-w-[560px]">
            <Link
              href={resultsHref}
              onClick={(e) => {
                e.preventDefault();
                onViewResults({
                  lat: center[1],
                  lng: center[0],
                  radius: radiusInMiles,
                  ...(placeLabel.trim() ? { place: placeLabel.trim() } : {}),
                });
              }}
              className="inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[#0D9488] px-4 text-sm font-semibold text-white hover:bg-[#0B7F77]"
            >
              View results
            </Link>
          </div>

          {mapError ? <div className="text-sm text-red-600">{mapError}</div> : null}
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
