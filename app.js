// Golf Tracker App
const DEFAULT_SHOT_TYPES = [
    { id: 'fullswing', name: 'Full Swing', custom: false },
    { id: 'drives', name: 'Drives', custom: false },
    { id: 'pitches', name: 'Pitches', custom: false },
    { id: 'chips', name: 'Chips', custom: false },
    { id: 'putts', name: 'Putts', custom: false }
];

const DEFAULT_CATEGORIES = [
    { id: 'putting', name: 'Putting', subs: [
        { id: 'p1', name: '0-5 ft' }, { id: 'p2', name: '5-10 ft' }, { id: 'p3', name: '10-20 ft' }, { id: 'p4', name: '20+ ft' }
    ] },
    { id: 'chipping', name: 'Chipping', subs: [
        { id: 'c1', name: 'Bump & Run' }, { id: 'c2', name: 'Standard' }, { id: 'c3', name: 'Flop' }
    ] },
    { id: 'approach', name: 'Approach Shots', subs: [
        { id: 'a1', name: '50-75 yds' }, { id: 'a2', name: '75-100 yds' }, { id: 'a3', name: '100-150 yds' }, { id: 'a4', name: '150+ yds' }
    ] },
    { id: 'fullswing', name: 'Full Swing', subs: [
        { id: 'f1', name: 'Driver' }, { id: 'f2', name: 'Irons' }
    ] },
    { id: 'bunker', name: 'Bunker', subs: [] }
];

const QUALITY_LABELS = {
    1: 'Rough day',
    2: 'Below average',
    3: 'Solid session',
    4: 'Good work',
    5: 'Crushed it'
};

// Validated CVD-safe categorical palette (fixed order — never cycled/reassigned)
const CATEGORICAL_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const OTHER_COLOR = '#c3c2b7';
const CATEGORY_SLOT_CAP = 8;

let currentDate = new Date();
let shotTypes = [];
let categories = [];
let goalsMonthView = new Date();
let reportMonthView = new Date();
let activeTimer = null;
let timerInterval = null;

let deleteTargetId = null;
let directInputTarget = null; // { type: 'shot'|'holes', id: string|null }
let logTimeCategoryId = null;
let editEntryTarget = null; // { dateKey, entryId }
let editingGoalId = null;
let goalModalMonthKey = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadShotTypes();
    loadCategories();
    renderDate();
    renderShotGrid();
    loadDayData();
    updateWeeklyStats();
    renderWeeklyGoalsProgress();
    renderGoalsView();
    renderReportView();
    renderDashboard();
    restoreActiveTimer();
    setupEventListeners();
    registerServiceWorker();
});

// ==================== Helpers ====================

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function getDateKey(date) {
    return date.toISOString().split('T')[0];
}

function getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
}

function getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function addMonths(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function formatMinutes(total) {
    total = Math.round(total || 0);
    if (total <= 0) return '0m';
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
}

function formatDate(date) {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (getDateKey(date) === getDateKey(today)) {
        return 'Today';
    } else if (getDateKey(date) === getDateKey(yesterday)) {
        return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', options);
}

function csvEscape(value) {
    const s = value == null ? '' : String(value);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}

function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== Storage ====================

function loadShotTypes() {
    const saved = localStorage.getItem('golftracker_shottypes');
    if (saved) {
        shotTypes = JSON.parse(saved);
    } else {
        shotTypes = [...DEFAULT_SHOT_TYPES];
        saveShotTypes();
    }
}

function saveShotTypes() {
    localStorage.setItem('golftracker_shottypes', JSON.stringify(shotTypes));
}

function loadCategories() {
    const saved = localStorage.getItem('golftracker_categories');
    if (saved) {
        categories = JSON.parse(saved);
    } else {
        categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        saveCategories();
    }
}

function saveCategories() {
    localStorage.setItem('golftracker_categories', JSON.stringify(categories));
}

function getDayData(dateKey) {
    const data = localStorage.getItem(`golftracker_${dateKey}`);
    return data ? JSON.parse(data) : {
        sessionType: 'practice',
        shots: {},
        holes: 0,
        quality: 0,
        notes: ''
    };
}

function saveDayData(dateKey, data) {
    localStorage.setItem(`golftracker_${dateKey}`, JSON.stringify(data));
}

function getPracticeEntries(dateKey) {
    const saved = localStorage.getItem(`golftracker_practice_${dateKey}`);
    return saved ? JSON.parse(saved) : [];
}

function savePracticeEntries(dateKey, entries) {
    localStorage.setItem(`golftracker_practice_${dateKey}`, JSON.stringify(entries));
}

function getGoals(monthKey) {
    const saved = localStorage.getItem(`golftracker_goals_${monthKey}`);
    return saved ? JSON.parse(saved) : [];
}

function saveGoals(monthKey, goals) {
    localStorage.setItem(`golftracker_goals_${monthKey}`, JSON.stringify(goals));
}

// ==================== Date Nav / Day Rendering ====================

function renderDate() {
    document.getElementById('currentDate').textContent = formatDate(currentDate);

    const today = new Date();
    const nextBtn = document.getElementById('nextDay');
    nextBtn.disabled = getDateKey(currentDate) === getDateKey(today);
    nextBtn.style.opacity = nextBtn.disabled ? '0.3' : '1';
}

function renderShotGrid() {
    const grid = document.getElementById('shotGrid');
    grid.innerHTML = shotTypes.map(shot => `
        <div class="shot-card ${shot.custom ? 'custom' : ''}" data-shot-id="${shot.id}">
            ${shot.custom ? `<button class="delete-btn" data-delete-id="${shot.id}">✕</button>` : ''}
            <div class="shot-name">${escapeHtml(shot.name)}</div>
            <div class="shot-counter">
                <button class="counter-btn minus" data-shot="${shot.id}">−</button>
                <span class="shot-count" id="count-${shot.id}">0</span>
                <button class="counter-btn plus" data-shot="${shot.id}">+</button>
            </div>
        </div>
    `).join('');
}

function loadDayData() {
    const dateKey = getDateKey(currentDate);
    const data = getDayData(dateKey);

    document.querySelectorAll('.session-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === data.sessionType);
    });

    shotTypes.forEach(shot => {
        const countEl = document.getElementById(`count-${shot.id}`);
        if (countEl) {
            countEl.textContent = data.shots[shot.id] || 0;
        }
    });

    document.getElementById('holesCount').textContent = data.holes || 0;

    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.rating) === data.quality);
    });
    document.getElementById('qualityLabel').textContent =
        data.quality ? QUALITY_LABELS[data.quality] : 'Tap to rate';

    document.getElementById('sessionNotes').value = data.notes || '';

    renderCategoryList();
}

