if (!auth.requireAuth() || !auth.requireRole('driver')) throw new Error('Access denied');

let scheduleType = 'weekly';
const selectedWeekdays = new Set();

function buildTime() {
  const h = document.getElementById('depHour').value;
  const m = document.getElementById('depMin').value;
  const ampm = document.getElementById('depAmpm').value;
  if (!h || !m) return '';
  let hour = parseInt(h);
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${m}`;
}

// Schedule type toggle
window.setScheduleType = function(type) {
  scheduleType = type;
  const onceBtn = document.getElementById('toggle-once');
  const weeklyBtn = document.getElementById('toggle-weekly');
  const onceFields = document.getElementById('once-fields');
  const weeklyFields = document.getElementById('weekly-fields');

  if (type === 'once') {
    onceBtn.className = 'flex-1 px-3 py-2 text-xs font-semibold text-center transition-all bg-primary text-on-primary';
    weeklyBtn.className = 'flex-1 px-3 py-2 text-xs font-semibold text-center transition-all text-on-surface-variant hover:bg-surface-container-low';
    onceFields.classList.remove('hidden');
    weeklyFields.classList.add('hidden');
  } else {
    weeklyBtn.className = 'flex-1 px-3 py-2 text-xs font-semibold text-center transition-all bg-primary text-on-primary';
    onceBtn.className = 'flex-1 px-3 py-2 text-xs font-semibold text-center transition-all text-on-surface-variant hover:bg-surface-container-low';
    weeklyFields.classList.remove('hidden');
    onceFields.classList.add('hidden');
  }
  updatePreview();
};

// Weekday chips
function initWeekdayChips() {
  const container = document.getElementById('weekday-chips');
  CONFIG.WEEKDAYS.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = name.slice(0, 3);
    btn.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-all';
    btn.dataset.day = i;
    btn.addEventListener('click', () => {
      if (selectedWeekdays.has(i)) {
        selectedWeekdays.delete(i);
        btn.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-all';
      } else {
        selectedWeekdays.add(i);
        btn.className = 'px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-on-primary shadow-sm transition-all';
      }
      updatePreview();
    });
    container.appendChild(btn);
  });
}

// Duration toggle
document.getElementById('duration').addEventListener('change', () => {
  const custom = document.getElementById('duration').value === 'custom';
  document.getElementById('custom-end-wrapper').classList.toggle('hidden', !custom);
  updatePreview();
});

// Set min date to today
const todayStr = new Date().toISOString().split('T')[0];
document.getElementById('tripDate').min = todayStr;
document.getElementById('startDate').min = todayStr;
document.getElementById('endDate').min = todayStr;
document.getElementById('startDate').value = todayStr;

document.getElementById('tripDate').addEventListener('change', updatePreview);
document.getElementById('startDate').addEventListener('change', updatePreview);
document.getElementById('endDate').addEventListener('change', updatePreview);

function computeEndDate(startDate, duration) {
  const d = new Date(startDate);
  switch (duration) {
    case '1w': d.setDate(d.getDate() + 6); return d;
    case '2w': d.setDate(d.getDate() + 13); return d;
    case '1m': d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); return d;
    case '3m': d.setMonth(d.getMonth() + 3); d.setDate(d.getDate() - 1); return d;
    default: return null;
  }
}

function countTrips(weekdays, startDate, endDate) {
  let count = 0;
  const d = new Date(startDate);
  const end = new Date(endDate);
  while (d <= end) {
    if (weekdays.has(d.getDay())) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function updatePreview() {
  const preview = document.getElementById('schedule-preview');
  const textEl = document.getElementById('preview-text');
  const time = buildTime();
  const timeStr = time ? `, ${ui.formatTime(time)}` : '';

  if (scheduleType === 'once') {
    const tripDate = document.getElementById('tripDate').value;
    if (!tripDate) { preview.classList.add('hidden'); return; }
    textEl.textContent = `One time on ${formatDateShort(tripDate)}${timeStr}`;
    preview.classList.remove('hidden');
    return;
  }

  if (selectedWeekdays.size === 0) { preview.classList.add('hidden'); return; }
  const startDate = document.getElementById('startDate').value;
  if (!startDate) { preview.classList.add('hidden'); return; }

  const dur = document.getElementById('duration').value;
  let endDate;
  if (dur === 'custom') {
    endDate = document.getElementById('endDate').value;
    if (!endDate) { preview.classList.add('hidden'); return; }
  } else {
    const computed = computeEndDate(startDate, dur);
    if (!computed) { preview.classList.add('hidden'); return; }
    endDate = computed.toISOString().split('T')[0];
  }

  const dayNames = [...selectedWeekdays].sort().map(d => CONFIG.WEEKDAYS[d].slice(0, 3));
  const trips = countTrips(selectedWeekdays, startDate, endDate);
  textEl.textContent = `Every ${dayNames.join(' & ')}${timeStr}, from ${formatDateShort(startDate)} to ${formatDateShort(endDate)} (${trips} trip${trips !== 1 ? 's' : ''})`;
  preview.classList.remove('hidden');
}

initWeekdayChips();

document.getElementById('ride-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const originLat = document.getElementById('originLat').value;
  const originLng = document.getElementById('originLng').value;
  const destLat = document.getElementById('destLat').value;
  const destLng = document.getElementById('destLng').value;
  const depTime = buildTime();

  if (!originLat || !originLng) {
    ui.showError('error-msg', 'Please select a pickup location on the map or search for one.');
    return;
  }
  if (!destLat || !destLng) {
    ui.showError('error-msg', 'Please select a drop-off location on the map or search for one.');
    return;
  }
  if (!depTime) {
    ui.showError('error-msg', 'Please select a departure time.');
    return;
  }
  document.getElementById('departureTime').value = depTime;

  if (scheduleType === 'once') {
    if (!document.getElementById('tripDate').value) {
      ui.showError('error-msg', 'Please select a date for the one-time ride.');
      return;
    }
  } else {
    if (selectedWeekdays.size === 0) {
      ui.showError('error-msg', 'Please select at least one day of the week.');
      return;
    }
    if (!document.getElementById('startDate').value) {
      ui.showError('error-msg', 'Please select a start date.');
      return;
    }
    if (document.getElementById('duration').value === 'custom' && !document.getElementById('endDate').value) {
      ui.showError('error-msg', 'Please select an end date.');
      return;
    }
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">progress_activity</span> Publishing...';
  document.getElementById('error-msg').innerHTML = '';

  try {
    const body = {
      origin_lat: parseFloat(originLat),
      origin_lng: parseFloat(originLng),
      origin_name: document.getElementById('originName').value || undefined,
      destination_lat: parseFloat(destLat),
      destination_lng: parseFloat(destLng),
      destination_name: document.getElementById('destName').value || undefined,
      departure_time: document.getElementById('departureTime').value,
      seats_total: parseInt(document.getElementById('seats').value),
      fare: document.getElementById('fare').value ? parseFloat(document.getElementById('fare').value) : undefined,
      pickup_area_radius_km: parseFloat(document.getElementById('pickupRadius').value) || 2.0,
      schedule_type: scheduleType,
    };

    if (scheduleType === 'once') {
      body.trip_date = document.getElementById('tripDate').value;
    } else {
      body.weekdays = [...selectedWeekdays].sort();
      body.start_date = document.getElementById('startDate').value;
      const dur = document.getElementById('duration').value;
      if (dur === 'custom') {
        body.end_date = document.getElementById('endDate').value;
      } else {
        body.duration = dur;
      }
    }

    const result = await api.post('/rides', body);
    ui.showSuccess('error-msg', `Ride published! ${result.instances.length} trip${result.instances.length !== 1 ? 's' : ''} created.`);
    setTimeout(() => window.location.href = '/pages/my-rides.html', 2000);
  } catch (err) {
    ui.showError('error-msg', err.message || 'Failed to publish ride');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-lg">publish</span>Publish Ride';
  }
});
