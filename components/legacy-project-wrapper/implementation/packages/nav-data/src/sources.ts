import { NavDataSource } from "./types";

export const NAV_DATA_SOURCES: NavDataSource[] = [
  {
    id: "ourairports",
    name: "OurAirports",
    homepage: "https://ourairports.com/data/",
    license: "Public domain",
    updateCadence: "Daily",
    coverage: "Global airports, runways, frequencies, regions",
    formats: [
      {
        type: "csv",
        description: "Airport, runway, frequency, navaid, country, and region tables",
        files: [
          "airports.csv",
          "runways.csv",
          "airport-frequencies.csv",
          "navaids.csv",
          "countries.csv",
          "regions.csv",
        ],
      },
    ],
    notes: "Good baseline for global airport metadata with simple CSV ingestion.",
  },
  {
    id: "openaip",
    name: "openAIP",
    homepage: "https://www.openaip.net/",
    license: "ODbL 1.0",
    updateCadence: "Weekly",
    coverage: "Airspace, airports, navaids, reporting points",
    formats: [
      {
        type: "json",
        description: "Structured aviation datasets delivered per-country",
      },
      {
        type: "geojson",
        description: "Airspace geometry and obstacle overlays",
      },
    ],
    notes: "Requires attribution and share-alike for derived datasets.",
  },
  {
    id: "faa-cifp",
    name: "FAA CIFP",
    homepage: "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/",
    license: "Public domain (US Government)",
    updateCadence: "28-day cycle",
    coverage: "US procedures, waypoints, airways, navaids",
    formats: [
      {
        type: "arinc-424",
        description: "ARINC 424-encoded CIFP records",
      },
      {
        type: "text",
        description: "Fixed-width text distributions",
      },
    ],
    notes: "Primary source for procedure legs and terminal procedures.",
  },
  {
    id: "faa-nasr",
    name: "FAA NASR",
    homepage: "https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/",
    license: "Public domain (US Government)",
    updateCadence: "56-day cycle",
    coverage: "US airport and navaid reference data",
    formats: [
      {
        type: "csv",
        description: "Airport, runway, and navaid CSV extracts",
      },
      {
        type: "text",
        description: "Fixed-width NASR data files",
      },
    ],
    notes: "Useful for cross-checking airport metadata with CIFP procedures.",
  },
];
