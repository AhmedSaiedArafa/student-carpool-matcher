if (!auth.requireAuth() || !auth.requireRole('driver')) throw new Error('Access denied');

async function loadRides() {
  ui.showLoading('rides-list');
  try {
    const rides = await api.get('/rides/mine');
    renderRides(rides);
  } catch (err) {
    ui.showError('rides-list', err.message);
  }
}

function renderRides(rides) {
  const container = document.getElementById('rides-list');
  if (rides.length === 0) {
    ui.showEmpty(container, 'No rides published yet');
    return;
  }

  container.innerHTML = `<div class="space-y-4">${rides.map(r => `
    <div class="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
      <div class="p-5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <div class="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <span class="material-symbols-outlined text-lg text-primary">trip_origin</span>
              ${ui.escape(r.origin_name || r.origin_lat + ', ' + r.origin_lng)}
              <span class="material-symbols-outlined text-lg text-on-surface-variant">arrow_forward</span>
              <span class="material-symbols-outlined text-lg text-secondary">location_on</span>
              ${ui.escape(r.destination_name || r.destination_lat + ', ' + r.destination_lng)}
            </div>
            <div class="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant mt-2">
              <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">repeat</span>Every ${CONFIG.WEEKDAYS[r.weekday]}</span>
              <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span>${ui.formatTime(r.departure_time)}</span>
              <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">event_seat</span>${r.seats_total} seats</span>
              ${r.fare ? `<span class="inline-flex items-center gap-1 font-semibold text-secondary"><span class="material-symbols-outlined text-sm">payments</span>${r.fare} EGP</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${ui.statusBadge(r.status)}
            ${r.status === 'active' ? `<button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-outline-variant text-on-surface-variant text-xs font-semibold hover:bg-surface-container-low transition-all" onclick="toggleStatus(${r.id}, 'paused')"><span class="material-symbols-outlined text-sm">pause</span>Pause</button>` : ''}
            ${r.status === 'paused' ? `<button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary text-on-secondary text-xs font-semibold hover:opacity-95 transition-all" onclick="toggleStatus(${r.id}, 'active')"><span class="material-symbols-outlined text-sm">play_arrow</span>Resume</button>` : ''}
            ${r.status !== 'cancelled' ? `<button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-error-container text-on-error-container text-xs font-semibold hover:opacity-90 transition-all" onclick="toggleStatus(${r.id}, 'cancelled')"><span class="material-symbols-outlined text-sm">cancel</span>Cancel</button>` : ''}
          </div>
        </div>
      </div>
      ${r.trips && r.trips.length > 0 ? `
        <div class="border-t border-outline-variant/50 overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-surface-container-low">
              <tr>
                <th class="px-4 py-2.5 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Date</th>
                <th class="px-4 py-2.5 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Seats Left</th>
                <th class="px-4 py-2.5 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                <th class="px-4 py-2.5 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/30">
              ${r.trips.map(t => `
                <tr class="hover:bg-surface-container-low/50 transition-colors">
                  <td class="px-4 py-2.5 text-on-surface">${ui.formatDate(t.trip_date)}</td>
                  <td class="px-4 py-2.5 text-on-surface">${t.seats_remaining}/${r.seats_total}</td>
                  <td class="px-4 py-2.5">${ui.statusBadge(t.status)}</td>
                  <td class="px-4 py-2.5">
                    <a href="/pages/trip-detail.html?id=${t.id}" class="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-outline-variant text-on-surface-variant text-xs font-semibold hover:bg-surface-container-low transition-all">
                      <span class="material-symbols-outlined text-xs">visibility</span>Details</a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="px-5 pb-4 text-sm text-on-surface-variant">No trip instances yet</div>'}
    </div>
  `).join('')}</div>`;
}

async function toggleStatus(rideId, status) {
  if (status === 'cancelled' && !confirm('Cancel this ride template? This cannot be undone.')) return;
  try {
    await api.patch(`/rides/${rideId}/status`, { status });
    loadRides();
  } catch (err) {
    ui.toast(err.message || 'Failed to update status', 'error');
  }
}

loadRides();
