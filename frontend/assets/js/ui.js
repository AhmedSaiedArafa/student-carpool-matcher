const ui = {
  showError(container, message) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.innerHTML = `<div class="p-4 rounded-xl bg-error-container text-on-error-container text-sm font-medium flex items-center gap-2">
      <span class="material-symbols-outlined text-lg">error</span>${this.escape(message)}</div>`;
  },

  showSuccess(container, message) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.innerHTML = `<div class="p-4 rounded-xl bg-secondary-container text-on-secondary-container text-sm font-medium flex items-center gap-2">
      <span class="material-symbols-outlined text-lg">check_circle</span>${this.escape(message)}</div>`;
  },

  showLoading(container) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.innerHTML = `<div class="flex items-center justify-center py-16">
      <span class="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span></div>`;
  },

  showEmpty(container, message = 'Nothing to show') {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-on-surface-variant">
      <span class="material-symbols-outlined text-5xl mb-3 opacity-40">inbox</span>
      <p class="text-base font-medium">${this.escape(message)}</p></div>`;
  },

  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },

  formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  },

  formatDateTime(dtStr) {
    return new Date(dtStr).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  },

  statusBadge(status) {
    const map = {
      active: 'bg-secondary-container text-on-secondary-container',
      paused: 'bg-surface-container-high text-on-surface-variant',
      cancelled: 'bg-error-container text-on-error-container',
      scheduled: 'bg-primary-fixed text-on-primary-fixed',
      completed: 'bg-secondary-container text-on-secondary-container',
      pending: 'bg-surface-container-high text-on-surface-variant',
      approved: 'bg-secondary-container text-on-secondary-container',
      rejected: 'bg-error-container text-on-error-container',
      withdrawn: 'bg-error-container text-on-error-container',
      waiting: 'bg-surface-container-high text-on-surface-variant',
      offered: 'bg-primary-fixed text-on-primary-fixed',
    };
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${map[status] || 'bg-surface-container text-on-surface-variant'}">${status}</span>`;
  },

  starRating(score, interactive = false, containerId = '') {
    let html = `<div class="flex items-center gap-0.5"${containerId ? ` id="${containerId}"` : ''}>`;
    for (let i = 1; i <= 5; i++) {
      const filled = i <= score;
      const click = interactive ? ` onclick="selectStar(${i})" data-value="${i}" style="cursor:pointer"` : '';
      html += `<span class="material-symbols-outlined text-lg ${filled ? 'text-amber-500' : 'text-outline-variant'}"${click} style="font-variation-settings: 'FILL' ${filled ? 1 : 0}">star</span>`;
    }
    html += '</div>';
    return html;
  },

  toast(message, type = 'success') {
    const existing = document.getElementById('ui-toast');
    if (existing) existing.remove();
    const isError = type === 'error';
    const toast = document.createElement('div');
    toast.id = 'ui-toast';
    toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold transition-all duration-300 ${isError ? 'bg-error text-on-error' : 'bg-secondary-container text-on-secondary-container'}`;
    toast.innerHTML = `<span class="material-symbols-outlined text-lg">${isError ? 'error' : 'check_circle'}</span>${this.escape(message)}`;
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 12px)';
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translate(-50%, 0)'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 12px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  buildNav() {
    const user = auth.getUser();
    const header = document.getElementById('app-header');
    if (!header) return;

    const isDriver = user?.role === 'driver';
    const currentPath = window.location.pathname;

    function navLink(href, label, icon) {
      const hrefBase = href.replace('.html', '');
      const pathBase = currentPath.replace('.html', '');
      const active = pathBase === hrefBase || pathBase.endsWith(hrefBase);
      return `<a href="${href}" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${active ? 'bg-primary-fixed text-on-primary-fixed' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'}">
        <span class="material-symbols-outlined text-lg">${icon}</span><span class="hidden lg:inline">${label}</span></a>`;
    }

    const navLinks = user ? (isDriver
      ? navLink('/pages/dashboard.html', 'Dashboard', 'dashboard')
        + navLink('/pages/my-rides.html', 'My Rides', 'directions_car')
        + navLink('/pages/publish-ride.html', 'Publish Ride', 'add_circle')
        + navLink('/pages/history.html', 'History', 'history')
      : navLink('/pages/search.html', 'Find Rides', 'search')
        + navLink('/pages/my-requests.html', 'My Requests', 'commute')
        + navLink('/pages/history.html', 'History', 'history'))
      : '';

    const userArea = user
      ? `<div class="flex items-center gap-2">
           <button onclick="window.location.href='/pages/notifications.html'" class="relative p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors" title="Notifications">
             <span class="material-symbols-outlined text-xl">notifications</span>
             <span id="notif-count" class="absolute top-1 right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-on-error">0</span>
           </button>
           <a href="/pages/profile.html?id=${user.id}" class="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-surface-container-low transition-colors">
             <div class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-sm font-bold">${user.name.charAt(0).toUpperCase()}</div>
             <span class="hidden sm:block text-sm font-semibold text-on-surface">${ui.escape(user.name)}</span>
           </a>
           <button onclick="auth.logout()" class="px-3 py-1.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors">
             <span class="material-symbols-outlined text-lg">logout</span>
           </button>
         </div>`
      : `<a href="/pages/login.html" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold shadow-sm hover:bg-primary-container transition-all">
           <span class="material-symbols-outlined text-lg">login</span>Sign In</a>`;

    header.innerHTML = `
      <div class="h-16 max-w-7xl mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
        <a href="/" class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md">
            <span class="material-symbols-outlined text-xl" style="font-variation-settings:'FILL' 1">directions_car</span>
          </div>
          <div class="flex flex-col">
            <span class="text-base font-bold text-primary tracking-tight leading-tight">CarpoolMatch</span>
            <span class="text-[10px] font-semibold text-on-surface-variant tracking-wide">Greater Cairo Campuses</span>
          </div>
        </a>
        <nav class="hidden md:flex items-center gap-1">${navLinks}</nav>
        ${userArea}
      </div>`;

    if (user) loadNotificationCount();
  },
};

async function loadNotificationCount() {
  try {
    const notifications = await api.get('/notifications?unread=true');
    const badge = document.getElementById('notif-count');
    if (badge && notifications.length > 0) {
      badge.textContent = notifications.length;
      badge.classList.remove('hidden');
      badge.classList.add('flex');
    }
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => ui.buildNav());
