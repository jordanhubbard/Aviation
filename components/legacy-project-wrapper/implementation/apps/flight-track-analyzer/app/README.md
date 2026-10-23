# Flight track analyzer (implementation)

Authority: `components/flight-analyzer/component.md`. Python/FastAPI back end (`flightlab/`),
dependency-free JavaScript + SVG front end (`static/`), tests with a synthetic-flight truth
generator (`tests/synth.py`).

| Module | Role |
|---|---|
| `kml.py` | tolerant ForeFlight/Garmin/generic KML reader, safe XML |
| `track.py` | de-dup, spike rejection, 1 Hz resample, Savitzky–Golay derivatives, unit inference |
| `events.py` | ground reference, take-off / landing / touch-and-go / go-around detection |
| `wind.py` | circle-fit wind and TAS with confidence grading |
| `pattern.py` | runway-frame pattern legs and final-approach quality |
| `accuracy.py`, `performance.py` | hold accuracy; climb / cruise / descent / turns |
| `aggregate.py` | cross-flight statistics |
| `store.py` | SQLite store; tail number is the leading primary key of every table |
| `poh.py` | AFM/POH-style distance tables, conditions, reference interpolation |
| `llm.py` | optional LLM, digest only, inert unless configured |

Known limits: GPS-altitude touchdown timing is uncertain by seconds; pattern-only wind is
approximate; airport MSL elevation may corroborate touchdown only after a GPS ground
reference has calibrated the altitude offset. Runways are inferred from heading.

Uploading: every file needs a tail number, e.g.
`curl -F files=@flight.kml -F aircraft=N12345 http://localhost:8000/api/flights` (repeat `files`/`aircraft` pairs for several files).
