"use client"

import mapboxgl from "mapbox-gl"
import { useEffect, useMemo, useRef } from "react"
import * as turf from "@turf/turf"

// ✅ MAPBOX TOKEN
const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
if (!token) {
  // Avoid crashing `next build` when env vars are not present.
  // Map will error client-side if token truly missing at runtime.
  console.warn("Missing NEXT_PUBLIC_MAPBOX_TOKEN")
} else {
  mapboxgl.accessToken = token
}

// ==============================
// ✅ TYPES
// ==============================
type Worker = {
  id: string
  first_name: string
  last_name: string
  lat: number
  lng: number
  job_role: string
}

type Props = {
  center: [number, number]
  workers: Worker[]
  radius: number // miles
  onCenterChange?: (center: [number, number]) => void
  interactive?: boolean
  onMapError?: (message: string) => void
}

function mapboxErrorMessage(evt: unknown): string {
  if (evt == null || typeof evt !== "object") return "Map error"
  const r = evt as Record<string, unknown>
  const err = r.error
  if (err == null) return "Map error"
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  if (typeof err === "object") {
    const er = err as Record<string, unknown>
    if (typeof er.message === "string") return er.message
  }
  return String(err)
}

// ==============================
// ✅ COMPONENT
// ==============================
export default function MapBoxAdvanced({
  center,
  workers,
  radius,
  onCenterChange,
  interactive = true,
  onMapError,
}: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  const circleGeojson = useMemo(() => {
    return turf.circle(center, radius, { steps: 64, units: "miles" })
  }, [center, radius])

  const workersGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: "FeatureCollection",
      features: workers.map((w) => ({
        type: "Feature",
        properties: {
          id: w.id,
          name: `${w.first_name} ${w.last_name}`,
          role: w.job_role,
        },
        geometry: {
          type: "Point",
          coordinates: [w.lng, w.lat],
        },
      })),
    }
  }, [workers])

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstanceRef.current) return

    if (!mapboxgl.accessToken) {
      onMapError?.("Missing Mapbox access token")
    }

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center,
      zoom: 10,
    })

    map.on("error", (e) => {
      onMapError?.(mapboxErrorMessage(e))
    })

    map.on("load", () => {
      map.addSource("radius", {
        type: "geojson",
        data: circleGeojson,
      })

      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: "radius",
        paint: {
          "fill-color": "#0CC8B0",
          "fill-opacity": 0.15,
        },
      })

      map.addLayer({
        id: "radius-outline",
        type: "line",
        source: "radius",
        paint: {
          "line-color": "#0CC8B0",
          "line-width": 2,
        },
      })

      // =============================
      // ✅ WORKERS GEOJSON
      // =============================
      // =============================
      // ✅ SOURCE WITH CLUSTER
      // =============================
      map.addSource("workers", {
        type: "geojson",
        data: workersGeojson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      })

      // =============================
      // ✅ CLUSTER LAYER
      // =============================
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "workers",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0CC8B0",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20,
            10,
            25,
            30,
            30,
          ],
        },
      })

      // =============================
      // ✅ CLUSTER COUNT
      // =============================
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "workers",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
        },
      })

      // =============================
      // ✅ SINGLE POINTS
      // =============================
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "workers",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#0AAE9E",
          "circle-radius": 8,
        },
      })

      // =============================
      // ✅ POPUP (CLICK MARKER)
      // =============================
      map.on("click", "unclustered-point", (e) => {
        const feature = e.features?.[0]
        if (!feature) return

        const geometry = feature.geometry as GeoJSON.Point
        const coords = geometry.coordinates as [number, number]

        const props = feature.properties as {
          name: string
          role: string
        }

        new mapboxgl.Popup()
          .setLngLat(coords)
          .setHTML(`
            <div style="font-size:14px">
              <strong>${props.name}</strong><br/>
              ${props.role}
            </div>
          `)
          .addTo(map)
      })

      // =============================
      // ✅ CLUSTER CLICK (ZOOM)
      // =============================
      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        })

        if (!features.length) return

        const feature = features[0]

        const clusterId = feature.properties?.cluster_id as number

        const source = map.getSource("workers") as mapboxgl.GeoJSONSource

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom === undefined) return

          const geometry = feature.geometry as GeoJSON.Point
          const coordinates = geometry.coordinates as [number, number]

          map.easeTo({
            center: coordinates,
            zoom: 10,
          })
        })
      })

      // =============================
      // ✅ CURSOR POINTER
      // =============================
      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer"
      })

      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = ""
      })
    })

    // Center marker
    const marker = new mapboxgl.Marker({ draggable: interactive })
      .setLngLat(center)
      .addTo(map)

    if (interactive) {
      marker.on("dragend", () => {
        const ll = marker.getLngLat()
        onCenterChange?.([ll.lng, ll.lat])
      })

      map.on("click", (e) => {
        marker.setLngLat(e.lngLat)
        onCenterChange?.([e.lngLat.lng, e.lngLat.lat])
      })
    }

    markerRef.current = marker
    mapInstanceRef.current = map

    return () => {
      marker.remove()
      map.remove()
      markerRef.current = null
      mapInstanceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update sources + marker when props change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const radiusSource = map.getSource("radius") as mapboxgl.GeoJSONSource | undefined
    radiusSource?.setData(circleGeojson as unknown as GeoJSON.Feature)

    const workersSource = map.getSource("workers") as mapboxgl.GeoJSONSource | undefined
    workersSource?.setData(workersGeojson as unknown as GeoJSON.FeatureCollection)

    markerRef.current?.setLngLat(center)
    map.easeTo({ center })
  }, [center, circleGeojson, workersGeojson])

  return <div ref={mapRef} className="w-full h-full rounded-xl" />
}