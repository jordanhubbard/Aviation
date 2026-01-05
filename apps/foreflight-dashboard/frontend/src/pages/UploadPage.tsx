import React, { useState } from 'react'
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material'
import { CloudUpload } from '@mui/icons-material'
import { toast } from 'react-hot-toast'
import logbookService, { LogbookData } from '../services/logbookService'
import DashboardContent from '../components/DashboardContent'

const UploadPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [isStudentPilot, setIsStudentPilot] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [logbookData, setLogbookData] = useState<LogbookData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const data = await logbookService.processLogbook(file, isStudentPilot)
      setLogbookData(data)
      toast.success(`Successfully processed ${data.entries.length} logbook entries!`)
    } catch (err: unknown) {
      const maybeErr = err as {
        response?: { data?: { detail?: string } }
        message?: string
      }
      const errorMessage =
        maybeErr.response?.data?.detail || maybeErr.message || 'Failed to process logbook'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const handleNewUpload = () => {
    setFile(null)
    setLogbookData(null)
    setError(null)
    // Reset file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  // If we have logbook data, show the dashboard
  if (logbookData) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Logbook Dashboard
          </Typography>
          <Button
            variant="outlined"
            onClick={handleNewUpload}
            sx={{ ml: 2 }}
          >
            Upload New Logbook
          </Button>
        </Box>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Session-based data:</strong> Your logbook data is stored in your browser session only. 
            It will be lost when you close the browser or refresh the page.
          </Typography>
        </Alert>

        <DashboardContent logbookData={logbookData} />
      </Container>
    )
  }

  // Show upload interface
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
        <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        
        <Typography variant="h3" component="h1" gutterBottom>
          ForeFlight Logbook Dashboard
        </Typography>
        
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
          Upload your ForeFlight logbook CSV to view your flight statistics and dashboard
        </Typography>

        <Divider sx={{ my: 4 }} />

        <Box sx={{ mb: 4 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Select your ForeFlight logbook CSV file:
          </Typography>
          
          <input
            id="file-input"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          
          <label htmlFor="file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<CloudUpload />}
              sx={{ mb: 2 }}
            >
              Choose CSV File
            </Button>
          </label>
          
          {file && (
            <Typography variant="body2" color="text.secondary">
              Selected: {file.name}
            </Typography>
          )}
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              checked={isStudentPilot}
              onChange={(e) => setIsStudentPilot(e.target.checked)}
            />
          }
          label="I am a student pilot"
          sx={{ mb: 3 }}
        />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box>
          <Button
            variant="contained"
            size="large"
            onClick={handleUpload}
            disabled={!file || isUploading}
            startIcon={isUploading ? <CircularProgress size={20} /> : <CloudUpload />}
            sx={{ px: 4, py: 1.5 }}
          >
            {isUploading ? 'Processing...' : 'Process Logbook'}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
          <strong>Privacy Notice:</strong> Your logbook data is processed locally in your browser session. 
          No data is permanently stored on our servers.
        </Typography>
      </Paper>
    </Container>
  )
}

export default UploadPage
