import { afterEach, describe, expect, it } from 'vitest';

import { readCamera, resetCameraMemory, saveCamera } from './camera-memory';

describe('camera-memory', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    resetCameraMemory();
  });

  it('bez zapisu nie ma kadru; zapisany wraca takze po utracie pamieci karty (odswiezenie)', () => {
    expect(readCamera()).toBeNull();

    saveCamera({ center: [21.59, 52.17], zoom: 16.5 });
    resetCameraMemory();

    expect(readCamera()).toEqual({ center: [21.59, 52.17], zoom: 16.5 });
  });

  it('uszkodzony zapis = brak kadru', () => {
    window.sessionStorage.setItem('gtz:map-camera:v1', '{"center":[1,"x"],"zoom":3}');

    expect(readCamera()).toBeNull();
  });
});
