if (!auth.requireAuth()) throw new Error('Not authenticated');

const userId = new URLSearchParams(window.location.search).get('id');
if (!userId) window.location.href = '/';

async function loadProfile() {
  ui.showLoading('profile-content');
  try {
    const [reliability, badges, ratings] = await Promise.all([
      api.get(`/users/${userId}/reliability`),
      api.get(`/users/${userId}/badges`),
      api.get(`/users/${userId}/ratings`),
    ]);
    renderProfile(reliability, badges, ratings);
  } catch (err) {
    ui.showError('profile-content', err.message);
  }
}

function renderProfile(reliability, badges, ratings) {
  const container = document.getElementById('profile-content');

  container.innerHTML = `
    <div class="bg-surface-container-lowest rounded-2xl shadow-sm p-6 mb-4">
      <h2 class="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-xl text-primary">monitoring</span>Reliability Stats
      </h2>
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="bg-surface-container-low rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-on-surface">${reliability.average_score.toFixed(1)}</div>
          <div class="text-xs font-semibold text-on-surface-variant mt-1">Average Rating</div>
          <div class="mt-2">${ui.starRating(Math.round(reliability.average_score))}</div>
        </div>
        <div class="bg-surface-container-low rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-on-surface">${reliability.rating_count}</div>
          <div class="text-xs font-semibold text-on-surface-variant mt-1">Total Ratings</div>
        </div>
        <div class="bg-surface-container-low rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-secondary">${(reliability.completion_rate * 100).toFixed(0)}%</div>
          <div class="text-xs font-semibold text-on-surface-variant mt-1">Completion Rate</div>
          <div class="w-full bg-surface-container-high rounded-full h-1.5 mt-2">
            <div class="bg-secondary rounded-full h-1.5 transition-all" style="width:${reliability.completion_rate * 100}%"></div>
          </div>
        </div>
        <div class="bg-surface-container-low rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-primary">${(reliability.punctuality_rate * 100).toFixed(0)}%</div>
          <div class="text-xs font-semibold text-on-surface-variant mt-1">Punctuality</div>
          <div class="w-full bg-surface-container-high rounded-full h-1.5 mt-2">
            <div class="bg-primary rounded-full h-1.5 transition-all" style="width:${reliability.punctuality_rate * 100}%"></div>
          </div>
        </div>
        <div class="bg-surface-container-low rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-error">${(reliability.cancellation_rate * 100).toFixed(0)}%</div>
          <div class="text-xs font-semibold text-on-surface-variant mt-1">Cancellation Rate</div>
        </div>
      </div>
    </div>

    <div class="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
      <h2 class="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-xl text-amber-500" style="font-variation-settings:'FILL' 1">emoji_events</span>Badges
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${badges.map(b => {
        const levelColors = { bronze: 'bg-amber-700/15 text-amber-800 border-amber-700/30', silver: 'bg-slate-300/20 text-slate-700 border-slate-400/40', gold: 'bg-amber-400/20 text-amber-700 border-amber-400/50', driver: 'bg-primary-fixed text-on-primary-fixed border-primary/30', rider: 'bg-secondary-container text-on-secondary-container border-secondary/30', special: 'bg-purple-100 text-purple-800 border-purple-300/50' };
        const color = b.earned ? (levelColors[b.level] || 'bg-surface-container text-on-surface border-outline-variant') : 'bg-surface-container-low text-on-surface-variant border-outline-variant/50 opacity-60';
        let progressText = '';
        if (!b.earned && b.progress) {
          const parts = [];
          if (b.progress.rating && b.progress.rating.current < b.progress.rating.target) parts.push('needs ' + b.progress.rating.target + '★ (now ' + b.progress.rating.current.toFixed(1) + '★)');
          if (b.progress.ratings && b.progress.ratings.current < b.progress.ratings.target) parts.push(b.progress.ratings.target + ' ratings (now ' + b.progress.ratings.current + ')');
          if (b.progress.trips && b.progress.trips.current < b.progress.trips.target) parts.push(b.progress.trips.target + ' trips (now ' + b.progress.trips.current + ')');
          if (parts.length > 0) progressText = parts.join(' and ');
        }
        return `
          <div class="flex items-start gap-3 px-4 py-3 rounded-xl border ${color}">
            <span class="material-symbols-outlined text-xl mt-0.5" style="font-variation-settings:'FILL' ${b.earned ? 1 : 0}">${b.earned ? 'emoji_events' : 'lock'}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold">${ui.escape(b.name)}</span>
                <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">${ui.escape(b.level)}</span>
              </div>
              <p class="text-xs mt-0.5">${ui.escape(b.description)}</p>
              ${!b.earned && progressText ? `<p class="text-xs mt-1 font-medium">${ui.escape(progressText)}</p>` : ''}
            </div>
          </div>`;
      }).join('')}</div>
    </div>

    <div class="bg-surface-container-lowest rounded-2xl shadow-sm p-6 mt-4">
      <h2 class="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-xl text-primary">reviews</span>Recent Reviews
      </h2>
      ${ratings.length > 0
        ? `<div class="space-y-3">${ratings.map(r => `
            <div class="bg-surface-container-low rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  ${ui.starRating(r.score)}
                  <span class="text-xs font-semibold text-on-surface-variant">by ${ui.escape(r.author_name)}</span>
                </div>
                <span class="text-xs text-on-surface-variant">${ui.formatDate(r.created_at)}</span>
              </div>
              ${r.comment ? `<p class="text-sm text-on-surface">${ui.escape(r.comment)}</p>` : ''}
              <p class="text-xs text-on-surface-variant mt-1">${ui.escape(r.origin_name || 'Origin')} → ${ui.escape(r.destination_name || 'Destination')} · ${ui.formatDate(r.trip_date)}</p>
            </div>
          `).join('')}</div>`
        : `<div class="flex flex-col items-center justify-center py-8 text-on-surface-variant">
            <span class="material-symbols-outlined text-5xl mb-3 opacity-40">reviews</span>
            <p class="text-base font-medium">No reviews yet</p>
          </div>`}
    </div>`;
}

loadProfile();
