import { useState, useEffect } from 'react';
import { Alert, Autocomplete, TextField, Typography, Grid, ToggleButton, ToggleButtonGroup, Card, CardContent, List, ListItem, ListItemText } from '@mui/material';

export type Procedure = {
  name: string
  legs: Array<{ fix: string; altitude: number; course: number }>
}

type ProcedureType = 'SID' | 'STAR' | 'Approach'

const isProcedure = (value: unknown): value is Procedure => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Procedure>
  return typeof candidate.name === 'string' && Array.isArray(candidate.legs)
}

export const loadProcedures = async (
  airportCode: string,
  procedureType: ProcedureType,
  request: typeof fetch = fetch,
): Promise<Procedure[]> => {
  const params = new URLSearchParams({ airport: airportCode, type: procedureType })
  const response = await request(`/api/procedures?${params}`)
  if (!response.ok) throw new Error(`Procedures unavailable (HTTP ${response.status})`)

  const data: unknown = await response.json()
  if (!Array.isArray(data) || !data.every(isProcedure)) {
    throw new Error('Procedures response is not a valid list')
  }
  return data
}

type Props = {
  airportCode: string
}

const ProcedureSelection = ({ airportCode }: Props) => {
  const [procedureType, setProcedureType] = useState<ProcedureType>('SID');
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [proceduresUnavailable, setProceduresUnavailable] = useState(false);

  useEffect(() => {
    let active = true
    setSelectedProcedure(null)

    if (!airportCode) {
      setProcedures([])
      setProceduresUnavailable(false)
      return () => { active = false }
    }

    setProceduresUnavailable(false)
    void loadProcedures(airportCode, procedureType)
      .then((data) => {
        if (active) setProcedures(data)
      })
      .catch(() => {
        if (!active) return
        setProcedures([])
        setProceduresUnavailable(true)
      })

    return () => { active = false }
  }, [airportCode, procedureType]);

  const handleProcedureChange = (_event: React.SyntheticEvent, value: Procedure | null) => {
    setSelectedProcedure(value);
  };

  const handleProcedureTypeChange = (_event: React.MouseEvent, newType: ProcedureType | null) => {
    if (newType) setProcedureType(newType);
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <ToggleButtonGroup
          value={procedureType}
          exclusive
          onChange={handleProcedureTypeChange}
          aria-label="Procedure Type"
        >
          <ToggleButton value="SID" aria-label="SID">
            SID
          </ToggleButton>
          <ToggleButton value="STAR" aria-label="STAR">
            STAR
          </ToggleButton>
          <ToggleButton value="Approach" aria-label="Approach">
            Approach
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="h6">Select Procedure</Typography>
      </Grid>
      <Grid item xs={12}>
        <Autocomplete
          options={procedures}
          getOptionLabel={(option) => option.name}
          onChange={handleProcedureChange}
          renderInput={(params) => <TextField {...params} label="Procedure" variant="outlined" />}
        />
        {proceduresUnavailable ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            Procedures are unavailable for this airport.
          </Alert>
        ) : null}
      </Grid>
      {selectedProcedure && (
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6">Procedure Legs</Typography>
              <List>
                {selectedProcedure.legs.map((leg, index) => (
                  <ListItem key={index}>
                    <ListItemText primary={`${leg.fix} - ${leg.altitude} ft`} secondary={`Course: ${leg.course}°`} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      )}
        <Grid item xs={12}>
          <Typography variant="body1">Preview of procedure legs will be shown here.</Typography>
        </Grid>
    </Grid>
  );
};

export default ProcedureSelection;
