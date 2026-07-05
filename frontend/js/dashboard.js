/**
 * dashboard.js — Main Dashboard Orchestrator
 * Handles: App init, session management, navbar clock, market status
 */

/* ─── App Bootstrap ─── */
(function initApp() {
  const overlay = document.getElementById('loading-overlay');

  window.addEventListener('load', async () => {
    // Brief loading screen
    await delay(1200);

    if (isAuthenticated()) {
      const user = getUser();
      overlay?.classList.add('fade-out');
      setTimeout(() => {
        overlay?.classList.add('hidden');
        transitionToDashboard(user);
      }, 400);
    } else {
      overlay?.classList.add('fade-out');
      setTimeout(() => {
        overlay?.classList.add('hidden');
        showAuthSection();
      }, 400);
    }
  });
})();

/* ─── Dashboard Ready Listener ─── */
window.addEventListener('dashboardReady', async (e) => {
  const user = e.detail.user;
  await initDashboard(user);
});

/* ─── Dashboard Initialization ─── */
async function initDashboard(user) {
  // Populate user info in navbar
  const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User';
  const avatarChar  = (user.firstName?.[0] || user.email?.[0] || 'U').toUpperCase();
  const el = document.getElementById('user-display-name');
  const av = document.getElementById('user-avatar');
  if (el) el.textContent = displayName;
  if (av) av.textContent = avatarChar;

  // Start clock
  startClock();

  // Detect market status
  updateMarketStatus();
  setInterval(updateMarketStatus, 60000);

  // Initialize chart
  ChartModule.init();

  // Initialize watchlist
  await StockAPI.initWatchlist();

  // Load default symbol
  await StockAPI.loadSymbol('AAPL', '1M');

  // Mark AAPL active in watchlist
  document.getElementById('wl-AAPL')?.classList.add('active');
}

/* ─── Clock ─── */
function startClock() {
  function tick() {
    const now = new Date();
    const formatted = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true, timeZone: 'America/New_York'
    });
    const el = document.getElementById('nav-time');
    if (el) el.textContent = `NYSE ${formatted}`;
  }
  tick();
  setInterval(tick, 1000);
}

/* ─── Market Status ─── */
function updateMarketStatus() {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = nyTime.getDay();   // 0=Sun, 6=Sat
  const hour = nyTime.getHours();
  const min  = nyTime.getMinutes();
  const totalMin = hour * 60 + min;

  // NYSE: Mon-Fri 9:30 AM – 4:00 PM ET
  const isWeekday  = day >= 1 && day <= 5;
  const isOpenHour = totalMin >= 570 && totalMin < 960; // 9:30=570, 16:00=960
  const isOpen     = isWeekday && isOpenHour;

  const dot  = document.getElementById('market-dot');
  const text = document.getElementById('market-status-text');

  if (dot) {
    dot.style.background   = isOpen ? 'var(--green)' : 'var(--red)';
    dot.style.boxShadow    = isOpen ? '0 0 8px var(--green)' : '0 0 8px var(--red)';
    dot.style.animation    = isOpen ? 'pulse 2s ease infinite' : 'none';
  }
  if (text) text.textContent = isOpen ? 'Market Open' : 'Market Closed';
}

/* ─── Helpers ─── */
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
