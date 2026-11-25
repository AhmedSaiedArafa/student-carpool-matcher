if (!auth.requireAuth()) throw new Error('Not authenticated');

const user = auth.getUser();

async function loadHistory() {
  ui.showLoading('history-list');
  try {
    const history = await api.get('/history');
    renderHistory(history);
  } catch (err) {
    ui.showError('history-list', err.message);
  }
}

function renderHistory(trips) {
  const container = document.getElementById('history-list');
  if (trips.length === 0) {
    ui.showEmpty(container, 'No trip history yet');
    return;
  }

  const future = trips.filter(t => new Date(t.trip_date) >= new Date() && t.status === 'scheduled');
  const past = trips.filter(t => t.status === 'completed' || t.status === 'cancelled' || new Date(t.trip_date) < new Date());

  let html = '';
  if (future.length > 0) {
    html += `<h2 class="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
      <span class="material-symbols-outlined text-xl text-primary">upcoming</span>Upcoming</h2>`;
    html += `<div class="space-y-3 mb-6">${future.map(t => renderTripCard(t, false)).join('')}</div>`;
  }
  if (past.length > 0) {
    html += `<h2 class="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
      <span class="material-symbols-outlined text-xl text-on-surface-variant">history</span>Past Trips</h2>`;
    html += `<div class="space-y-3">${past.map(t => renderTripCard(t, true)).join('')}</div>`;
  }
  container.innerHTML = html;
}

function renderTripCard(t, isPast) {
  return `
    <div class="bg-surface-container-lowest rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow ${isPast ? 'opacity-80' : ''}">
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
        ${t.driver_name ? `<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">person</span>${ui.escape(t.driver_name)}</span>` : ''}
        ${t.passenger_count !== undefined ? `<span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">groups</span>${t.passenger_count} passengers</span>` : ''}
        ${t.fare ? `<span class="inline-flex items-center gap-1 font-semibold text-secondary"><span class="material-symbols-outlined text-sm">payments</span>${t.fare} EGP</span>` : ''}
      </div>
    </div>`;
}

loadHistory();
