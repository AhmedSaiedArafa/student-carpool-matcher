const { ORS_API_KEY } = require('../config/env');

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

async function geocodeORS(text, limit) {
  if (!ORS_API_KEY) return null;
  try {
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(text)}&size=${limit}&boundary.country=EG`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.features || data.features.length === 0) return null;
    return data.features.map(f => ({
      name: f.properties.label || f.properties.name || '',
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
  } catch {
    return null;
  }
}

async function geocodeNominatim(text, limit) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=${limit}&countrycodes=eg&accept-language=en,ar`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CarpoolMatcher/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length === 0) return null;
    return data.map(item => ({
      name: item.display_name.split(',').slice(0, 3).join(',').trim(),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch {
    return null;
  }
}

async function geocode(text, limit = 6) {
  const orsResult = await geocodeORS(text, limit);
  if (orsResult) return orsResult;
  return geocodeNominatim(text, limit);
}

async function reverseGeocodeORS(lat, lng) {
  if (!ORS_API_KEY) return null;
  try {
    const url = `https://api.openrouteservice.org/geocode/reverse?api_key=${ORS_API_KEY}&point.lon=${lng}&point.lat=${lat}&size=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.features || data.features.length === 0) return null;
    return data.features[0].properties.label || data.features[0].properties.name || null;
  } catch {
    return null;
  }
}

async function reverseGeocodeNominatim(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&accept-language=en,ar`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CarpoolMatcher/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.display_name) return data.display_name.split(',').slice(0, 3).join(',').trim();
    if (data.address) {
      const parts = [data.address.road, data.address.suburb, data.address.city].filter(Boolean);
      return parts.length ? parts.join(', ') : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function reverseGeocode(lat, lng) {
  const orsResult = await reverseGeocodeORS(lat, lng);
  if (orsResult) return orsResult;
  return reverseGeocodeNominatim(lat, lng);
}

module.exports = { haversineKm, geocode, reverseGeocode };
