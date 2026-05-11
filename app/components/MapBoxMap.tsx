"use client"

import mapboxgl from "mapbox-gl"
import { useEffect, useRef } from "react"

// ✅ SET TOKEN
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// ✅ TYPES
type MarkerType = {
  lat: number
  lng: number
}

type MapProps = {
  center: [number, number]
  markers: MarkerType[]
}

export default function MapBoxMap({ center, markers }: MapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center,
      zoom: 10,
    })

    // ✅ ADD MARKERS (TYPED)
    markers.forEach((m: MarkerType) => {
      new mapboxgl.Marker()
        .setLngLat([m.lng, m.lat])
        .addTo(map)
    })

    return () => map.remove()
  }, [center, markers])

  return <div ref={mapRef} className="w-full h-full rounded-lg" />
}