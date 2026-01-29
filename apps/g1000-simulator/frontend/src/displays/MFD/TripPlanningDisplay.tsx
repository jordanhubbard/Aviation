import { useMemo, useState } from 'react'

import { TelemetrySnapshot } from '../../hooks/useTelemetrySocket'
import { formatNumber } from '../PFD/formatters'

type TripPlanningDisplayProps = {
  telemetry: TelemetrySnapshot | null
}

const parseNumber = (value: string, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const formatHours = (hours: number) => {
  if (!Number.isFinite(hours) || hours <= 0) return '0:00'
  const totalMinutes = Math.round(hours * 60)
  const displayHours = Math.floor(totalMinutes / 60)
  const displayMinutes = totalMinutes % 60
  return `${displayHours}:${displayMinutes.toString().padStart(2, '0')}`
}

export const TripPlanningDisplay = ({ telemetry }: TripPlanningDisplayProps) => {
  const [distanceNm, setDistanceNm] = useState('120')
  const [groundSpeed, setGroundSpeed] = useState(
    telemetry?.gps.ground_speed_kt ? telemetry.gps.ground_speed_kt.toFixed(0) : '115',
  )
  const [fuelBurn, setFuelBurn] = useState('9.2')
  const [fuelOnBoard, setFuelOnBoard] = useState('46')
  const [reserveMinutes, setReserveMinutes] = useState('45')
  const [pressureAltitude, setPressureAltitude] = useState(
    telemetry?.adc.pressure_altitude_ft ? telemetry.adc.pressure_altitude_ft.toFixed(0) : '3500',
  )
  const [outsideTemp, setOutsideTemp] = useState(
    telemetry?.adc.oat_c ? telemetry.adc.oat_c.toFixed(0) : '15',
  )
  const [stations, setStations] = useState([
    { label: 'Pilot', arm: 37, weight: '180' },
    { label: 'Copilot', arm: 37, weight: '150' },
    { label: 'Rear Pax', arm: 73, weight: '120' },
    { label: 'Baggage', arm: 95, weight: '40' },
  ])

  const distanceValue = parseNumber(distanceNm)
  const speedValue = parseNumber(groundSpeed)
  const fuelBurnValue = parseNumber(fuelBurn)
  const fuelOnBoardValue = parseNumber(fuelOnBoard)
  const reserveValue = parseNumber(reserveMinutes)
  const timeHours = speedValue > 0 ? distanceValue / speedValue : 0
  const reserveHours = reserveValue / 60
  const fuelRequired = timeHours * fuelBurnValue + reserveHours * fuelBurnValue
  const fuelRemaining = fuelOnBoardValue - fuelRequired

  const wbTotals = useMemo(() => {
    const emptyWeight = 1650
    const emptyArm = 39
    const stationTotals = stations.reduce(
      (acc, station) => {
        const weightValue = parseNumber(station.weight)
        return {
          weight: acc.weight + weightValue,
          moment: acc.moment + weightValue * station.arm,
        }
      },
      { weight: 0, moment: 0 },
    )
    const totalWeight = emptyWeight + stationTotals.weight
    const totalMoment = emptyWeight * emptyArm + stationTotals.moment
    const cg = totalWeight > 0 ? totalMoment / totalWeight : 0
    return { totalWeight, totalMoment, cg }
  }, [stations])

  const densityAltitude = useMemo(() => {
    const pa = parseNumber(pressureAltitude)
    const temp = parseNumber(outsideTemp)
    const standardTemp = 15 - 0.00198 * pa
    return pa + 120 * (temp - standardTemp)
  }, [outsideTemp, pressureAltitude])

  const updateStation = (index: number, nextValue: string) => {
    setStations((prev) =>
      prev.map((station, stationIndex) =>
        stationIndex === index ? { ...station, weight: nextValue } : station,
      ),
    )
  }

  return (
    <div className="mfd__trip">
      <div className="mfd__trip-section">
        <h4 className="mfd__trip-title">Fuel Planning</h4>
        <div className="mfd__trip-grid">
          <label className="mfd__trip-field">
            <span>Distance (NM)</span>
            <input value={distanceNm} onChange={(event) => setDistanceNm(event.target.value)} />
          </label>
          <label className="mfd__trip-field">
            <span>Ground Speed (KT)</span>
            <input value={groundSpeed} onChange={(event) => setGroundSpeed(event.target.value)} />
          </label>
          <label className="mfd__trip-field">
            <span>Fuel Burn (GPH)</span>
            <input value={fuelBurn} onChange={(event) => setFuelBurn(event.target.value)} />
          </label>
          <label className="mfd__trip-field">
            <span>Fuel On Board (GAL)</span>
            <input value={fuelOnBoard} onChange={(event) => setFuelOnBoard(event.target.value)} />
          </label>
          <label className="mfd__trip-field">
            <span>Reserve (MIN)</span>
            <input value={reserveMinutes} onChange={(event) => setReserveMinutes(event.target.value)} />
          </label>
          <div className="mfd__trip-result">
            <span>ETE</span>
            <strong>{formatHours(timeHours)}</strong>
          </div>
          <div className="mfd__trip-result">
            <span>Fuel Required</span>
            <strong>{formatNumber(fuelRequired, ' gal', 1)}</strong>
          </div>
          <div className={`mfd__trip-result ${fuelRemaining < 0 ? 'mfd__trip-result--warn' : ''}`}>
            <span>Fuel Remaining</span>
            <strong>{formatNumber(fuelRemaining, ' gal', 1)}</strong>
          </div>
        </div>
      </div>

      <div className="mfd__trip-section">
        <h4 className="mfd__trip-title">Weight & Balance</h4>
        <div className="mfd__trip-grid mfd__trip-grid--weights">
          {stations.map((station, index) => (
            <label key={station.label} className="mfd__trip-field">
              <span>
                {station.label} ({station.arm} in)
              </span>
              <input value={station.weight} onChange={(event) => updateStation(index, event.target.value)} />
            </label>
          ))}
          <div className="mfd__trip-result">
            <span>Total Weight</span>
            <strong>{formatNumber(wbTotals.totalWeight, ' lb')}</strong>
          </div>
          <div className="mfd__trip-result">
            <span>CG</span>
            <strong>{wbTotals.cg.toFixed(1)} in</strong>
          </div>
        </div>
      </div>

      <div className="mfd__trip-section">
        <h4 className="mfd__trip-title">Density Altitude</h4>
        <div className="mfd__trip-grid">
          <label className="mfd__trip-field">
            <span>Pressure Alt (FT)</span>
            <input value={pressureAltitude} onChange={(event) => setPressureAltitude(event.target.value)} />
          </label>
          <label className="mfd__trip-field">
            <span>OAT (°C)</span>
            <input value={outsideTemp} onChange={(event) => setOutsideTemp(event.target.value)} />
          </label>
          <div className="mfd__trip-result">
            <span>Density Alt</span>
            <strong>{formatNumber(densityAltitude, ' ft')}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
