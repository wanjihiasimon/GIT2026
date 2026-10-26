const eventList = document.querySelector('#event-list');
const eventDialog = document.querySelector('#event-dialog');
const eventForm = document.querySelector('#event-form');
const searchInput = document.querySelector('#search');
const formError = document.querySelector('#form-error');
let events = [];
let activeFilter = 'upcoming';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

function dateFromInput(value) {
  return new Date(value);
}

function formatDate(value, options) {
  return new Intl.DateTimeFormat(undefined, options).format(dateFromInput(value));
}

function isUpcoming(event, now = new Date()) {
  return dateFromInput(event.date) >= now && !['done', 'cancelled'].includes(event.status);
}

function renderOverview() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  document.querySelector('#total-count').textContent = events.length;
  document.querySelector('#month-count').textContent = events.filter((event) => {
    const date = dateFromInput(event.date);
    return date >= monthStart && date < monthEnd;
  }).length;
  document.querySelector('#soon-count').textContent = events.filter((event) => {
    const date = dateFromInput(event.date);
    return isUpcoming(event, now) && date <= weekEnd;
  }).length;
  document.querySelector('#month-label').textContent = new Intl.DateTimeFormat(undefined, {
    month: 'long', year: 'numeric',
  }).format(now);
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(now).toUpperCase();
}

function renderNextEvent() {
  const next = [...events].filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date))[0];
  const container = document.querySelector('#next-event');
  if (!next) {
    container.innerHTML = '<p class="next-empty">Nothing on the horizon yet.<br>Leave a little room for a good surprise.</p>';
    return;
  }
  container.innerHTML = `<div class="next-date">${escapeHtml(formatDate(next.date, {
    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }))}</div><h3 class="next-title">${escapeHtml(next.title)}</h3><div class="next-location">${escapeHtml(next.location || next.category || 'Details to come')}</div>`;
}

function renderEvents() {
  const search = searchInput.value.trim().toLowerCase();
  const now = new Date();
  const filtered = events.filter((event) => {
    const future = isUpcoming(event, now);
    const matchesFilter = activeFilter === 'all' || (activeFilter === 'upcoming' ? future : !future);
    const searchable = `${event.title} ${event.location} ${event.category} ${event.notes}`.toLowerCase();
    return matchesFilter && searchable.includes(search);
  }).sort((a, b) => a.date.localeCompare(b.date));

  document.querySelector('#result-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`;
  if (!filtered.length) {
    const hasSearch = Boolean(search);
    eventList.innerHTML = `<div class="empty-state"><div class="empty-symbol" aria-hidden="true">✳</div><h3>${hasSearch ? 'No plans found' : activeFilter === 'upcoming' ? 'A little space to fill' : 'No events here yet'}</h3><p>${hasSearch ? 'Try another name, place, or category.' : activeFilter === 'upcoming' ? 'Put something lovely on the calendar.' : 'Your events will find their way here.'}</p>${!hasSearch && activeFilter === 'upcoming' ? '<button class="button button-dark" type="button" data-action="add">Add your first event <span aria-hidden="true">↗</span></button>' : ''}</div>`;
    return;
  }

  eventList.innerHTML = filtered.map((event, index) => {
    const date = dateFromInput(event.date);
    const statusLabels = { planned: 'Planned', attending: 'Going', done: 'Been there', cancelled: 'Cancelled' };
    const categoryClass = (event.category || 'personal').toLowerCase().replace(/[^a-z]/g, '');
    const meta = [formatDate(event.date, { hour: 'numeric', minute: '2-digit' }), event.location, event.category]
      .filter(Boolean).map(escapeHtml).join('<span class="meta-separator">·</span>');
    return `<article class="event-row" style="animation-delay:${Math.min(index, 8) * 35}ms">
      <div class="date-block"><span class="date-month">${escapeHtml(formatDate(event.date, { month: 'short' }))}</span><span class="date-day">${escapeHtml(formatDate(event.date, { day: '2-digit' }))}</span></div>
      <div class="event-info"><div class="event-title-line"><span class="category-dot ${escapeHtml(categoryClass)}"></span><h3 title="${escapeHtml(event.title)}">${escapeHtml(event.title)}</h3></div>
      <p class="event-meta">${meta}</p><span class="event-status ${escapeHtml(event.status)}">${statusLabels[event.status] || 'Planned'}</span></div>
      <div class="event-actions"><button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(event.id)}" aria-label="Edit ${escapeHtml(event.title)}" title="Edit event">✎</button><button class="icon-button" type="button" data-action="delete" data-id="${escapeHtml(event.id)}" aria-label="Delete ${escapeHtml(event.title)}" title="Delete event">×</button></div>
    </article>`;
  }).join('');
}

function render() {
  renderOverview();
  renderNextEvent();
  renderEvents();
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Something went wrong.');
  return result;
}

function openNewEvent() {
  eventForm.reset();
  document.querySelector('#event-id').value = '';
  document.querySelector('#dialog-title').textContent = 'Add an event';
  document.querySelector('#status').value = 'planned';
  formError.textContent = '';
  eventDialog.showModal();
  document.querySelector('#title').focus();
}

function openEditEvent(event) {
  document.querySelector('#event-id').value = event.id;
  document.querySelector('#dialog-title').textContent = 'Edit your event';
  for (const key of ['title', 'date', 'location', 'category', 'notes', 'status']) {
    document.querySelector(`#${key}`).value = event[key] || (key === 'status' ? 'planned' : '');
  }
  formError.textContent = '';
  eventDialog.showModal();
  document.querySelector('#title').focus();
}

document.querySelector('#add-event').addEventListener('click', openNewEvent);
document.querySelector('#close-dialog').addEventListener('click', () => eventDialog.close());
document.querySelector('#cancel-dialog').addEventListener('click', () => eventDialog.close());
document.querySelectorAll('.filter-tab').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.toggle('active', tab === button));
    renderEvents();
  });
});
searchInput.addEventListener('input', renderEvents);

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !eventDialog.open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

eventList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'add') return openNewEvent();
  const selected = events.find((item) => item.id === button.dataset.id);
  if (!selected) return;
  if (button.dataset.action === 'edit') return openEditEvent(selected);
  if (button.dataset.action === 'delete' && window.confirm(`Delete “${selected.title}”?`)) {
    try {
      await request(`/api/events/${encodeURIComponent(selected.id)}`, { method: 'DELETE' });
      events = events.filter((item) => item.id !== selected.id);
      render();
    } catch (error) {
      window.alert(error.message);
    }
  }
});

eventForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';
  const id = document.querySelector('#event-id').value;
  const payload = Object.fromEntries(new FormData(eventForm).entries());
  try {
    const saved = await request(id ? `/api/events/${encodeURIComponent(id)}` : '/api/events', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    if (id) events = events.map((item) => item.id === id ? saved : item);
    else events.push(saved);
    eventDialog.close();
    render();
  } catch (error) {
    formError.textContent = error.message;
  }
});

request('/api/events')
  .then((result) => {
    events = result;
    render();
  })
  .catch(() => {
    eventList.innerHTML = '<div class="empty-state"><h3>Could not load your events</h3><p>Refresh the page to try again.</p></div>';
  });