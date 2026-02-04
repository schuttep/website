const API_BASE = '';

// Team Members
let teamMembers = [];
let availability = [];
let projectEvents = [];
let currentDate = new Date();
let editingEventId = null;

// Load initial data
document.addEventListener('DOMContentLoaded', async () => {
    await loadAvailability();
    await loadProjectEvents();
    await checkAPIStatus();
    await loadDevNotes();
    renderCalendar();
});

// Project Links
async function loadProjectLinks() {
    try {
        const res = await fetch('/api/chess/project/links');
        const data = await res.json();
        if (data.github) {
            document.getElementById('github-link').href = data.github;
        }
        if (data.drive) {
            document.getElementById('drive-link').href = data.drive;
        }
    } catch (error) {
        console.error('Error loading project links:', error);
    }
}

// Team Members Management
async function loadTeamMembers() {
    try {
        const response = await fetch('/api/chess/team/members');
        const data = await response.json();
        teamMembers = data.members || [];
        renderTeamMembers();
    } catch (error) {
        console.error('Failed to load team members:', error);
    }
}

function renderTeamMembers() {
    const container = document.getElementById('team-members');
    if (!teamMembers.length) {
        container.innerHTML = '<p style="color: #718096;">No team members yet. Add your first member!</p>';
        return;
    }

    container.innerHTML = teamMembers.map(member => `
        <div class="team-member">
            <button class="remove-member" onclick="removeMember('${member.id}')">×</button>
            <div class="name">${member.name}</div>
            <div class="role">${member.role || 'Team Member'}</div>
        </div>
    `).join('');
}

document.getElementById('add-member-btn').addEventListener('click', async () => {
    const name = prompt('Enter team member name:');
    if (!name) return;

    const role = prompt('Enter role (optional):') || 'Team Member';

    try {
        await fetch('/api/chess/team/member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, role })
        });
        await loadTeamMembers();
    } catch (error) {
        alert('Failed to add team member');
    }
});

async function removeMember(id) {
    if (!confirm('Remove this team member?')) return;

    try {
        await fetch(`/api/chess/team/member/${id}`, { method: 'DELETE' });
        await loadTeamMembers();
    } catch (error) {
        alert('Failed to remove team member');
    }
}

// Meeting Scheduler
async function loadAvailability() {
    try {
        const response = await fetch('/api/chess/meeting/availability');
        const data = await response.json();
        availability = data.availability || [];
        renderAvailability();
    } catch (error) {
        console.error('Failed to load availability:', error);
    }
}

function renderAvailability() {
    const container = document.getElementById('availability-list');
    if (!availability.length) {
        container.innerHTML = '<p style="color: #718096;">No availability added yet.</p>';
        return;
    }

    container.innerHTML = availability.map((slot, index) => `
        <div class="availability-item">
            <div>
                <span class="name">${slot.name}</span> - 
                <span class="time">${slot.date} from ${slot.timeFrom} to ${slot.timeTo}</span>
            </div>
            <button class="remove-availability" onclick="removeAvailability(${index})">Remove</button>
        </div>
    `).join('');
}

document.getElementById('add-availability-btn').addEventListener('click', async () => {
    const name = document.getElementById('member-name').value;
    const date = document.getElementById('availability-date').value;
    const timeFrom = document.getElementById('time-from').value;
    const timeTo = document.getElementById('time-to').value;

    if (!name || !date || !timeFrom || !timeTo) {
        alert('Please fill in all fields');
        return;
    }

    try {
        await fetch('/api/chess/meeting/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, date, timeFrom, timeTo })
        });

        // Clear form
        document.getElementById('member-name').value = '';
        document.getElementById('availability-date').value = '';
        document.getElementById('time-from').value = '';
        document.getElementById('time-to').value = '';

        await loadAvailability();
    } catch (error) {
        alert('Failed to add availability');
    }
});

async function removeAvailability(index) {
    try {
        await fetch(`/api/chess/meeting/availability/${index}`, { method: 'DELETE' });
        await loadAvailability();
    } catch (error) {
        alert('Failed to remove availability');
    }
}

document.getElementById('find-best-time-btn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/chess/meeting/best-time');
        const data = await response.json();

        const resultDiv = document.getElementById('best-time-result');
        if (data.bestTime) {
            resultDiv.innerHTML = `
                <h3>🎯 Best Meeting Time Found!</h3>
                <p><strong>Date:</strong> ${data.bestTime.date}</p>
                <p><strong>Time:</strong> ${data.bestTime.timeFrom} - ${data.bestTime.timeTo}</p>
                <p><strong>Available Members:</strong> ${data.bestTime.members.join(', ')}</p>
            `;
            resultDiv.classList.add('show');
        } else {
            resultDiv.innerHTML = '<p>No overlapping availability found. Try adding more time slots!</p>';
            resultDiv.classList.add('show');
        }
    } catch (error) {
        alert('Failed to find best meeting time');
    }
});

// Calendar
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    document.getElementById('month-year').textContent =
        currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day';
        emptyDay.style.opacity = '0.3';
        grid.appendChild(emptyDay);
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Check if day has events
        if (projectEvents.some(e => e.date === dateStr)) {
            dayEl.classList.add('has-event');
        }

        // Mark today
        const today = new Date();
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
            dayEl.classList.add('today');
        }

        dayEl.addEventListener('click', () => {
            document.getElementById('event-date').value = dateStr;
            document.getElementById('event-form').scrollIntoView({ behavior: 'smooth' });
        });

        grid.appendChild(dayEl);
    }
}

