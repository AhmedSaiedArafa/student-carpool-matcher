if (!auth.requireAuth() || !auth.requireRole('driver')) throw new Error('Access denied');

async function loadDashboard() {
  ui.showLoading('dashboard-content');
  try {
    const data = await api.get('/drivers/dashboard');
    renderDashboard(data);
  } catch (err) {
    ui.showError('dashboard-content', err.message);
  }
}

function renderDashboard(data) {
  const container = document.getElementById('dashboard-content');

  const statsHtml = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
        <div class="flex items-center gap-2 text-primary mb-1">
          <span class="material-symbols-outlined text-2xl">calendar_month</span>
          <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Upcoming Trips</span>
        </div>
        <span class="text-3xl font-bold text-on-surface">${data.upcoming.length}</span>
      </div>
      <div class="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
        <div class="flex items-center gap-2 text-secondary mb-1">
          <span class="material-symbols-outlined text-2xl">pending_actions</span>
          <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Pending Requests</span>
        </div>
        <span class="text-3xl font-bold text-on-surface">${data.pending.length}</span>
      </div>
      <div class="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
        <div class="flex items-center gap-2 text-primary mb-1">
          <span class="material-symbols-outlined text-2xl">groups</span>
          <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Confirmed Passengers</span>
        </div>
        <span class="text-3xl font-bold text-on-surface">${data.upcoming.reduce((s, t) => s + (t.seats_total - t.seats_remaining), 0)}</span>
      </div>
    </div>`;

  const pendingHtml = data.pending.length > 0 ? `
    <div class="mb-6">
      <h2 class="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-xl text-secondary">pending_actions</span>Pending Requests
      </h2>
      <div class="bg-surface-container-lowest rounded-2xl shadow-sm divide-y divide-outline-variant/50">
        ${data.pending.map(r => `
          <div class="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 class="text-sm font-semibold text-on-surface">${ui.escape(r.rider_name)}</h4>
              <p class="text-xs text-on-surface-variant mt-0.5">
                ${ui.escape(r.origin_name || '')} <span class="material-symbols-outlined text-xs align-middle">arrow_forward</span> ${ui.escape(r.destination_name || '')}
                <span class="mx-1">&middot;</span> ${ui.formatDate(r.trip_date)}
              </p>
              ${r.offered_fare != null ? `<p class="text-xs mt-0.5"><span class="font-semibold ${r.offered_fare != r.fare ? 'text-primary' : 'text-on-surface-variant'}">Offered: ${parseFloat(r.offered_fare).toFixed(2)} EGP</span>${r.offered_fare != r.fare && r.fare ? ` <span class="text-on-surface-variant">(Ride fare: ${parseFloat(r.fare).toFixed(2)} EGP)</span>` : ''}</p>` : ''}
            </div>
            <div class="flex gap-2">
              <button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary text-on-secondary text-xs font-semibold hover:opacity-95 transition-all" onclick="decide(${r.id}, 'approved')">
                <span class="material-symbols-outlined text-sm">check</span>Accept</button>
              <button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-error-container text-on-error-container text-xs font-semibold hover:opacity-90 transition-all" onclick="decide(${r.id}, 'rejected')">
                <span class="material-symbols-outlined text-sm">close</span>Reject</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>` : '';

  const upcomingHtml = `
    <div>
      <h2 class="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-xl text-primary">calendar_month</span>Upcoming Trips
      </h2>
      ${data.upcoming.length > 0 ? `<div class="space-y-3">${data.upcoming.map(t => `
        <div class="bg-surface-container-lowest rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div class="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <span class="material-symbols-outlined text-lg text-primary">trip_origin</span>
              ${ui.escape(t.origin_name || 'Origin')}
              <span class="material-symbols-outlined text-lg text-on-surface-variant">arrow_forward</span>
              <span class="material-symbols-outlined text-lg text-secondary">location_on</span>
              ${ui.escape(t.destination_name || 'Destination')}
            </div>
            ${ui.statusBadge(t.status)}
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant mb-3">
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">calendar_today</span>${ui.formatDate(t.trip_date)}</span>
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">${t.schedule_type === 'once' ? 'event' : 'repeat'}</span>${CONFIG.scheduleLabel(t)}</span>
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span>${ui.formatTime(t.departure_time)}</span>
            <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">event_seat</span>${t.seats_remaining}/${t.seats_total} seats left</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <a href="/pages/trip-detail.html?id=${t.id}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-outline-variant text-on-surface-variant text-xs font-semibold hover:bg-surface-container-low transition-all">
              <span class="material-symbols-outlined text-sm">visibility</span>View Details</a>
            <button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary text-on-secondary text-xs font-semibold hover:opacity-95 transition-all" onclick="completeTrip(${t.id})">
              <span class="material-symbols-outlined text-sm">check_circle</span>Complete</button>
            <button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-error-container text-on-error-container text-xs font-semibold hover:opacity-90 transition-all" onclick="cancelTrip(${t.id})">
              <span class="material-symbols-outlined text-sm">cancel</span>Cancel</button>
          </div>
        </div>
      `).join('')}</div>` : `
        <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant">
          <span class="material-symbols-outlined text-5xl mb-3 opacity-40">calendar_month</span>
          <p class="text-base font-medium">No upcoming trips</p>
        </div>`}
    </div>`;

  container.innerHTML = statsHtml + pendingHtml + upcomingHtml;
}

async function decide(requestId, decision) {
  try {
    await api.patch(`/requests/${requestId}/decision`, { decision });
    loadDashboard();
  } catch (err) {
    ui.toast(err.message || 'Failed to process request', 'error');
  }
}

async function completeTrip(tripId) {
  try {
    const passengers = await api.get(`/trips/${tripId}/passengers`);
    openAttendanceModal(tripId, passengers);
  } catch (err) {
    ui.toast(err.message || 'Failed to load passengers', 'error');
  }
}

function openAttendanceModal(tripId, passengers) {
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
      await api.patch(`/trips/${tripId}/complete`, { attendance });
      ui.toast('Trip marked as completed!');
      loadDashboard();
    } catch (err) {
      ui.toast(err.message || 'Failed to complete trip', 'error');
    }
  });
}

async function cancelTrip(tripId) {
  if (!confirm('Cancel this trip? All riders will be notified.')) return;
  try {
    await api.patch(`/trips/${tripId}/status`, { status: 'cancelled' });
    loadDashboard();
  } catch (err) {
    ui.toast(err.message || 'Failed to cancel trip', 'error');
  }
}

loadDashboard();
