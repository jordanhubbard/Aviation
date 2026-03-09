import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';

const ImportExportUI: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setError(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    if (selectedFile && !['application/gpx+xml', 'application/vnd.google-earth.kml+xml', 'application/xml'].includes(selectedFile.type)) {
      setError('Invalid file type. Please select a GPX, FPL, or KML file.');
      setFile(null);
    } else {
      setError(null);
      setFile(selectedFile);
    }
  };

  const handleImport = () => {
    if (file) {
      // Implement import logic here
      console.log('Importing:', file);
      handleClose();
    }
  };

  const handleExport = () => {
    // Implement export logic here
    console.log('Exporting plan');
  };

  return (
    <div>
      <Button variant="outlined" onClick={handleClickOpen}>
        Import/Export Flight Plan
      </Button>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Import Flight Plan</DialogTitle>
        <DialogContent>
          <input
            accept=".gpx,.fpl,.kml"
            style={{ display: 'none' }}
            id="file-input"
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="file-input">
            <Button variant="contained" component="span">
              Choose File
            </Button>
          </label>
          {file && <TextField value={file.name} fullWidth disabled />}
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleImport} color="primary" disabled={!file}>
            Import
          </Button>
          <Button onClick={handleExport} color="primary">
            Export
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ImportExportUI;
