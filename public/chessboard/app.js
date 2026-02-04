// Collapsible Sections
function toggleSection(headerElement) {
    const section = headerElement.closest('.collapsible-section');
    section.classList.toggle('collapsed');
}

// To-Do List
let tasks = { hardware: [], software: [], internet: [] };

// Load tasks on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTasks();
});

// Load tasks from API
async function loadTasks() {
    try {
        const response = await fetch('/api/chess/tasks');
        const data = await response.json();
        tasks = data.tasks || { hardware: [], software: [], internet: [] };
        renderAllTasks();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

// Show specific to-do section
function showTodoSection(section) {
    document.querySelectorAll('.todo-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.todo-section').forEach(sec => sec.classList.remove('active'));

    event.target.classList.add('active');
    document.getElementById(`todo-${section}`).classList.add('active');
}

// Add task
async function addTask(section) {
    const input = document.getElementById(`${section}-task-input`);
    const taskText = input.value.trim();

    if (!taskText) return;

    const task = {
        id: Date.now().toString(),
        text: taskText,
        status: 'not-started',
        createdAt: new Date().toISOString()
    };

    try {
        const response = await fetch(`/api/chess/tasks/${section}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });

        if (response.ok) {
            tasks[section].push(task);
            input.value = '';
            renderTasks(section);
        }
    } catch (error) {
        console.error('Error adding task:', error);
    }
}

// Update task status
async function updateTaskStatus(section, taskId, newStatus) {
    try {
        const response = await fetch(`/api/chess/tasks/${section}/${taskId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            const task = tasks[section].find(t => t.id === taskId);
            if (task) {
                task.status = newStatus;
                renderTasks(section);
            }
        }
    } catch (error) {
        console.error('Error updating task:', error);
    }
}

// Delete task
async function deleteTask(section, taskId) {
    try {
        const response = await fetch(`/api/chess/tasks/${section}/${taskId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            tasks[section] = tasks[section].filter(t => t.id !== taskId);
            renderTasks(section);
        }
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}

// Render tasks for a specific section
function renderTasks(section) {
    const container = document.getElementById(`${section}-tasks`);
    const sectionTasks = tasks[section] || [];

    if (sectionTasks.length === 0) {
        container.innerHTML = '<p class="no-tasks">No tasks yet. Add one above!</p>';
        return;
    }

    container.innerHTML = sectionTasks.map(task => `
        <div class="task-item ${task.status}">
            <div class="task-content">
                <span class="task-text">${task.text}</span>
            </div>
            <div class="task-actions">
                <select class="task-status" onchange="updateTaskStatus('${section}', '${task.id}', this.value)">
                    <option value="not-started" ${task.status === 'not-started' ? 'selected' : ''}>Not Started</option>
                    <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                    <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
                </select>
                <button onclick="deleteTask('${section}', '${task.id}')" class="btn-delete">✕</button>
            </div>
        </div>
    `).join('');
}

// Render all tasks
function renderAllTasks() {
    renderTasks('hardware');
    renderTasks('software');
    renderTasks('internet');
}
// Weekly Calendar
let currentWeekStart = new Date();
currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
let calendarEvents = { group: {}, payton: {}, quinn: {}, danny: {} };
let currentView = 'weekly';
let currentMonth = new Date();

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COLORS = {
    blue: '#667eea',
    red: '#f56565',
    green: '#48bb78',
    yellow: '#f6ad55',
    purple: '#9f7aea'
};

// Load calendar events on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Tasks load already happens
    // Now load calendar
    await loadCalendarEvents();
    renderWeeklyCalendar();
});

// Load calendar events from API
async function loadCalendarEvents() {
    try {
        const response = await fetch('/api/chess/calendar');
        const data = await response.json();
        calendarEvents = data.events || { group: {}, payton: {}, quinn: {}, danny: {} };
        renderWeeklyCalendar();
    } catch (error) {
        console.error('Error loading calendar events:', error);
    }
}

// Get week range display
function getWeekRangeDisplay() {
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);

    const options = { month: 'short', day: 'numeric' };
    const startStr = currentWeekStart.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', options);
    return `${startStr} - ${endStr}`;
}

// Navigate weeks
function previousWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderWeeklyCalendar();
}

function nextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderWeeklyCalendar();
}

// Render all weekly calendars
function renderWeeklyCalendar() {
    document.getElementById('week-display').textContent = `Week of ${getWeekRangeDisplay()}`;

    renderCalendarForPerson('group');
    renderCalendarForPerson('payton');
    renderCalendarForPerson('quinn');
    renderCalendarForPerson('danny');
}

// Switch view
function switchView(view) {
    currentView = view;
    document.getElementById('weekly-btn').classList.remove('active');
    document.getElementById('monthly-btn').classList.remove('active');

    if (view === 'weekly') {
        document.getElementById('weekly-btn').classList.add('active');
        renderWeeklyCalendar();
    } else {
        document.getElementById('monthly-btn').classList.add('active');
        renderMonthlyCalendar();
    }
}
const dateStr = date.toISOString().split('T')[0];
const dayName = WEEKDAYS[i];
const dayNum = date.getDate();

const dayEvents = calendarEvents[person][dateStr] || [];

<div class="event-badge" style="background-color: ${COLORS[evt.color] || COLORS.blue}" onclick="deleteCalendarEvent('${person}', '${dateStr}', '${evt.id}')">
    ${evt.title}
    <span class="delete-hint">✕</span>
</div>
`).join('')}
                </div>
            </div>
        `;
    }

html += '</div>';
container.innerHTML = html;
}

// Render monthly calendar
function renderMonthlyCalendar() {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    document.getElementById('week-display').textContent = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const colorSelect = document.getElementById(`${person}-color-select`);

    const title = input.value.trim();
    const dayOffset = parseInt(daySelect.value);
    const color = colorSelect.value;

    if (!title) return;

    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    try {
        const response = await fetch(`/api/chess/calendar/${person}/${dateStr}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                color,
                id: Date.now().toString()
            })
        });

        if (response.ok) {
            input.value = '';
            daySelect.value = '0';
            colorSelect.value = 'blue'; '' : 'other-month'
        } ">
            < div class="month-date" > ${ date.getDate() }</div >
                <div class="month-events">
                    ${dayEvents.map(evt => `
                        <div class="month-event-badge" style="background-color: ${COLORS[evt.color] || COLORS.blue}" onclick="deleteCalendarEvent('${person}', '${dateStr}', '${evt.id}')"></div>    const daySelect = document.getElementById(`${ person } - day - select`);

    const title = input.value.trim();
    const dayOffset = parseInt(daySelect.value);

    if (!title) return;

    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    try {
        const response = await fetch(`/ api / chess / calendar / ${ person } / ${ dateStr }`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                id: Date.now().toString()
            })
        });

        if (response.ok) {
            input.value = '';
            daySelect.value = '0';
            await loadCalendarEvents();
        }
    } catch (error) {
        console.error('Error adding event:', error);
    }
}

// Delete calendar event
async function deleteCalendarEvent(person, dateStr, eventId) {
    try {
        const response = await fetch(`/ api / chess / calendar / ${ person } / ${ dateStr } / ${ eventId }`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadCalendarEvents();
        }
    } catch (error) {
        console.error('Error deleting event:', error);
    }
}