document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

// Project Events
async function loadProjectEvents() {
    try {
        const response = await fetch('/api/chess/project/events');
        const data = await response.json();
        projectEvents = data.events || [];
        renderProjectEvents();
        renderCalendar();
    } catch (error) {
        console.error('Failed to load events:', error);
    }
}

function renderProjectEvents() {
    const container = document.getElementById('events-list');
    if (!projectEvents.length) {
        container.innerHTML = '<p style="color: #718096;">No events yet. Add your first project milestone!</p>';
        return;
    }

    const sorted = [...projectEvents].sort((a, b) => {
        return `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`);
    });

    container.innerHTML = sorted.map(event => `
        <div class="event-item">
            <div class="event-info">
                <h4>${event.title}</h4>
                <div class="date">${event.date}${event.time ? ' • ' + event.time : ''}</div>
                ${event.notes ? `<p style="margin-top: 0.5rem; color: #718096;">${event.notes}</p>` : ''}
            </div>
            <div class="event-actions">
                <button class="edit-event" onclick="editEvent('${event.id}')">Edit</button>
                <button class="delete-event" onclick="deleteEvent('${event.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('event-title').value;
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const notes = document.getElementById('event-notes').value;

    try {
        if (editingEventId) {
            await fetch(`/api/chess/project/event/${editingEventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, date, time, notes })
            });
        } else {
            await fetch('/api/chess/project/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, date, time, notes })
            });
        }

        resetEventForm();
        await loadProjectEvents();
    } catch (error) {
        alert('Failed to save event');
    }
});

function editEvent(id) {
    const event = projectEvents.find(e => e.id === id);
    if (!event) return;

    editingEventId = id;
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-date').value = event.date;
    document.getElementById('event-time').value = event.time || '';
    document.getElementById('event-notes').value = event.notes || '';

    document.getElementById('event-form-title').textContent = 'Edit Event';
    document.getElementById('submit-event-btn').textContent = 'Update Event';
    document.getElementById('cancel-event-btn').style.display = 'inline-block';

    document.getElementById('event-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;

    try {
        await fetch(`/api/chess/project/event/${id}`, { method: 'DELETE' });
        await loadProjectEvents();
    } catch (error) {
        alert('Failed to delete event');
    }
}

document.getElementById('cancel-event-btn').addEventListener('click', resetEventForm);

function resetEventForm() {
    editingEventId = null;
    document.getElementById('event-form').reset();
    document.getElementById('event-form-title').textContent = 'Add Project Event';
    document.getElementById('submit-event-btn').textContent = 'Add Event';
    document.getElementById('cancel-event-btn').style.display = 'none';
}

// Collapsible Sections
function toggleSection(headerElement) {
    const section = headerElement.closest('.collapsible-section');
    section.classList.toggle('collapsed');
}

// Development Tabs
function showDevSection(sectionName, buttonElement) {
    // Update tab buttons
    document.querySelectorAll('.dev-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Find and activate the clicked button
    const buttons = document.querySelectorAll('.dev-tab');
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(sectionName)) {
            btn.classList.add('active');
        }
    });

    // Update sections
    document.querySelectorAll('.dev-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`dev-${sectionName}`).classList.add('active');
}

// Save Development Notes
async function saveDevNotes(section) {
    const textarea = document.querySelector(`#dev-${section} textarea`);
    const notes = textarea.value;

    try {
        const response = await fetch(`/api/chess/development/notes/${section}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });

        if (response.ok) {
            const savedNotesEl = document.querySelector(`#dev-${section} .saved-notes`);
            savedNotesEl.textContent = notes;
            alert('Notes saved successfully!');
        } else {
            alert('Failed to save notes');
        }
    } catch (error) {
        console.error('Error saving notes:', error);
        alert('Error saving notes');
    }
}

// Load development notes on page load
async function loadDevNotes() {
    try {
        const response = await fetch('/api/chess/development/notes');
        const data = await response.json();

        if (data.hardware) {
            document.querySelector('#dev-hardware textarea').value = data.hardware;
            document.querySelector('#dev-hardware .saved-notes').textContent = data.hardware;
        }
        if (data.software) {
            document.querySelector('#dev-software textarea').value = data.software;
            document.querySelector('#dev-software .saved-notes').textContent = data.software;
        }
        if (data.internet) {
            document.querySelector('#dev-internet textarea').value = data.internet;
            document.querySelector('#dev-internet .saved-notes').textContent = data.internet;
        }
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

try {
    const response = await fetch('/api/chess/status');
    const data = await response.json();
    document.getElementById('status-text').textContent = data.status || 'Online';
} catch (error) {
    document.getElementById('status-text').textContent = 'Offline';
    document.querySelector('.status-dot').style.background = '#f56565';
}
}

document.getElementById('test-api-btn').addEventListener('click', async () => {
    const endpoint = document.getElementById('test-endpoint').value;
    const responseEl = document.getElementById('api-response');

    responseEl.textContent = 'Loading...';

    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        responseEl.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        responseEl.textContent = 'Error: ' + error.message;
    }
});
