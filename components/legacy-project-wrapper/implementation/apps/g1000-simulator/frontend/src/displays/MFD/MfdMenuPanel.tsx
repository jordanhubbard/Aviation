import { useMemo } from 'react'

import { MAP_RANGE_OPTIONS, useMfdStore } from '../../stores/mfdStore'
import type { MfdPage } from '../../stores/mfdStore'
import { useSoftkeyStore, useSoftkeyToggle } from '../../stores/softkeyStore'

export const MfdMenuPanel = () => {
  const activePage = useMfdStore((state) => state.activePage)
  const setActivePage = useMfdStore((state) => state.setActivePage)
  const mapRangeIndex = useMfdStore((state) => state.mapRangeIndex)
  const mapOrientation = useMfdStore((state) => state.mapOrientation)
  const stepRange = useMfdStore((state) => state.stepRange)
  const cycleOrientation = useMfdStore((state) => state.cycleOrientation)
  const setToggleState = useSoftkeyStore((state) => state.setToggleState)
  const terrainEnabled = useSoftkeyToggle('mfd', 'mfd-map-settings', 'terrain')
  const airspaceEnabled = useSoftkeyToggle('mfd', 'mfd-map-settings', 'airspace')
  const dataEnabled = useSoftkeyToggle('mfd', 'mfd-map-settings', 'data')
  const declutterEnabled = useSoftkeyToggle('mfd', 'mfd-map-settings', 'declutter')
  const windEnabled = useSoftkeyToggle('mfd', 'mfd-map-settings', 'wind')
  const lightningEnabled = useSoftkeyToggle('mfd', 'mfd-map-settings', 'ltng')
  const trafficEnabled = useSoftkeyToggle('mfd', 'mfd-map', 'traffic')
  const weatherEnabled = useSoftkeyToggle('mfd', 'mfd-map', 'weather')

  const mapRange = MAP_RANGE_OPTIONS[mapRangeIndex] ?? 20

  const toggles = [
    { id: 'terrain', menuId: 'mfd-map-settings', label: 'Terrain', state: terrainEnabled },
    { id: 'airspace', menuId: 'mfd-map-settings', label: 'Airspace', state: airspaceEnabled },
    { id: 'data', menuId: 'mfd-map-settings', label: 'Nav Data', state: dataEnabled },
    { id: 'declutter', menuId: 'mfd-map-settings', label: 'Declutter', state: declutterEnabled },
    { id: 'wind', menuId: 'mfd-map-settings', label: 'Winds', state: windEnabled },
    { id: 'ltng', menuId: 'mfd-map-settings', label: 'Lightning', state: lightningEnabled },
    { id: 'traffic', menuId: 'mfd-map', label: 'Traffic', state: trafficEnabled },
    { id: 'weather', menuId: 'mfd-map', label: 'Weather', state: weatherEnabled },
  ]

  const pageButtons = useMemo(
    () => [
      { id: 'map', label: 'Map' },
      { id: 'engine', label: 'Engine' },
      { id: 'nearest', label: 'Nearest' },
      { id: 'flight-plan', label: 'Flight Plan' },
      { id: 'procedures', label: 'Procedures' },
      { id: 'trip', label: 'Trip Planning' },
    ],
    [],
  )

  return (
    <div className="mfd__menu-panel">
      <div className="mfd__menu-section">
        <span className="mfd__menu-heading">Pages</span>
        <div className="mfd__menu-list">
          {pageButtons.map((page) => (
            <button
              key={page.id}
              type="button"
              className={`mfd__menu-item ${activePage === page.id ? 'mfd__menu-item--active' : ''}`}
              onClick={() => setActivePage(page.id as MfdPage)}
            >
              {page.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mfd__menu-section">
        <span className="mfd__menu-heading">Map Controls</span>
        <div className="mfd__menu-controls">
          <div>
            <span className="mfd__menu-label">Range</span>
            <div className="mfd__menu-control-row">
              <button type="button" onClick={() => stepRange(-1)}>
                -
              </button>
              <span>{mapRange} NM</span>
              <button type="button" onClick={() => stepRange(1)}>
                +
              </button>
            </div>
          </div>
          <div>
            <span className="mfd__menu-label">Orientation</span>
            <div className="mfd__menu-control-row">
              <button type="button" onClick={() => cycleOrientation(-1)}>
                ◀
              </button>
              <span>{mapOrientation.toUpperCase().replace('-', ' ')}</span>
              <button type="button" onClick={() => cycleOrientation(1)}>
                ▶
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mfd__menu-section">
        <span className="mfd__menu-heading">Map Layers</span>
        <div className="mfd__menu-list mfd__menu-list--toggle">
          {toggles.map((toggle) => (
            <button
              key={toggle.id}
              type="button"
              className={`mfd__menu-item ${toggle.state ? 'mfd__menu-item--active' : ''}`}
              onClick={() => setToggleState('mfd', toggle.menuId, toggle.id, !toggle.state)}
            >
              {toggle.label} {toggle.state ? 'ON' : 'OFF'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
