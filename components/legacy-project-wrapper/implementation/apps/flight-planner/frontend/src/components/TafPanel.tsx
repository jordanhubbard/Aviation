import { Alert, Box, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { weatherService } from '../services/weatherService'

function utcTime(value: string | number | null | undefined): string {
  if (value == null || value === '' || value === 0) return 'Unknown'
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toISOString().replace('T', ' ').replace('.000Z', ' UTC')
}

export default function TafPanel({ airport }: { airport: string }) {
  const taf = useQuery({
    queryKey: ['taf', airport],
    queryFn: () => weatherService.getTaf(airport),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  return (
    <Box component="section" aria-label={`${airport} TAF`} sx={{ mt: 2 }}>
      <Typography variant="subtitle2">TAF — terminal forecast</Typography>
      {taf.isLoading ? (
        <Typography variant="body2">Loading TAF…</Typography>
      ) : taf.isError ? (
        <Alert severity="warning">Unable to load TAF for {airport}.</Alert>
      ) : taf.data ? (
        <>
          {taf.data.status === 'no_reports' || taf.data.reports.length === 0 ? (
            <Typography variant="body2">No TAF available for {airport}.</Typography>
          ) : (
            taf.data.reports.map((report, index) => (
              <Box key={index} sx={{ my: 1 }}>
                <Typography variant="caption" display="block">
                  Station: {report.icaoId || airport} · Issued: {utcTime(report.issueTime)}
                </Typography>
                <Typography variant="caption" display="block">
                  Valid: {utcTime(report.validTimeFrom)} – {utcTime(report.validTimeTo)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {report.rawTAF || 'TAF text unavailable.'}
                </Typography>
              </Box>
            ))
          )}
          <Typography variant="caption" color="text.secondary" display="block">
            Source: {taf.data.source.provider} · Retrieved:{' '}
            {utcTime(taf.data.source.retrieved_at_utc)}
          </Typography>
        </>
      ) : null}
    </Box>
  )
}
