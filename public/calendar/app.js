const eventsContainer = document.getElementById('events');
const statusEl = document.getElementById('status');
const form = document.getElementById('event-form');
const refreshBtn = document.getElementById('refresh-btn');

async function fetchEvents() {
    statusEl.textContent = 'Loading events...';

    try {
        const response = await fetch('/api/calendar/events');
        if (!response.ok) {
            throw new Error('Failed to load events');
        }
        const data = await response.json();
        renderEvents(data.events || []);
        statusEl.textContent = '';
    } catch (error) {
        statusEl.textContent = error.message;
    }
}

function renderEvents(events) {
    if (!events.length) {
        eventsContainer.innerHTML = '<p class="status">No events yet.</p>';
        return;
    }

    const sorted = [...events].sort((a, b) => {
        const dateA = `${a.date || ''} ${a.time || ''}`.trim();
        const dateB = `${b.date || ''} ${b.time || ''}`.trim();
        return dateA.localeCompare(dateB);
    });

    eventsContainer.innerHTML = '';

    sorted.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event';

        const title = document.createElement('h3');
        title.textContent = event.title;

        const meta = document.createElement('div');
        meta.className = 'event-meta';
        meta.textContent = `${event.date}${event.time ? ` • ${event.time}` : ''}`;

        const notes = document.createElement('p');
        notes.textContent = event.notes || 'No notes provided.';

        const actions = document.createElement('div');
        actions.className = 'event-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => handleDelete(event.id));

        actions.appendChild(deleteBtn);

        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(notes);
        card.appendChild(actions);

        eventsContainer.appendChild(card);
    });
}

async function handleCreate(event) {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create event');
        }

        form.reset();
        await fetchEvents();
    } catch (error) {
        statusEl.textContent = error.message;
    }
}

async function handleDelete(id) {
    if (!confirm('Delete this event?')) {
        return;
    }

    try {
        const response = await fetch(`/api/calendar/events/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            throw new Error('Failed to delete event');
        }
        await fetchEvents();
    } catch (error) {
        statusEl.textContent = error.message;
    }
}

form.addEventListener('submit', handleCreate);
refreshBtn.addEventListener('click', fetchEvents);

fetchEvents();
