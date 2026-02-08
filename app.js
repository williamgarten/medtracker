// MedTracker App v2

// Data storage
let medications = JSON.parse(localStorage.getItem('medications')) || [];
let logs = JSON.parse(localStorage.getItem('medLogs')) || [];
let editingMedId = null;
let loggingShotId = null;
let currentCalendarDate = new Date();
let editingDate = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateDate();
    renderToday();
    renderSettings();
    renderCalendar();
    setupTypeSelector();
    updateNotificationStatus();
    requestNotificationPermission();
});

function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
}

function getDateStr(date) {
    return date.toISOString().split('T')[0];
}

function getToday() {
    return getDateStr(new Date());
}

function getLogsForDate(dateStr) {
    return logs.filter(log => log.date === dateStr);
}

function getTodayLogs() {
    return getLogsForDate(getToday());
}

// Render today's medications
function renderToday() {
    const container = document.getElementById('todayMeds');
    const todayLogs = getTodayLogs();
    
    if (medications.length === 0) {
        container.innerHTML = '<div class="empty-state">No medications added yet.<br>Go to Settings to add some.</div>';
        return;
    }
    
    container.innerHTML = medications.map(med => {
        const log = todayLogs.find(l => l.medId === med.id);
        const taken = !!log;
        const units = log?.units;
        
        return `
            <div class="med-item ${taken ? 'taken' : ''}" data-id="${med.id}">
                <div class="med-info">
                    <h3>${med.name}</h3>
                    <div class="type">${med.type === 'shot' ? '💉 Shot' : '💊 Pill'}</div>
                    ${taken && med.type === 'shot' && units ? `<div class="units">${units} units</div>` : ''}
                    ${taken ? `<div class="type">✓ Taken${log.time ? ' at ' + log.time : ''}</div>` : ''}
                </div>
                <div class="med-actions">
                    <button class="check-btn ${taken ? 'checked' : ''}" onclick="toggleMed('${med.id}')">
                        ${taken ? '✓' : ''}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Toggle medication taken
function toggleMed(medId, dateStr = null) {
    const med = medications.find(m => m.id === medId);
    const targetDate = dateStr || getToday();
    const existingLog = logs.find(l => l.medId === medId && l.date === targetDate);
    
    if (existingLog) {
        logs = logs.filter(l => !(l.medId === medId && l.date === targetDate));
    } else {
        if (med.type === 'shot') {
            loggingShotId = medId;
            editingDate = targetDate;
            document.getElementById('shotMedName').textContent = med.name;
            document.getElementById('shotUnits').value = med.defaultUnits || '';
            document.getElementById('logShotModal').classList.remove('hidden');
            document.getElementById('shotUnits').focus();
            return;
        } else {
            logs.push({
                medId: medId,
                date: targetDate,
                time: targetDate === getToday() ? new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
                type: 'pill'
            });
        }
    }
    
    saveLogs();
    renderToday();
    renderCalendar();
    if (editingDate) renderEditDayModal(editingDate);
}

// Log shot with units
function logShot() {
    const units = document.getElementById('shotUnits').value;
    const targetDate = editingDate || getToday();
    
    logs.push({
        medId: loggingShotId,
        date: targetDate,
        time: targetDate === getToday() ? new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
        type: 'shot',
        units: units ? parseInt(units) : null
    });
    
    saveLogs();
    closeLogModal();
    renderToday();
    renderCalendar();
    if (editingDate) renderEditDayModal(editingDate);
}

function closeLogModal() {
    document.getElementById('logShotModal').classList.add('hidden');
    loggingShotId = null;
    editingDate = null;
}

// Calendar rendering
function renderCalendar() {
    const container = document.getElementById('calendarView');
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update month label
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = getToday();
    
    // Day headers
    let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map(d => `<div class="calendar-header">${d}</div>`).join('');
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayLogs = getLogsForDate(dateStr);
        const isToday = dateStr === today;
        
        let dayClass = 'calendar-day';
        if (isToday) dayClass += ' today';
        
        if (dayLogs.length > 0) {
            // Check if all meds taken
            const allTaken = medications.every(med => dayLogs.some(l => l.medId === med.id));
            dayClass += allTaken ? ' has-logs' : ' partial';
        }
        
        html += `
            <div class="${dayClass}" onclick="showDayDetail('${dateStr}')">
                <span class="day-num">${day}</span>
                ${dayLogs.length > 0 ? `<span class="log-count">${dayLogs.length}/${medications.length}</span>` : ''}
            </div>
        `;
    }
    
    container.innerHTML = html;
    renderWeeklyStats();
}

function prevMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
}

// Weekly stats
function renderWeeklyStats() {
    const container = document.getElementById('weeklyStats');
    
    // Get current week (Sunday to Saturday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    
    let totalUnits = {};
    let daysTracked = 0;
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = getDateStr(date);
        const dayLogs = getLogsForDate(dateStr);
        
        if (dayLogs.length > 0) daysTracked++;
        
        dayLogs.forEach(log => {
            if (log.units) {
                const med = medications.find(m => m.id === log.medId);
                const medName = med?.name || 'Unknown';
                totalUnits[medName] = (totalUnits[medName] || 0) + log.units;
            }
        });
    }
    
    const weekRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(weekStart.getTime() + 6*24*60*60*1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    
    let html = `<h3>This Week (${weekRange})</h3>`;
    html += `<div class="stat-row"><span class="stat-label">Days Tracked</span><span class="stat-value">${daysTracked}/7</span></div>`;
    
    // Show units per shot medication
    Object.entries(totalUnits).forEach(([medName, units]) => {
        html += `<div class="stat-row"><span class="stat-label">${medName}</span><span class="stat-value">${units} units</span></div>`;
    });
    
    if (Object.keys(totalUnits).length === 0) {
        html += `<div class="stat-row"><span class="stat-label">No injectable data</span><span class="stat-value">-</span></div>`;
    }
    
    container.innerHTML = html;
}

// Day detail / edit
function showDayDetail(dateStr) {
    editingDate = dateStr;
    renderEditDayModal(dateStr);
    document.getElementById('editDayModal').classList.remove('hidden');
}

function renderEditDayModal(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('editDayTitle').textContent = dateLabel;
    
    const dayLogs = getLogsForDate(dateStr);
    const container = document.getElementById('editDayMeds');
    
    if (medications.length === 0) {
        container.innerHTML = '<div class="empty-state">No medications configured.</div>';
        return;
    }
    
    container.innerHTML = medications.map(med => {
        const log = dayLogs.find(l => l.medId === med.id);
        const taken = !!log;
        
        let unitInput = '';
        if (med.type === 'shot') {
            unitInput = `<input type="number" placeholder="Units" value="${log?.units || ''}" onchange="updateLogUnits('${med.id}', '${dateStr}', this.value)">`;
        }
        
        return `
            <div class="edit-med-row">
                <span class="med-name">${med.name} ${med.type === 'shot' ? '💉' : '💊'}</span>
                ${unitInput}
                <button class="toggle-btn ${taken ? 'active' : ''}" onclick="toggleMedForDate('${med.id}', '${dateStr}')">
                    ${taken ? '✓' : ''}
                </button>
            </div>
        `;
    }).join('');
}

function toggleMedForDate(medId, dateStr) {
    const med = medications.find(m => m.id === medId);
    const existingLog = logs.find(l => l.medId === medId && l.date === dateStr);
    
    if (existingLog) {
        logs = logs.filter(l => !(l.medId === medId && l.date === dateStr));
        saveLogs();
        renderEditDayModal(dateStr);
        renderCalendar();
        renderToday();
    } else {
        if (med.type === 'shot') {
            loggingShotId = medId;
            editingDate = dateStr;
            document.getElementById('shotMedName').textContent = med.name;
            document.getElementById('shotUnits').value = med.defaultUnits || '';
            document.getElementById('logShotModal').classList.remove('hidden');
        } else {
            logs.push({
                medId: medId,
                date: dateStr,
                time: null,
                type: 'pill'
            });
            saveLogs();
            renderEditDayModal(dateStr);
            renderCalendar();
            renderToday();
        }
    }
}

function updateLogUnits(medId, dateStr, units) {
    const log = logs.find(l => l.medId === medId && l.date === dateStr);
    if (log) {
        log.units = units ? parseInt(units) : null;
        saveLogs();
        renderWeeklyStats();
    }
}

function closeEditDayModal() {
    document.getElementById('editDayModal').classList.add('hidden');
    editingDate = null;
}

// Render settings/medications list
function renderSettings() {
    const container = document.getElementById('medSettings');
    
    if (medications.length === 0) {
        container.innerHTML = '<div class="empty-state">No medications yet.</div>';
        return;
    }
    
    container.innerHTML = medications.map(med => `
        <div class="med-item" data-id="${med.id}">
            <div class="med-info">
                <h3>${med.name}</h3>
                <div class="type">${med.type === 'shot' ? '💉 Shot' + (med.defaultUnits ? ` (${med.defaultUnits} units default)` : '') : '💊 Pill'}</div>
            </div>
            <div class="med-actions">
                <button class="edit-btn" onclick="editMed('${med.id}')">✏️</button>
                <button class="delete-btn" onclick="deleteMed('${med.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Show section
function showSection(sectionId) {
    document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
    
    if (sectionId === 'historySection') {
        renderCalendar();
    }
}

// Modal functions
function showAddMed() {
    editingMedId = null;
    document.getElementById('modalTitle').textContent = 'Add Medication';
    document.getElementById('medName').value = '';
    document.querySelector('input[name="medType"][value="pill"]').checked = true;
    document.getElementById('defaultUnits').value = '';
    document.getElementById('defaultUnits').classList.add('hidden');
    document.getElementById('addMedModal').classList.remove('hidden');
    document.getElementById('medName').focus();
}

function editMed(medId) {
    const med = medications.find(m => m.id === medId);
    if (!med) return;
    
    editingMedId = medId;
    document.getElementById('modalTitle').textContent = 'Edit Medication';
    document.getElementById('medName').value = med.name;
    document.querySelector(`input[name="medType"][value="${med.type}"]`).checked = true;
    document.getElementById('defaultUnits').value = med.defaultUnits || '';
    document.getElementById('defaultUnits').classList.toggle('hidden', med.type !== 'shot');
    document.getElementById('addMedModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('addMedModal').classList.add('hidden');
    editingMedId = null;
}

function saveMed() {
    const name = document.getElementById('medName').value.trim();
    const type = document.querySelector('input[name="medType"]:checked').value;
    const defaultUnits = document.getElementById('defaultUnits').value;
    
    if (!name) {
        alert('Please enter a medication name');
        return;
    }
    
    if (editingMedId) {
        const med = medications.find(m => m.id === editingMedId);
        if (med) {
            med.name = name;
            med.type = type;
            med.defaultUnits = type === 'shot' ? (defaultUnits ? parseInt(defaultUnits) : null) : null;
        }
    } else {
        medications.push({
            id: Date.now().toString(),
            name: name,
            type: type,
            defaultUnits: type === 'shot' ? (defaultUnits ? parseInt(defaultUnits) : null) : null
        });
    }
    
    saveMedications();
    closeModal();
    renderToday();
    renderSettings();
    renderCalendar();
}

function deleteMed(medId) {
    if (!confirm('Delete this medication?')) return;
    
    medications = medications.filter(m => m.id !== medId);
    logs = logs.filter(l => l.medId !== medId);
    
    saveMedications();
    saveLogs();
    renderToday();
    renderSettings();
    renderCalendar();
}

function setupTypeSelector() {
    document.querySelectorAll('input[name="medType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('defaultUnits').classList.toggle('hidden', e.target.value !== 'shot');
        });
    });
}

// Storage
function saveMedications() {
    localStorage.setItem('medications', JSON.stringify(medications));
}

function saveLogs() {
    localStorage.setItem('medLogs', JSON.stringify(logs));
}

// Notifications
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        // Will request when user clicks enable
    }
    updateNotificationStatus();
}

