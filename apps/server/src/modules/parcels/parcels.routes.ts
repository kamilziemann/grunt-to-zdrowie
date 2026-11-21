// Trasy odczytu dzialek ewidencyjnych dla OpenAPI. Identyfikator idzie w query, nie w sciezce: numery dzialek
// zawieraja ukosnik ("12/3"), ktory w segmencie sciezki rozbilby trase.
import { createRoute } from '@hono/zod-openapi';

import { jsonResponse, notFound, problemResponse, validationFailed } from '../../lib/openapi';
import {
  parcelAtQuery,
  parcelBoundariesDto,
  parcelBoundaryTileQuery,
  parcelByIdQuery,
  parcelDto,
  parcelSearchQuery,
  parcelSearchResultDto,
} from './parcels.schemas';

const tags = ['parcels'];
const upstreamFailed = problemResponse('ULDK (GUGiK) nie odpowiedzial albo odpowiedzial blednie');

export const searchParcels = createRoute({
  method: 'get',
  path: '/search',
  tags,
  summary: 'Kandydaci po pelnym identyfikatorze albo "obreb numer" (bez geometrii)',
  request: { query: parcelSearchQuery },
  responses: {
    200: jsonResponse(parcelSearchResultDto, 'Pasujace dzialki'),
    400: validationFailed,
    502: upstreamFailed,
  },
});

export const getParcelById = createRoute({
  method: 'get',
  path: '/by-id',
  tags,
  summary: 'Dzialka z geometria po pelnym identyfikatorze',
  request: { query: parcelByIdQuery },
  responses: {
    200: jsonResponse(parcelDto, 'Dzialka'),
    400: validationFailed,
    404: notFound,
    502: upstreamFailed,
  },
});

export const getParcelAt = createRoute({
  method: 'get',
  path: '/at',
  tags,
  summary: 'Dzialka pod punktem WGS84 (klikniecie na mapie)',
  request: { query: parcelAtQuery },
  responses: {
    200: jsonResponse(parcelDto, 'Dzialka'),
    400: validationFailed,
    404: notFound,
    502: upstreamFailed,
  },
});

export const getParcelBoundaries = createRoute({
  method: 'get',
  path: '/boundaries',
  tags,
  summary:
    'Obrysy i numery dzialek w kaflu XYZ siatki granic (poziom 14 albo 16, domyslnie 16) - warstwa granic na mapie',
  request: { query: parcelBoundaryTileQuery },
  responses: {
    200: jsonResponse(parcelBoundariesDto, 'Dzialki przecinajace kafel'),
    400: validationFailed,
    502: problemResponse('Usluga WFS ewidencji gruntow (GUGiK) nie odpowiedziala albo odpowiedziala blednie'),
  },
});
