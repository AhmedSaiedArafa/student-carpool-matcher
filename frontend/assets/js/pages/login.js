document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">progress_activity</span> Logging in...';
  document.getElementById('error-msg').innerHTML = '';

  try {
    const result = await api.post('/auth/login', {
      university_email: document.getElementById('email').value,
      password: document.getElementById('password').value,
    });
    auth.login(result.token, result.user);
    window.location.href = result.user.role === 'driver' ? '/pages/dashboard.html' : '/pages/search.html';
  } catch (err) {
    ui.showError('error-msg', err.message || 'Login failed');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-lg">login</span>Sign In';
  }
});
