export function createDateHelpers(timeZone) {
  const fmtDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

  const dateFromKey = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  };

  const todayKey = () => fmtDateKey(new Date());
  const todayDate = () => dateFromKey(todayKey());

  return {
    fmtDateKey,
    todayKey,
    todayDate
  };
}

export function startClock(timeZone) {
  const updateClock = () => {
    const clock = document.getElementById('clock');
    if (!clock) return;
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  updateClock();
  return setInterval(updateClock, 1000);
}
