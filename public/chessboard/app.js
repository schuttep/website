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
