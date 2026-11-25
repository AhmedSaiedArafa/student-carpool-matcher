if (!auth.requireAuth() || !auth.requireRole('driver')) throw new Error('Access denied');

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

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">progress_activity</span> Publishing...';
  document.getElementById('error-msg').innerHTML = '';

  try {
    const result = await api.post('/rides', {
      origin_lat: parseFloat(originLat),
      origin_lng: parseFloat(originLng),
      origin_name: document.getElementById('originName').value || undefined,
      destination_lat: parseFloat(destLat),
      destination_lng: parseFloat(destLng),
      destination_name: document.getElementById('destName').value || undefined,
      weekday: parseInt(document.getElementById('weekday').value),
      departure_time: document.getElementById('departureTime').value,
      seats_total: parseInt(document.getElementById('seats').value),
      fare: document.getElementById('fare').value ? parseFloat(document.getElementById('fare').value) : undefined,
      pickup_area_radius_km: parseFloat(document.getElementById('pickupRadius').value) || 2.0,
    });
    ui.showSuccess('error-msg', `Ride published! ${result.instances.length} upcoming trips created.`);
    setTimeout(() => window.location.href = '/pages/my-rides.html', 2000);
  } catch (err) {
    ui.showError('error-msg', err.message || 'Failed to publish ride');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-lg">publish</span>Publish Ride';
  }
});
