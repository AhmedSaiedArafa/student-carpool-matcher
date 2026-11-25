if (!auth.requireAuth()) throw new Error('Not authenticated');

async function loadNotifications() {
  ui.showLoading('notifications-list');
  try {
    const notifications = await api.get('/notifications');
    renderNotifications(notifications);
  } catch (err) {
    ui.showError('notifications-list', err.message);
  }
}

function renderNotifications(notifications) {
  const container = document.getElementById('notifications-list');
  if (notifications.length === 0) {
    ui.showEmpty(container, 'No notifications');
    return;
  }

  container.innerHTML = `
    <div class="flex justify-end mb-4">
      <button class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant text-xs font-semibold hover:bg-surface-container-low transition-all" onclick="markAllRead()">
        <span class="material-symbols-outlined text-sm">done_all</span>Mark all as read
      </button>
    </div>
    <div class="bg-surface-container-lowest rounded-2xl shadow-sm divide-y divide-outline-variant/50 overflow-hidden">
      ${notifications.map(n => `
        <div class="px-5 py-4 cursor-pointer hover:bg-surface-container-low/50 transition-colors ${n.is_read ? '' : 'bg-primary-fixed/20'}" onclick="markRead(${n.id})">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-lg mt-0.5 ${n.is_read ? 'text-on-surface-variant' : 'text-primary'}" style="font-variation-settings:'FILL' ${n.is_read ? 0 : 1}">notifications</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm ${n.is_read ? 'text-on-surface-variant' : 'text-on-surface font-semibold'}">${ui.escape(n.message)}</p>
              <p class="text-xs text-on-surface-variant mt-1">${ui.formatDateTime(n.created_at)}</p>
            </div>
            ${!n.is_read ? '<span class="w-2 h-2 rounded-full bg-primary mt-2 shrink-0"></span>' : ''}
          </div>
        </div>
      `).join('')}
    </div>`;
}

async function markRead(id) {
  try {
    await api.patch(`/notifications/${id}/read`);
    loadNotifications();
  } catch {}
}

async function markAllRead() {
  try {
    await api.patch('/notifications/read-all');
    loadNotifications();
  } catch {}
}

loadNotifications();