function updateShotCount(shotId, delta) {
    const dateKey = getDateKey(currentDate);
    const data = getDayData(dateKey);

    if (!data.shots[shotId]) data.shots[shotId] = 0;
    data.shots[shotId] = Math.max(0, data.shots[shotId] + delta);

    saveDayData(dateKey, data);

    const countEl = document.getElementById(`count-${shotId}`);
    if (countEl) {
        countEl.textContent = data.shots[shotId];
    }

    updateWeeklyStats();
}

function setDirectShotCount(shotId, value) {
    const dateKey = getDateKey(currentDate);
    const data = getDayData(dateKey);

    data.shots[shotId] = Math.max(0, value);
    saveDayData(dateKey, data);

    const countEl = document.getElementById(`count-${shotId}`);
    if (countEl) {
        countEl.textContent = data.shots[shotId];
    }

    updateWeeklyStats();
}

function updateHoles(delta) {
    const dateKey = getDateKey(currentDate);
    const data = getDayData(dateKey);

    data.holes = Math.max(0, (data.holes || 0) + delta);
    saveDayData(dateKey, data);

    document.getElementById('holesCount').textContent = data.holes;
    updateWeeklyStats();
    renderWeeklyGoalsProgress();
}

function setHoles(count) {
    const dateKey = getDateKey(currentDate);
    const data = getDayData(dateKey);

    data.holes = count;
    saveDayData(dateKey, data);

    document.getElementById('holesCount').textContent = data.holes;
    updateWeeklyStats();
    renderWeeklyGoalsProgress();
}

// ==================== Practice Categories (Log View) ====================

function renderCategoryList() {
    const container = document.getElementById('categoryList');
    const dateKey = getDateKey(currentDate);
    const entries = getPracticeEntries(dateKey);

    container.innerHTML = categories.map(cat => {
        const catEntries = entries.filter(e => e.categoryId === cat.id);
        const total = catEntries.reduce((a, e) => a + e.minutes, 0);
        const entriesHtml = catEntries.length ? catEntries.map(e => {
            const sub = cat.subs.find(s => s.id === e.subId);
            return `<div class="entry-row" data-entry-id="${e.id}" data-category-id="${cat.id}">
                <span class="entry-sub">${escapeHtml(sub ? sub.name : 'General')}</span>
                <span class="entry-minutes">${formatMinutes(e.minutes)}</span>
            </div>`;
        }).join('') : `<div class="entry-empty">No time logged yet</div>`;

        return `<div class="category-card" data-category-id="${cat.id}">
            <div class="category-header">
                <span class="category-name">${escapeHtml(cat.name)}</span>
                <span class="category-total">${formatMinutes(total)}</span>
            </div>
            <div class="category-entries">${entriesHtml}</div>
            <button class="log-time-btn" data-category-id="${cat.id}">+ Log Time</button>
        </div>`;
    }).join('');
}

function openLogTimeModal(categoryId) {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    logTimeCategoryId = categoryId;

    document.getElementById('logTimeTitle').textContent = `Log Time — ${cat.name}`;
    const select = document.getElementById('logTimeSubcategory');
    select.innerHTML = `<option value="">General</option>` +
        cat.subs.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

    document.getElementById('manualTimeFields').style.display = 'none';
    document.getElementById('logTimeModeButtons').style.display = 'flex';
    document.getElementById('manualHours').value = '';
    document.getElementById('manualMinutes').value = '';

    const isToday = getDateKey(currentDate) === getDateKey(new Date());
    const startBtn = document.getElementById('startTimerBtn');
    const note = document.getElementById('timerUnavailableNote');

    if (!isToday) {
        startBtn.style.display = 'none';
        note.style.display = 'block';
        note.textContent = 'Timer only works when logging today. Use "Enter Manually" for other days.';
    } else if (activeTimer) {
        startBtn.style.display = 'none';
        note.style.display = 'block';
        note.textContent = 'A timer is already running. Stop it before starting another.';
    } else {
        startBtn.style.display = 'inline-block';
        note.style.display = 'none';
    }

    document.getElementById('logTimeModal').classList.add('active');
}

function openEditEntry(categoryId, entryId) {
    const dateKey = getDateKey(currentDate);
    const entries = getPracticeEntries(dateKey);
    const entry = entries.find(e => e.id === entryId);
    const cat = categories.find(c => c.id === categoryId);
    if (!entry || !cat) return;

    editEntryTarget = { dateKey, entryId };
    const select = document.getElementById('editEntrySubcategory');
    select.innerHTML = `<option value="">General</option>` +
        cat.subs.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    select.value = entry.subId || '';

    document.getElementById('editEntryHours').value = Math.floor(entry.minutes / 60) || '';
    document.getElementById('editEntryMinutes').value = entry.minutes % 60 || '';

    document.getElementById('editEntryModal').classList.add('active');
}

// ==================== Timer ====================

function restoreActiveTimer() {
    const saved = localStorage.getItem('golftracker_activetimer');
    if (saved) {
        activeTimer = JSON.parse(saved);
        showTimerBar();
    }
}

function showTimerBar() {
    document.getElementById('activeTimerBar').style.display = 'flex';
    document.getElementById('activeTimerLabel').textContent = activeTimer.label;
    updateTimerElapsed();
    timerInterval = setInterval(updateTimerElapsed, 1000);
}

function updateTimerElapsed() {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - activeTimer.startTs) / 1000));
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    const label = h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    document.getElementById('activeTimerElapsed').textContent = label;
}

function startTimer(categoryId, subId, label) {
    activeTimer = { categoryId, subId: subId || '', label, startTs: Date.now() };
    localStorage.setItem('golftracker_activetimer', JSON.stringify(activeTimer));
    showTimerBar();
}

function stopTimer() {
    if (!activeTimer) return;
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - activeTimer.startTs) / 60000));
    const dateKey = getDateKey(new Date());
    const entries = getPracticeEntries(dateKey);
    entries.push({
        id: 'entry_' + Date.now(),
        categoryId: activeTimer.categoryId,
        subId: activeTimer.subId,
        minutes: elapsedMinutes,
        source: 'timer'
    });
    savePracticeEntries(dateKey, entries);

    clearInterval(timerInterval);
    activeTimer = null;
    localStorage.removeItem('golftracker_activetimer');
    document.getElementById('activeTimerBar').style.display = 'none';

    if (getDateKey(currentDate) === dateKey) renderCategoryList();
    updateWeeklyStats();
    renderWeeklyGoalsProgress();
}

// ==================== Weekly Stats / Streak ====================

function dayHasActivity(dateKey) {
    const data = getDayData(dateKey);
    const shotsTotal = Object.values(data.shots || {}).reduce((a, b) => a + b, 0);
    const minutesTotal = getPracticeEntries(dateKey).reduce((a, e) => a + e.minutes, 0);
    return shotsTotal > 0 || (data.holes || 0) > 0 || minutesTotal > 0;
}

