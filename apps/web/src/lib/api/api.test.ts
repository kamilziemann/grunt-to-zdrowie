import { describe, expect, it } from 'vitest';

import { apiUrl } from './api';

describe('apiUrl', () => {
  it('sciezka pod /api tego samego originu, z ukosnikiem albo bez', () => {
    expect(apiUrl('/parcels/by-id')).toBe('/api/parcels/by-id');
    expect(apiUrl('parcels/by-id')).toBe('/api/parcels/by-id');
  });

  it('query pomija puste wartosci, liczby zapisuje tekstem i koduje znaki', () => {
    expect(apiUrl('/parcels/search', { q: 'a b&c', page: 2, cursor: undefined, tag: '' })).toBe(
      '/api/parcels/search?q=a+b%26c&page=2',
    );
    expect(apiUrl('/places/search', {})).toBe('/api/places/search');
  });
});
