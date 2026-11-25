if (!auth.requireAuth()) throw new Error('Not authenticated');

const userId = new URLSearchParams(window.location.search).get('id');
if (!userId) window.location.href = '/';

async function loadProfile() {
  ui.showLoading('profile-content');
  try {
    const [reliability, badges] = await Promise.all([
      api.get(`/users/${userId}/reliability`),
      api.get(`/users/${userId}/badges`),
    ]);
    renderProfile(reliability, badges);
  } catch (err) {
    ui.showError('profile-content', err.message);
  }
}

function renderProfile(reliability, badges) {
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
      ${badges.length > 0
        ? `<div class="flex flex-wrap gap-3">${badges.map(b => `
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-fixed text-on-primary-fixed">
              <span class="material-symbols-outlined text-lg" style="font-variation-settings:'FILL' 1">emoji_events</span>
              <div>
                <span class="text-sm font-semibold">${ui.escape(b.name)}</span>
                <span class="text-xs text-on-surface-variant ml-1">${ui.escape(b.description)}</span>
              </div>
            </div>
          `).join('')}</div>`
        : `<div class="flex flex-col items-center justify-center py-8 text-on-surface-variant">
            <span class="material-symbols-outlined text-5xl mb-3 opacity-40">emoji_events</span>
            <p class="text-base font-medium">No badges earned yet</p>
          </div>`}
    </div>`;
}

loadProfile();
