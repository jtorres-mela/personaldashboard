export function initDashboard({ apiBase = window.location.origin, timeZone = 'America/Denver' } = {}) {
let activeApp = null;
    let activeTeardown = null;

    const DASH_TZ = timeZone;
    const fmtDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
      timeZone: DASH_TZ,
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

    // Clock Function
    function updateClock() {
      const clock = document.getElementById('clock');
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], {
        timeZone: DASH_TZ,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // API helper
    const API_BASE = apiBase;
    const api = async (path, options = {}) => {
      const isForm = options.body instanceof FormData;
      const headers = options.headers || {};
      if (!isForm) headers['Content-Type'] = 'application/json';
      const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      if (!res.ok) throw new Error('Request failed');
      return res.json();
    };

    // Dynamic App Launcher
    const appContent = document.getElementById('appContent');
    const icons = document.querySelectorAll('.app-icon');

    icons.forEach(icon => {
      icon.addEventListener('click', () => {
        const appId = icon.dataset.app;
        if (activeApp === appId) {
          if (typeof activeTeardown === 'function') {
            activeTeardown();
            activeTeardown = null;
          }
          appContent.innerHTML = '';
          activeApp = null;
          return;
        }

        if (typeof activeTeardown === 'function') {
          activeTeardown();
          activeTeardown = null;
        }

        const template = document.getElementById(`app-${appId}`);
        if (template) {
          appContent.innerHTML = ''; // Clear previous app
          const clone = template.content.cloneNode(true);
          appContent.appendChild(clone);
          activeApp = appId;
          let teardownFn = null;

          if (appId === 'notes') {
            const notesArea = document.getElementById('notesArea');
            const noteTitle = document.getElementById('noteTitle');
            const noteList = document.getElementById('noteList');
            const newNoteBtn = document.getElementById('newNoteBtn');
            const deleteNoteBtn = document.getElementById('deleteNoteBtn');
            const status = document.getElementById('notesSavedStatus');

            let notes = [];
            let activeId = null;
            let statusTimeout;

            const setStatus = (message) => {
              clearTimeout(statusTimeout);
              status.textContent = message;
              if (message) {
                statusTimeout = setTimeout(() => { status.textContent = ''; }, 1400);
              }
            };

            const renderPreview = () => {
              const preview = document.getElementById('notePreview');
              if (!preview) return;
              const raw = notesArea.value || '';
              preview.innerHTML = '';
              if (!raw.trim()) {
                const empty = document.createElement('span');
                empty.style.opacity = '0.6';
                empty.textContent = 'Nothing to preview yet.';
                preview.appendChild(empty);
                return;
              }

              const lines = raw.split('\n');
              const tokenRe = /!\[img\]\(asset:([^)]+)\)/g;
              lines.forEach((line, idx) => {
                const frag = document.createDocumentFragment();
                let cursor = 0;
                let match;
                while ((match = tokenRe.exec(line))) {
                  const text = line.slice(cursor, match.index);
                  if (text) frag.appendChild(document.createTextNode(text));
                  const id = (match[1] || '').trim();
                  if (/^[a-f0-9-]+$/i.test(id)) {
                    const img = document.createElement('img');
                    img.src = `${API_BASE}/api/assets/${encodeURIComponent(id)}`;
                    img.alt = 'image';
                    img.loading = 'lazy';
                    frag.appendChild(img);
                  } else {
                    frag.appendChild(document.createTextNode(match[0]));
                  }
                  cursor = match.index + match[0].length;
                }
                const rest = line.slice(cursor);
                if (rest) frag.appendChild(document.createTextNode(rest));
                preview.appendChild(frag);
                if (idx < lines.length - 1) preview.appendChild(document.createElement('br'));
              });
            };

            const insertAtCursor = (text) => {
              const start = notesArea.selectionStart ?? notesArea.value.length;
              const end = notesArea.selectionEnd ?? start;
              const val = notesArea.value;
              notesArea.value = val.slice(0, start) + text + val.slice(end);
              notesArea.selectionStart = notesArea.selectionEnd = start + text.length;
              renderPreview();
            };

            const renderList = () => {
              noteList.innerHTML = '';
              notes.forEach(note => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `note-tab${note.id === activeId ? ' active' : ''}`;
                btn.textContent = note.title || 'Untitled';
                btn.addEventListener('click', () => selectNote(note.id));
                noteList.appendChild(btn);
              });
            };

            const selectNote = (id) => {
              const note = notes.find(n => n.id === id);
              if (!note) return;
              activeId = id;
              noteTitle.value = note.title;
              notesArea.value = note.body;
              renderList();
              renderPreview();
            };

            const loadNotes = async () => {
              notes = await api('/api/notes');
              if (notes.length === 0) {
                const created = await api('/api/notes', { method: 'POST', body: JSON.stringify({ title: 'New note', body: '' }) });
                notes = [created];
              }
              activeId = notes[0].id;
              renderList();
              selectNote(activeId);
            };

            const saveActive = async () => {
              const note = notes.find(n => n.id === activeId);
              if (!note) return;
              note.title = noteTitle.value.trim() || 'Untitled';
              note.body = notesArea.value;
              await api(`/api/notes/${note.id}`, { method: 'PUT', body: JSON.stringify({ title: note.title, body: note.body }) });
              setStatus('Saved');
              await loadNotes();
            };

            const uploadAsset = async (file) => {
              const fd = new FormData();
              fd.append('file', file);
              const res = await fetch(`${API_BASE}/api/notes/${activeId}/assets`, { method: 'POST', body: fd });
              if (!res.ok) throw new Error('upload failed');
              const data = await res.json();
              return `![img](asset:${data.assetId})`;
            };

            notesArea.addEventListener('paste', async (e) => {
              const file = Array.from(e.clipboardData?.files || []).find(f => f.type.startsWith('image/'));
              if (!file) return;
              e.preventDefault();
              try {
                setStatus('Uploading imageâ€¦');
                const token = await uploadAsset(file);
                insertAtCursor(token);
                await saveActive();
                setStatus('Image added');
              } catch (err) {
                console.error(err);
                setStatus('Image upload failed');
              }
            });

            const addNote = async () => {
              const created = await api('/api/notes', { method: 'POST', body: JSON.stringify({ title: 'New note', body: '' }) });
              await loadNotes();
              selectNote(created.id);
              setStatus('New note added');
            };

            const deleteNote = async () => {
              if (!activeId) return;
              await api(`/api/notes/${activeId}`, { method: 'DELETE' });
              await loadNotes();
              setStatus('Note deleted');
            };

            newNoteBtn.addEventListener('click', addNote);
            deleteNoteBtn.addEventListener('click', deleteNote);
            noteTitle.addEventListener('input', () => { saveActive(); });
            notesArea.addEventListener('input', () => { renderPreview(); saveActive(); });

            loadNotes();
          }

          if (appId === 'calc') {
            const exprEl = document.getElementById('calcExpression');
            const resultEl = document.getElementById('calcResult');
            const historyEl = document.getElementById('calcHistory');
            const buttons = document.querySelectorAll('.calc-buttons button');

            let expression = '';
            const history = [];

            const renderHistory = () => {
              historyEl.innerHTML = '';
              if (history.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'calc-history__empty';
                empty.textContent = 'No calculations yet';
                historyEl.appendChild(empty);
                return;
              }

              history.slice(-6).reverse().forEach(item => {
                const row = document.createElement('div');
                row.className = 'calc-history__item';
                const expr = document.createElement('span');
                expr.textContent = item.expr;
                const result = document.createElement('strong');
                result.textContent = item.result;
                row.appendChild(expr);
                row.appendChild(result);
                historyEl.appendChild(row);
              });
            };

            const updateDisplay = (expr, res) => {
              exprEl.textContent = expr || '0';
              resultEl.textContent = res ?? '0';
            };

            const evaluateExpression = () => {
              if (!expression) return null;
              try {
                const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, '');
                const value = Function(`"use strict"; return (${sanitized})`)();
                if (typeof value === 'number' && Number.isFinite(value)) {
                  return value;
                }
              } catch {
                return null;
              }
              return null;
            };

            const addToHistory = (expr, res) => {
              history.push({ expr, result: res });
              renderHistory();
            };

            const appendValue = (val) => {
              expression += val;
              const preview = evaluateExpression();
              updateDisplay(expression, preview !== null ? preview : '...');
            };

            const clearAll = () => {
              expression = '';
              updateDisplay('0', '0');
            };

            const backspace = () => {
              expression = expression.slice(0, -1);
              const preview = evaluateExpression();
              updateDisplay(expression || '0', preview !== null ? preview : '0');
            };

            const calculate = () => {
              const result = evaluateExpression();
              if (result === null) {
                updateDisplay('Error', '0');
                expression = '';
                return;
              }
              addToHistory(expression, result);
              expression = result.toString();
              updateDisplay(expression, result);
            };

            buttons.forEach(button => {
              const val = button.dataset.value;
              const action = button.dataset.action;
              button.addEventListener('click', () => {
                if (action === 'clear') return clearAll();
                if (action === 'backspace') return backspace();
                if (action === 'equals') return calculate();
                if (val) appendValue(val);
              });
            });

            const handleKeyDown = (e) => {
              const key = e.key;
              const allowed = '0123456789.+-*/()';
              if (allowed.includes(key)) {
                appendValue(key);
              } else if (key === 'Enter' || key === '=') {
                e.preventDefault();
                calculate();
              } else if (key === 'Backspace') {
                backspace();
              } else if (key === 'Escape') {
                clearAll();
              }
            };

            window.addEventListener('keydown', handleKeyDown);
            teardownFn = () => window.removeEventListener('keydown', handleKeyDown);

            updateDisplay('0', '0');
            renderHistory();
          }

          if (appId === 'tasks') {
            const nameInput = document.getElementById('taskName');
            const hoursInput = document.getElementById('taskHours');
            const addBtn = document.getElementById('addTaskBtn');
            const taskList = document.getElementById('taskList');
            const totalHours = document.getElementById('totalHours');
            const taskError = document.getElementById('taskError');
            const copyBtn = document.getElementById('copyTasksBtn');
            const copyStatus = document.getElementById('copyTasksStatus');
            const dateInput = document.getElementById('taskDate');
            dateInput.value = todayKey();
            let tasks = [];
            let orderIds = [];

            const currentDateKey = () => dateInput.value || todayKey();

            const loadTasks = async () => {
              dragId = null;
              tasks = await api(`/api/tasks?date=${currentDateKey()}`);
              orderIds = tasks.map(t => t.id);
              renderTasks();
            };

            const removeTask = async (id) => {
              await api(`/api/tasks/${id}`, { method: 'DELETE' });
              await loadTasks();
            };

            const renderTasks = () => {
              taskList.innerHTML = '';
              const sorted = [...tasks]; // server-ordered
              orderIds = sorted.map(t => t.id);
              if (sorted.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'task-empty';
                empty.textContent = 'No tasks yet. Add your first one above.';
                taskList.appendChild(empty);
              } else {
                sorted.forEach((task) => {
                  const row = document.createElement('div');
                  row.className = 'task-row';
                  row.draggable = true;
                  row.dataset.id = task.id;

                  row.addEventListener('dragstart', (e) => {
                    dragId = task.id;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', task.id);
                    row.classList.add('dragging');
                  });
                  row.addEventListener('dragend', () => {
                    row.classList.remove('dragging');
                    dragId = null;
                  });

                  const nameSpan = document.createElement('span');
                  nameSpan.textContent = task.name;
                  const hoursInput = document.createElement('input');
                  hoursInput.type = 'number';
                  hoursInput.min = '0';
                  hoursInput.step = '0.25';
                  hoursInput.value = task.hours.toFixed(2);
                  hoursInput.className = 'task-hours-input';
                  hoursInput.addEventListener('change', async () => {
                    const newVal = parseFloat(hoursInput.value);
                    if (Number.isNaN(newVal) || newVal < 0) {
                      hoursInput.value = task.hours.toFixed(2);
                      return;
                    }
                    await api(`/api/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ hours: newVal }) });
                    await loadTasks();
                  });
                  const removeBtn = document.createElement('button');
                  removeBtn.className = 'task-remove';
                  removeBtn.type = 'button';
                  removeBtn.textContent = 'Remove';
                  removeBtn.addEventListener('click', () => removeTask(task.id));
                  row.appendChild(nameSpan);
                  row.appendChild(hoursInput);
                  row.appendChild(removeBtn);
                  taskList.appendChild(row);
                });
              }

              const total = sorted.reduce((sum, t) => sum + t.hours, 0);
              totalHours.textContent = total.toFixed(2);
            };

            let dragId = null;
            taskList.addEventListener('dragenter', (e) => {
              e.preventDefault();
            });
            taskList.addEventListener('dragover', (e) => {
              e.preventDefault(); // allow drop
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
              const target = e.target.closest('.task-row');
              if (!target) return;
              taskList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
              if (target.dataset.id !== dragId) target.classList.add('drag-over');
            });

            taskList.addEventListener('drop', async (e) => {
              e.preventDefault();
              const target = e.target.closest('.task-row');
              taskList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
              const currentDragId = dragId || e.dataTransfer.getData('text/plain');
              if (!target || !currentDragId || target.dataset.id === currentDragId) return;

              const domOrder = Array.from(taskList.querySelectorAll('.task-row')).map(r => r.dataset.id);
              const from = domOrder.indexOf(currentDragId);
              const to = domOrder.indexOf(target.dataset.id);
              if (from === -1 || to === -1) return;
              domOrder.splice(to, 0, domOrder.splice(from, 1)[0]);

              await api('/api/tasks/reorder', { method: 'POST', body: JSON.stringify({ date_key: currentDateKey(), order: domOrder }) });
              dragId = null;
              await loadTasks();
            });

            const addTask = async () => {
              const name = nameInput.value.trim() || 'Untitled task';
              const hoursValue = parseFloat(hoursInput.value);

              if (Number.isNaN(hoursValue) || hoursValue < 0) {
                taskError.textContent = 'Please enter hours (0 or more).';
                hoursInput.focus();
                return;
              }

              taskError.textContent = '';
              await api('/api/tasks', { method: 'POST', body: JSON.stringify({ name, hours: hoursValue, date_key: currentDateKey() }) });
              nameInput.value = '';
              hoursInput.value = '';
              await loadTasks();
              nameInput.focus();
            };

            addBtn.addEventListener('click', addTask);
            nameInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') addTask();
            });
            hoursInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') addTask();
            });
            dateInput.addEventListener('change', () => loadTasks());

            const copyTasksToClipboard = async () => {
              if (!tasks.length) {
                copyStatus.textContent = 'No tasks to copy';
                setTimeout(() => { copyStatus.textContent = ''; }, 1200);
                return;
              }
              const lines = tasks.map(t => t.name);
              const text = lines.join('\n');
              try {
                await navigator.clipboard.writeText(text);
                copyStatus.textContent = 'Copied!';
              } catch (err) {
                copyStatus.textContent = 'Copy failed';
              }
              setTimeout(() => { copyStatus.textContent = ''; }, 1200);
            };

            copyBtn.addEventListener('click', copyTasksToClipboard);

            loadTasks();
          }

          if (appId === 'jokes') {
            const jokeText = document.getElementById('jokeText');
            const jokeBtn = document.getElementById('jokeBtn');
            const jokeStatus = document.getElementById('jokeStatus');
            let controller = null;

            const setStatus = (msg) => {
              jokeStatus.textContent = msg;
              if (msg) setTimeout(() => { if (jokeStatus.textContent === msg) jokeStatus.textContent = ''; }, 1400);
            };

            const loadJoke = async () => {
              try {
                controller?.abort();
                controller = new AbortController();
                jokeBtn.disabled = true;
                setStatus('Loadingâ€¦');
                const res = await fetch('https://icanhazdadjoke.com/', {
                  headers: { Accept: 'application/json', 'User-Agent': 'Dashboard (demo)' },
                  signal: controller.signal
                });
                const data = await res.json();
                jokeText.textContent = data.joke || 'No joke found.';
                setStatus('Got one!');
              } catch (err) {
                if (err.name === 'AbortError') return;
                jokeText.textContent = 'Could not load a joke right now.';
                setStatus('Error');
              } finally {
                jokeBtn.disabled = false;
              }
            };

            jokeBtn.addEventListener('click', loadJoke);
            loadJoke();

            teardownFn = () => controller?.abort();
          }

          if (appId === 'calendar') {
            const monthLabel = document.getElementById('calMonthLabel');
            const grid = document.getElementById('calGrid');
            const selectedLabel = document.getElementById('calSelectedDate');
            const tasksList = document.getElementById('calTasksList');
            const tasksTotal = document.getElementById('calTasksTotal');
            const todayBtn = document.getElementById('calToday');
            const prevBtn = document.getElementById('calPrev');
            const nextBtn = document.getElementById('calNext');

            let currentMonth = todayDate();
            let selectedDate = todayDate();

            const fmtDate = (d) => fmtDateKey(d);
            const isSameDay = (a, b) => fmtDate(a) === fmtDate(b);

            const setSelectedDate = (date) => {
              selectedDate = date;
              selectedLabel.textContent = selectedDate.toLocaleDateString('en-US', {
                timeZone: DASH_TZ,
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
              monthLabel.textContent = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: DASH_TZ });

              grid.innerHTML = '';
              const firstDay = new Date(Date.UTC(year, month, 1, 12));
              const startWeekday = firstDay.getUTCDay();
              const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();

              for (let i = 0; i < startWeekday; i++) {
                const filler = document.createElement('div');
                filler.className = 'cal-cell cal-cell--empty';
                grid.appendChild(filler);
              }

              for (let day = 1; day <= daysInMonth; day++) {
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
              api(`/api/tasks?date=${dateStr}`).then(res => {
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
                tasks.forEach(task => {
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
          }

          activeTeardown = teardownFn;
        } else {
          appContent.innerHTML = `<p style="text-align:center;opacity:0.6;">App not available yet</p>`;
        }
      });
    });
}

