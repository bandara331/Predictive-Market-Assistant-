/**
 * auth.js — JWT Authentication Logic
 * Handles: Login, Register, Logout, Token management, Route protection
 */

const API_BASE = 'http://localhost:8081/api';
const TOKEN_KEY = 'predictiq_jwt';
const USER_KEY  = 'predictiq_user';

/* ─── Token Management ─── */
function getToken()  { return localStorage.getItem(TOKEN_KEY); }
function getUser()   { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch { return true; }
}

function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  if (isTokenExpired(token)) { clearSession(); return false; }
  return true;
}

/* ─── Auth Headers ─── */
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

/* ─── API Calls ─── */
async function apiRegister(firstName, lastName, email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Registration failed');
  return data;
}

async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Invalid email or password');
  return data;
}

/* ─── UI Helpers ─── */
function setButtonLoading(submitBtnId, loading) {
  const btn  = document.getElementById(submitBtnId);
  const text = btn?.querySelector('.btn-text');
  const ldr  = btn?.querySelector('.btn-loader');
  if (!btn) return;
  btn.disabled = loading;
  text?.classList.toggle('hidden', loading);
  ldr?.classList.toggle('hidden', !loading);
}

function showError(errorDivId, message) {
  const el = document.getElementById(errorDivId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

/* ─── Tab Switching ─── */
function switchTab(tab) {
  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLogin     = document.getElementById('tab-login');
  const tabRegister  = document.getElementById('tab-register');
  const indicator    = document.getElementById('tab-indicator');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabRegister.setAttribute('aria-selected', 'false');
    indicator.classList.remove('right');
  } else {
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    tabRegister.setAttribute('aria-selected', 'true');
    tabLogin.setAttribute('aria-selected', 'false');
    indicator.classList.add('right');
  }

  document.getElementById('login-error')?.classList.add('hidden');
  document.getElementById('register-error')?.classList.add('hidden');
}

/* ─── Password Visibility Toggle ─── */
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

/* ─── Password Strength ─── */
function updatePasswordStrength(password) {
  const bar = document.getElementById('strength-bar');
  if (!bar) return;
  let score = 0;
  if (password.length >= 8)  score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const widths = ['0%', '25%', '50%', '75%', '100%'];
  const colors = ['transparent', '#ef5350', '#f7931a', '#00d4ff', '#26a69a'];
  bar.style.width  = widths[score];
  bar.style.background = colors[score];
}

/* ─── Form Handlers ─── */
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) { showError('login-error', 'Please fill in all fields.'); return; }

  setButtonLoading('login-submit', true);
  try {
    // DEMO MODE: bypass backend if not running
    let data;
    try {
      data = await apiLogin(email, password);
    } catch (fetchErr) {
      if (fetchErr.message.includes('fetch') || fetchErr.name === 'TypeError') {
        // Backend offline — use demo mode
        data = createDemoSession(email);
      } else { throw fetchErr; }
    }
    setSession(data.token, data.user);
    transitionToDashboard(data.user);
  } catch (err) {
    showError('login-error', err.message);
  } finally {
    setButtonLoading('login-submit', false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const firstName = document.getElementById('reg-firstname')?.value?.trim();
  const lastName  = document.getElementById('reg-lastname')?.value?.trim();
  const email     = document.getElementById('reg-email')?.value?.trim();
  const password  = document.getElementById('reg-password')?.value;

  if (!firstName || !lastName || !email || !password) {
    showError('register-error', 'Please fill in all fields.');
    return;
  }
  if (password.length < 8) {
    showError('register-error', 'Password must be at least 8 characters.');
    return;
  }

  setButtonLoading('register-submit', true);
  try {
    let data;
    try {
      data = await apiRegister(firstName, lastName, email, password);
    } catch (fetchErr) {
      if (fetchErr.message.includes('fetch') || fetchErr.name === 'TypeError') {
        data = createDemoSession(email, firstName, lastName);
      } else { throw fetchErr; }
    }
    setSession(data.token, data.user);
    transitionToDashboard(data.user);
  } catch (err) {
    showError('register-error', err.message);
  } finally {
    setButtonLoading('register-submit', false);
  }
}

function handleLogout() {
  clearSession();
  window.location.reload();
}

/* ─── Demo Mode (when backend is offline) ─── */
function createDemoSession(email, firstName = 'Demo', lastName = 'User') {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: email,
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000)
  }));
  const token = `${header}.${payload}.demo-signature`;
  return {
    token,
    user: {
      id: 1,
      email,
      firstName,
      lastName,
      role: 'USER'
    }
  };
}

/* ─── View Transitions ─── */
function showAuthSection() {
  document.getElementById('auth-section')?.classList.remove('hidden');
  document.getElementById('dashboard-section')?.classList.add('hidden');
  initParticles();
}

function transitionToDashboard(user) {
  document.getElementById('auth-section')?.classList.add('hidden');
  document.getElementById('dashboard-section')?.classList.remove('hidden');
  // Notify dashboard to initialize
  window.dispatchEvent(new CustomEvent('dashboardReady', { detail: { user } }));
}

/* ─── Particle Canvas ─── */
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.4 + 0.1
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${p.alpha})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();

  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

/* ─── Password Strength Listener ─── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reg-password')?.addEventListener('input', (e) => {
    updatePasswordStrength(e.target.value);
  });
});
