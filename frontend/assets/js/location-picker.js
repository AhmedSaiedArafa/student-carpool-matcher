let map, originMarker, destMarker, pickMode = 'origin';
let searchTimeout = null;

const CAIRO_CENTER = [30.0444, 31.2357];

const originIcon = L.divIcon({
  className: '',
  html: '<div style="background:#004ac6;width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="8"/></svg></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const destIcon = L.divIcon({
  className: '',
  html: '<div style="background:#006c49;width:28px;height:28px;border-radius:50% 50% 50% 0;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="transform:rotate(45deg)"><circle cx="12" cy="12" r="6"/></svg></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function initMap(elementId) {
  map = L.map(elementId).setView(CAIRO_CENTER, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  map.on('click', function (e) {
    const { lat, lng } = e.latlng;
    reverseGeocode(lat, lng, function (name) {
      if (pickMode === 'origin') {
        setOrigin(lat, lng, name);
      } else {
        setDest(lat, lng, name);
      }
    });
  });
}

function setPickMode(mode) {
  pickMode = mode;
  const originBtn = document.getElementById('pick-origin-btn');
  const destBtn = document.getElementById('pick-dest-btn');
  if (mode === 'origin') {
    originBtn.className = 'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-sm transition-all';
    destBtn.className = 'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-secondary text-secondary text-xs font-semibold transition-all';
  } else {
    originBtn.className = 'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-primary text-primary text-xs font-semibold transition-all';
    destBtn.className = 'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-on-secondary text-xs font-semibold shadow-sm transition-all';
  }
  map.getContainer().style.cursor = 'crosshair';
}

function setOrigin(lat, lng, name) {
  const latEl = document.getElementById('originLat');
  const lngEl = document.getElementById('originLng');
  const nameEl = document.getElementById('originName');
  if (latEl) latEl.value = lat;
  if (lngEl) lngEl.value = lng;
  if (nameEl) nameEl.value = name || '';
  document.getElementById('origin-search').value = '';
  document.getElementById('origin-results').classList.add('hidden');

  const display = document.getElementById('origin-display');
  document.getElementById('origin-name-display').textContent = name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  display.classList.remove('hidden');

  if (originMarker) map.removeLayer(originMarker);
  originMarker = L.marker([lat, lng], { icon: originIcon }).addTo(map);
  originMarker.bindPopup('<b>Pickup:</b> ' + (name || 'Selected location')).openPopup();
  fitMapBounds();
  setPickMode('dest');
}

function setDest(lat, lng, name) {
  const latEl = document.getElementById('destLat');
  const lngEl = document.getElementById('destLng');
  const nameEl = document.getElementById('destName');
  if (latEl) latEl.value = lat;
  if (lngEl) lngEl.value = lng;
  if (nameEl) nameEl.value = name || '';
  document.getElementById('dest-search').value = '';
  document.getElementById('dest-results').classList.add('hidden');

  const display = document.getElementById('dest-display');
  document.getElementById('dest-name-display').textContent = name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  display.classList.remove('hidden');

  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.marker([lat, lng], { icon: destIcon }).addTo(map);
  destMarker.bindPopup('<b>Drop-off:</b> ' + (name || 'Selected location')).openPopup();
  fitMapBounds();
}

function clearLocation(type) {
  if (type === 'origin') {
    const latEl = document.getElementById('originLat');
    const lngEl = document.getElementById('originLng');
    const nameEl = document.getElementById('originName');
    if (latEl) latEl.value = '';
    if (lngEl) lngEl.value = '';
    if (nameEl) nameEl.value = '';
    document.getElementById('origin-display').classList.add('hidden');
    if (originMarker) { map.removeLayer(originMarker); originMarker = null; }
  } else {
    const latEl = document.getElementById('destLat');
    const lngEl = document.getElementById('destLng');
    const nameEl = document.getElementById('destName');
    if (latEl) latEl.value = '';
    if (lngEl) lngEl.value = '';
    if (nameEl) nameEl.value = '';
    document.getElementById('dest-display').classList.add('hidden');
    if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
  }
}

function fitMapBounds() {
  const markers = [originMarker, destMarker].filter(Boolean);
  if (markers.length === 2) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.3));
  } else if (markers.length === 1) {
    map.setView(markers[0].getLatLng(), 14);
  }
}

function searchLocation(query, resultsId, callback) {
  if (query.length < 2) {
    document.getElementById(resultsId).classList.add('hidden');
    return;
  }
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      const data = await api.get(`/geocode?q=${encodeURIComponent(query)}`);
      const container = document.getElementById(resultsId);
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="px-4 py-3 text-sm text-on-surface-variant">No results found</div>';
        container.classList.remove('hidden');
        return;
      }
      window._searchResults = data;
      container.innerHTML = data.map((item, i) => {
        const parts = item.name.split(',');
        const shortName = parts.slice(0, 2).join(',').trim();
        const detail = parts.slice(2, 4).join(',').trim();
        return `<button type="button" class="w-full text-left px-4 py-2.5 hover:bg-surface-container-low transition-colors flex items-start gap-2 border-b border-outline-variant/30 last:border-0"
          onclick="pickSearchResult(${i}, '${callback}')">
          <span class="material-symbols-outlined text-lg text-on-surface-variant mt-0.5 shrink-0">location_on</span>
          <div class="min-w-0">
            <div class="text-sm font-medium text-on-surface truncate">${shortName}</div>
            <div class="text-xs text-on-surface-variant truncate">${detail}</div>
          </div>
        </button>`;
      }).join('');
      container.classList.remove('hidden');
    } catch {
      console.warn('Location search failed');
    }
  }, 400);
}

function pickSearchResult(index, callbackName) {
  const item = window._searchResults[index];
  if (!item) return;
  const name = item.name.split(',').slice(0, 2).join(',').trim();
  window[callbackName](item.lat, item.lng, name);
}

function reverseGeocode(lat, lng, callback) {
  api.get(`/geocode/reverse?lat=${lat}&lng=${lng}`)
    .then(data => callback(data?.name || null))
    .catch(() => {
      console.warn('Reverse geocoding failed');
      callback(null);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  const mapEl = document.getElementById('map');
  if (mapEl) initMap('map');

  const originSearch = document.getElementById('origin-search');
  const destSearch = document.getElementById('dest-search');

  if (originSearch) {
    originSearch.addEventListener('input', (e) => searchLocation(e.target.value, 'origin-results', 'setOrigin'));
    originSearch.addEventListener('focus', () => setPickMode('origin'));
  }
  if (destSearch) {
    destSearch.addEventListener('input', (e) => searchLocation(e.target.value, 'dest-results', 'setDest'));
    destSearch.addEventListener('focus', () => setPickMode('dest'));
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#origin-search') && !e.target.closest('#origin-results')) {
      document.getElementById('origin-results')?.classList.add('hidden');
    }
    if (!e.target.closest('#dest-search') && !e.target.closest('#dest-results')) {
      document.getElementById('dest-results')?.classList.add('hidden');
    }
  });
});
