// Ostatni kadr map wejscia (srodek widocznej czesci mapy i przyblizenie). Kazda strona (`/mapa`, `/analiza`) tworzy
// wlasna mape - nowa startuje tam, gdzie uzytkownik zostawil poprzednia, a nie od widoku calej Polski. Pamiec karty,
// zapisywana tez w sessionStorage (odswiezenie strony); zablokowana pamiec przegladarki = tylko pamiec karty.

export interface CameraMemory {
  /** srodek czesci mapy widocznej obok paneli [dlugosc, szerokosc] */
  center: [number, number];
  zoom: number;
}

const STORAGE_KEY = 'gtz:map-camera:v1';
let memory: CameraMemory | null | undefined;

function parse(raw: string | null): CameraMemory | null {
  if (raw === null) return null;

  try {
    const value: unknown = JSON.parse(raw);

    if (typeof value !== 'object' || value === null) return null;

    const { center, zoom } = value as { center?: unknown; zoom?: unknown };
    const [lng, lat] = Array.isArray(center) ? center : [];

    if (typeof lng !== 'number' || typeof lat !== 'number' || typeof zoom !== 'number') return null;

    if (!Number.isFinite(lng + lat + zoom) || Math.abs(lat) > 85 || Math.abs(lng) > 180) return null;

    return { center: [lng, lat], zoom };
  } catch {
    return null;
  }
}

/** Ostatni zapamietany kadr albo null (pierwsza mapa w karcie). */
export function readCamera(): CameraMemory | null {
  if (memory !== undefined) return memory;

  try {
    memory = parse(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    memory = null;
  }

  return memory;
}

export function saveCamera(camera: CameraMemory): void {
  memory = camera;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(camera));
  } catch {
    // bez pamieci przegladarki kadr zyje do odswiezenia strony
  }
}

/** Tylko dla testow: zapomina kadr z pamieci karty. */
export function resetCameraMemory(): void {
  memory = undefined;
}
