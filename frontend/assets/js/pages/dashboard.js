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
  if (!confirm('Mark this trip as completed?')) return;
  try {
    await api.patch(`/trips/${tripId}/complete`);
    loadDashboard();
  } catch (err) {
    ui.toast(err.message || 'Failed to complete trip', 'error');
  }
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