function updateWeeklyStats() {
    const today = new Date();
    const weekStart = getWeekStart(today);

    let totalShots = 0;
    let totalHoles = 0;
    let totalMinutes = 0;
    let practiceDays = 0;

    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateKey = getDateKey(date);
        const data = getDayData(dateKey);

        const dayShots = Object.values(data.shots || {}).reduce((a, b) => a + b, 0);
        const dayMinutes = getPracticeEntries(dateKey).reduce((a, e) => a + e.minutes, 0);

        totalShots += dayShots;
        totalHoles += data.holes || 0;
        totalMinutes += dayMinutes;

        if (dayShots > 0 || data.holes > 0 || dayMinutes > 0) {
            practiceDays++;
        }
    }

    document.getElementById('weeklyStats').innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${totalShots}</div>
            <div class="stat-label">Total Shots</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${totalHoles}</div>
            <div class="stat-label">Holes</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${formatMinutes(totalMinutes)}</div>
            <div class="stat-label">Practice Time</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${practiceDays}</div>
            <div class="stat-label">Days Active</div>
        </div>
    `;

    const streak = calculateStreak();
    const streakDisplay = document.getElementById('streakDisplay');

    if (streak > 0) {
        streakDisplay.className = 'streak';
        streakDisplay.innerHTML = `
            <div class="streak-count">🔥 ${streak}</div>
            <div class="streak-label">Day${streak > 1 ? 's' : ''} Streak</div>
        `;
    } else {
        streakDisplay.className = 'streak none';
        streakDisplay.innerHTML = `
            <div class="streak-label">No active streak — get after it!</div>
        `;
    }
}

function calculateStreak() {
    let streak = 0;
    const today = new Date();
    let checkDate = new Date(today);

    if (!dayHasActivity(getDateKey(today))) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
        if (dayHasActivity(getDateKey(checkDate))) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
        if (streak > 365) break;
    }

    return streak;
}

// ==================== Goals ====================

function computeGoalActual(goal, weekStart) {
    let total = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dateKey = getDateKey(d);
        if (goal.metric === 'holes') {
            total += getDayData(dateKey).holes || 0;
        } else if (goal.metric === 'minutes') {
            total += getPracticeEntries(dateKey).reduce((a, e) => a + e.minutes, 0);
        } else if (goal.metric.startsWith('cat:')) {
            const catId = goal.metric.slice(4);
            total += getPracticeEntries(dateKey).filter(e => e.categoryId === catId).reduce((a, e) => a + e.minutes, 0);
        }
    }
    return total;
}

function renderGoalProgressCard(goal, weekStart) {
    const actual = computeGoalActual(goal, weekStart);
    const pct = goal.target > 0 ? Math.min(100, Math.round((actual / goal.target) * 100)) : 0;
    const isTime = goal.metric !== 'holes';
    const actualLabel = isTime ? formatMinutes(actual) : `${actual} holes`;
    const targetLabel = isTime ? formatMinutes(goal.target) : `${goal.target} holes`;
    const remaining = Math.max(0, goal.target - actual);
    const remainingLabel = remaining === 0
        ? '🎉 Goal complete!'
        : `${isTime ? formatMinutes(remaining) : remaining + ' holes'} to go`;

    return `<div class="goal-card" data-goal-id="${goal.id}">
        <div class="goal-card-header">
            <span class="goal-name">${escapeHtml(goal.name)}</span>
            <span class="goal-amounts">${actualLabel} / ${targetLabel}</span>
        </div>
        <div class="progress-bar-track">
            <div class="progress-bar-fill ${pct >= 100 ? 'complete' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="goal-remaining">${remainingLabel}</div>
    </div>`;
}

function renderWeeklyGoalsProgress() {
    const container = document.getElementById('weeklyGoalsProgress');
    const now = new Date();
    const monthKey = getMonthKey(now);
    const goals = getGoals(monthKey);
    if (!goals.length) {
        container.innerHTML = '';
        return;
    }
    const weekStart = getWeekStart(now);
    container.innerHTML = `<h3 class="field-label">This Week's Goals</h3>` +
        goals.map(g => renderGoalProgressCard(g, weekStart)).join('');
}

// ==================== Dashboard ====================

function niceCeiling(value) {
    if (value <= 0) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const residual = value / magnitude;
    let niceResidual;
    if (residual <= 1) niceResidual = 1;
    else if (residual <= 2) niceResidual = 2;
    else if (residual <= 5) niceResidual = 5;
    else niceResidual = 10;
    return niceResidual * magnitude;
}

function roundedTopBarPath(x, y, w, h, r) {
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function textColorForBg(hex) {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#0b0b0b' : '#ffffff';
}

function getLastNWeeksData(n) {
    const currentWeekStart = getWeekStart(new Date());
    const weeks = [];
    for (let i = n - 1; i >= 0; i--) {
        const ws = new Date(currentWeekStart);
        ws.setDate(ws.getDate() - i * 7);
        let holes = 0, minutes = 0;
        for (let d = 0; d < 7; d++) {
            const day = new Date(ws);
            day.setDate(ws.getDate() + d);
            const dateKey = getDateKey(day);
            holes += getDayData(dateKey).holes || 0;
            minutes += getPracticeEntries(dateKey).reduce((a, e) => a + e.minutes, 0);
        }
        weeks.push({ weekStart: ws, holes, minutes });
    }
    return weeks;
}

function activityLevel(minutes, holes, shots) {
    const score = minutes + holes * 3 + shots * 0.5;
    if (score <= 0) return 0;
    if (score < 30) return 1;
    if (score < 90) return 2;
    if (score < 180) return 3;
    return 4;
}

function getActivityHeatmapData(weeksCount) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const roughStart = new Date(today);
    roughStart.setDate(roughStart.getDate() - (weeksCount * 7 - 1));
    const alignedStart = getWeekStart(roughStart);

    // Aligning back to Sunday can push alignedStart more than weeksCount*7 days
    // before today, so the day count must be derived from the actual span.
    const totalDays = Math.round((today - alignedStart) / 86400000) + 1;

    const days = [];
    for (let i = 0; i < totalDays; i++) {
        const day = new Date(alignedStart);
        day.setDate(alignedStart.getDate() + i);
        const dateKey = getDateKey(day);
        const data = getDayData(dateKey);
        const minutes = getPracticeEntries(dateKey).reduce((a, e) => a + e.minutes, 0);
        const shots = Object.values(data.shots || {}).reduce((a, b) => a + b, 0);
        days.push({
            date: day,
            minutes,
            holes: data.holes || 0,
            level: activityLevel(minutes, data.holes || 0, shots)
        });
    }
    return days;
}

function attachChartInteractions(container) {
    container.querySelectorAll('[data-label]').forEach(el => {
        el.addEventListener('click', () => showChartTooltip(el));
        el.addEventListener('focus', () => showChartTooltip(el));
        el.addEventListener('mouseenter', () => showChartTooltip(el));
        el.addEventListener('mouseleave', hideChartTooltip);
        el.addEventListener('blur', hideChartTooltip);
    });
}

