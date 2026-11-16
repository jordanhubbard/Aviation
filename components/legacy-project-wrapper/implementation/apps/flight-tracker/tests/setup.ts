/** Test environment policy, installed before importing application modules. */

// Disable the shared-sdk METAR fetch so no real HTTP is made to aviationweather.gov
process.env.DISABLE_METAR_FETCH = '1';

// Neutralise any egress proxy configured in the host environment
process.env.NO_PROXY = '*';
process.env.HTTP_PROXY = '';
process.env.HTTPS_PROXY = '';
process.env.http_proxy = '';
process.env.https_proxy = '';

// Suppress noisy live-polling timers in CI
process.env.FLIGHT_LIVE_POLL_MS = '999999';
process.env.FLIGHT_LIVE_MIN_FETCH_MS = '0';
