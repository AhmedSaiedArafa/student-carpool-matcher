if (!auth.requireAuth()) throw new Error('Not authenticated');

const resultsContainer = document.getElementById('results');

// Bridge: location-picker uses originLat/originLng, search API needs pickupLat/pickupLng
const _origSetOrigin = window.setOrigin;
window.setOrigin = function(lat, lng, name) {
  _origSetOrigin(lat, lng, name);
  document.getElementById('pickupLat').value = lat;
  document.getElementById('pickupLng').value = lng;
};

const _origSetDest = window.setDest;
window.setDest = function(lat, lng, name) {
  _origSetDest(lat, lng, name);
  document.getElementById('dropoffLat').value = lat;
  document.getElementById('dropoffLng').value = lng;
};

const _origClearOrigin = window.clearLocation;
window.clearLocation = function(type) {
  _origClearOrigin(type);
  if (type === 'origin') {
    document.getElementById('pickupLat').value = '';
    document.getElementById('pickupLng').value = '';
  } else {
    document.getElementById('dropoffLat').value = '';
    document.getElementById('dropoffLng').value = '';
  }
};

document.getElementById('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const pickupLat = document.getElementById('pickupLat').value;
  const pickupLng = document.getElementById('pickupLng').value;

  if (!pickupLat || !pickupLng) {
    ui.showError(resultsContainer, 'Please select a pickup location on the map or search for one.');
    return;
  }

  const dropLat = document.getElementById('dropoffLat').value;
  const dropLng = document.getElementById('dropoffLng').value;

  if (!dropLat || !dropLng) {
    ui.showError(resultsContainer, 'Please select a drop-off location on the map or search for one.');
    return;
  }

  ui.showLoading(resultsContainer);

  const params = new URLSearchParams();
  params.set('pickupLat', pickupLat);
  params.set('pickupLng', pickupLng);
  params.set('dropoffLat', dropLat);
  params.set('dropoffLng', dropLng);

  const after = document.getElementById('departureAfter').value;
  if (after) params.set('departureAfter', new Date(after).toISOString());

  const weekday = document.getElementById('weekday').value;
  if (weekday !== '') params.set('weekday', weekday);

  try {
    const matches = await api.get(`/matches?${params}`);
    renderResults(matches);
  } catch (err) {
    ui.showError(resultsContainer, err.message || 'Search failed');
  }
});

function renderResults(matches) {
  if (matches.length === 0) {
    ui.showEmpty(resultsContainer, 'No rides found matching your criteria');
    return;
  }

  resultsContainer.innerHTML = `<div class="space-y-3">${matches.map(m => `
    <div class="bg-surface-container-lowest rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div class="flex items-center gap-2 text-sm font-semibold text-on-surface">
          <span class="material-symbols-outlined text-lg text-primary">trip_origin</span>
          <span>${ui.escape(m.origin_name || m.origin_lat + ', ' + m.origin_lng)}</span>
          <span class="material-symbols-outlined text-lg text-on-surface-variant">arrow_forward</span>
          <span class="material-symbols-outlined text-lg text-secondary">location_on</span>
          <span>${ui.escape(m.destination_name || m.destination_lat + ', ' + m.destination_lng)}</span>
        </div>
        <div class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold">
          <span class="material-symbols-outlined text-sm">speed</span>Match ${m.score}%
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant mb-3">
        <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">calendar_today</span>${ui.formatDate(m.trip_date)}</span>
        <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">${m.schedule_type === 'once' ? 'event' : 'repeat'}</span>${CONFIG.scheduleLabel(m)}</span>
        <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span>${ui.formatTime(m.departure_time)}</span>
        <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">event_seat</span>${m.seats_remaining}/${m.seats_total} seats</span>
        <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">person</span>${ui.escape(m.driver_name)}</span>
        <span class="inline-flex items-center gap-1 font-semibold text-amber-500"><span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL' 1">star</span>Driver ${m.driver_rating}★</span>
        ${m.fare ? `<span class="inline-flex items-center gap-1 font-semibold text-secondary"><span class="material-symbols-outlined text-sm">payments</span>${m.fare} EGP</span>` : ''}
        <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">near_me</span>${m.pickupDist} km away</span>
      </div>
      <div class="flex flex-wrap gap-2">
        ${m.seats_remaining > 0
          ? `<button class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-sm hover:bg-primary-container transition-all" onclick="openFareModal(${m.id}, ${m.fare || 0})">
              <span class="material-symbols-outlined text-sm">airline_seat_recline_normal</span>Request Seat</button>`
          : `<button class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-high text-on-surface-variant text-xs font-semibold hover:bg-surface-container-highest transition-all" onclick="joinWaitlist(${m.id})">
              <span class="material-symbols-outlined text-sm">hourglass_top</span>Join Waitlist</button>`}
        <a href="/pages/profile.html?id=${m.driver_id}" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant text-xs font-semibold hover:bg-surface-container-low transition-all">
          <span class="material-symbols-outlined text-sm">person</span>Driver Profile</a>
      </div>
    </div>
  `).join('')}</div>`;
}

function openFareModal(tripId, defaultFare) {
  const existing = document.getElementById('fare-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fare-modal';
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40';
  modal.innerHTML = `
    <div class="bg-surface-container-lowest rounded-2xl shadow-lg p-6 w-full max-w-sm mx-4">
      <h3 class="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">payments</span>Your Price (EGP)
      </h3>
      <input type="number" id="fare-input" min="0" max="9999.99" step="0.01" value="${defaultFare}"
        class="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all mb-4">
      <div class="flex justify-end gap-2">
        <button id="fare-cancel" class="px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-all">Cancel</button>
        <button id="fare-submit" class="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold shadow-sm hover:bg-primary-container transition-all">Send Request</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById('fare-cancel').addEventListener('click', () => modal.remove());
  document.getElementById('fare-submit').addEventListener('click', async () => {
    const offeredFare = parseFloat(document.getElementById('fare-input').value);
    if (isNaN(offeredFare) || offeredFare < 0) {
      ui.toast('Please enter a valid price', 'error');
      return;
    }
    modal.remove();
    try {
      await api.post(`/trips/${tripId}/requests`, {
        pickup_lat: parseFloat(document.getElementById('pickupLat').value),
        pickup_lng: parseFloat(document.getElementById('pickupLng').value),
        offered_fare: offeredFare,
      });
      ui.toast('Seat requested! The driver will review your request.');
      document.getElementById('search-form').dispatchEvent(new Event('submit'));
    } catch (err) {
      ui.toast(err.message || 'Failed to request seat', 'error');
    }
  });
}

async function joinWaitlist(tripId) {
  try {
    await api.post(`/trips/${tripId}/waitlist`);
    ui.toast('Added to waitlist! You\'ll be notified if a seat opens.');
  } catch (err) {
    ui.toast(err.message || 'Failed to join waitlist', 'error');
  }
}
