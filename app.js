// Golf Tracker App
const DEFAULT_SHOT_TYPES = [
    { id: 'fullswing', name: 'Full Swing', custom: false },
    { id: 'drives', name: 'Drives', custom: false },
    { id: 'pitches', name: 'Pitches', custom: false },
    { id: 'chips', name: 'Chips', custom: false },
    { id: 'putts', name: 'Putts', custom: false }
];

const QUALITY_LABELS = {
    1: 'Rough day',
    2: 'Below average',
    3: 'Solid session',
    4: 'Good work',
    5: 'Crushed it'
};

let currentDate = new Date();
let shotTypes = [];
let deleteTargetId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadShotTypes();
    renderDate();
    renderShotGrid();
    loadDayData();
    updateWeeklyStats();
    setupEventListeners();
    registerServiceWorker();
});

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

function getDateKey(date) {
    return date.toISOString().split('T')[0];
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

function renderDate() {
    document.getElementById('currentDate').textContent = formatDate(currentDate);
    
    // Disable next button if on today
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
            <div class="shot-name">${shot.name}</div>
            <div class="shot-counter">
                <button class="counter-btn minus" data-shot="${shot.id}">−</button>
                <span class="shot-count" id="count-${shot.id}">0</span>
                <button class="counter-btn plus" data-shot="${shot.id}">+</button>
            </div>
        </div>
    `).join('');
}

function getDayData(dateKey) {
    const data = localStorage.getItem(`golftracker_${dateKey}`);
    return data ? JSON.parse(data) : {
        sessionType: 'practice',
        shots: {},
        holes: 0,
        timeHours: 0,
        timeMinutes: 0,
        quality: 0,
        notes: ''
    };
}

function saveDayData(dateKey, data) {
    localStorage.setItem(`golftracker_${dateKey}`, JSON.stringify(data));
}

function loadDayData() {
    const dateKey = getDateKey(currentDate);
    const data = getDayData(dateKey);
    
    // Session type
    document.querySelectorAll('.session-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === data.sessionType);
    });
    
    // Shot counts
    shotTypes.forEach(shot => {
        const countEl = document.getElementById(`count-${shot.id}`);
        if (countEl) {
            countEl.textContent = data.shots[shot.id] || 0;
        }
    });
    
    // Holes
    document.getElementById('holesCount').textContent = data.holes || 0;
    
    // Time
    document.getElementById('timeHours').value = data.timeHours || '';
    document.getElementById('timeMinutes').value = data.timeMinutes || '';
    
    // Quality
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.rating) === data.quality);
    });
    document.getElementById('qualityLabel').textContent = 
        data.quality ? QUALITY_LABELS[data.quality] : 'Tap to rate';
    
    // Notes
    document.getElementById('sessionNotes').value = data.notes || '';
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

function updateHoles(delta) {
    const dateKey = getDateKey(currentDate);
    const data = getDayData(dateKey);
    
    data.holes = Math.max(0, (data.holes || 0) + delta);
    saveDayData(dateKey, data);
    
    document.getElementById('holesCount').textContent = data.holes;
    updateWeeklyStats();
}

function setHoles(count) {
    const dateKey = getDateKey(currentDate);
    const data = getDayData(dateKey);
    
    data.holes = count;
    saveDayData(dateKey, data);
    
    document.getElementById('holesCount').textContent = data.holes;
    updateWeeklyStats();
}

function updateWeeklyStats() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    
    let totalShots = 0;
    let totalHoles = 0;
    let totalMinutes = 0;
    let practiceDays = 0;
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const data = getDayData(getDateKey(date));
        
        const dayShots = Object.values(data.shots || {}).reduce((a, b) => a + b, 0);
        totalShots += dayShots;
        totalHoles += data.holes || 0;
        totalMinutes += ((data.timeHours || 0) * 60) + (data.timeMinutes || 0);
        
        if (dayShots > 0 || data.holes > 0) {
            practiceDays++;
        }
    }
    
    const statsGrid = document.getElementById('weeklyStats');
    statsGrid.innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${totalShots}</div>
            <div class="stat-label">Total Shots</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${totalHoles}</div>
            <div class="stat-label">Holes</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${practiceDays}</div>
            <div class="stat-label">Days Active</div>
        </div>
    `;
    
    // Calculate streak
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
    
    // Check if today has activity
    const todayData = getDayData(getDateKey(today));
    const todayActive = Object.values(todayData.shots || {}).reduce((a, b) => a + b, 0) > 0 || todayData.holes > 0;
    
    // If today isn't active, start from yesterday
    if (!todayActive) {
        checkDate.setDate(checkDate.getDate() - 1);
    }
    
    // Count consecutive days
    while (true) {
        const data = getDayData(getDateKey(checkDate));
        const hasActivity = Object.values(data.shots || {}).reduce((a, b) => a + b, 0) > 0 || data.holes > 0;
        
        if (hasActivity) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
        
        // Safety limit
        if (streak > 365) break;
    }
    
    return streak;
}

function setupEventListeners() {
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
    });
    
    // Quick holes buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setHoles(parseInt(btn.dataset.holes));
        });
    });
    
    // Time inputs
    ['timeHours', 'timeMinutes'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            const dateKey = getDateKey(currentDate);
            const data = getDayData(dateKey);
            data.timeHours = parseInt(document.getElementById('timeHours').value) || 0;
            data.timeMinutes = parseInt(document.getElementById('timeMinutes').value) || 0;
            saveDayData(dateKey, data);
            updateWeeklyStats();
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
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed:', err));
    }
}
