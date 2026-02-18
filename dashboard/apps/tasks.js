export function setupTasksApp({ api, todayKey }) {
  const nameInput = document.getElementById('taskName');
  const hoursInput = document.getElementById('taskHours');
  const addBtn = document.getElementById('addTaskBtn');
  const taskList = document.getElementById('taskList');
  const totalHours = document.getElementById('totalHours');
  const taskError = document.getElementById('taskError');
  const copyBtn = document.getElementById('copyTasksBtn');
  const copyStatus = document.getElementById('copyTasksStatus');
  const dateInput = document.getElementById('taskDate');

  if (!nameInput || !hoursInput || !addBtn || !taskList || !totalHours || !taskError || !copyBtn || !copyStatus || !dateInput) {
    return null;
  }

  dateInput.value = todayKey();
  let tasks = [];
  let orderIds = [];
  let dragId = null;

  const currentDateKey = () => dateInput.value || todayKey();

  const loadTasks = async () => {
    dragId = null;
    tasks = await api(`/api/tasks?date=${currentDateKey()}`);
    orderIds = tasks.map((t) => t.id);
    renderTasks();
  };

  const removeTask = async (id) => {
    await api(`/api/tasks/${id}`, { method: 'DELETE' });
    await loadTasks();
  };

  const renderTasks = () => {
    taskList.innerHTML = '';
    const sorted = [...tasks];
    orderIds = sorted.map((t) => t.id);
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

        const rowHoursInput = document.createElement('input');
        rowHoursInput.type = 'number';
        rowHoursInput.min = '0';
        rowHoursInput.step = '0.25';
        rowHoursInput.value = task.hours.toFixed(2);
        rowHoursInput.className = 'task-hours-input';
        rowHoursInput.addEventListener('change', async () => {
          const newVal = parseFloat(rowHoursInput.value);
          if (Number.isNaN(newVal) || newVal < 0) {
            rowHoursInput.value = task.hours.toFixed(2);
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
        row.appendChild(rowHoursInput);
        row.appendChild(removeBtn);
        taskList.appendChild(row);
      });
    }

    const total = sorted.reduce((sum, t) => sum + t.hours, 0);
    totalHours.textContent = total.toFixed(2);
  };

  taskList.addEventListener('dragenter', (e) => {
    e.preventDefault();
  });

  taskList.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.task-row');
    if (!target) return;
    taskList.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    if (target.dataset.id !== dragId) target.classList.add('drag-over');
  });

  taskList.addEventListener('drop', async (e) => {
    e.preventDefault();
    const target = e.target.closest('.task-row');
    taskList.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    const currentDragId = dragId || e.dataTransfer.getData('text/plain');
    if (!target || !currentDragId || target.dataset.id === currentDragId) return;

    const domOrder = Array.from(taskList.querySelectorAll('.task-row')).map((r) => r.dataset.id);
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
    const lines = tasks.map((t) => t.name);
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      copyStatus.textContent = 'Copied!';
    } catch {
      copyStatus.textContent = 'Copy failed';
    }
    setTimeout(() => { copyStatus.textContent = ''; }, 1200);
  };

  copyBtn.addEventListener('click', copyTasksToClipboard);
  loadTasks();
  return null;
}
