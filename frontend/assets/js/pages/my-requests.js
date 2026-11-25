if (!auth.requireAuth()) throw new Error('Not authenticated');

async function loadRequests() {
  ui.showLoading('requests-list');
  try {
    const requests = await api.get('/requests/mine');
    renderRequests(requests);
  } catch (err) {
    ui.showError('requests-list', err.message);
  }
}

function renderRequests(requests) {
  const container = document.getElementById('requests-list');
  if (requests.length === 0) {
    ui.showEmpty(container, 'No ride requests yet');
    return;
  }

  container.innerHTML = `<div class="space-y-3">${requests.map(r => `
    <div class="bg-surface-container-lowest rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div class="flex items-center gap-2 text-sm font-semibold text-on-surface">
          <span class="material-symbols-outlined text-lg text-primary">trip_origin</span>
          ${ui.escape(r.origin_name || 'Origin')}
          <span class="material-symbols-outlined text-lg text-on-surface-variant">arrow_forward</span>
          <span class="material-symbols-outlined text-lg text-secondary">location_on</span>
          ${ui.escape(r.destination_name || 'Destination')}
        </div>
        ${ui.statusBadge(r.status)}
      </div>
      <div class="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant mb-3">
        <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">calendar_today</span>${ui.formatDate(r.trip_date)}</span>
        <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">person</span>${ui.escape(r.driver_name)}</span>
        ${r.fare ? `<span class="inline-flex items-center gap-1 font-semibold text-secondary"><span class="material-symbols-outlined text-sm">payments</span>${r.fare} EGP</span>` : ''}
      </div>
      <div class="flex flex-wrap gap-2">
        ${['pending', 'approved'].includes(r.status)
          ? `<button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-error-container text-on-error-container text-xs font-semibold hover:opacity-90 transition-all" onclick="withdrawRequest(${r.id})">
              <span class="material-symbols-outlined text-sm">${r.status === 'approved' ? 'cancel' : 'undo'}</span>${r.status === 'approved' ? 'Cancel' : 'Withdraw'}</button>`
          : ''}
      </div>
    </div>
  `).join('')}</div>`;
}

async function withdrawRequest(requestId) {
  if (!confirm('Withdraw this request?')) return;
  try {
    await api.delete(`/requests/${requestId}`);
    loadRequests();
  } catch (err) {
    ui.toast(err.message || 'Failed to withdraw request', 'error');
  }
}

loadRequests();
