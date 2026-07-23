// Golf Tracker App
const DEFAULT_CATEGORIES = [
    { id: 'driver', name: 'Driver', subs: [] },
    { id: 'par3tee', name: 'Par 3 off the Tee', subs: [] },
    { id: 'ballstriking', name: 'Ball Striking', subs: [] },
    { id: 'approach', name: 'Approach Shots', subs: [
        { id: 'a1', name: '50-75 yds' }, { id: 'a2', name: '75-100 yds' }, { id: 'a3', name: '100-150 yds' }, { id: 'a4', name: '150+ yds' }
    ] },
    { id: 'pitches', name: 'Pitches', subs: [] },
    { id: 'chips', name: 'Chips', subs: [
        { id: 'c1', name: 'Bump & Run' }, { id: 'c2', name: 'Standard' }, { id: 'c3', name: 'Flop' }
    ] },
    { id: 'putts', name: 'Putts', subs: [
        { id: 'p1', name: '0-5 ft' }, { id: 'p2', name: '5-10 ft' }, { id: 'p3', name: '10-20 ft' }, { id: 'p4', name: '20+ ft' }
    ] }
];

const QUALITY_LABELS = {
    1: 'Rough day',
    2: 'Below average',
    3: 'Solid session',
    4: 'Good work',
    5: 'Crushed it'
};

let currentDate = new Date();
let categories = [];
let goalsMonthView = new Date();
let reportMonthView = new Date();
let activeTimer = null;
let timerInterval = null;

let directInputTarget = false;
let logTimeCategoryId = null;
let editEntryTarget = null; // { dateKey, entryId }
let editingGoalId = null;
let goalModalMonthKey = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    renderDate();
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

function loadDayData() {
    const dateKey = getDateKey(currentDate);
    const data = getDayData(dateKey);

    document.querySelectorAll('.session-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === data.sessionType);
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
    const minutesTotal = getPracticeEntries(dateKey).reduce((a, e) => a + e.minutes, 0);
    return (data.holes || 0) > 0 || minutesTotal > 0;
}

function updateWeeklyStats() {
    const today = new Date();
    const weekStart = getWeekStart(today);

    let totalHoles = 0;
    let totalMinutes = 0;
    let practiceDays = 0;

    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateKey = getDateKey(date);
        const data = getDayData(dateKey);

        const dayMinutes = getPracticeEntries(dateKey).reduce((a, e) => a + e.minutes, 0);

        totalHoles += data.holes || 0;
        totalMinutes += dayMinutes;

        if (data.holes > 0 || dayMinutes > 0) {
            practiceDays++;
        }
    }

    document.getElementById('weeklyStats').innerHTML = `
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

function renderMetricRow(label, metric, weekStart) {
    const goals = getGoals(getMonthKey(new Date()));
    const goal = goals.find(g => g.metric === metric);
    const actual = computeGoalActual({ metric }, weekStart);
    const isTime = metric === 'minutes';
    const actualLabel = isTime ? formatMinutes(actual) : `${actual} holes`;

    if (!goal) {
        return `<div class="goal-card">
            <div class="goal-card-header">
                <span class="goal-name">${escapeHtml(label)}</span>
                <span class="goal-amounts">${actualLabel}</span>
            </div>
            <div class="goal-remaining">No goal set — add one in the Goals tab.</div>
        </div>`;
    }

    const pct = goal.target > 0 ? Math.min(100, Math.round((actual / goal.target) * 100)) : 0;
    const targetLabel = isTime ? formatMinutes(goal.target) : `${goal.target} holes`;
    const remaining = Math.max(0, goal.target - actual);
    const remainingLabel = remaining === 0
        ? '🎉 Goal complete!'
        : `${isTime ? formatMinutes(remaining) : remaining + ' holes'} to go`;

    return `<div class="goal-card">
        <div class="goal-card-header">
            <span class="goal-name">${escapeHtml(label)}</span>
            <span class="goal-amounts">${actualLabel} / ${targetLabel}</span>
        </div>
        <div class="progress-bar-track">
            <div class="progress-bar-fill ${pct >= 100 ? 'complete' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="goal-remaining">${remainingLabel}</div>
    </div>`;
}

function renderDashboard() {
    const now = new Date();
    document.getElementById('dashMonth').textContent = now.toLocaleDateString('en-US', { month: 'long' });

    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    document.getElementById('dashWeek').textContent =
        `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    document.getElementById('dashboardMetrics').innerHTML =
        renderMetricRow('Hours Practiced', 'minutes', weekStart) +
        renderMetricRow('Holes Played', 'holes', weekStart);
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

    // Holes counter
    document.querySelector('.holes-counter').addEventListener('click', (e) => {
        if (e.target.classList.contains('counter-btn')) {
            const delta = e.target.classList.contains('plus') ? 1 : -1;
            updateHoles(delta);
        }
        if (e.target.id === 'holesCount') {
            openDirectInput('Holes Played', parseInt(e.target.textContent) || 0);
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

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Direct input modal
    document.getElementById('cancelDirectInput').addEventListener('click', () => {
        document.getElementById('directInputModal').classList.remove('active');
        directInputTarget = false;
    });

    document.getElementById('confirmDirectInput').addEventListener('click', () => {
        const value = parseInt(document.getElementById('directInputValue').value) || 0;
        if (directInputTarget) {
            setHoles(value);
        }
        document.getElementById('directInputModal').classList.remove('active');
        directInputTarget = false;
    });

    document.getElementById('directInputValue').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('confirmDirectInput').click();
        }
    });
}

function openDirectInput(label, currentValue) {
    directInputTarget = true;
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
