export function setupNotesApp({ api, apiBase }) {
  const notesArea = document.getElementById('notesArea');
  const noteTitle = document.getElementById('noteTitle');
  const noteList = document.getElementById('noteList');
  const newNoteBtn = document.getElementById('newNoteBtn');
  const deleteNoteBtn = document.getElementById('deleteNoteBtn');
  const status = document.getElementById('notesSavedStatus');
  if (!notesArea || !noteTitle || !noteList || !newNoteBtn || !deleteNoteBtn || !status) {
    return null;
  }

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
          img.src = `${apiBase}/api/assets/${encodeURIComponent(id)}`;
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
    notes.forEach((note) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `note-tab${note.id === activeId ? ' active' : ''}`;
      btn.textContent = note.title || 'Untitled';
      btn.addEventListener('click', () => selectNote(note.id));
      noteList.appendChild(btn);
    });
  };

  const selectNote = (id) => {
    const note = notes.find((n) => n.id === id);
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
    const note = notes.find((n) => n.id === activeId);
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
    const res = await fetch(`${apiBase}/api/notes/${activeId}/assets`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('upload failed');
    const data = await res.json();
    return `![img](asset:${data.assetId})`;
  };

  notesArea.addEventListener('paste', async (e) => {
    const file = Array.from(e.clipboardData?.files || []).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    try {
      setStatus('Uploading image...');
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
  return null;
}
