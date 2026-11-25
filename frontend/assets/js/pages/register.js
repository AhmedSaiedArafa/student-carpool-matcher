document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">progress_activity</span> Creating account...';
  document.getElementById('error-msg').innerHTML = '';

  try {
    const result = await api.post('/auth/register', {
      name: document.getElementById('name').value,
      university_email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      role: document.getElementById('role').value,
    });
    ui.showSuccess('error-msg', 'Account created! You can now log in. For demo purposes, your email is auto-verified.');
    btn.innerHTML = '<span class="material-symbols-outlined text-lg">person_add</span>Create Account';
    btn.disabled = false;
    setTimeout(() => window.location.href = '/pages/login.html', 2000);
  } catch (err) {
    ui.showError('error-msg', err.message || 'Registration failed');
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-lg">person_add</span>Create Account';
  }
});
