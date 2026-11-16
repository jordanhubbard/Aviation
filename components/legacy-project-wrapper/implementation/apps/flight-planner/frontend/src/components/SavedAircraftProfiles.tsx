import { useEffect, useState } from 'react'
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { AIRCRAFT_STORAGE_KEY, AircraftProfileConflict, aircraftWriterAvailable, normalizeRegistration, readSavedAircraft, removeAircraft, saveAircraft, validateSavedAircraft, type SavedAircraft } from '../services/aircraftProfiles'

type Props = {
  cruiseSpeedKt: number
  fuelBurnGph: number
  fuelOnBoardGal: number
  disabled: boolean
  onSelect: (aircraft: SavedAircraft) => void
}
export default function SavedAircraftProfiles(props: Props) {
  const [aircraft, setAircraft] = useState<SavedAircraft[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [registration, setRegistration] = useState('')
  const [speed, setSpeed] = useState('')
  const [burn, setBurn] = useState('')
  const [fuel, setFuel] = useState('')
  const [formError, setFormError] = useState('')
  const [editingAircraft, setEditingAircraft] = useState<SavedAircraft | null>(null)
  const current = aircraft.find(item => item.registration === selected) ?? null

  useEffect(() => {
    const refresh = () => {
      try { setAircraft(readSavedAircraft(window.localStorage)); setStorageReady(true); setError('') }
      catch { setStorageReady(false); setError('Saved aircraft could not be read. Existing data was kept; flight inputs are still editable.') }
    }
    const changed = (event: StorageEvent) => { if (event.key === AIRCRAFT_STORAGE_KEY || event.key === null) refresh() }
    refresh(); window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])

  const edit = () => {
    setEditingAircraft(current ? { ...current } : null)
    setRegistration(current?.registration ?? '')
    setSpeed(String(props.cruiseSpeedKt)); setBurn(String(props.fuelBurnGph)); setFuel(String(props.fuelOnBoardGal))
    setFormError(''); setOpen(true)
  }
  const save = async () => {
    if (saving) return
    let value: SavedAircraft
    try {
      if (![speed, burn, fuel].every(text => text.trim() !== '')) throw new Error('Fill in all three planning values.')
      value = validateSavedAircraft({ registration: normalizeRegistration(registration), cruiseSpeedKt: Number(speed), fuelBurnGph: Number(burn), fuelOnBoardGal: Number(fuel) })
    } catch (failure) { setFormError(failure instanceof Error ? failure.message : 'Check the aircraft values.'); return }
    let next: SavedAircraft[]
    setSaving(true)
    try { next = await saveAircraft(window.localStorage, value, editingAircraft?.registration === value.registration ? editingAircraft : null) }
    catch (failure) { setFormError(failure instanceof AircraftProfileConflict ? failure.message : 'Could not save this aircraft in this browser. Your edits are still in this form.'); return }
    finally { setSaving(false) }
    setAircraft(next); setSelected(value.registration); setOpen(false); setError(''); props.onSelect(value)
  }
  const remove = async () => {
    if (saving || !editingAircraft) return
    setSaving(true)
    try { setAircraft(await removeAircraft(window.localStorage, editingAircraft)); setSelected(null); setOpen(false); setError('') }
    catch (failure) { setFormError(failure instanceof AircraftProfileConflict ? failure.message : 'Could not remove this saved aircraft. Existing data was kept.') }
    finally { setSaving(false) }
  }
  return <Stack spacing={1}>
    <Typography variant="subtitle2">Your aircraft</Typography>
    <Typography variant="caption">Saved only in this browser. Values are your planning preferences; check fuel on board for each flight.</Typography>
    {!aircraftWriterAvailable() && <Alert severity="info">Saving aircraft requires secure cross-window storage support in this browser. Flight inputs remain available.</Alert>}
    {error && <Alert severity="warning">{error}</Alert>}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <Autocomplete fullWidth options={aircraft} value={current} getOptionLabel={item => item.registration}
        isOptionEqualToValue={(a, b) => a.registration === b.registration} disabled={props.disabled || !storageReady}
        onChange={(_event, value) => { setSelected(value?.registration ?? null); if (value) props.onSelect(value) }}
        renderInput={params => <TextField {...params} label="Saved aircraft (this browser)" placeholder="Choose a registration" />} />
      <Button variant="outlined" onClick={edit} disabled={props.disabled || !storageReady || !aircraftWriterAvailable()}>Save aircraft</Button>
    </Stack>
    {current && (current.cruiseSpeedKt !== props.cruiseSpeedKt || current.fuelBurnGph !== props.fuelBurnGph || current.fuelOnBoardGal !== props.fuelOnBoardGal) &&
      <Typography variant="caption">This flight has planning values that differ from the saved aircraft.</Typography>}
    <Dialog open={open} onClose={() => { if (!saving) setOpen(false) }} fullWidth maxWidth="sm">
      <DialogTitle>Save aircraft planning values</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Typography variant="body2">Enter the values you want to reuse. Saving a registration does not look up aircraft-specific performance or limitations.</Typography>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField disabled={saving} autoFocus label="Aircraft registration" value={registration} onChange={e => setRegistration(e.target.value)} inputProps={{ maxLength: 16 }} />
        <TextField disabled={saving} label="Saved cruise speed (kt)" type="number" value={speed} onChange={e => setSpeed(e.target.value)} inputProps={{ min: 0.1, max: 1000, step: 0.1 }} />
        <TextField disabled={saving} label="Saved fuel burn (US gal/h)" type="number" value={burn} onChange={e => setBurn(e.target.value)} inputProps={{ min: 0.1, max: 5000, step: 0.1 }} />
        <TextField disabled={saving} label="Saved fuel on board (US gal)" type="number" value={fuel} onChange={e => setFuel(e.target.value)} inputProps={{ min: 0, max: 50000, step: 0.1 }} />
      </Stack></DialogContent>
      <DialogActions>
        {editingAircraft && <Button color="error" onClick={remove} disabled={saving || registration.trim().toUpperCase() !== editingAircraft.registration}>Remove {editingAircraft.registration}</Button>}
        <Button disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={saving} onClick={save} variant="contained">Save and use aircraft</Button>
      </DialogActions>
    </Dialog>
  </Stack>
}
