import { Routes, Route } from 'react-router-dom'
import { Box } from '@mui/material'
import UploadPage from './pages/UploadPage'

function App() {
  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(180deg, #f0f4f8 0%, #e3eef7 100%)',
      }}
    >
      <Routes>
        {/* Single route - upload page that leads to dashboard */}
        <Route path="/" element={<UploadPage />} />
        <Route path="*" element={<UploadPage />} />
      </Routes>
    </Box>
  )
}

export default App
