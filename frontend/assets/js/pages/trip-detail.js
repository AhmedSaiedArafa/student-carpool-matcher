if (!auth.requireAuth()) throw new Error('Not authenticated');

const tripId = new URLSearchParams(window.location.search).get('id');
if (!tripId) window.location.href = '/';

async function loadTrip() {
  ui.showLoading('trip-content');
  try {
    const trip = await api.get(`/trips/${tripId}`);
    renderTrip(trip);

    const user = auth.getUser();
    if (user.role === 'driver' && trip.driver_id === user.id) {
      await loadRequests();
      await loadPassengers();
    }
  } catch (err) {
    ui.showError('trip-content', err.message);
  }
}

function renderTrip(trip) {
  document.getElementById('trip-content').innerHTML = `
    <div class="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 class="text-lg font-bold text-on-surface flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">trip_origin</span>
          ${ui.escape(trip.origin_name || 'Origin')}
          <span class="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
          <span class="material-symbols-outlined text-secondary">location_on</span>
          ${ui.escape(trip.destination_name || 'Destination')}
        </h2>
        ${ui.statusBadge(trip.status)}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-2 text-sm">
          <p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-primary">calendar_today</span><strong class="text-on-surface">${ui.formatDate(trip.trip_date)}</strong></p>
          <p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-primary">schedule</span><strong class="text-on-surface">${ui.formatTime(trip.departure_time)}</strong></p>
          <p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-primary">event_seat</span><strong class="text-on-surface">${trip.seats_remaining}/${trip.seats_total} available</strong></p>
        </div>
        <div class="space-y-2 text-sm">
          <p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-secondary">person</span><a href="/pages/profile.html?id=${trip.driver_id}" class="text-primary font-semibold hover:underline">${ui.escape(trip.driver_name)}</a></p>
          ${trip.fare ? `<p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-secondary">payments</span><strong class="text-on-surface">${trip.fare} EGP</strong></p>` : ''}
          <p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-secondary">my_location</span><strong class="text-on-surface">${trip.pickup_area_radius_km} km radius</strong></p>
        </div>
      </div>
    </div>`;
}

async function loadRequests() {
  try {
    const requests = await api.get(`/trips/${tripId}/requests`);
    const container = document.getElementById('requests-section');
    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div class="p-5 pb-3">
          <h3 class="text-base font-bold text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-lg text-secondary">pending_actions</span>Requests (${requests.length})
          </h3>
        </div>
        ${requests.length > 0 ? `
          <div class="divide-y divide-outline-variant/50">
            ${requests.map(r => `
              <div class="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 class="text-sm font-semibold text-on-surface">${ui.escape(r.rider_name)}</h4>
                  <p class="text-xs text-on-surface-variant mt-0.5">${ui.escape(r.university_email)} <span class="mx-1">&middot;</span> ${ui.statusBadge(r.status)}</p>
                </div>
                ${r.status === 'pending' ? `
                  <div class="flex gap-2">
                    <button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary text-on-secondary text-xs font-semibold" onclick="decide(${r.id}, 'approved')">
                      <span class="material-symbols-outlined text-sm">check</span>Accept</button>
                    <button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-error-container text-on-error-container text-xs font-semibold" onclick="decide(${r.id}, 'rejected')">
                      <span class="material-symbols-outlined text-sm">close</span>Reject</button>
                  </div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : '<div class="px-5 pb-4 text-sm text-on-surface-variant">No requests yet</div>'}
      </div>`;
  } catch {}
}

async function loadPassengers() {
  try {
    const passengers = await api.get(`/trips/${tripId}/passengers`);
    const container = document.getElementById('passengers-section');
    container.innerHTML = `
      <div class="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div class="p-5 pb-3">
          <h3 class="text-base font-bold text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-lg text-primary">groups</span>Confirmed Passengers (${passengers.length})
          </h3>
        </div>
        ${passengers.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-surface-container-low">
                <tr>
                  <th class="px-4 py-2.5 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Name</th>
                  <th class="px-4 py-2.5 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Email</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/30">
                ${passengers.map(p => `
                  <tr class="hover:bg-surface-container-low/50 transition-colors">
                    <td class="px-4 py-2.5 text-on-surface font-medium">${ui.escape(p.rider_name)}</td>
                    <td class="px-4 py-2.5 text-on-surface-variant">${ui.escape(p.university_email)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="px-5 pb-4 text-sm text-on-surface-variant">No confirmed passengers</div>'}
      </div>`;
  } catch {}
}

async function decide(requestId, decision) {
  try {
    await api.patch(`/requests/${requestId}/decision`, { decision });
    loadTrip();
  } catch (err) {
    ui.toast(err.message || 'Failed', 'error');
  }
}

loadTrip();
