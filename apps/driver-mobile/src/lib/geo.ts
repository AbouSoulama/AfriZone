export interface LatLng {
  lat: number;
  lng: number;
}

export const CITY_COORDS: Record<string, LatLng> = {
  Dakar: { lat: 14.7167, lng: -17.4677 },
  Ouagadougou: { lat: 12.3714, lng: -1.5197 },
  Bamako: { lat: 12.6392, lng: -8.0029 },
  Thies: { lat: 14.7886, lng: -16.926 },
  'Saint-Louis': { lat: 16.0179, lng: -16.4897 },
  Ziguinchor: { lat: 12.5681, lng: -16.275 },
  Kaolack: { lat: 14.151, lng: -16.075 },
  Touba: { lat: 14.85, lng: -15.8833 },
  Bobo: { lat: 11.178, lng: -4.289 },
  'Bobo-Dioulasso': { lat: 11.178, lng: -4.289 },
  Sikasso: { lat: 11.3176, lng: -5.6665 },
};

export function coordsForCity(city?: string | null): LatLng | null {
  if (!city) return null;
  const exact = CITY_COORDS[city.trim()];
  if (exact) return exact;
  const key = Object.keys(CITY_COORDS).find(
    (k) => k.toLowerCase() === city.trim().toLowerCase()
  );
  return key ? CITY_COORDS[key] : null;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function estimateEtaMinutes(distanceKm: number, vehicleType?: string | null): number {
  const speeds: Record<string, number> = {
    moto: 35,
    velo: 15,
    voiture: 30,
    camionnette: 25,
  };
  const speed = speeds[vehicleType || 'moto'] || 30;
  return Math.max(5, Math.round((distanceKm / speed) * 60));
}

export function googleMapsDirectionsUrl(from: LatLng, to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}

export function mapsQueryUrl(address: string, city: string): string {
  const q = encodeURIComponent(`${address}, ${city}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function formatXof(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} F CFA`;
}
