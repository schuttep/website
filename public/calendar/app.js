const eventsContainer = document.getElementById('events');
const statusEl = document.getElementById('status');
const form = document.getElementById('event-form');
const calendarGrid = document.getElementById('calendar-grid');
const monthYearEl = document.getElementById('month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const dateInput = document.getElementById('date');
const colorInput = document.getElementById('color');
const colorLabel = document.getElementById('color-label');
const recurrenceInput = document.getElementById('recurrence');
const recurrenceEndLabel = document.getElementById('recurrence-end-label');
const recurrenceEndDateInput = document.getElementById('recurrence-end-date');

const colorNames = {
    '#2c6bff': 'Blue',
    '#48bb78': 'Green',
    '#f6ad55': 'Orange',
    '#f56565': 'Red',
    '#9f7aea': 'Purple',
    '#ed64a6': 'Pink',
    '#4299e1': 'Sky Blue',
    '#38b2ac': 'Teal'
};

let currentDate = new Date();
let allEvents = [];

function isEventOnDate(event, date) {
    const [eyear, emonth, eday] = event.date.split('-').map(Number);
    const eventDate = new Date(eyear, emonth - 1, eday);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (eventDate.getTime() === dateOnly.getTime()) {
        return true;
    }

    if (event.recurrence === 'none' || !event.recurrence) {
        return false;
    }

    let endDate = null;
    if (event.recurrenceEndDate) {
        const [edyear, edmonth, edday] = event.recurrenceEndDate.split('-').map(Number);
        endDate = new Date(edyear, edmonth - 1, edday);
    }

    if (endDate && dateOnly.getTime() > endDate.getTime()) {
        return false;
    }

    if (dateOnly.getTime() < eventDate.getTime()) {
        return false;
    }

    const daysDiff = Math.floor((dateOnly.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));

    switch (event.recurrence) {
        case 'daily':
            return true;
        case 'weekly':
            // Same day of week and multiple of 7 days later
            return eventDate.getDay() === dateOnly.getDay() && daysDiff % 7 === 0;
        case 'biweekly':
            return daysDiff % 14 === 0;
        case 'monthly':
            return eventDate.getDate() === dateOnly.getDate();
        case 'yearly':
            return eventDate.getMonth() === dateOnly.getMonth() && eventDate.getDate() === dateOnly.getDate();
        default:
            return false;
    }
}

async function fetchEvents() {
    statusEl.textContent = 'Loading events...';

    try {
        const response = await fetch('/api/calendar/events');
        if (!response.ok) {
            throw new Error('Failed to load events');
        }
        const data = await response.json();
        allEvents = data.events || [];
        renderCalendar();
        renderEvents(allEvents);
        statusEl.textContent = '';
    } catch (error) {
        statusEl.textContent = error.message;
    }
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthYearEl.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    calendarGrid.innerHTML = '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';

        if (date.getMonth() !== month) {
            dayEl.classList.add('other-month');
        }

        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);
        if (dateOnly.getTime() === today.getTime()) {
            dayEl.classList.add('today');
        }

        const dateStr = date.toISOString().split('T')[0];
        const dayEvents = allEvents.filter(e => isEventOnDate(e, date));

        const numberEl = document.createElement('div');
        numberEl.className = 'calendar-day-number';
        numberEl.textContent = date.getDate();
        dayEl.appendChild(numberEl);

        if (dayEvents.length > 0) {
            const eventsEl = document.createElement('div');
            eventsEl.className = 'calendar-events';
            dayEvents.slice(0, 2).forEach(event => {
                const eventEl = document.createElement('div');
                eventEl.className = 'calendar-event-title';
                eventEl.style.backgroundColor = `${event.color}20`;
                eventEl.style.color = event.color;
                eventEl.style.borderLeft = `3px solid ${event.color}`;
                eventEl.innerHTML = `<span class="calendar-event-dot" style="background-color: ${event.color}"></span>${event.title}`;
                eventsEl.appendChild(eventEl);
            });
            if (dayEvents.length > 2) {
                const moreEl = document.createElement('div');
                moreEl.className = 'calendar-event-title';
                moreEl.textContent = `+${dayEvents.length - 2} more`;
                eventsEl.appendChild(moreEl);
            }
            dayEl.appendChild(eventsEl);
        }

        dayEl.addEventListener('click', () => {
            dateInput.value = dateStr;
            form.scrollIntoView({ behavior: 'smooth' });
            document.getElementById('title').focus();
        });

        calendarGrid.appendChild(dayEl);
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
        card.style.borderLeft = `4px solid ${event.color || '#2c6bff'}`;

        const title = document.createElement('h3');
        title.textContent = event.title;
        title.style.color = event.color || '#2c6bff';

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
        colorInput.value = '#2c6bff';
        colorLabel.textContent = 'Blue';
        recurrenceInput.value = 'none';
        recurrenceEndLabel.style.display = 'none';
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
colorInput.addEventListener('change', () => {
    colorLabel.textContent = colorNames[colorInput.value] || 'Custom';
});
recurrenceInput.addEventListener('change', () => {
    if (recurrenceInput.value !== 'none') {
        recurrenceEndLabel.style.display = 'grid';
    } else {
        recurrenceEndLabel.style.display = 'none';
    }
});
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});
nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

fetchEvents();
