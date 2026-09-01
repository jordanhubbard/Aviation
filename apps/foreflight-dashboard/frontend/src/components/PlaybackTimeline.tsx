import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Slider,
  IconButton,
  Typography,
  Paper,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  Replay,
} from '@mui/icons-material';

interface PlaybackTimelineProps {
  duration: number; // Total duration in seconds
  onTimeChange: (time: number) => void;
  onPlayPauseChange: (isPlaying: boolean) => void;
  isPlaying: boolean;
  markers?: Array<{ time: number; label: string }>;
}

const PlaybackTimeline: React.FC<PlaybackTimelineProps> = ({
  duration,
  onTimeChange,
  onPlayPauseChange,
  isPlaying,
  markers = [],
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(Date.now());

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle playback animation
  useEffect(() => {
    if (!isPlaying || isDragging) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastTimeRef.current) / 1000; // Convert to seconds
      lastTimeRef.current = now;

      setCurrentTime((prevTime) => {
        const newTime = prevTime + deltaTime * playbackSpeed;
        if (newTime >= duration) {
          onPlayPauseChange(false);
          return duration;
        }
        onTimeChange(newTime);
        return newTime;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = Date.now();
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, duration, isDragging, onTimeChange, onPlayPauseChange]);

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    setCurrentTime(value);
    onTimeChange(value);
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handlePlayPause = () => {
    onPlayPauseChange(!isPlaying);
  };

  const handleReplay = () => {
    setCurrentTime(0);
    onTimeChange(0);
  };

  const handleSkipBackward = () => {
    const newTime = Math.max(0, currentTime - 10);
    setCurrentTime(newTime);
    onTimeChange(newTime);
  };

  const handleSkipForward = () => {
    const newTime = Math.min(duration, currentTime + 10);
    setCurrentTime(newTime);
    onTimeChange(newTime);
  };

  const handleSpeedChange = (event: SelectChangeEvent<number>) => {
    setPlaybackSpeed(Number(event.target.value));
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: 2,
      }}
    >
      <Stack spacing={2}>
        {/* Title */}
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Flight Playback Timeline
        </Typography>

        {/* Time Display */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2">{formatTime(currentTime)}</Typography>
          <Typography variant="body2">{formatTime(duration)}</Typography>
        </Box>

        {/* Timeline Slider */}
        <Slider
          value={currentTime}
          onChange={handleSliderChange}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchEnd={handleDragEnd}
          min={0}
          max={duration}
          step={0.1}
          sx={{
            color: 'white',
            '& .MuiSlider-thumb': {
              backgroundColor: 'white',
              boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
            },
            '& .MuiSlider-track': {
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            },
            '& .MuiSlider-rail': {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
            },
          }}
        />

        {/* Markers */}
        {markers.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {markers.map((marker, index) => (
              <Box
                key={index}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
                onClick={() => {
                  setCurrentTime(marker.time);
                  onTimeChange(marker.time);
                }}
              >
                {marker.label} ({formatTime(marker.time)})
              </Box>
            ))}
          </Box>
        )}

        {/* Controls */}
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', alignItems: 'center' }}>
          {/* Replay Button */}
          <IconButton
            size="small"
            onClick={handleReplay}
            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' } }}
            title="Replay from start"
          >
            <Replay />
          </IconButton>

          {/* Skip Backward Button */}
          <IconButton
            size="small"
            onClick={handleSkipBackward}
            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' } }}
            title="Skip backward 10 seconds"
          >
            <SkipPrevious />
          </IconButton>

          {/* Play/Pause Button */}
          <IconButton
            size="medium"
            onClick={handlePlayPause}
            sx={{
              color: 'white',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>

          {/* Skip Forward Button */}
          <IconButton
            size="small"
            onClick={handleSkipForward}
            sx={{ color: 'white', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' } }}
            title="Skip forward 10 seconds"
          >
            <SkipNext />
          </IconButton>
        </Stack>

        {/* Speed Control */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel sx={{ color: 'white' }}>Speed</InputLabel>
          <Select
            value={playbackSpeed}
            onChange={handleSpeedChange}
            label="Speed"
            sx={{
              color: 'white',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'white',
              },
              '& .MuiSvgIcon-root': {
                color: 'white',
              },
            }}
          >
            <MenuItem value={0.5}>0.5x</MenuItem>
            <MenuItem value={1}>1x</MenuItem>
            <MenuItem value={1.5}>1.5x</MenuItem>
            <MenuItem value={2}>2x</MenuItem>
          </Select>
        </FormControl>
      </Stack>
    </Paper>
  );
};

export default PlaybackTimeline;
