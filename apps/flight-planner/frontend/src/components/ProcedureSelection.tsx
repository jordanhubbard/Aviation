import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Typography, Grid, ToggleButton, ToggleButtonGroup, Card, CardContent, List, ListItem, ListItemText } from '@mui/material';

const ProcedureSelection = ({ airportCode }) => {
  const [procedureType, setProcedureType] = useState('SID');
  const [procedures, setProcedures] = useState([]);
  const [selectedProcedure, setSelectedProcedure] = useState(null);

  useEffect(() => {
    if (airportCode) {
      fetch(`/api/procedures?airport=${airportCode}`)
        .then(response => response.json())
        .then(data => setProcedures(data));
    }
  }, [airportCode]);

  const handleProcedureChange = (event, value) => {
    setSelectedProcedure(value);
  };

  const handleProcedureTypeChange = (event, newType) => {
    setProcedureType(newType);
    // Fetch procedures based on the selected type
    if (airportCode) {
      fetch(`/api/procedures?airport=${airportCode}&type=${newType}`)
        .then(response => response.json())
        .then(data => setProcedures(data));
    }
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
      )}
    </Grid>
  );
};

export default ProcedureSelection;