function showChartTooltip(el) {
    const tooltip = document.getElementById('chartTooltip');
    tooltip.innerHTML = '';
    const valueEl = document.createElement('strong');
    valueEl.textContent = el.dataset.value;
    const labelEl = document.createElement('div');
    labelEl.textContent = el.dataset.label;
    tooltip.appendChild(valueEl);
    tooltip.appendChild(labelEl);

    const rect = el.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 8}px`;
    tooltip.hidden = false;
}

function hideChartTooltip() {
    document.getElementById('chartTooltip').hidden = true;
}

function renderBarChart(containerId, data, opts) {
    const container = document.getElementById(containerId);
    const width = 320, height = 150;
    const padTop = 18, padBottom = 22, padSide = 4;
    const chartW = width - padSide * 2;
    const chartH = height - padTop - padBottom;
    const n = data.length;
    const colW = chartW / n;
    const barW = Math.min(22, colW * 0.55);
    const maxVal = niceCeiling(Math.max(1, ...data.map(d => d.value)));

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="${escapeHtml(opts.ariaLabel)}">`;

    [1, 0.5].forEach(frac => {
        const y = padTop + chartH * (1 - frac);
        svg += `<line x1="${padSide}" y1="${y}" x2="${width - padSide}" y2="${y}" class="chart-gridline" />`;
        svg += `<text x="${padSide}" y="${y - 3}" class="chart-axis-label">${escapeHtml(opts.formatValue(maxVal * frac))}</text>`;
    });
    svg += `<line x1="${padSide}" y1="${padTop + chartH}" x2="${width - padSide}" y2="${padTop + chartH}" class="chart-baseline" />`;

    data.forEach((d, i) => {
        const cx = padSide + colW * i + colW / 2;
        const barH = maxVal > 0 ? (d.value / maxVal) * chartH : 0;
        const y = padTop + chartH - barH;
        const valueLabel = opts.formatValue(d.value);
        svg += `<g class="chart-bar-group" tabindex="0" role="button" data-label="${escapeHtml(d.label)}" data-value="${escapeHtml(valueLabel)}">
            <rect x="${cx - colW / 2}" y="${padTop}" width="${colW}" height="${chartH}" class="chart-hit-area" />
            <path d="${roundedTopBarPath(cx - barW / 2, y, barW, barH, 4)}" class="chart-bar" />
            <text x="${cx}" y="${height - 4}" class="chart-x-label">${escapeHtml(d.shortLabel)}</text>
        </g>`;
    });
    svg += `</svg>`;
    container.innerHTML = svg;
    attachChartInteractions(container);
}

function renderActivityHeatmap() {
    const container = document.getElementById('activityHeatmap');
    const days = getActivityHeatmapData(12);
    container.innerHTML = days.map(d => {
        const dateLabel = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const valueLabel = (d.minutes > 0 || d.holes > 0)
            ? `${formatMinutes(d.minutes)}${d.holes ? ` · ${d.holes} holes` : ''}`
            : 'No activity';
        return `<div class="heat-cell level-${d.level}" tabindex="0" role="button" data-label="${escapeHtml(dateLabel)}" data-value="${escapeHtml(valueLabel)}"></div>`;
    }).join('');
    attachChartInteractions(container);
}

function renderCategoryStackedChart() {
    const container = document.getElementById('categoryStackedChart');
    const legendContainer = document.getElementById('categoryLegend');
    const { categoryTotals } = aggregateMonth(new Date());

    let entries = Object.keys(categoryTotals).map(catId => {
        const cat = categories.find(c => c.id === catId);
        return { id: catId, name: cat ? cat.name : catId, minutes: categoryTotals[catId].total };
    }).sort((a, b) => b.minutes - a.minutes);

    if (!entries.length) {
        container.innerHTML = '<div class="empty-state">No practice time logged yet this month.</div>';
        legendContainer.innerHTML = '';
        return;
    }

    if (entries.length > CATEGORY_SLOT_CAP) {
        const shown = entries.slice(0, CATEGORY_SLOT_CAP - 1);
        const rest = entries.slice(CATEGORY_SLOT_CAP - 1);
        shown.push({ id: '_other', name: 'Other', minutes: rest.reduce((a, e) => a + e.minutes, 0) });
        entries = shown;
    }

    const total = entries.reduce((a, e) => a + e.minutes, 0);
    const width = 320, height = 40;
    let x = 0;
    let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Practice time by category this month">`;

    entries.forEach((entry, i) => {
        const color = entry.id === '_other' ? OTHER_COLOR : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length];
        const segW = (entry.minutes / total) * width;
        const gap = i > 0 ? 2 : 0;
        const segX = x + gap;
        const drawW = Math.max(0, segW - gap);
        const pct = Math.round((entry.minutes / total) * 100);
        const label = `${formatMinutes(entry.minutes)} · ${pct}%`;

        svg += `<g tabindex="0" role="button" data-label="${escapeHtml(entry.name)}" data-value="${escapeHtml(label)}">
            <rect x="${segX}" y="0" width="${drawW}" height="${height}" fill="${color}" rx="3" />
            ${drawW > 30 ? `<text x="${segX + drawW / 2}" y="${height / 2 + 4}" class="chart-segment-label" fill="${textColorForBg(color)}">${pct}%</text>` : ''}
        </g>`;
        x += segW;
    });
    svg += `</svg>`;
    container.innerHTML = svg;
    attachChartInteractions(container);

    legendContainer.innerHTML = entries.map((entry, i) => {
        const color = entry.id === '_other' ? OTHER_COLOR : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length];
        return `<div class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${escapeHtml(entry.name)} · ${formatMinutes(entry.minutes)}</div>`;
    }).join('');
}

function renderDashboardKpis() {
    const container = document.getElementById('dashboardKpis');
    const streak = calculateStreak();
    const monthAgg = aggregateMonth(new Date());
    const currentWeekStart = getWeekStart(new Date());
    const goals = getGoals(getMonthKey(new Date()));
    const met = goals.filter(g => computeGoalActual(g, currentWeekStart) >= g.target).length;

    container.innerHTML = `
        <div class="stat-item"><div class="stat-value">🔥 ${streak}</div><div class="stat-label">Day Streak</div></div>
        <div class="stat-item"><div class="stat-value">${monthAgg.totalHoles}</div><div class="stat-label">Holes This Month</div></div>
        <div class="stat-item"><div class="stat-value">${formatMinutes(monthAgg.totalMinutes)}</div><div class="stat-label">Practice This Month</div></div>
        <div class="stat-item"><div class="stat-value">${goals.length ? `${met}/${goals.length}` : '—'}</div><div class="stat-label">Goals On Track</div></div>
    `;
}

function renderDashboardGoals() {
    const container = document.getElementById('dashboardGoals');
    const goals = getGoals(getMonthKey(new Date()));
    if (!goals.length) {
        container.innerHTML = '<div class="empty-state">No goals set for this month yet. Add one in the Goals tab.</div>';
        return;
    }
    const weekStart = getWeekStart(new Date());
    container.innerHTML = goals.map(g => renderGoalProgressCard(g, weekStart)).join('');
}

