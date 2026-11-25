if (!auth.requireAuth()) throw new Error('Not authenticated');

const user = auth.getUser();

async function loadHistory() {
  ui.showLoading('history-list');
  try {
    const history = await api.get('/history');
    await renderHistory(history);
  } catch (err) {
    ui.showError('history-list', err.message);
  }
}

async function renderHistory(trips) {
  const container = document.getElementById('history-list');
  if (trips.length === 0) {
    ui.showEmpty(container, 'No trip history yet');
    return;
  }

  const future = trips.filter(t => new Date(t.trip_date) >= new Date() && t.status === 'scheduled');
  const past = trips.filter(t => t.status === 'completed' || t.status === 'cancelled' || new Date(t.trip_date) < new Date());

  const pendingMap = {};
  const completedTrips = past.filter(t => t.status === 'completed');
  await Promise.all(completedTrips.map(async t => {
    try {
      pendingMap[t.id] = await api.get(`/trips/${t.id}/ratings/pending`);
    } catch { pendingMap[t.id] = []; }
  }));

  let html = '';
  if (future.length > 0) {
    html += `<h2 class="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
      <span class="material-symbols-outlined text-xl text-primary">upcoming</span>Upcoming</h2>`;
    html += `<div class="space-y-3 mb-6">${future.map(t => renderTripCard(t, false, [])).join('')}</div>`;
  }
  if (past.length > 0) {
    html += `<h2 class="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
      <span class="material-symbols-outlined text-xl text-on-surface-variant">history</span>Past Trips</h2>`;
    html += `<div class="space-y-3">${past.map(t => renderTripCard(t, true, pendingMap[t.id] || [])).join('')}</div>`;
  }
  container.innerHTML = html;
}

function renderTripCard(t, isPast, pendingRatings) {
  const ratingButtons = t.status === 'completed' && pendingRatings.length > 0
    ? `<div class="flex flex-wrap gap-2 mt-2" id="rate-buttons-${t.id}">${pendingRatings.map(p => `
        <button class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-700 text-xs font-semibold hover:bg-amber-500/25 transition-all" onclick="openRatingModal(${t.id}, ${p.id}, '${ui.escape(p.name).replace(/'/g, "\\'")}')">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL' 1">star</span>Rate ${ui.escape(p.name)}</button>
      `).join('')}</div>`
    : '';

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
      ${ratingButtons}
    </div>`;
}

let selectedScore = 0;

window.selectStar = function(value) {
  selectedScore = value;
  const container = document.getElementById('rating-stars');
  if (!container) return;
  const stars = container.querySelectorAll('span');
  stars.forEach((star, i) => {
    const filled = i < value;
    star.className = `material-symbols-outlined text-lg ${filled ? 'text-amber-500' : 'text-outline-variant'}`;
    star.style.fontVariationSettings = `'FILL' ${filled ? 1 : 0}`;
  });
};

function openRatingModal(tripId, subjectId, subjectName) {
  selectedScore = 0;
  const existing = document.getElementById('rating-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'rating-modal';
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40';
  modal.innerHTML = `
    <div class="bg-surface-container-lowest rounded-2xl shadow-lg p-6 w-full max-w-sm mx-4">
      <h3 class="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-amber-500" style="font-variation-settings:'FILL' 1">star</span>Rate ${ui.escape(subjectName)}
      </h3>
      <div class="flex justify-center mb-4" id="rating-stars">
        ${ui.starRating(0, true)}
      </div>
      <textarea id="rating-comment" placeholder="Optional comment (max 300 chars)" maxlength="300" rows="2"
        class="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all mb-4 resize-none"></textarea>
      <div class="flex justify-end gap-2">
        <button id="rating-cancel" class="px-4 py-2 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-all">Cancel</button>
        <button id="rating-submit" class="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold shadow-sm hover:bg-primary-container transition-all">Submit</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const starsContainer = document.getElementById('rating-stars');
  const innerDiv = starsContainer.querySelector('div');
  if (innerDiv) innerDiv.id = '';
  starsContainer.id = 'rating-stars';

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById('rating-cancel').addEventListener('click', () => modal.remove());
  document.getElementById('rating-submit').addEventListener('click', async () => {
    if (selectedScore < 1) {
      ui.toast('Please select a star rating', 'error');
      return;
    }
    const comment = document.getElementById('rating-comment').value.trim();
    modal.remove();
    try {
      await api.post(`/trips/${tripId}/ratings`, { subject_id: subjectId, score: selectedScore, comment: comment || undefined });
      ui.toast(`Rated ${subjectName} ${'★'.repeat(selectedScore)}`);
      loadHistory();
    } catch (err) {
      ui.toast(err.message || 'Failed to submit rating', 'error');
    }
  });
}

loadHistory();
