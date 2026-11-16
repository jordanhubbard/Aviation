import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function Fit({ bounds }: { bounds: number[] }) {
  const map = useMap()
  useEffect(() => {
    const [west, south, east, north] = bounds
    map.fitBounds(
      [
        [south, west],
        [north, east < west ? east + 360 : east],
      ],
      { padding: [8, 8] },
    )
  }, [bounds, map])
  return null
}

export default function ChartMap({ url, bounds }: { url: string; bounds: number[] }) {
  return (
    <MapContainer center={[37, -122]} zoom={7} style={{ height: 500, width: '100%', zIndex: 0 }}>
      <TileLayer url={url} maxZoom={16} attribution="FAA aeronautical charts" />
      <Fit bounds={bounds} />
    </MapContainer>
  )
}