async function toggleNotifications() {
    if (!('Notification' in window)) {
        alert('Notifications are not supported in this browser');
        return;
    }
    
    if (Notification.permission === 'granted') {
        // Disable - just update UI (can't revoke permission)
        localStorage.setItem('notificationsEnabled', 'false');
        updateNotificationStatus();
    } else if (Notification.permission === 'denied') {
        alert('Notifications are blocked. Please enable them in your browser settings.');
    } else {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem('notificationsEnabled', 'true');
            scheduleNotification();
            new Notification('MedTracker', {
                body: 'Notifications enabled! You\'ll be reminded to take your meds.',
                icon: 'icon-192.png'
            });
        }
        updateNotificationStatus();
    }
}

function updateNotificationStatus() {
    const btn = document.getElementById('notifBtn');
    const status = document.getElementById('notifStatus');
    
    if (!('Notification' in window)) {
        btn.textContent = 'Not Supported';
        btn.disabled = true;
        status.textContent = 'Your browser doesn\'t support notifications.';
        return;
    }
    
    const enabled = localStorage.getItem('notificationsEnabled') === 'true';
    
    if (Notification.permission === 'granted' && enabled) {
        btn.textContent = 'Disable';
        btn.style.background = 'var(--surface-light)';
        status.textContent = '✓ Notifications enabled. You\'ll get daily reminders.';
    } else if (Notification.permission === 'denied') {
        btn.textContent = 'Blocked';
        btn.disabled = true;
        status.textContent = 'Notifications blocked. Enable in browser settings.';
    } else {
        btn.textContent = 'Enable';
        btn.style.background = 'var(--success)';
        status.textContent = 'Enable notifications to get medication reminders.';
    }
}

function scheduleNotification() {
    // For PWA, we'd use service worker for true scheduled notifications
    // This is a simple check on page load
    if (Notification.permission === 'granted' && localStorage.getItem('notificationsEnabled') === 'true') {
        const now = new Date();
        const hour = now.getHours();
        
        // Check if morning (8-10am) and no meds logged today
        if (hour >= 8 && hour <= 10) {
            const todayLogs = getTodayLogs();
            if (todayLogs.length === 0 && medications.length > 0) {
                new Notification('MedTracker Reminder', {
                    body: 'Don\'t forget to log your medications today!',
                    icon: 'icon-192.png',
                    tag: 'med-reminder'
                });
            }
        }
    }
}

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
