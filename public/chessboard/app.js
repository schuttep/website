// Collapsible Sections
function toggleSection(headerElement) {
    const section = headerElement.closest('.collapsible-section');
    section.classList.toggle('collapsed');
}

// To-Do List
let tasks = { hardware: [], software: [], internet: [], misc: [] };

// Parts List
let parts = [];

// Load tasks and calendar on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTasks();
    await loadCalendarEvents();
    await loadParts();
    renderWeeklyCalendar();
});

// Load tasks from API
async function loadTasks() {
    try {
        const response = await fetch('/api/chess/tasks');
        const data = await response.json();
        tasks = data.tasks || { hardware: [], software: [], internet: [], misc: [] };
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
    const assigneeSelect = document.getElementById(`${section}-assignee-select`);
    const deadlineInput = document.getElementById(`${section}-deadline-input`);
    const assignee = assigneeSelect.value;
    const deadline = deadlineInput.value;

    if (!taskText) return;

    const task = {
        id: Date.now().toString(),
        text: taskText,
        status: 'not-started',
        createdAt: new Date().toISOString(),
        assignedTo: assignee || null,
        deadline: deadline || null
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
            assigneeSelect.value = '';
            deadlineInput.value = '';
            renderTasks(section);

            // If task has both assignee and deadline, add to calendar
            if (assignee && deadline) {
                const color = getSectionColor(section);
                await addTaskToCalendar(assignee, deadline, taskText, color);
            }
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

// Update task assignee
async function updateTaskAssignee(section, taskId, newAssignee) {
    try {
        const task = tasks[section].find(t => t.id === taskId);
        const oldAssignee = task?.assignedTo;
        const deadline = task?.deadline;

        const response = await fetch(`/api/chess/tasks/${section}/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedTo: newAssignee || null })
        });

        if (response.ok) {
            if (task) {
                task.assignedTo = newAssignee || null;
                renderTasks(section);

                // Update calendar if there's a deadline
                if (deadline) {
                    // Remove from old assignee's calendar if exists
                    if (oldAssignee) {
                        await removeTaskFromCalendar(oldAssignee, deadline, task.text);
                    }
                    // Add to new assignee's calendar if assigned
                    if (newAssignee) {
                        const color = getSectionColor(section);
                        await addTaskToCalendar(newAssignee, deadline, task.text, color);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error updating task assignee:', error);
    }
}

// Update task deadline
async function updateTaskDeadline(section, taskId, newDeadline) {
    try {
        const task = tasks[section].find(t => t.id === taskId);
        const oldDeadline = task?.deadline;
        const assignee = task?.assignedTo;

        const response = await fetch(`/api/chess/tasks/${section}/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deadline: newDeadline || null })
        });

        if (response.ok) {
            if (task) {
                task.deadline = newDeadline || null;
                renderTasks(section);

                // Update calendar if there's an assignee
                if (assignee) {
                    // Remove from old deadline if exists
                    if (oldDeadline) {
                        await removeTaskFromCalendar(assignee, oldDeadline, task.text);
                    }
                    // Add to new deadline if set
                    if (newDeadline) {
                        const color = getSectionColor(section);
                        await addTaskToCalendar(assignee, newDeadline, task.text, color);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error updating task deadline:', error);
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

    container.innerHTML = sectionTasks.map(task => {
        return `
            <div class="task-item ${task.status}">
                <div class="task-content">
                    <span class="task-text">${task.text}</span>
                    <div class="task-meta">
                        <select class="task-assignee-select" onchange="updateTaskAssignee('${section}', '${task.id}', this.value)">
                            <option value="">Unassigned</option>
                            <option value="payton" ${task.assignedTo === 'payton' ? 'selected' : ''}>P - Payton</option>
                            <option value="quinn" ${task.assignedTo === 'quinn' ? 'selected' : ''}>Q - Quinn</option>
                            <option value="danny" ${task.assignedTo === 'danny' ? 'selected' : ''}>D - Danny</option>
                            <option value="group" ${task.assignedTo === 'group' ? 'selected' : ''}>G - Group</option>
                        </select>
                        <input type="date" class="task-deadline-input" value="${task.deadline || ''}" onchange="updateTaskDeadline('${section}', '${task.id}', this.value)" />
                    </div>
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
        `;
    }).join('');
}

// Helper function to get assignee initial
function getAssigneeInitial(assignee) {
    const initials = {
        'payton': 'P',
        'quinn': 'Q',
        'danny': 'D',
        'group': 'G'
    };
    return initials[assignee] || '';
}

// Helper function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get color based on task section
function getSectionColor(section) {
    const colorMap = {
        'hardware': 'red',
        'software': 'green',
        'internet': 'yellow',
        'misc': 'blue'
    };
    return colorMap[section] || 'blue';
}

// Add task to calendar
async function addTaskToCalendar(person, deadline, taskText, color = 'blue') {
    try {
        const response = await fetch(`/api/chess/calendar/${person}/${deadline}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: `Task: ${taskText}`,
                color: color,
                id: Date.now().toString()
            })
        });

        if (response.ok) {
            loadCalendarEvents(); // Reload calendar to show new event
        }
    } catch (error) {
        console.error('Error adding task to calendar:', error);
    }
}

// Remove task from calendar
async function removeTaskFromCalendar(person, deadline, taskText) {
    try {
        const events = calendarEvents[person]?.[deadline] || [];
        const taskEvent = events.find(evt => evt.title === `Task: ${taskText}`);

        if (taskEvent) {
            await deleteCalendarEvent(person, deadline, taskEvent.id);
        }
    } catch (error) {
        console.error('Error removing task from calendar:', error);
    }
}

// Render all tasks
function renderAllTasks() {
    renderTasks('hardware');
    renderTasks('software');
    renderTasks('internet');
    renderTasks('misc');
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

// Load calendar events from API
async function loadCalendarEvents() {
    try {
        const response = await fetch('/api/chess/calendar');
        const data = await response.json();
        calendarEvents = data.events || { group: {}, payton: {}, quinn: {}, danny: {} };
        if (currentView === 'weekly') {
            renderWeeklyCalendar();
        } else {
            renderMonthlyCalendar();
        }
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

// Render calendar for specific person (weekly view)
function renderCalendarForPerson(person) {
    const container = document.getElementById(`${person}-calendar`);
    let html = '<div class="days-grid">';

    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayName = WEEKDAYS[i];
        const dayNum = date.getDate();

        const dayEvents = calendarEvents[person][dateStr] || [];

        html += `
            <div class="day-column">
                <div class="day-header">${dayName}</div>
                <div class="day-num">${dayNum}</div>
                <div class="day-events">
                    ${dayEvents.map(evt => `
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

// Render monthly calendar
function renderMonthlyCalendar() {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    document.getElementById('week-display').textContent = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const people = ['group', 'payton', 'quinn', 'danny'];
    people.forEach(person => {
        renderMonthCalendarForPerson(person, startDate, year, month);
    });
}

function renderMonthCalendarForPerson(person, startDate, year, month) {
    const container = document.getElementById(`${person}-calendar`);
    let html = '<div class="month-grid">';

    // Day headers
    WEEKDAYS.forEach(day => {
        html += `<div class="month-day-header">${day.substr(0, 3)}</div>`;
    });

    // Days
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const isCurrentMonth = date.getMonth() === month;

        const dayEvents = calendarEvents[person][dateStr] || [];

        html += `
            <div class="month-day ${isCurrentMonth ? '' : 'other-month'}">
                <div class="month-date">${date.getDate()}</div>
                <div class="month-events">
                    ${dayEvents.map(evt => `
                        <div class="month-event-badge" style="background-color: ${COLORS[evt.color] || COLORS.blue}" onclick="deleteCalendarEvent('${person}', '${dateStr}', '${evt.id}')"></div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

// Add calendar event
async function addCalendarEvent(person) {
    const input = document.getElementById(`${person}-event-input`);
    const daySelect = document.getElementById(`${person}-day-select`);
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
            colorSelect.value = 'blue';
            await loadCalendarEvents();
        }
    } catch (error) {
        console.error('Error adding event:', error);
    }
}

// Delete calendar event
async function deleteCalendarEvent(person, dateStr, eventId) {
    try {
        const response = await fetch(`/api/chess/calendar/${person}/${dateStr}/${eventId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadCalendarEvents();
        }
    } catch (error) {
        console.error('Error deleting event:', error);
    }
}

// Parts List Functions
async function loadParts() {
    try {
        const response = await fetch('/api/chess/parts');
        const data = await response.json();
        parts = data.parts || [];
        renderPartsList();
    } catch (error) {
        console.error('Error loading parts:', error);
    }
}

function renderPartsList() {
    const container = document.getElementById('parts-list-container');

    if (parts.length === 0) {
        container.innerHTML = '<p class="no-parts">No parts yet. Add one above!</p>';
        updateTotalCost();
        return;
    }

    container.innerHTML = parts.map(part => `
        <div class="part-row">
            <div class="part-fields">
                <div class="part-name">${part.name}</div>
                <div class="part-id">${part.partId}</div>
                <div class="part-cost">$${part.cost.toFixed(2)}</div>
                <div class="part-amount">${part.amountNeeded}</div>
                <select class="part-status" onchange="updatePart('${part.id}', 'status', this.value)">
                    <option value="ordered" ${part.status === 'ordered' ? 'selected' : ''}>Ordered</option>
                    <option value="on-the-way" ${part.status === 'on-the-way' ? 'selected' : ''}>On the Way</option>
                    <option value="delivered" ${part.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                </select>
                <button onclick="deletePart('${part.id}')" class="btn-delete-part">✕ Remove</button>
            </div>
            <div class="part-total">$${(part.cost * part.amountNeeded).toFixed(2)}</div>
        </div>
    `).join('');

    updateTotalCost();
}

async function addPart() {
    const nameInput = document.getElementById('part-name-input');
    const idInput = document.getElementById('part-id-input');
    const costInput = document.getElementById('part-cost-input');
    const amountInput = document.getElementById('part-amount-input');

    const name = nameInput.value.trim();
    const partId = idInput.value.trim();
    const cost = parseFloat(costInput.value);
    const amountNeeded = parseInt(amountInput.value);

    if (!name || !partId || !cost || !amountNeeded || cost < 0 || amountNeeded < 1) {
        alert('Please fill in all fields with valid values');
        return;
    }

    const part = {
        id: Date.now().toString(),
        name,
        partId,
        cost,
        amountNeeded,
        status: 'ordered'
    };

    try {
        const response = await fetch('/api/chess/parts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(part)
        });

        if (response.ok) {
            nameInput.value = '';
            idInput.value = '';
            costInput.value = '';
            amountInput.value = '';
            await loadParts();
        }
    } catch (error) {
        console.error('Error adding part:', error);
    }
}

async function updatePart(partId, field, value) {
    try {
        const response = await fetch(`/api/chess/parts/${partId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value })
        });

        if (response.ok) {
            const part = parts.find(p => p.id === partId);
            if (part) {
                part[field] = value;
                renderPartsList();
            }
        }
    } catch (error) {
        console.error('Error updating part:', error);
    }
}

async function deletePart(partId) {
    try {
        const response = await fetch(`/api/chess/parts/${partId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            parts = parts.filter(p => p.id !== partId);
            renderPartsList();
        }
    } catch (error) {
        console.error('Error deleting part:', error);
    }
}

function updateTotalCost() {
    const total = parts.reduce((sum, part) => sum + (part.cost * part.amountNeeded), 0);
    const totalElement = document.getElementById('parts-total-cost');
    if (totalElement) {
        totalElement.textContent = `$${total.toFixed(2)}`;
    }
}