function renderDashboard() {
    renderDashboardKpis();
    renderActivityHeatmap();

    const weeks = getLastNWeeksData(8);
    const weekLabels = weeks.map(w => ({
        shortLabel: w.weekStart.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        label: `Week of ${w.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }));

    renderBarChart('holesTrendChart',
        weeks.map((w, i) => ({ value: w.holes, label: weekLabels[i].label, shortLabel: weekLabels[i].shortLabel })),
        { ariaLabel: 'Holes played, last 8 weeks', formatValue: v => `${Math.round(v)}` });

    renderBarChart('minutesTrendChart',
        weeks.map((w, i) => ({ value: w.minutes, label: weekLabels[i].label, shortLabel: weekLabels[i].shortLabel })),
        { ariaLabel: 'Practice time, last 8 weeks', formatValue: v => formatMinutes(v) });

    renderCategoryStackedChart();
    renderDashboardGoals();
}

function renderGoalsView() {
    document.querySelector('#view-goals .month-label').textContent = formatMonthLabel(goalsMonthView);
    const monthKey = getMonthKey(goalsMonthView);
    const goals = getGoals(monthKey);
    const list = document.getElementById('goalsList');
    const isCurrentMonth = monthKey === getMonthKey(new Date());
    const weekStart = getWeekStart(new Date());

    if (!goals.length) {
        list.innerHTML = `<div class="empty-state">No goals set for ${formatMonthLabel(goalsMonthView)} yet.</div>`;
    } else if (isCurrentMonth) {
        list.innerHTML = goals.map(g => renderGoalProgressCard(g, weekStart)).join('');
    } else {
        list.innerHTML = goals.map(g => {
            const isTime = g.metric !== 'holes';
            const targetLabel = isTime ? formatMinutes(g.target) : `${g.target} holes`;
            return `<div class="goal-card" data-goal-id="${g.id}">
                <div class="goal-card-header">
                    <span class="goal-name">${escapeHtml(g.name)}</span>
                    <span class="goal-amounts">${targetLabel} / week</span>
                </div>
            </div>`;
        }).join('');
    }

    const prevGoals = getGoals(getMonthKey(addMonths(goalsMonthView, -1)));
    document.getElementById('goalsEmptyActions').style.display = (!goals.length && prevGoals.length) ? 'block' : 'none';
}

function populateGoalMetricOptions(selectedValue) {
    const select = document.getElementById('goalMetric');
    select.innerHTML = `<option value="holes">Holes played</option><option value="minutes">Total practice time</option>` +
        categories.map(c => `<option value="cat:${c.id}">Practice: ${escapeHtml(c.name)}</option>`).join('');
    select.value = selectedValue || 'holes';
    toggleGoalTargetFields();
}

function toggleGoalTargetFields() {
    const isHoles = document.getElementById('goalMetric').value === 'holes';
    document.getElementById('goalTargetHoles').style.display = isHoles ? 'block' : 'none';
    document.getElementById('goalTargetTime').style.display = isHoles ? 'none' : 'flex';
}

function openGoalModal(goal) {
    goalModalMonthKey = getMonthKey(goalsMonthView);
    editingGoalId = goal ? goal.id : null;

    document.getElementById('goalModalTitle').textContent = goal ? 'Edit Goal' : 'Add Goal';
    document.getElementById('goalName').value = goal ? goal.name : '';
    populateGoalMetricOptions(goal ? goal.metric : 'holes');

    if (goal) {
        if (goal.metric === 'holes') {
            document.getElementById('goalTargetHolesInput').value = goal.target;
        } else {
            document.getElementById('goalTargetHours').value = Math.floor(goal.target / 60) || '';
            document.getElementById('goalTargetMinutes').value = goal.target % 60 || '';
        }
    } else {
        document.getElementById('goalTargetHolesInput').value = '';
        document.getElementById('goalTargetHours').value = '';
        document.getElementById('goalTargetMinutes').value = '';
    }

    document.getElementById('deleteGoalBtn').style.display = goal ? 'inline-block' : 'none';
    document.getElementById('goalModal').classList.add('active');
}

// ==================== Report ====================

function aggregateMonth(monthDate) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let totalHoles = 0, totalMinutes = 0, activeDays = 0;
    const categoryTotals = {};
    const weekBuckets = {};

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dateKey = getDateKey(date);
        const dayData = getDayData(dateKey);
        const entries = getPracticeEntries(dateKey);
        const dayMinutes = entries.reduce((a, e) => a + e.minutes, 0);

        totalHoles += dayData.holes || 0;
        totalMinutes += dayMinutes;
        if ((dayData.holes || 0) > 0 || dayMinutes > 0) activeDays++;

        const wsKey = getDateKey(getWeekStart(date));
        if (!weekBuckets[wsKey]) weekBuckets[wsKey] = { holes: 0, minutes: 0, categoryMinutes: {} };
        weekBuckets[wsKey].holes += dayData.holes || 0;
        weekBuckets[wsKey].minutes += dayMinutes;

        entries.forEach(e => {
            if (!categoryTotals[e.categoryId]) categoryTotals[e.categoryId] = { total: 0, subs: {} };
            categoryTotals[e.categoryId].total += e.minutes;
            const subKey = e.subId || '_general';
            categoryTotals[e.categoryId].subs[subKey] = (categoryTotals[e.categoryId].subs[subKey] || 0) + e.minutes;

            weekBuckets[wsKey].categoryMinutes[e.categoryId] =
                (weekBuckets[wsKey].categoryMinutes[e.categoryId] || 0) + e.minutes;
        });
    }

    return { totalHoles, totalMinutes, activeDays, categoryTotals, weekBuckets };
}

function bucketGoalActual(goal, bucket) {
    if (goal.metric === 'holes') return bucket.holes;
    if (goal.metric === 'minutes') return bucket.minutes;
    return (bucket.categoryMinutes && bucket.categoryMinutes[goal.metric.slice(4)]) || 0;
}

function renderReportView() {
    document.querySelector('#view-report .month-label').textContent = formatMonthLabel(reportMonthView);
    const monthKey = getMonthKey(reportMonthView);
    const { totalHoles, totalMinutes, activeDays, categoryTotals, weekBuckets } = aggregateMonth(reportMonthView);
    const goals = getGoals(monthKey);
    const weekKeys = Object.keys(weekBuckets).sort();

    let goalInstancesTotal = 0, goalInstancesMet = 0;
    const weeklyHtml = weekKeys.map(wsKey => {
        const bucket = weekBuckets[wsKey];
        const label = `Week of ${new Date(wsKey + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        const mainRow = `<div class="report-row">
            <span class="report-row-label">${label}</span>
            <span class="report-row-value">${bucket.holes} holes · ${formatMinutes(bucket.minutes)}</span>
        </div>`;
        const goalRows = goals.map(g => {
            const actual = bucketGoalActual(g, bucket);
            const met = actual >= g.target;
            goalInstancesTotal++;
            if (met) goalInstancesMet++;
            const isTime = g.metric !== 'holes';
            const actualLabel = isTime ? formatMinutes(actual) : `${actual}`;
            const targetLabel = isTime ? formatMinutes(g.target) : `${g.target}`;
            return `<div class="report-row sub">
                <span class="report-row-label">${escapeHtml(g.name)}</span>
                <span class="report-row-value"><span class="${met ? 'met' : 'missed'}">${actualLabel} / ${targetLabel} ${met ? '✓' : '✗'}</span></span>
            </div>`;
        }).join('');
        return mainRow + goalRows;
    }).join('');

    document.getElementById('reportSummary').innerHTML = `
        <div class="stat-item"><div class="stat-value">${totalHoles}</div><div class="stat-label">Holes Played</div></div>
        <div class="stat-item"><div class="stat-value">${formatMinutes(totalMinutes)}</div><div class="stat-label">Practice Time</div></div>
        <div class="stat-item"><div class="stat-value">${activeDays}</div><div class="stat-label">Active Days</div></div>
        ${goalInstancesTotal > 0 ? `<div class="stat-item"><div class="stat-value">${goalInstancesMet}/${goalInstancesTotal}</div><div class="stat-label">Goals Met</div></div>` : ''}
    `;

    document.getElementById('reportWeekly').innerHTML = weeklyHtml || '<div class="empty-state">No data yet for this month.</div>';

    const catKeys = Object.keys(categoryTotals);
    const catHtml = catKeys.map(catId => {
        const cat = categories.find(c => c.id === catId);
        const catName = cat ? cat.name : catId;
        const data = categoryTotals[catId];
        const subRows = Object.keys(data.subs).map(subKey => {
            const sub = cat && cat.subs.find(s => s.id === subKey);
            const subName = sub ? sub.name : 'General';
            return `<div class="report-row sub">
                <span class="report-row-label">${escapeHtml(subName)}</span>
                <span class="report-row-value">${formatMinutes(data.subs[subKey])}</span>
            </div>`;
        }).join('');
        return `<div class="report-row">
            <span class="report-row-label">${escapeHtml(catName)}</span>
            <span class="report-row-value">${formatMinutes(data.total)}</span>
        </div>` + subRows;
    }).join('');

    document.getElementById('reportCategories').innerHTML = catHtml || '<div class="empty-state">No practice time logged yet.</div>';
}

function exportCsv() {
    const monthKey = getMonthKey(reportMonthView);
    const year = reportMonthView.getFullYear();
    const month = reportMonthView.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const { categoryTotals, weekBuckets } = aggregateMonth(reportMonthView);
    const goals = getGoals(monthKey);

    const rows = [];
    rows.push(['Golf Tracker Report', formatMonthLabel(reportMonthView)]);
    rows.push([]);
    rows.push(['Daily Log']);
    rows.push(['Date', 'Holes', 'Practice Minutes', 'Quality (1-5)', 'Notes']);
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dateKey = getDateKey(date);
        const dayData = getDayData(dateKey);
        const minutes = getPracticeEntries(dateKey).reduce((a, e) => a + e.minutes, 0);
        rows.push([dateKey, dayData.holes || 0, minutes, dayData.quality || '', dayData.notes || '']);
    }

    rows.push([]);
    rows.push(['Practice Breakdown']);
    rows.push(['Category', 'Sub-category', 'Minutes']);
    Object.keys(categoryTotals).forEach(catId => {
        const cat = categories.find(c => c.id === catId);
        const catName = cat ? cat.name : catId;
        const data = categoryTotals[catId];
        Object.keys(data.subs).forEach(subKey => {
            const sub = cat && cat.subs.find(s => s.id === subKey);
            rows.push([catName, sub ? sub.name : 'General', data.subs[subKey]]);
        });
        rows.push([catName, 'Total', data.total]);
    });

    rows.push([]);
    rows.push(['Weekly Goals']);
    rows.push(['Week Start', 'Goal', 'Target', 'Actual', 'Met']);
    Object.keys(weekBuckets).sort().forEach(wsKey => {
        const bucket = weekBuckets[wsKey];
        goals.forEach(g => {
            const actual = bucketGoalActual(g, bucket);
            rows.push([wsKey, g.name, g.target, actual, actual >= g.target ? 'Yes' : 'No']);
        });
    });

    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
    downloadFile(`golf-report-${monthKey}.csv`, csv);
}

// ==================== Manage Categories ====================

function renderCategoriesManageList() {
    const container = document.getElementById('categoriesManageList');
    container.innerHTML = categories.map(cat => `
        <div class="category-manage-row" data-cat-id="${cat.id}">
            <div class="category-manage-header">
                <input type="text" value="${escapeHtml(cat.name)}" data-cat-name="${cat.id}">
                <button class="icon-btn" data-delete-cat="${cat.id}">✕</button>
            </div>
            <div class="subcategory-chips">
                ${cat.subs.map(s => `<span class="sub-chip">${escapeHtml(s.name)}<button data-delete-sub="${s.id}" data-cat-id="${cat.id}">✕</button></span>`).join('') ||
                    '<span class="hint" style="margin:0;">No sub-categories yet</span>'}
            </div>
            <div class="add-sub-row">
                <input type="text" placeholder="Add sub-category" data-new-sub="${cat.id}">
                <button data-add-sub="${cat.id}">Add</button>
            </div>
        </div>
    `).join('');
}

// ==================== Event Listeners ====================

function setupEventListeners() {
    // Tab bar
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${btn.dataset.view}`));

            if (btn.dataset.view === 'goals') renderGoalsView();
            if (btn.dataset.view === 'report') renderReportView();
            if (btn.dataset.view === 'dashboard') renderDashboard();
        });
    });

    // Date navigation
    document.getElementById('prevDay').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 1);
        renderDate();
        loadDayData();
    });

    document.getElementById('nextDay').addEventListener('click', () => {
        const today = new Date();
        if (getDateKey(currentDate) < getDateKey(today)) {
            currentDate.setDate(currentDate.getDate() + 1);
            renderDate();
            loadDayData();
        }
    });

    // Month navigation (Goals / Report)
    document.querySelectorAll('.month-nav').forEach(nav => {
        const type = nav.dataset.nav;
        nav.querySelector('.month-prev').addEventListener('click', () => {
            if (type === 'goals') {
                goalsMonthView = addMonths(goalsMonthView, -1);
                renderGoalsView();
            } else {
                reportMonthView = addMonths(reportMonthView, -1);
                renderReportView();
            }
        });
        nav.querySelector('.month-next').addEventListener('click', () => {
            if (type === 'goals') {
                goalsMonthView = addMonths(goalsMonthView, 1);
                renderGoalsView();
            } else {
                reportMonthView = addMonths(reportMonthView, 1);
                renderReportView();
            }
        });
    });

    // Session type toggle
    document.querySelectorAll('.session-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.session-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const dateKey = getDateKey(currentDate);
            const data = getDayData(dateKey);
            data.sessionType = btn.dataset.type;
            saveDayData(dateKey, data);
        });
    });

    // Shot counters (delegated)
    document.getElementById('shotGrid').addEventListener('click', (e) => {
        if (e.target.classList.contains('counter-btn')) {
            const shotId = e.target.dataset.shot;
            const delta = e.target.classList.contains('plus') ? 1 : -1;
            updateShotCount(shotId, delta);
        }
        if (e.target.classList.contains('shot-count')) {
            const shotId = e.target.id.replace('count-', '');
            const shot = shotTypes.find(s => s.id === shotId);
            openDirectInput('shot', shotId, shot?.name || 'Shots', parseInt(e.target.textContent) || 0);
        }
        if (e.target.classList.contains('delete-btn')) {
            deleteTargetId = e.target.dataset.deleteId;
            const shot = shotTypes.find(s => s.id === deleteTargetId);
            document.getElementById('deleteShotName').textContent = `"${shot?.name}"`;
            document.getElementById('deleteShotModal').classList.add('active');
        }
    });

    // Holes counter
    document.querySelector('.holes-counter').addEventListener('click', (e) => {
        if (e.target.classList.contains('counter-btn')) {
            const delta = e.target.classList.contains('plus') ? 1 : -1;
            updateHoles(delta);
        }
        if (e.target.id === 'holesCount') {
            openDirectInput('holes', null, 'Holes Played', parseInt(e.target.textContent) || 0);
        }
    });

    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setHoles(parseInt(btn.dataset.holes));
        });
    });

    // Practice categories (delegated)
    document.getElementById('categoryList').addEventListener('click', (e) => {
        const entryRow = e.target.closest('.entry-row');
        if (entryRow) {
            openEditEntry(entryRow.dataset.categoryId, entryRow.dataset.entryId);
            return;
        }
        const logBtn = e.target.closest('.log-time-btn');
        if (logBtn) {
            openLogTimeModal(logBtn.dataset.categoryId);
        }
    });

    document.getElementById('manageCategories').addEventListener('click', () => {
        renderCategoriesManageList();
        document.getElementById('categoriesModal').classList.add('active');
    });

    document.getElementById('closeCategoriesModal').addEventListener('click', () => {
        document.getElementById('categoriesModal').classList.remove('active');
    });

    document.getElementById('addCategoryBtn').addEventListener('click', () => {
        const input = document.getElementById('newCategoryName');
        const name = input.value.trim();
        if (name) {
            categories.push({ id: 'cat_' + Date.now(), name, subs: [] });
            saveCategories();
            input.value = '';
            renderCategoriesManageList();
            renderCategoryList();
        }
    });

    document.getElementById('categoriesManageList').addEventListener('change', (e) => {
        if (e.target.dataset.catName) {
            const cat = categories.find(c => c.id === e.target.dataset.catName);
            if (cat) {
                cat.name = e.target.value.trim() || cat.name;
                saveCategories();
                renderCategoryList();
            }
        }
    });

    document.getElementById('categoriesManageList').addEventListener('click', (e) => {
        const delCat = e.target.closest('[data-delete-cat]');
        if (delCat) {
            if (categories.length <= 1) {
                alert('You need at least one category.');
                return;
            }
            if (!confirm('Delete this category? Time already logged for it stays in your reports.')) return;
            categories = categories.filter(c => c.id !== delCat.dataset.deleteCat);
            saveCategories();
            renderCategoriesManageList();
            renderCategoryList();
            return;
        }

        const delSub = e.target.closest('[data-delete-sub]');
        if (delSub) {
            const cat = categories.find(c => c.id === delSub.dataset.catId);
            if (cat) {
                cat.subs = cat.subs.filter(s => s.id !== delSub.dataset.deleteSub);
                saveCategories();
                renderCategoriesManageList();
                renderCategoryList();
            }
            return;
        }

        const addSub = e.target.closest('[data-add-sub]');
        if (addSub) {
            const catId = addSub.dataset.addSub;
            const input = document.querySelector(`[data-new-sub="${catId}"]`);
            const name = input.value.trim();
            if (name) {
                const cat = categories.find(c => c.id === catId);
                cat.subs.push({ id: 'sub_' + Date.now(), name });
                saveCategories();
                renderCategoriesManageList();
                renderCategoryList();
            }
        }
    });

    // Log Time modal
    document.getElementById('startTimerBtn').addEventListener('click', () => {
        const cat = categories.find(c => c.id === logTimeCategoryId);
        if (!cat) return;
        const subId = document.getElementById('logTimeSubcategory').value;
        const sub = cat.subs.find(s => s.id === subId);
        const label = sub ? `${cat.name} — ${sub.name}` : cat.name;
        startTimer(cat.id, subId, label);
        document.getElementById('logTimeModal').classList.remove('active');
    });

    document.getElementById('enterManuallyBtn').addEventListener('click', () => {
        document.getElementById('logTimeModeButtons').style.display = 'none';
        document.getElementById('manualTimeFields').style.display = 'block';
    });

    document.getElementById('cancelManualTime').addEventListener('click', () => {
        document.getElementById('manualTimeFields').style.display = 'none';
        document.getElementById('logTimeModeButtons').style.display = 'flex';
    });

    document.getElementById('saveManualTime').addEventListener('click', () => {
        const hours = parseInt(document.getElementById('manualHours').value) || 0;
        const mins = parseInt(document.getElementById('manualMinutes').value) || 0;
        const total = hours * 60 + mins;
        document.getElementById('logTimeModal').classList.remove('active');
        if (total <= 0) return;

        const subId = document.getElementById('logTimeSubcategory').value;
        const dateKey = getDateKey(currentDate);
        const entries = getPracticeEntries(dateKey);
        entries.push({ id: 'entry_' + Date.now(), categoryId: logTimeCategoryId, subId, minutes: total, source: 'manual' });
        savePracticeEntries(dateKey, entries);

        renderCategoryList();
        updateWeeklyStats();
        renderWeeklyGoalsProgress();
    });

    document.getElementById('cancelLogTime').addEventListener('click', () => {
        document.getElementById('logTimeModal').classList.remove('active');
    });

    // Active timer bar
    document.getElementById('stopTimerBtn').addEventListener('click', stopTimer);

    // Edit entry modal
    document.getElementById('saveEditEntry').addEventListener('click', () => {
        if (!editEntryTarget) return;
        const entries = getPracticeEntries(editEntryTarget.dateKey);
        const entry = entries.find(e => e.id === editEntryTarget.entryId);
        if (entry) {
            const hours = parseInt(document.getElementById('editEntryHours').value) || 0;
            const mins = parseInt(document.getElementById('editEntryMinutes').value) || 0;
            entry.minutes = Math.max(0, hours * 60 + mins);
            entry.subId = document.getElementById('editEntrySubcategory').value;
            savePracticeEntries(editEntryTarget.dateKey, entries);
        }
        document.getElementById('editEntryModal').classList.remove('active');
        editEntryTarget = null;
        renderCategoryList();
        updateWeeklyStats();
        renderWeeklyGoalsProgress();
    });

    document.getElementById('deleteEntryBtn').addEventListener('click', () => {
        if (!editEntryTarget) return;
        if (!confirm('Delete this entry?')) return;
        let entries = getPracticeEntries(editEntryTarget.dateKey);
        entries = entries.filter(e => e.id !== editEntryTarget.entryId);
        savePracticeEntries(editEntryTarget.dateKey, entries);
        document.getElementById('editEntryModal').classList.remove('active');
        editEntryTarget = null;
        renderCategoryList();
        updateWeeklyStats();
        renderWeeklyGoalsProgress();
    });

    document.getElementById('cancelEditEntry').addEventListener('click', () => {
        document.getElementById('editEntryModal').classList.remove('active');
        editEntryTarget = null;
    });

    // Goals
    document.getElementById('addGoalBtn').addEventListener('click', () => openGoalModal(null));

    document.getElementById('goalsList').addEventListener('click', (e) => {
        const card = e.target.closest('.goal-card');
        if (!card) return;
        const goals = getGoals(getMonthKey(goalsMonthView));
        const goal = goals.find(g => g.id === card.dataset.goalId);
        if (goal) openGoalModal(goal);
    });

    document.getElementById('copyLastMonthGoals').addEventListener('click', () => {
        const prevGoals = getGoals(getMonthKey(addMonths(goalsMonthView, -1)));
        const copied = prevGoals.map(g => ({ ...g, id: 'goal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) }));
        saveGoals(getMonthKey(goalsMonthView), copied);
        renderGoalsView();
    });

    document.getElementById('goalMetric').addEventListener('change', toggleGoalTargetFields);

    document.getElementById('cancelGoalModal').addEventListener('click', () => {
        document.getElementById('goalModal').classList.remove('active');
    });

    document.getElementById('saveGoalBtn').addEventListener('click', () => {
        const name = document.getElementById('goalName').value.trim();
        if (!name) return;
        const metric = document.getElementById('goalMetric').value;
        let target;
        if (metric === 'holes') {
            target = parseInt(document.getElementById('goalTargetHolesInput').value) || 0;
        } else {
            target = (parseInt(document.getElementById('goalTargetHours').value) || 0) * 60 +
                (parseInt(document.getElementById('goalTargetMinutes').value) || 0);
        }
        if (target <= 0) return;

        const goals = getGoals(goalModalMonthKey);
        if (editingGoalId) {
            const g = goals.find(x => x.id === editingGoalId);
            if (g) { g.name = name; g.metric = metric; g.target = target; }
        } else {
            goals.push({ id: 'goal_' + Date.now(), name, metric, target });
        }
        saveGoals(goalModalMonthKey, goals);
        document.getElementById('goalModal').classList.remove('active');
        renderGoalsView();
        renderWeeklyGoalsProgress();
    });

    document.getElementById('deleteGoalBtn').addEventListener('click', () => {
        if (!editingGoalId) return;
        if (!confirm('Delete this goal?')) return;
        let goals = getGoals(goalModalMonthKey);
        goals = goals.filter(g => g.id !== editingGoalId);
        saveGoals(goalModalMonthKey, goals);
        document.getElementById('goalModal').classList.remove('active');
        renderGoalsView();
        renderWeeklyGoalsProgress();
    });

    // Report export
    document.getElementById('exportCsv').addEventListener('click', exportCsv);
    document.getElementById('printReport').addEventListener('click', () => window.print());

    // Time inputs (edit entry / goal / manual time modals) - Enter key convenience
    ['manualMinutes', 'manualHours'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('saveManualTime').click();
        });
    });

    // Quality rating
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const rating = parseInt(btn.dataset.rating);

            document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('qualityLabel').textContent = QUALITY_LABELS[rating];

            const dateKey = getDateKey(currentDate);
            const data = getDayData(dateKey);
            data.quality = rating;
            saveDayData(dateKey, data);
        });
    });

    // Notes
    document.getElementById('sessionNotes').addEventListener('input', (e) => {
        const dateKey = getDateKey(currentDate);
        const data = getDayData(dateKey);
        data.notes = e.target.value;
        saveDayData(dateKey, data);
    });

    // Add shot type modal
    document.getElementById('addShotType').addEventListener('click', () => {
        document.getElementById('newShotName').value = '';
        document.getElementById('addShotModal').classList.add('active');
        document.getElementById('newShotName').focus();
    });

    document.getElementById('cancelAddShot').addEventListener('click', () => {
        document.getElementById('addShotModal').classList.remove('active');
    });

    document.getElementById('confirmAddShot').addEventListener('click', () => {
        const name = document.getElementById('newShotName').value.trim();
        if (name) {
            const id = 'custom_' + Date.now();
            shotTypes.push({ id, name, custom: true });
            saveShotTypes();
            renderShotGrid();
            loadDayData();
        }
        document.getElementById('addShotModal').classList.remove('active');
    });

    // Delete shot type modal
    document.getElementById('cancelDeleteShot').addEventListener('click', () => {
        document.getElementById('deleteShotModal').classList.remove('active');
        deleteTargetId = null;
    });

    document.getElementById('confirmDeleteShot').addEventListener('click', () => {
        if (deleteTargetId) {
            shotTypes = shotTypes.filter(s => s.id !== deleteTargetId);
            saveShotTypes();
            renderShotGrid();
            loadDayData();
        }
        document.getElementById('deleteShotModal').classList.remove('active');
        deleteTargetId = null;
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Enter key in modal
    document.getElementById('newShotName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('confirmAddShot').click();
        }
    });

    // Direct input modal
    document.getElementById('cancelDirectInput').addEventListener('click', () => {
        document.getElementById('directInputModal').classList.remove('active');
        directInputTarget = null;
    });

    document.getElementById('confirmDirectInput').addEventListener('click', () => {
        const value = parseInt(document.getElementById('directInputValue').value) || 0;
        if (directInputTarget) {
            if (directInputTarget.type === 'shot') {
                setDirectShotCount(directInputTarget.id, value);
            } else if (directInputTarget.type === 'holes') {
                setHoles(value);
            }
        }
        document.getElementById('directInputModal').classList.remove('active');
        directInputTarget = null;
    });

    document.getElementById('directInputValue').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('confirmDirectInput').click();
        }
    });
}

function openDirectInput(type, id, label, currentValue) {
    directInputTarget = { type, id };
    document.getElementById('directInputTitle').textContent = label;
    document.getElementById('directInputValue').value = currentValue;
    document.getElementById('directInputModal').classList.add('active');
    setTimeout(() => {
        document.getElementById('directInputValue').select();
    }, 100);
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed:', err));
    }
}
