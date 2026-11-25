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
          <p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-primary">${trip.schedule_type === 'once' ? 'event' : 'repeat'}</span><strong class="text-on-surface">${CONFIG.scheduleLabel(trip)}</strong></p>
          <p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-primary">schedule</span><strong class="text-on-surface">${ui.formatTime(trip.departure_time)}</strong></p>
          <p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-primary">event_seat</span><strong class="text-on-surface">${trip.seats_remaining}/${trip.seats_total} available</strong></p>
        </div>
        <div class="space-y-2 text-sm">
          <p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-secondary">person</span><a href="/pages/profile.html?id=${trip.driver_id}" class="text-primary font-semibold hover:underline">${ui.escape(trip.driver_name)}</a></p>
          ${trip.fare ? `<p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-secondary">payments</span><strong class="text-on-surface">${trip.fare} EGP</strong></p>` : ''}
          <p class="flex items-center gap-2 text-on-surface-variant"><span class="material-symbols-outlined text-lg text-secondary">my_location</span><strong class="text-on-surface">${trip.pickup_area_radius_km} km radius</strong></p>
        </div>
      </div>
      ${trip.status === 'scheduled' && auth.getUser()?.role === 'driver' && trip.driver_id === auth.getUser()?.id ? `
        <div class="mt-4 flex gap-2">
          <button class="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-secondary text-on-secondary text-sm font-semibold hover:opacity-95 transition-all" onclick="completeTrip(${trip.id})">
            <span class="material-symbols-outlined text-sm">check_circle</span>Complete Trip</button>
        </div>` : ''}
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
                  ${r.offered_fare != null ? `<p class="text-xs mt-0.5"><span class="font-semibold ${r.offered_fare != r.fare ? 'text-primary' : 'text-on-surface-variant'}">Offered: ${parseFloat(r.offered_fare).toFixed(2)} EGP</span>${r.offered_fare != r.fare && r.fare ? ` <span class="text-on-surface-variant">(Ride fare: ${parseFloat(r.fare).toFixed(2)} EGP)</span>` : ''}</p>` : ''}
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
                  <th class="px-4 py-2.5 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Offered Fare</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/30">
                ${passengers.map(p => `
                  <tr class="hover:bg-surface-container-low/50 transition-colors">
                    <td class="px-4 py-2.5 text-on-surface font-medium">${ui.escape(p.rider_name)}</td>
                    <td class="px-4 py-2.5 text-on-surface-variant">${ui.escape(p.university_email)}</td>
                    <td class="px-4 py-2.5 text-on-surface-variant">${p.offered_fare != null ? parseFloat(p.offered_fare).toFixed(2) + ' EGP' : '-'}</td>
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

async function completeTrip(id) {
  try {
    const passengers = await api.get(`/trips/${id}/passengers`);
    openAttendanceModal(id, passengers);
  } catch (err) {
    ui.toast(err.message || 'Failed to load passengers', 'error');
  }
}

function openAttendanceModal(id, passengers) {
  const existing = document.getElementById('attendance-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'attendance-modal';
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40';
  modal.innerHTML = `
    <div class="bg-surface-container-lowest rounded-2xl shadow-lg p-6 w-full max-w-md mx-4">
      <h3 class="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">check_circle</span>Complete Trip – Attendance
      </h3>
      ${passengers.length > 0 ? `
        <div class="space-y-2 mb-4">${passengers.map(p => `
          <label class="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low cursor-pointer">
            <input type="checkbox" checked data-rider-id="${p.rider_id}" class="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary">
            <span class="text-sm font-medium text-on-surface">${ui.escape(p.rider_name)}</span>
            <span class="text-xs text-on-surface-variant">Showed up</span>
          </label>
        `).join('')}</div>
      ` : '<p class="text-sm text-on-surface-variant mb-4">No confirmed passengers</p>'}
      <div class="flex justify-end gap-2">
        <button id="attendance-cancel" class="px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-all">Cancel</button>
        <button id="attendance-submit" class="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-sm font-semibold shadow-sm hover:opacity-95 transition-all">Complete Trip</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById('attendance-cancel').addEventListener('click', () => modal.remove());
  document.getElementById('attendance-submit').addEventListener('click', async () => {
    const checkboxes = modal.querySelectorAll('input[data-rider-id]');
    const attendance = Array.from(checkboxes).map(cb => ({
      rider_id: parseInt(cb.dataset.riderId),
      showed_up: cb.checked,
    }));
    modal.remove();
    try {
      await api.patch(`/trips/${id}/complete`, { attendance });
      ui.toast('Trip marked as completed!');
      loadTrip();
    } catch (err) {
      ui.toast(err.message || 'Failed to complete trip', 'error');
    }
  });
}

loadTrip();
