import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Typography, Grid } from '@mui/material';

const ProcedureSelection = ({ airportCode }) => {
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

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
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
          <Typography variant="body1">Preview of procedure legs will be shown here.</Typography>
        </Grid>
      )}
    </Grid>
  );
};

export default ProcedureSelection;
