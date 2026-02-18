import { createApi } from './dashboard/api.js';
import { createDateHelpers, startClock } from './dashboard/time.js';
import { setupNotesApp } from './dashboard/apps/notes.js';
import { setupCalcApp } from './dashboard/apps/calc.js';
import { setupTasksApp } from './dashboard/apps/tasks.js';
import { setupJokesApp } from './dashboard/apps/jokes.js';
import { setupCalendarApp } from './dashboard/apps/calendar.js';

export function initDashboard({ apiBase = window.location.origin, timeZone = 'America/Denver' } = {}) {
  let activeApp = null;
  let activeTeardown = null;

  const api = createApi(apiBase);
  const { fmtDateKey, todayKey, todayDate } = createDateHelpers(timeZone);
  startClock(timeZone);

  const appLaunchers = {
    notes: () => setupNotesApp({ api, apiBase }),
    calc: () => setupCalcApp(),
    tasks: () => setupTasksApp({ api, todayKey }),
    jokes: () => setupJokesApp(),
    calendar: () => setupCalendarApp({ api, todayDate, fmtDateKey, timeZone })
  };

  const appContent = document.getElementById('appContent');
  const icons = document.querySelectorAll('.app-icon');
  if (!appContent || !icons.length) return;

  const teardownActive = () => {
    if (typeof activeTeardown === 'function') {
      activeTeardown();
      activeTeardown = null;
    }
  };

  icons.forEach((icon) => {
    icon.addEventListener('click', () => {
      const appId = icon.dataset.app;
      if (activeApp === appId) {
        teardownActive();
        appContent.innerHTML = '';
        activeApp = null;
        return;
      }

      teardownActive();

      const template = document.getElementById(`app-${appId}`);
      if (!template) {
        appContent.innerHTML = '<p style="text-align:center;opacity:0.6;">App not available yet</p>';
        return;
      }

      appContent.innerHTML = '';
      appContent.appendChild(template.content.cloneNode(true));
      activeApp = appId;

      const launch = appLaunchers[appId];
      activeTeardown = typeof launch === 'function' ? launch() : null;
    });
  });
}
