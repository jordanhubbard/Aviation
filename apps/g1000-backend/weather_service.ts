// Weather Service

import express from 'express';

const app = express();

app.get('/api/weather/metar/:icao', (req, res) => {
  res.json({ message: `METAR for ${req.params.icao}` });
});

app.get('/api/weather/taf/:icao', (req, res) => {
  res.json({ message: `TAF for ${req.params.icao}` });
});

app.get('/api/weather/nexrad/:tile', (req, res) => {
  res.json({ message: `NEXRAD tile ${req.params.tile}` });
});

app.get('/api/weather/winds/:lat/:lon/:alt', (req, res) => {
  res.json({ message: `Winds at ${req.params.lat}, ${req.params.lon}, ${req.params.alt}` });
});

export default app;
