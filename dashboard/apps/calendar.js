export function setupCalendarApp({ api, todayDate, fmtDateKey, timeZone }) {
  const monthLabel = document.getElementById('calMonthLabel');
  const grid = document.getElementById('calGrid');
  const selectedLabel = document.getElementById('calSelectedDate');
  const tasksList = document.getElementById('calTasksList');
  const tasksTotal = document.getElementById('calTasksTotal');
  const todayBtn = document.getElementById('calToday');
  const prevBtn = document.getElementById('calPrev');
  const nextBtn = document.getElementById('calNext');

  if (!monthLabel || !grid || !selectedLabel || !tasksList || !tasksTotal || !todayBtn || !prevBtn || !nextBtn) {
    return null;
  }

  let currentMonth = todayDate();
  let selectedDate = todayDate();

  const fmtDate = (d) => fmtDateKey(d);
  const isSameDay = (a, b) => fmtDate(a) === fmtDate(b);

  const setSelectedDate = (date) => {
    selectedDate = date;
    selectedLabel.textContent = selectedDate.toLocaleDateString('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    renderGrid();
    renderTasks();
  };

  const changeMonth = (delta) => {
    currentMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + delta, 1, 12));
    renderGrid();
  };

  const renderGrid = () => {
    const year = currentMonth.getUTCFullYear();
    const month = currentMonth.getUTCMonth();
    monthLabel.textContent = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone });

    grid.innerHTML = '';
    const firstDay = new Date(Date.UTC(year, month, 1, 12));
    const startWeekday = firstDay.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();

    for (let i = 0; i < startWeekday; i += 1) {
      const filler = document.createElement('div');
      filler.className = 'cal-cell cal-cell--empty';
      grid.appendChild(filler);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateObj = new Date(Date.UTC(year, month, day, 12));
      const cell = document.createElement('button');
      cell.className = 'cal-cell';
      if (isSameDay(dateObj, todayDate())) cell.classList.add('today');
      if (isSameDay(dateObj, selectedDate)) cell.classList.add('selected');
      cell.textContent = day.toString();

      cell.addEventListener('click', () => setSelectedDate(dateObj));
      grid.appendChild(cell);
    }
  };

  const renderTasks = () => {
    tasksList.innerHTML = '';
    const dateStr = fmtDate(selectedDate);
    let tasks = [];
    api(`/api/tasks?date=${dateStr}`).then((res) => {
      tasks = res || [];

      tasksList.innerHTML = '';
      if (tasks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'calendar-empty';
        empty.textContent = 'No tasks linked to this day';
        tasksList.appendChild(empty);
        tasksTotal.textContent = '';
        return;
      }

      let total = 0;
      const formatHours = (val) => {
        const n = Number(val);
        if (!Number.isFinite(n)) return '0';
        if (n % 1 === 0) return n.toString();
        return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      };

      tasks.forEach((task) => {
        const row = document.createElement('div');
        row.className = 'calendar-item calendar-item--task';

        const name = document.createElement('div');
        name.className = 'calendar-item__title';
        name.textContent = task.name || 'Untitled task';

        const hours = document.createElement('div');
        hours.className = 'calendar-item__meta';
        const h = Number.isFinite(task.hours) ? task.hours : Number(task.hours) || 0;
        hours.textContent = `${h.toFixed(2)} h`;
        total += h;

        row.appendChild(name);
        row.appendChild(hours);
        tasksList.appendChild(row);
        row.addEventListener('click', async () => {
          const text = `${task.name || 'Untitled task'} (${formatHours(h)})`;
          try {
            await navigator.clipboard.writeText(text);
          } catch (err) {
            console.error('Clipboard copy failed', err);
          }
        });
      });

      tasksTotal.textContent = `Total planned: ${total.toFixed(2)} h`;
    });
  };

  todayBtn.addEventListener('click', () => {
    currentMonth = todayDate();
    setSelectedDate(todayDate());
  });
  prevBtn.addEventListener('click', () => changeMonth(-1));
  nextBtn.addEventListener('click', () => changeMonth(1));

  setSelectedDate(todayDate());
  return null;
}
