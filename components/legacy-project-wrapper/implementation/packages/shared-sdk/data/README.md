# Bundled airport data

`airports_cache.json` is a generated snapshot of the OurAirports airport catalog,
not SDK source code. OurAirports releases its downloadable data to the public domain;
see <https://ourairports.com/data/>. Attribution is appreciated but not required.

The snapshot's exact output digest and record count are recorded in
`provenance.json`. Its original download time and input CSV digest were not retained,
so its freshness is **unknown**. It must not be represented as current or suitable for
primary navigation. A future refresh must record the source digest and acquisition
time before replacing this snapshot.

The `elevation` field is the source `elevation_ft` value: mean sea level in feet.
The repository's MIT license covers SDK code; this public-domain dataset retains the
separate status recorded here.
