// Nagrane odpowiedzi Copernicus Data Space (2026-11-21, dzialka 141201_1.0001.6509, czerwiec 2025), skrocone do
// pol, ktore czyta adapter. Testy nie lacza sie z siecia.
export const CATALOG_RESPONSE = {
  type: 'FeatureCollection',
  features: [
    { properties: { datetime: '2025-06-30T09:56:10.11Z', 'eo:cloud_cover': 9.43 } },
    { properties: { datetime: '2025-06-27T09:46:13.113Z', 'eo:cloud_cover': 81.48 } },
    { properties: { datetime: '2025-06-22T09:46:30Z', 'eo:cloud_cover': 42.66 } },
    { properties: { datetime: '2025-06-17T09:56:20.513Z', 'eo:cloud_cover': 84.41 } },
    { properties: { datetime: '2025-06-17T09:46:10.57Z', 'eo:cloud_cover': 75.85 } },
    { properties: { datetime: '2025-06-15T09:56:26.554Z', 'eo:cloud_cover': 0.0 } },
    { properties: { datetime: '2025-06-14T09:46:25.229Z', 'eo:cloud_cover': 18.22 } },
  ],
  links: [],
  context: { limit: 100, returned: 7 },
};

export const STATS_CLEAR = {
  data: [
    {
      interval: { from: '2025-06-15T00:00:00Z', to: '2025-06-16T00:00:00Z' },
      outputs: {
        index: {
          bands: {
            B0: {
              stats: {
                min: 0.4888768196105957,
                max: 0.8613707423210144,
                mean: 0.7958101766804853,
                stDev: 0.06856107098420783,
                sampleCount: 66,
                noDataCount: 18,
                percentiles: { '5.0': 0.7332465648651123, '95.0': 0.8597997426986694 },
              },
            },
          },
        },
      },
    },
  ],
  status: 'OK',
  geometryPixelCount: 48,
};

/** Ta sama dzialka pod chmura: widoczna tylko czesc pikseli. */
export const STATS_CLOUDY = {
  ...STATS_CLEAR,
  data: [
    {
      interval: { from: '2025-06-30T00:00:00Z', to: '2025-07-01T00:00:00Z' },
      outputs: {
        index: {
          bands: {
            B0: {
              stats: {
                min: 0.1,
                max: 0.7,
                mean: 0.4,
                stDev: 0.1,
                sampleCount: 66,
                noDataCount: 50,
                percentiles: { '5.0': 0.2, '95.0': 0.6 },
              },
            },
          },
        },
      },
    },
  ],
};

export const STATS_EMPTY = { data: [], status: 'OK', geometryPixelCount: null };

export const TOKEN_RESPONSE = { access_token: 'token-1', expires_in: 1800, token_type: 'Bearer' };

/** Poczatek pliku PNG - adapter przekazuje bajty dalej bez dekodowania. */
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
