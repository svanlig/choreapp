/* ============================================================
   APP.JS — Chore & Reward App
   Features implemented:
     - Parent Hub → Children management
     - Parent Hub → Weekly Chores Setup (per-week slate)
     - Parent Hub → Confirm Completed Chores
     - Parent Hub → Record Spending Ledger
     - Parent Hub → Modify Security PIN
     - Parent Hub → Backup & Restore
     - Parent PIN gate (real verification)
     - Child Home → check-off chores (pending → confirmed)
     - Mom Bucks Ledger (earned + spent transactions)
     - Rewards Ledger screen with per-child view
     - Calendar → monthly grid + shared family events
   ============================================================ */

var CHILDREN_STORAGE_KEY = 'children';
var WEEKLY_CHORES_STORAGE_KEY = 'weeklyChores';
var COMPLETIONS_STORAGE_KEY = 'choreCompletions';
var LEDGER_STORAGE_KEY = 'momBucksLedger';
var PARENT_PIN_STORAGE_KEY = 'parentPIN';
var CALENDAR_STORAGE_KEY = 'calendarEvents';

var DEFAULT_PARENT_PIN = '1234';
var PIN_MIN_LENGTH = 4;
var PIN_MAX_LENGTH = 6;

/* All app-owned localStorage keys (used for backup & restore).
   The completion/approval data lives under COMPLETIONS_STORAGE_KEY. */
var APP_STORAGE_KEYS = [
    CHILDREN_STORAGE_KEY,
    WEEKLY_CHORES_STORAGE_KEY,
    COMPLETIONS_STORAGE_KEY,
    LEDGER_STORAGE_KEY,
    PARENT_PIN_STORAGE_KEY,
    CALENDAR_STORAGE_KEY
];

var BACKUP_FORMAT_TAG = 'mom-bucks-app';
var BACKUP_FORMAT_VERSION = 1;

/* ------------------------------------------------------------
   PARENT PIN DATA LAYER
   ------------------------------------------------------------ */

function loadParentPin() {
    try {
        var raw = localStorage.getItem(PARENT_PIN_STORAGE_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (typeof parsed === 'string' && /^\d+$/.test(parsed)) {
                return parsed;
            }
            if (parsed && typeof parsed === 'object' && typeof parsed.pin === 'string') {
                return parsed.pin;
            }
        }
    } catch (e) {
        /* ignore corrupt storage */
    }
    saveParentPin(DEFAULT_PARENT_PIN);
    return DEFAULT_PARENT_PIN;
}

function saveParentPin(pin) {
    localStorage.setItem(PARENT_PIN_STORAGE_KEY, JSON.stringify(pin));
}

var parentPin = loadParentPin();

/* ------------------------------------------------------------
   PARENT PIN GATE STATE
   ------------------------------------------------------------ */

var parentUnlocked = false;
var pinGateError = null;

/* ------------------------------------------------------------
   CALENDAR DATA LAYER
   ------------------------------------------------------------ */

function generateEventId() {
    return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function loadCalendarEvents() {
    try {
        var raw = localStorage.getItem(CALENDAR_STORAGE_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                var normalised = [];
                for (var i = 0; i < parsed.length; i++) {
                    var ev = parsed[i];
                    if (ev && typeof ev === 'object' && ev.id && ev.name && ev.date) {
                        normalised.push({
                            id: ev.id,
                            name: String(ev.name),
                            date: String(ev.date),
                            time: ev.time ? String(ev.time) : ''
                        });
                    }
                }
                return normalised;
            }
        }
    } catch (e) {
        /* ignore corrupt storage */
    }
    return [];
}

function saveCalendarEvents(list) {
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(list));
}

var calendarEvents = loadCalendarEvents();

function getEventById(id) {
    for (var i = 0; i < calendarEvents.length; i++) {
        if (calendarEvents[i].id === id) return calendarEvents[i];
    }
    return null;
}

function getEventsForDate(ymd) {
    var list = [];
    for (var i = 0; i < calendarEvents.length; i++) {
        if (calendarEvents[i].date === ymd) list.push(calendarEvents[i]);
    }
    list.sort(function (a, b) {
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        if (a.time < b.time) return -1;
        if (a.time > b.time) return 1;
        return 0;
    });
    return list;
}

var calendarFormState = null;
var calendarEditId = null;
var calendarError = null;
var calendarViewYear = new Date().getFullYear();
var calendarViewMonth = new Date().getMonth();
var calendarPendingDate = '';

/* ------------------------------------------------------------
   CHILDREN DATA LAYER
   ------------------------------------------------------------ */

function generateId() {
    return 'child_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateChoreId() {
    return 'chore_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateCompletionId() {
    return 'completion_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateLedgerId() {
    return 'ledger_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function loadChildren() {
    try {
        var raw = localStorage.getItem(CHILDREN_STORAGE_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        /* ignore corrupt storage */
    }

    var initial = [
        {
            id: generateId(),
            name: 'Emma',
            avatar: 'E',
            momBucks: 0
        }
    ];
    saveChildren(initial);
    return initial;
}

function saveChildren(children) {
    localStorage.setItem(CHILDREN_STORAGE_KEY, JSON.stringify(children));
}

var childrenData = loadChildren();

function getChildById(id) {
    for (var i = 0; i < childrenData.length; i++) {
        if (childrenData[i].id === id) return childrenData[i];
    }
    return null;
}

function isDuplicateName(name, excludeId) {
    var lower = name.trim().toLowerCase();
    for (var i = 0; i < childrenData.length; i++) {
        if (childrenData[i].id === excludeId) continue;
        if (childrenData[i].name.trim().toLowerCase() === lower) return true;
    }
    return false;
}

/* ------------------------------------------------------------
   WEEKLY CHORES DATA LAYER
   ------------------------------------------------------------ */

function loadWeeklyChores() {
    try {
        var raw = localStorage.getItem(WEEKLY_CHORES_STORAGE_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                var normalised = [];
                for (var i = 0; i < parsed.length; i++) {
                    var entry = parsed[i];
                    if (entry && typeof entry === 'object' && entry.weekStart && Array.isArray(entry.chores)) {
                        normalised.push(entry);
                    }
                }
                return normalised;
            }
        }
    } catch (e) {
        /* ignore corrupt storage */
    }
    return [];
}

function saveWeeklyChores(weekly) {
    localStorage.setItem(WEEKLY_CHORES_STORAGE_KEY, JSON.stringify(weekly));
}

var weeklyChoresData = loadWeeklyChores();

function getWeekEntry(weekStart) {
    for (var i = 0; i < weeklyChoresData.length; i++) {
        if (weeklyChoresData[i].weekStart === weekStart) return weeklyChoresData[i];
    }
    return null;
}

function ensureWeekEntry(weekStart) {
    var entry = getWeekEntry(weekStart);
    if (!entry) {
        /* Find the most recent week strictly earlier than this one,
           to carry forward its momBuckValue (if any). If no earlier
           week exists, or it has no value, start blank. */
        var previousValue = '';
        var latestEarlierStart = null;
        for (var i = 0; i < weeklyChoresData.length; i++) {
            var w = weeklyChoresData[i];
            if (!w || !w.weekStart) continue;
            if (w.weekStart >= weekStart) continue;
            if (latestEarlierStart === null || w.weekStart > latestEarlierStart) {
                latestEarlierStart = w.weekStart;
            }
        }
        if (latestEarlierStart !== null) {
            var prevEntry = getWeekEntry(latestEarlierStart);
            if (prevEntry && typeof prevEntry.momBuckValue === 'string') {
                previousValue = prevEntry.momBuckValue;
            }
        }

        entry = {
            weekStart: weekStart,
            weekContext: '',
            momBuckValue: previousValue,
            chores: []
        };
        weeklyChoresData.push(entry);
        saveWeeklyChores(weeklyChoresData);
    }
    return entry;
}

function getChildNamesForIds(ids) {
    var names = [];
    if (!Array.isArray(ids)) return names;
    for (var i = 0; i < ids.length; i++) {
        var c = getChildById(ids[i]);
        if (c) names.push(c.name);
    }
    return names;
}

/* ------------------------------------------------------------
   COMPLETIONS DATA LAYER
   Each completion:
   {
     id: "completion_...",
     choreId: "...",
     childId: "...",
     weekStart: "YYYY-MM-DD",   // the Monday of the week the chore belongs to
     date: "YYYY-MM-DD",        // the day this completion is for
     status: "pending" | "confirmed",
     momBucks: 10
   }
   ------------------------------------------------------------ */

function loadCompletions() {
    try {
        var raw = localStorage.getItem(COMPLETIONS_STORAGE_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        /* ignore corrupt storage */
    }
    return [];
}

function saveCompletions(list) {
    localStorage.setItem(COMPLETIONS_STORAGE_KEY, JSON.stringify(list));
}

var completionsData = loadCompletions();

/* Look up a completion for a specific child + chore + day. */
function getCompletion(choreId, childId, dateYmd) {
    for (var i = 0; i < completionsData.length; i++) {
        var c = completionsData[i];
        if (c.choreId === choreId && c.childId === childId && c.date === dateYmd) {
            return c;
        }
    }
    return null;
}

function getCompletionById(id) {
    for (var i = 0; i < completionsData.length; i++) {
        if (completionsData[i].id === id) return completionsData[i];
    }
    return null;
}

/* ------------------------------------------------------------
   MOM BUCKS LEDGER DATA LAYER
   ------------------------------------------------------------ */

function loadLedger() {
    try {
        var raw = localStorage.getItem(LEDGER_STORAGE_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        /* ignore corrupt storage */
    }
    return [];
}

function saveLedger(list) {
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(list));
}

var ledgerData = loadLedger();

function findLedgerByCompletion(completionId) {
    for (var i = 0; i < ledgerData.length; i++) {
        if (ledgerData[i].completionId === completionId) return ledgerData[i];
    }
    return null;
}

function getLedgerForChild(childId) {
    var list = [];
    for (var i = 0; i < ledgerData.length; i++) {
        if (ledgerData[i].childId === childId) list.push(ledgerData[i]);
    }
    list.sort(function (a, b) {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        if (a.id > b.id) return -1;
        if (a.id < b.id) return 1;
        return 0;
    });
    return list;
}

/* ------------------------------------------------------------
   DATE HELPERS
   ------------------------------------------------------------ */

function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
}

function formatYmd(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function getMondayOf(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay();
    var diff;
    if (day === 0) {
        diff = -6;
    } else {
        diff = 1 - day;
    }
    d.setDate(d.getDate() + diff);
    return d;
}

function addDays(date, n) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + n);
    return d;
}

var MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function formatPrettyDate(date) {
    return MONTH_NAMES[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
}

function formatPrettyShort(date) {
    return MONTH_NAMES[date.getMonth()] + ' ' + date.getDate();
}

function formatPrettyDateShort(ymd) {
    var d = parseYmd(ymd);
    return MONTH_NAMES[d.getMonth()] + ' ' + d.getDate();
}

function formatWeekLabel(weekStart) {
    var monday = parseYmd(weekStart);
    var sunday = addDays(monday, 6);
    return 'Week of ' + formatPrettyShort(monday) + ' – ' + formatPrettyShort(sunday) + ', ' + sunday.getFullYear();
}

function parseYmd(ymd) {
    if (!ymd || typeof ymd !== 'string') return new Date();
    var parts = ymd.split('-');
    if (parts.length !== 3) return new Date();
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date();
    return new Date(y, m, d);
}

function formatPrettyTime(hhmm) {
    if (!hhmm || typeof hhmm !== 'string') return '';
    var parts = hhmm.split(':');
    if (parts.length < 2) return hhmm;
    var h = parseInt(parts[0], 10);
    var mn = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(mn)) return hhmm;
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + pad2(mn) + ' ' + ampm;
}

/* Today as YYYY-MM-DD. Used to key completions per-day. */
function todayYmd() {
    return formatYmd(new Date());
}

/* ------------------------------------------------------------
   EXISTING PROTOTYPE: VIEW SWITCHING
   ------------------------------------------------------------ */

function switchView(viewName, btnElement) {
    if (viewName === 'parent-area' && !parentUnlocked) {
        viewName = 'parent-pin';
        btnElement = null;
    }

    var screens = document.querySelectorAll('.app-screen');
    for (var i = 0; i < screens.length; i++) {
        screens[i].classList.remove('active');
    }

    var targetId = 'screen-' + viewName;
    var target = document.getElementById(targetId);

    if (!target) {
        if (viewName === 'children') {
            target = createChildrenScreen();
        } else if (viewName === 'chore-setup') {
            target = createChoreSetupScreen();
        } else if (viewName === 'confirm-chores') {
            target = createConfirmChoresScreen();
        } else if (viewName === 'spending-ledger') {
            target = createSpendingLedgerScreen();
        } else if (viewName === 'modify-pin') {
            target = createModifyPinScreen();
        } else if (viewName === 'backup-restore') {
            target = createBackupRestoreScreen();
        }
    }

    if (target) {
        target.classList.add('active');
    }

    var protoButtons = document.querySelectorAll('.btn-proto');
    for (var j = 0; j < protoButtons.length; j++) {
        protoButtons[j].classList.remove('active');
    }
    if (btnElement) {
        btnElement.classList.add('active');
    }

    updateNavForView(viewName);

    if (viewName === 'children') {
        renderChildrenList();
    } else if (viewName === 'chore-setup') {
        renderChoreSetupScreen();
    } else if (viewName === 'confirm-chores') {
        renderConfirmChoresScreen();
    } else if (viewName === 'spending-ledger') {
        renderSpendingLedgerScreen();
    } else if (viewName === 'modify-pin') {
        renderModifyPinScreen();
    } else if (viewName === 'backup-restore') {
        renderBackupRestoreScreen();
    } else if (viewName === 'parent-pin') {
        renderParentPinScreen();
    } else if (viewName === 'parent-area') {
        /* Parent Hub renders no Back button */
    } else if (viewName === 'child-home') {
        renderChildHome();
    } else if (viewName === 'rewards') {
        renderRewardsLedger();
    } else if (viewName === 'calendar') {
        renderCalendarScreen();
    }
}

function updateNavForView(viewName) {
    var navMap = {
        'child-home': 'nav-home',
        'rewards': 'nav-rewards',
        'calendar': 'nav-calendar',
        'parent-pin': 'nav-parent',
        'parent-area': 'nav-parent',
        'children': 'nav-parent',
        'chore-setup': 'nav-parent',
        'confirm-chores': 'nav-parent',
        'spending-ledger': 'nav-parent',
        'modify-pin': 'nav-parent',
        'backup-restore': 'nav-parent'
    };
    var navItems = document.querySelectorAll('.nav-item');
    for (var i = 0; i < navItems.length; i++) {
        navItems[i].classList.remove('active');
    }
    var activeNavId = navMap[viewName];
    if (activeNavId) {
        var el = document.getElementById(activeNavId);
        if (el) el.classList.add('active');
    }
}

function handleSystemNav(viewName, navElement) {
    var navItems = document.querySelectorAll('.nav-item');
    for (var i = 0; i < navItems.length; i++) {
        navItems[i].classList.remove('active');
    }
    if (navElement) {
        navElement.classList.add('active');
    }
    switchView(viewName, null);
}

/* ------------------------------------------------------------
   PARENT PIN SCREEN — REAL GATE
   ------------------------------------------------------------ */

function renderParentPinScreen() {
    var existing = document.getElementById('screen-parent-pin');
    if (!existing) return;

    var html = '';

    html +=
        '<div class="pin-screen-layout">' +
            '<div class="pin-header-icon">🔒</div>' +
            '<h3>Enter Parent PIN</h3>' +
            '<p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Access to parent dashboard controls</p>' +

            '<div class="context-input-card" style="margin-top:20px; text-align:left;">' +
                '<label>Parent PIN</label>' +
                '<input id="pin-gate-input" type="password" inputmode="numeric" maxlength="' + PIN_MAX_LENGTH + '" ' +
                    'placeholder="' + PIN_MIN_LENGTH + '–' + PIN_MAX_LENGTH + ' digits" ' +
                    'oninput="handlePinGateInput(this.value)" ' +
                    'onkeydown="handlePinGateKeydown(event)" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:1.2rem; font-weight:700; letter-spacing:0.3em; color:var(--text-primary); ' +
                    'outline:none; padding:6px 0;" />' +
            '</div>' +

            '<div id="pin-gate-error" style="display:' + (pinGateError ? 'block' : 'none') + '; ' +
                'color: var(--color-coral); font-size:0.85rem; font-weight:700; margin-top:10px;">' +
                (pinGateError ? escapeHtml(pinGateError) : '') +
            '</div>' +

            '<button class="btn-add-chore" style="margin-top:20px; width:100%; background:var(--color-blue); ' +
                'border-color:var(--color-blue); color:#fff;" onclick="verifyParentPin()">Verify PIN</button>' +
        '</div>';

    existing.innerHTML = html;

    var input = document.getElementById('pin-gate-input');
    if (input) input.focus();
}

function handlePinGateInput(value) {
    var cleaned = String(value || '').replace(/\D/g, '').slice(0, PIN_MAX_LENGTH);
    var input = document.getElementById('pin-gate-input');
    if (input && input.value !== cleaned) {
        input.value = cleaned;
    }
    if (pinGateError) {
        pinGateError = null;
        var err = document.getElementById('pin-gate-error');
        if (err) {
            err.textContent = '';
            err.style.display = 'none';
        }
    }
}

function handlePinGateKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        verifyParentPin();
    }
}

function verifyParentPin() {
    var input = document.getElementById('pin-gate-input');
    var entered = input ? String(input.value).trim() : '';

    if (entered === '') {
        pinGateError = 'Please enter your PIN.';
        renderParentPinScreen();
        return;
    }

    if (!/^\d+$/.test(entered)) {
        pinGateError = 'PIN must contain only digits.';
        renderParentPinScreen();
        return;
    }

    if (entered.length < PIN_MIN_LENGTH || entered.length > PIN_MAX_LENGTH) {
        pinGateError = 'PIN must be ' + PIN_MIN_LENGTH + '–' + PIN_MAX_LENGTH + ' digits.';
        renderParentPinScreen();
        return;
    }

    if (entered !== parentPin) {
        pinGateError = 'Incorrect PIN. Please try again.';
        renderParentPinScreen();
        return;
    }

    parentUnlocked = true;
    pinGateError = null;
    switchView('parent-area', document.querySelectorAll('.btn-proto')[4]);
}

function lockParentArea() {
    parentUnlocked = false;
    pinGateError = null;
}

/* ------------------------------------------------------------
   BACK BUTTON HELPERS
   ------------------------------------------------------------ */

function goBackToParentHub() {
    switchView('parent-area', document.querySelectorAll('.btn-proto')[4]);
}

/* ------------------------------------------------------------
   BACKUP & RESTORE SCREEN
   ------------------------------------------------------------ */

var backupRestoreState = {
    mode: null,
    pendingPayload: null,
    message: null
};

function createBackupRestoreScreen() {
    var contentArea = document.querySelector('.app-content');
    if (!contentArea) return null;

    var screen = document.createElement('div');
    screen.id = 'screen-backup-restore';
    screen.className = 'app-screen';
    screen.innerHTML = '<div id="backup-restore-root"></div>';

    contentArea.appendChild(screen);
    return screen;
}

function renderBackupRestoreScreen() {
    var root = document.getElementById('backup-restore-root');
    if (!root) return;

    var html = '';

    html +=
        '<div class="control-pill" style="display:inline-block; margin-bottom:12px; cursor:pointer;" ' +
            'onclick="goBackToParentHub()">← Back to Parent Hub</div>';

    html +=
        '<div class="section-title">' +
            '<span>Backup &amp; Restore</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>';

    if (backupRestoreState.message) {
        var msgType = backupRestoreState.message.type;
        var bannerColor = 'var(--color-coral)';
        var bannerBorder = 'var(--color-coral)';
        if (msgType === 'success') {
            bannerColor = 'var(--color-green)';
            bannerBorder = 'var(--color-green)';
        } else if (msgType === 'info') {
            bannerColor = 'var(--color-blue)';
            bannerBorder = 'var(--color-blue)';
        }

        html +=
            '<div class="ui-card" style="margin-bottom:16px; border:2px solid ' + bannerBorder + '; ' +
                'color:' + bannerColor + '; font-weight:700; text-align:center;">' +
                escapeHtml(backupRestoreState.message.text) +
            '</div>';
    }

    html +=
        '<div class="ui-card" style="margin-bottom:16px;">' +
            '<div style="font-weight:700; font-size:0.95rem; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.3px;">' +
                'What\'s included' +
            '</div>' +
            '<div style="font-size:0.85rem; color: var(--text-muted); line-height:1.5;">' +
                'A backup file contains all of this app\'s data stored on this device: children profiles, weekly chores, chore completion and approval records, Mom Bucks ledger, spending transactions, calendar events, and the Parent PIN. ' +
                'Backups are created locally in your browser — nothing is uploaded anywhere.' +
            '</div>' +
        '</div>';

    if (backupRestoreState.mode === 'confirm-restore' && backupRestoreState.pendingPayload) {
        var meta = backupRestoreState.pendingPayload;

        html +=
            '<div class="ui-card" style="margin-bottom:16px; border:2px solid var(--color-coral);">' +
                '<div style="font-weight:700; font-size:1.05rem; margin-bottom:6px;">' +
                    'Restore this backup?' +
                '</div>' +
                '<div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:6px;">' +
                    'File created: ' + escapeHtml(meta.createdAt || 'unknown') +
                '</div>' +
                '<div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:14px;">' +
                    'This will replace the current app data on this device with the data from the backup. ' +
                    'This cannot be undone.' +
                '</div>' +
                '<div style="display:flex; gap:10px;">' +
                    '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-coral); ' +
                        'border-color:var(--color-coral); color:#fff;" onclick="confirmRestoreBackup()">Restore</button>' +
                    '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" ' +
                        'onclick="cancelRestoreBackup()">Cancel</button>' +
                '</div>' +
            '</div>';
    }

    if (backupRestoreState.mode !== 'confirm-restore') {
        html +=
            '<button class="btn-add-chore" style="margin-top:0; width:100%; background:var(--color-blue); ' +
                'border-color:var(--color-blue); color:#fff; margin-bottom:12px;" ' +
                'onclick="createBackup()">Backup All Data</button>' +

            '<button class="btn-add-chore" style="margin-top:0; width:100%; ' +
                'background:transparent; border-style:dashed;" ' +
                'onclick="triggerRestoreFilePicker()">Restore Backup</button>' +

            '<input id="backup-restore-file-input" type="file" accept=".json,application/json" ' +
                'style="display:none;" onchange="handleRestoreFileSelected(event)" />';
    } else {
        html +=
            '<input id="backup-restore-file-input" type="file" accept=".json,application/json" ' +
                'style="display:none;" onchange="handleRestoreFileSelected(event)" />';
    }

    root.innerHTML = html;
}

function createBackup() {
    var payload = {
        app: BACKUP_FORMAT_TAG,
        version: BACKUP_FORMAT_VERSION,
        createdAt: new Date().toISOString(),
        data: {}
    };

    for (var i = 0; i < APP_STORAGE_KEYS.length; i++) {
        var key = APP_STORAGE_KEYS[i];
        var raw = null;
        try {
            raw = localStorage.getItem(key);
        } catch (e) {
            raw = null;
        }
        payload.data[key] = raw;
    }

    var jsonString;
    try {
        jsonString = JSON.stringify(payload, null, 2);
    } catch (e) {
        backupRestoreState.message = {
            type: 'error',
            text: 'Could not build the backup file.'
        };
        renderBackupRestoreScreen();
        return;
    }

    var blob = new Blob([jsonString], { type: 'application/json' });
    var url = URL.createObjectURL(blob);

    var filename = 'mom-bucks-backup-' + formatYmd(new Date()) + '.json';

    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    setTimeout(function () {
        try {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            /* ignore */
        }
    }, 0);

    backupRestoreState.message = {
        type: 'success',
        text: 'Backup downloaded as ' + filename + '.'
    };
    renderBackupRestoreScreen();
}

function triggerRestoreFilePicker() {
    var input = document.getElementById('backup-restore-file-input');
    if (!input) return;
    input.value = '';
    input.click();
}

function handleRestoreFileSelected(event) {
    var input = event && event.target ? event.target : null;
    var file = input && input.files && input.files.length > 0 ? input.files[0] : null;

    if (!file) return;

    var reader = new FileReader();

    reader.onload = function (e) {
        var text = e && e.target ? e.target.result : '';
        processRestorePayload(text);
    };

    reader.onerror = function () {
        backupRestoreState.message = {
            type: 'error',
            text: 'Could not read the selected file.'
        };
        backupRestoreState.mode = null;
        backupRestoreState.pendingPayload = null;
        renderBackupRestoreScreen();
    };

    reader.readAsText(file);
}

function processRestorePayload(text) {
    backupRestoreState.pendingPayload = null;
    backupRestoreState.mode = null;

    if (!text || typeof text !== 'string' || text.trim() === '') {
        backupRestoreState.message = {
            type: 'error',
            text: 'The selected file is empty.'
        };
        renderBackupRestoreScreen();
        return;
    }

    var parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        backupRestoreState.message = {
            type: 'error',
            text: 'The selected file is not valid JSON.'
        };
        renderBackupRestoreScreen();
        return;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        backupRestoreState.message = {
            type: 'error',
            text: 'This file is not a Mom Bucks backup.'
        };
        renderBackupRestoreScreen();
        return;
    }

    if (parsed.app !== BACKUP_FORMAT_TAG) {
        backupRestoreState.message = {
            type: 'error',
            text: 'This file is not a Mom Bucks backup.'
        };
        renderBackupRestoreScreen();
        return;
    }

    if (typeof parsed.version !== 'number' || parsed.version > BACKUP_FORMAT_VERSION) {
        backupRestoreState.message = {
            type: 'error',
            text: 'This backup was created by an unsupported app version.'
        };
        renderBackupRestoreScreen();
        return;
    }

    if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
        backupRestoreState.message = {
            type: 'error',
            text: 'The backup file is missing its data section.'
        };
        renderBackupRestoreScreen();
        return;
    }

    var recognised = 0;
    for (var i = 0; i < APP_STORAGE_KEYS.length; i++) {
        var k = APP_STORAGE_KEYS[i];
        if (Object.prototype.hasOwnProperty.call(parsed.data, k)) {
            recognised++;
        }
    }
    if (recognised === 0) {
        backupRestoreState.message = {
            type: 'error',
            text: 'The backup file does not contain any recognised app data.'
        };
        renderBackupRestoreScreen();
        return;
    }

    for (var j = 0; j < APP_STORAGE_KEYS.length; j++) {
        var key = APP_STORAGE_KEYS[j];
        if (!Object.prototype.hasOwnProperty.call(parsed.data, key)) continue;
        var v = parsed.data[key];
        if (v !== null && typeof v !== 'string') {
            backupRestoreState.message = {
                type: 'error',
                text: 'The backup file has an unexpected structure.'
            };
            renderBackupRestoreScreen();
            return;
        }
        if (v !== null) {
            try {
                JSON.parse(v);
            } catch (e) {
                backupRestoreState.message = {
                    type: 'error',
                    text: 'The backup file contains data that could not be read.'
                };
                renderBackupRestoreScreen();
                return;
            }
        }
    }

    backupRestoreState.pendingPayload = {
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
        data: parsed.data
    };
    backupRestoreState.mode = 'confirm-restore';
    backupRestoreState.message = null;
    renderBackupRestoreScreen();
}

function cancelRestoreBackup() {
    backupRestoreState.mode = null;
    backupRestoreState.pendingPayload = null;
    backupRestoreState.message = {
        type: 'info',
        text: 'Restore cancelled. Your data was not changed.'
    };
    renderBackupRestoreScreen();
}

function confirmRestoreBackup() {
    var pending = backupRestoreState.pendingPayload;
    if (!pending || !pending.data) {
        backupRestoreState.mode = null;
        backupRestoreState.pendingPayload = null;
        backupRestoreState.message = {
            type: 'error',
            text: 'No valid backup is loaded.'
        };
        renderBackupRestoreScreen();
        return;
    }

    try {
        for (var i = 0; i < APP_STORAGE_KEYS.length; i++) {
            var key = APP_STORAGE_KEYS[i];
            if (!Object.prototype.hasOwnProperty.call(pending.data, key)) continue;
            var raw = pending.data[key];
            if (raw === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, raw);
            }
        }
    } catch (e) {
        backupRestoreState.mode = null;
        backupRestoreState.pendingPayload = null;
        backupRestoreState.message = {
            type: 'error',
            text: 'Something went wrong while restoring. Your data may be unchanged.'
        };
        renderBackupRestoreScreen();
        return;
    }

    window.location.reload();
}

/* ------------------------------------------------------------
   CALENDAR SCREEN
   ------------------------------------------------------------ */

function calendarPrevMonth() {
    calendarViewMonth -= 1;
    if (calendarViewMonth < 0) {
        calendarViewMonth = 11;
        calendarViewYear -= 1;
    }
    calendarFormState = null;
    calendarEditId = null;
    calendarError = null;
    calendarPendingDate = '';
    renderCalendarScreen();
}

function calendarNextMonth() {
    calendarViewMonth += 1;
    if (calendarViewMonth > 11) {
        calendarViewMonth = 0;
        calendarViewYear += 1;
    }
    calendarFormState = null;
    calendarEditId = null;
    calendarError = null;
    calendarPendingDate = '';
    renderCalendarScreen();
}

function buildCalendarGridCells(year, month) {
    var firstOfMonth = new Date(year, month, 1);
    var startOffset = firstOfMonth.getDay();
    var gridStart = addDays(firstOfMonth, -startOffset);

    var cells = [];
    for (var i = 0; i < 42; i++) {
        cells.push(addDays(gridStart, i));
    }
    return cells;
}

function renderCalendarScreen() {
    var existing = document.getElementById('screen-calendar');
    if (!existing) return;

    var today = formatYmd(new Date());
    var html = '';

    html +=
        '<div class="section-title" style="margin-top:0;">' +
            '<div style="display:flex; align-items:center; gap:10px;">' +
                '<div class="control-pill" style="cursor:pointer;" onclick="calendarPrevMonth()">←</div>' +
                '<span>' + escapeHtml(MONTH_NAMES[calendarViewMonth]) + ' ' + calendarViewYear + '</span>' +
                '<div class="control-pill" style="cursor:pointer;" onclick="calendarNextMonth()">→</div>' +
            '</div>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>';

    if (calendarError) {
        html +=
            '<div class="ui-card" style="margin-bottom:12px; border:2px solid var(--color-coral); ' +
                'color:var(--color-coral); font-weight:700; text-align:center;">' +
                escapeHtml(calendarError) +
            '</div>';
    }

    if (calendarFormState === 'add') {
        html += buildCalendarFormHtml(null);
    } else if (calendarFormState === 'edit' && calendarEditId) {
        var editEvent = getEventById(calendarEditId);
        if (editEvent) {
            html += buildCalendarFormHtml(editEvent);
        } else {
            calendarFormState = null;
            calendarEditId = null;
        }
    } else if (calendarFormState === 'remove' && calendarEditId) {
        var removeEvent = getEventById(calendarEditId);
        if (removeEvent) {
            html += buildCalendarRemoveConfirmHtml(removeEvent);
        } else {
            calendarFormState = null;
            calendarEditId = null;
        }
    }

    html += '<div class="ui-card" style="padding:10px;">';

    html +=
        '<div class="calendar-grid" style="grid-template-columns:repeat(7, 1fr); gap:4px; padding:0; ' +
            'background:transparent; border:none;">' +
            '<div class="calendar-day-label">S</div>' +
            '<div class="calendar-day-label">M</div>' +
            '<div class="calendar-day-label">T</div>' +
            '<div class="calendar-day-label">W</div>' +
            '<div class="calendar-day-label">T</div>' +
            '<div class="calendar-day-label">F</div>' +
            '<div class="calendar-day-label">S</div>' +
        '</div>';

    var cells = buildCalendarGridCells(calendarViewYear, calendarViewMonth);

    html +=
        '<div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; margin-top:6px;">';

    for (var i = 0; i < cells.length; i++) {
        var cellDate = cells[i];
        var cellYmd = formatYmd(cellDate);
        var inMonth = (cellDate.getMonth() === calendarViewMonth && cellDate.getFullYear() === calendarViewYear);
        var isToday = (cellYmd === today);
        var dayEvents = getEventsForDate(cellYmd);

        var cellBg = inMonth ? 'var(--color-white)' : '#F0E9E2';
        var cellBorder = isToday ? '2px solid var(--color-blue)' : '1px solid rgba(0,0,0,0.06)';
        var dayColor = inMonth ? 'var(--text-primary)' : 'var(--text-muted)';

        html +=
            '<div style="background:' + cellBg + '; border:' + cellBorder + '; border-radius:6px; ' +
                'min-height:64px; padding:4px; display:flex; flex-direction:column; gap:2px; ' +
                'overflow:hidden;">';

        html +=
            '<div style="cursor:pointer; font-size:0.8rem; font-weight:700; color:' + dayColor + '; ' +
                'text-align:right; line-height:1.1;" ' +
                'onclick="openAddCalendarEventForDate(\'' + cellYmd + '\')">' +
                cellDate.getDate() +
            '</div>';

        for (var e = 0; e < dayEvents.length; e++) {
            var ev = dayEvents[e];
            var timeLabel = ev.time ? formatPrettyTime(ev.time) : '';
            var title = ev.name + (timeLabel ? ' · ' + timeLabel : '');

            html +=
                '<div class="control-pill" ' +
                    'style="cursor:pointer; font-size:0.65rem; padding:2px 5px; border-radius:6px; ' +
                    'white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ' +
                    'background:#E4ECF5; border-color:var(--color-blue);" ' +
                    'title="' + escapeHtml(title) + '" ' +
                    'onclick="openEditCalendarEvent(\'' + ev.id + '\')">' +
                    escapeHtml(ev.name) +
                '</div>';
        }

        html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    if (calendarFormState !== 'add' && calendarFormState !== 'edit') {
        html +=
            '<button class="btn-add-chore" onclick="openAddCalendarEvent()">+ Add Event</button>';
    }

    html +=
        '<div class="section-title" style="margin-top:20px;">' +
            '<span>Upcoming Events</span>' +
        '</div>';

    var sorted = calendarEvents.slice();
    sorted.sort(function (a, b) {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        if (a.time < b.time) return -1;
        if (a.time > b.time) return 1;
        return 0;
    });

    if (sorted.length === 0) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No events yet. Tap a date or + Add Event to create one.</p>' +
            '</div>';
    } else {
        for (var s = 0; s < sorted.length; s++) {
            var sev = sorted[s];
            var stime = sev.time ? formatPrettyTime(sev.time) : '';

            html +=
                '<div class="ui-card" style="margin-bottom:10px;">' +
                    '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">' +
                        '<div style="flex:1; min-width:0;">' +
                            '<div style="font-weight:700; font-size:1rem;">' +
                                escapeHtml(sev.name) +
                            '</div>' +
                            '<div style="font-size:0.85rem; color:var(--text-muted); font-weight:600; margin-top:4px;">' +
                                escapeHtml(formatPrettyDateShort(sev.date)) +
                                (stime ? ' · ' + escapeHtml(stime) : '') +
                            '</div>' +
                        '</div>' +
                        '<div style="display:flex; gap:6px; flex-shrink:0;">' +
                            '<div class="control-pill" onclick="openEditCalendarEvent(\'' + sev.id + '\')">Edit</div>' +
                            '<div class="control-pill" style="background:#FC6262; color:#fff; border-color:#FC6262;" ' +
                                'onclick="openRemoveCalendarEvent(\'' + sev.id + '\')">Delete</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }
    }

    existing.innerHTML = html;
}

function buildCalendarFormHtml(event) {
    var isEdit = !!event;
    var title = isEdit ? 'Edit Event' : 'Add Event';
    var nameVal = isEdit ? event.name : '';
    var dateVal = isEdit ? event.date : (calendarPendingDate || '');
    var timeVal = isEdit && event.time ? event.time : '';

    var saveHandler = isEdit
        ? 'saveCalendarEvent(\'' + event.id + '\')'
        : 'saveCalendarEvent(null)';

    return (
        '<div class="ui-card" style="margin-bottom:16px;">' +
            '<div style="font-weight:700; font-size:0.95rem; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.3px;">' +
                title +
            '</div>' +

            '<div class="context-input-card" style="margin-bottom:10px;">' +
                '<label>Event Name</label>' +
                '<input id="calendar-form-name" type="text" placeholder="e.g. Math Test" ' +
                    'value="' + escapeHtml(nameVal) + '" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +

            '<div class="context-input-card" style="margin-bottom:10px;">' +
                '<label>Date</label>' +
                '<input id="calendar-form-date" type="date" value="' + escapeHtml(dateVal) + '" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +

            '<div class="context-input-card" style="margin-bottom:10px;">' +
                '<label>Time (optional)</label>' +
                '<input id="calendar-form-time" type="time" value="' + escapeHtml(timeVal) + '" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +

            '<div id="calendar-form-error" style="display:none; color:var(--color-coral); font-size:0.8rem; ' +
                'font-weight:600; margin-bottom:10px;"></div>' +

            '<div style="display:flex; gap:10px;">' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-blue); ' +
                    'border-color:var(--color-blue); color:#fff;" onclick="' + saveHandler + '">Save</button>' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" ' +
                    'onclick="closeCalendarForm()">Cancel</button>' +
            '</div>' +
        '</div>'
    );
}

function buildCalendarRemoveConfirmHtml(event) {
    var timeLabel = event.time ? formatPrettyTime(event.time) : '';

    return (
        '<div class="ui-card" style="margin-bottom:16px; border:2px solid var(--color-coral);">' +
            '<div style="font-weight:700; font-size:1.05rem; margin-bottom:6px;">' +
                'Delete this event?' +
            '</div>' +
            '<div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:6px;">' +
                escapeHtml(event.name) + ' · ' + escapeHtml(formatPrettyDateShort(event.date)) +
                (timeLabel ? ' · ' + escapeHtml(timeLabel) : '') +
            '</div>' +
            '<div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:14px;">' +
                'This cannot be undone.' +
            '</div>' +
            '<div style="display:flex; gap:10px;">' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-coral); ' +
                    'border-color:var(--color-coral); color:#fff;" onclick="confirmRemoveCalendarEvent(\'' + event.id + '\')">Delete</button>' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" ' +
                    'onclick="closeCalendarForm()">Cancel</button>' +
            '</div>' +
        '</div>'
    );
}

function openAddCalendarEvent() {
    calendarFormState = 'add';
    calendarEditId = null;
    calendarError = null;
    calendarPendingDate = '';
    renderCalendarScreen();
}

function openAddCalendarEventForDate(ymd) {
    calendarFormState = 'add';
    calendarEditId = null;
    calendarError = null;
    calendarPendingDate = ymd;
    var d = parseYmd(ymd);
    if (d.getFullYear() !== calendarViewYear || d.getMonth() !== calendarViewMonth) {
        calendarViewYear = d.getFullYear();
        calendarViewMonth = d.getMonth();
    }
    renderCalendarScreen();
    var nameInput = document.getElementById('calendar-form-name');
    if (nameInput) nameInput.focus();
}

function openEditCalendarEvent(id) {
    calendarFormState = 'edit';
    calendarEditId = id;
    calendarError = null;
    calendarPendingDate = '';
    renderCalendarScreen();
}

function openRemoveCalendarEvent(id) {
    calendarFormState = 'remove';
    calendarEditId = id;
    calendarError = null;
    renderCalendarScreen();
}

function closeCalendarForm() {
    calendarFormState = null;
    calendarEditId = null;
    calendarError = null;
    calendarPendingDate = '';
    renderCalendarScreen();
}

function saveCalendarEvent(editId) {
    var nameInput = document.getElementById('calendar-form-name');
    var dateInput = document.getElementById('calendar-form-date');
    var timeInput = document.getElementById('calendar-form-time');

    var name = nameInput ? nameInput.value.trim() : '';
    var date = dateInput ? dateInput.value.trim() : '';
    var time = timeInput ? timeInput.value.trim() : '';

    if (name === '') {
        showFormError('calendar-form-error', 'Event name cannot be blank.');
        return;
    }

    if (date === '') {
        showFormError('calendar-form-error', 'Date is required.');
        return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        showFormError('calendar-form-error', 'Please pick a valid date.');
        return;
    }

    if (editId) {
        var ev = getEventById(editId);
        if (!ev) {
            showFormError('calendar-form-error', 'Event not found.');
            return;
        }
        ev.name = name;
        ev.date = date;
        ev.time = time;
    } else {
        calendarEvents.push({
            id: generateEventId(),
            name: name,
            date: date,
            time: time
        });
    }

    saveCalendarEvents(calendarEvents);
    calendarFormState = null;
    calendarEditId = null;
    calendarError = null;
    calendarPendingDate = '';
    renderCalendarScreen();
}

function confirmRemoveCalendarEvent(id) {
    var newList = [];
    for (var i = 0; i < calendarEvents.length; i++) {
        if (calendarEvents[i].id !== id) {
            newList.push(calendarEvents[i]);
        }
    }
    calendarEvents = newList;
    saveCalendarEvents(calendarEvents);
    calendarFormState = null;
    calendarEditId = null;
    calendarError = null;
    renderCalendarScreen();
}

/* ------------------------------------------------------------
   CHILDREN SCREEN
   ------------------------------------------------------------ */

function createChildrenScreen() {
    var contentArea = document.querySelector('.app-content');
    if (!contentArea) return null;

    var screen = document.createElement('div');
    screen.id = 'screen-children';
    screen.className = 'app-screen';
    screen.innerHTML = '<div id="children-root"></div>';

    contentArea.appendChild(screen);
    return screen;
}

function childrenBackButtonHtml() {
    return (
        '<div class="control-pill" style="display:inline-block; margin-bottom:12px; cursor:pointer;" ' +
            'onclick="goBackToParentHub()">← Back to Parent Hub</div>'
    );
}

function renderChildrenList() {
    var root = document.getElementById('children-root');
    if (!root) return;

    var html = '';

    html += childrenBackButtonHtml();

    html +=
        '<div class="section-title">' +
            '<span>Children Profiles</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>';

    if (childrenData.length === 0) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No children yet. Tap + Add Child to create a profile.</p>' +
            '</div>';
    } else {
        for (var i = 0; i < childrenData.length; i++) {
            var child = childrenData[i];
            html +=
                '<div class="ui-card" style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">' +
                    '<div class="avatar-circle" style="background-color: var(--color-blue); flex-shrink:0;">' +
                        escapeHtml(child.avatar) +
                    '</div>' +
                    '<div style="flex:1; min-width:0;">' +
                        '<div style="font-weight:700; font-size:1rem; text-transform:uppercase; letter-spacing:0.3px;">' +
                            escapeHtml(child.name) +
                        '</div>' +
                        '<div style="font-size:0.8rem; color: var(--text-muted); font-weight:500;">' +
                            'Mom Bucks: ' + child.momBucks +
                        '</div>' +
                    '</div>' +
                    '<div style="display:flex; gap:6px; flex-shrink:0;">' +
                        '<div class="control-pill" onclick="showEditChildForm(\'' + child.id + '\')">Edit</div>' +
                        '<div class="control-pill" style="background:#FC6262; color:#fff; border-color:#FC6262;" onclick="showRemoveChildConfirm(\'' + child.id + '\')">Remove</div>' +
                    '</div>' +
                '</div>';
        }
    }

    html +=
        '<button class="btn-add-chore" onclick="showAddChildForm()">+ Add Child</button>';

    root.innerHTML = html;
}

function showAddChildForm() {
    var root = document.getElementById('children-root');
    if (!root) return;

    root.innerHTML =
        childrenBackButtonHtml() +

        '<div class="section-title">' +
            '<span>Add Child</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>' +

        '<div class="context-input-card" style="margin-bottom:12px;">' +
            '<label>Child Name</label>' +
            '<input id="child-form-name" type="text" placeholder="e.g. Liam" ' +
                'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
        '</div>' +

        '<div class="context-input-card" style="margin-bottom:12px;">' +
            '<label>Avatar</label>' +
            '<input id="child-form-avatar" type="text" maxlength="2" placeholder="e.g. L" ' +
                'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
        '</div>' +

        '<div id="child-form-error" style="display:none; color:var(--color-coral); font-size:0.8rem; ' +
            'font-weight:600; margin-bottom:10px;"></div>' +

        '<div style="display:flex; gap:10px;">' +
            '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-blue); ' +
                'border-color:var(--color-blue); color:#fff;" onclick="saveNewChild()">Save</button>' +
            '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" ' +
                'onclick="renderChildrenList()">Cancel</button>' +
        '</div>';

    var nameInput = document.getElementById('child-form-name');
    if (nameInput) nameInput.focus();
}

function saveNewChild() {
    var nameInput = document.getElementById('child-form-name');
    var avatarInput = document.getElementById('child-form-avatar');

    var name = nameInput ? nameInput.value.trim() : '';
    var avatar = avatarInput ? avatarInput.value.trim() : '';

    if (name === '') {
        showFormError('child-form-error', 'Child name cannot be blank.');
        return;
    }

    if (isDuplicateName(name, null)) {
        showFormError('child-form-error', 'A child with that name already exists.');
        return;
    }

    if (avatar === '') {
        avatar = name.charAt(0).toUpperCase();
    }
    if (avatar.length > 2) {
        avatar = avatar.charAt(0);
    }

    childrenData.push({
        id: generateId(),
        name: name,
        avatar: avatar,
        momBucks: 0
    });

    saveChildren(childrenData);
    renderChildrenList();
    updateParentMenuChildCount();
}

function showEditChildForm(id) {
    var child = getChildById(id);
    if (!child) return;

    var root = document.getElementById('children-root');
    if (!root) return;

    root.innerHTML =
        childrenBackButtonHtml() +

        '<div class="section-title">' +
            '<span>Edit Child</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>' +

        '<div class="context-input-card" style="margin-bottom:12px;">' +
            '<label>Child Name</label>' +
            '<input id="child-form-name" type="text" value="' + escapeHtml(child.name) + '" ' +
                'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
        '</div>' +

        '<div class="context-input-card" style="margin-bottom:12px;">' +
            '<label>Avatar</label>' +
            '<input id="child-form-avatar" type="text" maxlength="2" value="' + escapeHtml(child.avatar) + '" ' +
                'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
        '</div>' +

        '<div id="child-form-error" style="display:none; color:var(--color-coral); font-size:0.8rem; ' +
            'font-weight:600; margin-bottom:10px;"></div>' +

        '<div style="display:flex; gap:10px;">' +
            '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-blue); ' +
                'border-color:var(--color-blue); color:#fff;" onclick="saveEditChild(\'' + child.id + '\')">Save</button>' +
            '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" ' +
                'onclick="renderChildrenList()">Cancel</button>' +
        '</div>';

    var nameInput = document.getElementById('child-form-name');
    if (nameInput) nameInput.focus();
}

function saveEditChild(id) {
    var child = getChildById(id);
    if (!child) return;

    var nameInput = document.getElementById('child-form-name');
    var avatarInput = document.getElementById('child-form-avatar');

    var newName = nameInput ? nameInput.value.trim() : '';
    var newAvatar = avatarInput ? avatarInput.value.trim() : '';

    if (newName === '') {
        showFormError('child-form-error', 'Child name cannot be blank.');
        return;
    }

    if (isDuplicateName(newName, id)) {
        showFormError('child-form-error', 'A child with that name already exists.');
        return;
    }

    if (newAvatar === '') {
        newAvatar = newName.charAt(0).toUpperCase();
    }
    if (newAvatar.length > 2) {
        newAvatar = newAvatar.charAt(0);
    }

    child.name = newName;
    child.avatar = newAvatar;

    saveChildren(childrenData);
    renderChildrenList();
    updateParentMenuChildCount();
}

function showRemoveChildConfirm(id) {
    var child = getChildById(id);
    if (!child) return;

    var root = document.getElementById('children-root');
    if (!root) return;

    root.innerHTML =
        childrenBackButtonHtml() +

        '<div class="section-title">' +
            '<span>Remove Child</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>' +

        '<div class="ui-card" style="margin-bottom:12px; border:2px solid var(--color-coral);">' +
            '<div style="font-weight:700; font-size:1.05rem; margin-bottom:6px;">' +
                'Remove ' + escapeHtml(child.name) + '?' +
            '</div>' +
            '<div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:14px;">' +
                'This cannot be undone.' +
            '</div>' +
            '<div style="display:flex; gap:10px;">' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-coral); ' +
                    'border-color:var(--color-coral); color:#fff;" onclick="confirmRemoveChild(\'' + child.id + '\')">Remove</button>' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" ' +
                    'onclick="renderChildrenList()">Cancel</button>' +
            '</div>' +
        '</div>';
}

function confirmRemoveChild(id) {
    var newData = [];
    for (var i = 0; i < childrenData.length; i++) {
        if (childrenData[i].id !== id) {
            newData.push(childrenData[i]);
        }
    }
    childrenData = newData;
    saveChildren(childrenData);

    var newCompletions = [];
    for (var j = 0; j < completionsData.length; j++) {
        if (completionsData[j].childId !== id) {
            newCompletions.push(completionsData[j]);
        }
    }
    completionsData = newCompletions;
    saveCompletions(completionsData);

    renderChildrenList();
    updateParentMenuChildCount();
}

/* ------------------------------------------------------------
   WEEKLY CHORE SLATE SCREEN
   ------------------------------------------------------------ */

var activeWeekStart = formatYmd(getMondayOf(new Date()));

var choreFormState = null;
var choreFormEditId = null;

function createChoreSetupScreen() {
    var existing = document.getElementById('screen-chore-setup');
    if (existing) {
        existing.innerHTML = '<div id="chore-setup-root"></div>';
        return existing;
    }

    var contentArea = document.querySelector('.app-content');
    if (!contentArea) return null;

    var screen = document.createElement('div');
    screen.id = 'screen-chore-setup';
    screen.className = 'app-screen';
    screen.innerHTML = '<div id="chore-setup-root"></div>';

    contentArea.appendChild(screen);
    return screen;
}

function ensureChoreSetupRoot() {
    var existing = document.getElementById('screen-chore-setup');
    if (!existing) return null;

    var root = document.getElementById('chore-setup-root');
    if (!root) {
        existing.innerHTML = '<div id="chore-setup-root"></div>';
        root = document.getElementById('chore-setup-root');
    }
    return root;
}

function renderChoreSetupScreen() {
    var root = ensureChoreSetupRoot();
    if (!root) return;

    var backHtml =
        '<div class="control-pill" style="display:inline-block; margin-bottom:12px; cursor:pointer;" ' +
            'onclick="goBackToParentHub()">← Back to Parent Hub</div>';

    var html = '';
    html += backHtml;

    html +=
        '<div class="section-title">' +
            '<span>Weekly Chore Slate</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>';

    var monday = parseYmd(activeWeekStart);
    var sunday = addDays(monday, 6);

    html +=
        '<div class="context-input-card" style="margin-bottom:12px;">' +
            '<label>Week of</label>' +
            '<input id="week-date-input" type="date" value="' + activeWeekStart + '" ' +
                'onchange="handleWeekDateChange(this.value)" ' +
                'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '<div style="font-size:0.8rem; color:var(--text-muted); font-weight:600; margin-top:6px;">' +
                'Week of ' + formatPrettyShort(monday) + ' – ' + formatPrettyShort(sunday) + ', ' + sunday.getFullYear() +
            '</div>' +
        '</div>';

    var entry = getWeekEntry(activeWeekStart);
    var contextValue = entry && entry.weekContext ? entry.weekContext : '';

    html +=
        '<div class="context-input-card" style="margin-bottom:16px;">' +
            '<label>What\'s happening this week?</label>' +
            '<input id="week-context-input" type="text" placeholder="e.g. Test Week, Family Vacation (optional)" ' +
                'value="' + escapeHtml(contextValue) + '" ' +
                'oninput="handleWeekContextChange(this.value)" ' +
                'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
        '</div>';
     
    var momBuckValueStr = entry && typeof entry.momBuckValue === 'string' ? entry.momBuckValue : '';

    html +=
        '<div class="context-input-card" style="margin-bottom:16px;">' +
            '<label>1 Mom Buck =</label>' +
            '<input id="week-mom-buck-value-input" type="text" ' +
                'placeholder="e.g. $1, 10 minutes of rest, one ice cream" ' +
                'value="' + escapeHtml(momBuckValueStr) + '" ' +
                'oninput="handleWeekMomBuckValueChange(this.value)" ' +
                'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
        '</div>';

    if (childrenData.length === 0) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No children yet. Please add children first in Manage Children Profiles.</p>' +
            '</div>';
        root.innerHTML = html;
        return;
    }

    if (choreFormState === 'add') {
        html += buildChoreFormHtml(null);
    } else if (choreFormState === 'edit' && choreFormEditId) {
        var editChore = getChoreFromActiveWeek(choreFormEditId);
        if (editChore) {
            html += buildChoreFormHtml(editChore);
        } else {
            choreFormState = null;
            choreFormEditId = null;
        }
    } else if (choreFormState === 'remove' && choreFormEditId) {
        var removeChore = getChoreFromActiveWeek(choreFormEditId);
        if (removeChore) {
            html += buildChoreRemoveConfirmHtml(removeChore);
        } else {
            choreFormState = null;
            choreFormEditId = null;
        }
    }

    html +=
        '<div class="section-title" style="margin-top:20px;">' +
            '<span>Chores for this week</span>' +
        '</div>';

    var chores = entry && entry.chores ? entry.chores : [];

    if (chores.length === 0) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted); margin-bottom:12px;">' +
                '<p>No chores yet for this week.</p>' +
            '</div>';
    } else {
        for (var i = 0; i < chores.length; i++) {
            var chore = chores[i];
            var assignedNames = getChildNamesForIds(chore.assignedChildren);
            var assignedLabel = assignedNames.length > 0
                ? assignedNames.join(', ')
                : 'No children assigned';

            html +=
                '<div class="setup-chore-row" style="flex-direction:column; align-items:stretch; gap:8px;">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                        '<div class="setup-chore-info">' +
                            '<font>' + escapeHtml(chore.name) + '</font>' +
                            '<span>' + chore.momBucks + ' Mom Bucks</span>' +
                        '</div>' +
                        '<div style="display:flex; gap:6px; flex-shrink:0;">' +
                            '<div class="control-pill" onclick="openEditChoreForm(\'' + chore.id + '\')">Edit</div>' +
                            '<div class="control-pill" style="background:#FC6262; color:#fff; border-color:#FC6262;" onclick="openRemoveChoreConfirm(\'' + chore.id + '\')">Remove</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">' +
                        'Assigned: ' + escapeHtml(assignedLabel) +
                    '</div>' +
                '</div>';
        }
    }

    if (choreFormState !== 'add') {
        html +=
            '<button class="btn-add-chore" onclick="openAddChoreForm()">+ Add Chore</button>';
    }

    root.innerHTML = html;
}

function handleWeekDateChange(value) {
    if (!value) return;
    var picked = parseYmd(value);
    var monday = getMondayOf(picked);
    activeWeekStart = formatYmd(monday);

    choreFormState = null;
    choreFormEditId = null;

    ensureWeekEntry(activeWeekStart);

    renderChoreSetupScreen();
}

function handleWeekContextChange(value) {
    var entry = ensureWeekEntry(activeWeekStart);
    entry.weekContext = value;
    saveWeeklyChores(weeklyChoresData);
}

function getActiveWeekChores() {
    var entry = getWeekEntry(activeWeekStart);
    if (!entry) return [];
    return entry.chores || [];
}

function getChoreFromActiveWeek(id) {
    var chores = getActiveWeekChores();
    for (var i = 0; i < chores.length; i++) {
        if (chores[i].id === id) return chores[i];
    }
    return null;
}

function openAddChoreForm() {
    choreFormState = 'add';
    choreFormEditId = null;
    renderChoreSetupScreen();
}

function openEditChoreForm(id) {
    choreFormState = 'edit';
    choreFormEditId = id;
    renderChoreSetupScreen();
}

function openRemoveChoreConfirm(id) {
    choreFormState = 'remove';
    choreFormEditId = id;
    renderChoreSetupScreen();
}

function closeChoreForm() {
    choreFormState = null;
    choreFormEditId = null;
    renderChoreSetupScreen();
}

function buildChildCheckboxList(selectedIds) {
    if (childrenData.length === 0) {
        return '<div style="font-size:0.85rem; color:var(--text-muted);">No children available.</div>';
    }

    var html = '<div class="copy-targets" style="flex-wrap:wrap;">';
    for (var i = 0; i < childrenData.length; i++) {
        var child = childrenData[i];
        var checked = '';
        if (selectedIds && selectedIds.indexOf(child.id) !== -1) {
            checked = ' checked';
        }
        html +=
            '<div class="target-checkbox">' +
                '<input type="checkbox" id="chore-child-' + child.id + '" value="' + child.id + '"' + checked + '>' +
                '<label for="chore-child-' + child.id + '">' + escapeHtml(child.name) + '</label>' +
            '</div>';
    }
    html += '</div>';
    return html;
}

function buildChoreFormHtml(chore) {
    var isEdit = !!chore;
    var title = isEdit ? 'Edit Chore' : 'Add Chore';
    var nameVal = isEdit ? chore.name : '';
    var bucksVal = isEdit ? chore.momBucks : '';
    var selectedIds = isEdit && Array.isArray(chore.assignedChildren) ? chore.assignedChildren : [];

    var saveHandler = isEdit
        ? 'saveChoreForm(\'' + chore.id + '\')'
        : 'saveChoreForm(null)';

    return (
        '<div class="ui-card" style="margin-bottom:16px;">' +
            '<div style="font-weight:700; font-size:0.95rem; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.3px;">' +
                title +
            '</div>' +

            '<div class="context-input-card" style="margin-bottom:10px;">' +
                '<label>Chore Name</label>' +
                '<input id="chore-form-name" type="text" placeholder="e.g. Make Bed" value="' + escapeHtml(nameVal) + '" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +

            '<div class="context-input-card" style="margin-bottom:10px;">' +
                '<label>Mom Bucks</label>' +
                '<input id="chore-form-bucks" type="number" min="0" step="1" placeholder="e.g. 20" value="' + (bucksVal === '' ? '' : bucksVal) + '" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +

            '<div class="copy-component" style="margin-bottom:10px;">' +
                '<p>Assign To</p>' +
                buildChildCheckboxList(selectedIds) +
            '</div>' +

            '<div id="chore-form-error" style="display:none; color:var(--color-coral); font-size:0.8rem; ' +
                'font-weight:600; margin-bottom:10px;"></div>' +

            '<div style="display:flex; gap:10px;">' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-blue); ' +
                    'border-color:var(--color-blue); color:#fff;" onclick="' + saveHandler + '">Save</button>' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" ' +
                    'onclick="closeChoreForm()">Cancel</button>' +
            '</div>' +
        '</div>'
    );
}

function buildChoreRemoveConfirmHtml(chore) {
    return (
        '<div class="ui-card" style="margin-bottom:16px; border:2px solid var(--color-coral);">' +
            '<div style="font-weight:700; font-size:1.05rem; margin-bottom:6px;">' +
                'Remove this chore?' +
            '</div>' +
            '<div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:6px;">' +
                escapeHtml(chore.name) + ' · ' + chore.momBucks + ' Mom Bucks' +
            '</div>' +
            '<div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:14px;">' +
                'This cannot be undone.' +
            '</div>' +
            '<div style="display:flex; gap:10px;">' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-coral); ' +
                    'border-color:var(--color-coral); color:#fff;" onclick="confirmRemoveChore(\'' + chore.id + '\')">Remove</button>' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" ' +
                    'onclick="closeChoreForm()">Cancel</button>' +
            '</div>' +
        '</div>'
    );
}

function readSelectedChildIds() {
    var ids = [];
    for (var i = 0; i < childrenData.length; i++) {
        var cb = document.getElementById('chore-child-' + childrenData[i].id);
        if (cb && cb.checked) {
            ids.push(childrenData[i].id);
        }
    }
    return ids;
}

function saveChoreForm(editId) {
    var nameInput = document.getElementById('chore-form-name');
    var bucksInput = document.getElementById('chore-form-bucks');

    var name = nameInput ? nameInput.value.trim() : '';
    var bucksRaw = bucksInput ? bucksInput.value.trim() : '';

    if (name === '') {
        showFormError('chore-form-error', 'Chore name cannot be blank.');
        return;
    }

    if (bucksRaw === '') {
        showFormError('chore-form-error', 'Mom Bucks is required.');
        return;
    }

    var bucks = Number(bucksRaw);
    if (isNaN(bucks) || !isFinite(bucks) || bucks < 0) {
        showFormError('chore-form-error', 'Mom Bucks must be a valid number 0 or greater.');
        return;
    }
    bucks = Math.floor(bucks);

    var assigned = readSelectedChildIds();
    if (assigned.length === 0) {
        showFormError('chore-form-error', 'Please assign this chore to at least one child.');
        return;
    }

    var entry = ensureWeekEntry(activeWeekStart);

    if (editId) {
        var chore = null;
        for (var i = 0; i < entry.chores.length; i++) {
            if (entry.chores[i].id === editId) {
                chore = entry.chores[i];
                break;
            }
        }
        if (!chore) {
            showFormError('chore-form-error', 'Chore not found.');
            return;
        }
        chore.name = name;
        chore.momBucks = bucks;
        chore.assignedChildren = assigned;
    } else {
        entry.chores.push({
            id: generateChoreId(),
            name: name,
            momBucks: bucks,
            assignedChildren: assigned
        });
    }

    saveWeeklyChores(weeklyChoresData);

    choreFormState = null;
    choreFormEditId = null;
    renderChoreSetupScreen();
}

function confirmRemoveChore(id) {
    var entry = getWeekEntry(activeWeekStart);
    if (!entry) return;

    var newChores = [];
    for (var i = 0; i < entry.chores.length; i++) {
        if (entry.chores[i].id !== id) {
            newChores.push(entry.chores[i]);
        }
    }
    entry.chores = newChores;
    saveWeeklyChores(weeklyChoresData);

    var newCompletions = [];
    for (var j = 0; j < completionsData.length; j++) {
        var c = completionsData[j];
        if (!(c.choreId === id && c.weekStart === activeWeekStart)) {
            newCompletions.push(c);
        }
    }
    completionsData = newCompletions;
    saveCompletions(completionsData);

    choreFormState = null;
    choreFormEditId = null;
    renderChoreSetupScreen();
}

/* ------------------------------------------------------------
   CHILD HOME
   ------------------------------------------------------------ */

var activeChildId = null;

function getActiveChild() {
    if (activeChildId) {
        var c = getChildById(activeChildId);
        if (c) return c;
    }
    if (childrenData.length > 0) {
        activeChildId = childrenData[0].id;
        return childrenData[0];
    }
    return null;
}

function renderChildHome() {
    var existing = document.getElementById('screen-child-home');
    if (!existing) return;

    var child = getActiveChild();

    var html = '';
   /* Weekly info read-only display, sourced from the current week's
   Weekly Chore Slate entry. No inputs, no new state. */
    var weekEntry = getWeekEntry(activeWeekStart);
    var weekContextText = weekEntry && weekEntry.weekContext ? weekEntry.weekContext : '';

    html +=
        '<div class="context-input-card" style="margin-bottom:12px;">' +
            '<label>Week of</label>' +
            '<div style="font-size:0.95rem; font-weight:600; color:var(--text-primary);">' +
                escapeHtml(formatWeekLabel(activeWeekStart)) +
            '</div>' +
        '</div>';

    if (weekContextText) {
        html +=
            '<div class="context-input-card" style="margin-bottom:12px;">' +
                '<label>What\'s Happening This Week</label>' +
                '<div style="font-size:0.95rem; font-weight:600; color:var(--text-primary);">' +
                    escapeHtml(weekContextText) +
                '</div>' +
            '</div>';
    }

    if (childrenData.length > 1) {
        html +=
            '<div class="context-input-card" style="margin-bottom:12px;">' +
                '<label>Viewing as</label>' +
                '<select id="child-home-picker" onchange="handleChildHomePickerChange(this.value)" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;">';
        for (var i = 0; i < childrenData.length; i++) {
            var c = childrenData[i];
            var sel = (child && c.id === child.id) ? ' selected' : '';
            html += '<option value="' + c.id + '"' + sel + '>' + escapeHtml(c.name) + '</option>';
        }
        html +=
                '</select>' +
            '</div>';
    }

    if (!child) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No children yet. Ask a parent to add a child profile.</p>' +
            '</div>';
        existing.innerHTML = html;
        return;
    }

    html +=
        '<div class="ui-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
            '<div style="display:flex; align-items:center; gap:12px;">' +
                '<div class="avatar-circle" style="background-color: var(--color-blue); flex-shrink:0;">' +
                    escapeHtml(child.avatar) +
                '</div>' +
                '<div>' +
                    '<div style="font-weight:700; font-size:1rem; text-transform:uppercase; letter-spacing:0.3px;">' +
                        escapeHtml(child.name) +
                    '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); font-weight:500;">' +
                        'Mom Bucks Balance' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div style="font-weight:700; font-size:1.2rem;">' + child.momBucks + '</div>' +
        '</div>';

    html +=
        '<div class="section-title">' +
            '<span>Today\'s Plan</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>';

    var entry = getWeekEntry(activeWeekStart);
    var chores = entry && entry.chores ? entry.chores : [];

    var assigned = [];
    for (var k = 0; k < chores.length; k++) {
        if (Array.isArray(chores[k].assignedChildren) &&
            chores[k].assignedChildren.indexOf(child.id) !== -1) {
            assigned.push(chores[k]);
        }
    }

    if (assigned.length === 0) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No chores assigned for this week.</p>' +
            '</div>';
        existing.innerHTML = html;
        return;
    }

    /* Completions are now keyed by day, so this lookup only matches
       today's completion for each chore. Yesterday's confirmed row
       does not hide today's row. */
    var today = todayYmd();

    for (var m = 0; m < assigned.length; m++) {
        var chore = assigned[m];
        var completion = getCompletion(chore.id, child.id, today);

        var statusClass = '';
        var checkboxContent = '';
        var statusPill = '';
        var toggleHandler = '';

        if (completion && completion.status === 'confirmed') {
            statusClass = 'state-confirmed';
            checkboxContent = '✓';
            statusPill = '<span class="status-pill confirmed">Confirmed</span>';
            toggleHandler = '';
        } else if (completion && completion.status === 'pending') {
            statusClass = 'state-waiting';
            checkboxContent = '•••';
            statusPill = '<span class="status-pill waiting">Waiting for Mom</span>';
            toggleHandler = 'onclick="uncheckChore(\'' + chore.id + '\')"';
        } else {
            statusClass = '';
            checkboxContent = '';
            statusPill = '';
            toggleHandler = 'onclick="checkChore(\'' + chore.id + '\')"';
        }

        html +=
            '<div class="chore-item ' + statusClass + '">' +
                '<div class="chore-details">' +
                    '<h3>' + escapeHtml(chore.name) + '</h3>' +
                    '<p>This week · ' + chore.momBucks + ' Mom Bucks</p>' +
                    statusPill +
                '</div>' +
                '<div class="chore-checkbox" ' + toggleHandler + '>' + checkboxContent + '</div>' +
            '</div>';
    }

    existing.innerHTML = html;
}

function handleChildHomePickerChange(childId) {
    activeChildId = childId;
    renderChildHome();
}

function checkChore(choreId) {
    var child = getActiveChild();
    if (!child) return;

    var entry = getWeekEntry(activeWeekStart);
    if (!entry) return;

    var chore = null;
    for (var i = 0; i < entry.chores.length; i++) {
        if (entry.chores[i].id === choreId) {
            chore = entry.chores[i];
            break;
        }
    }
    if (!chore) return;

    /* Reject double-completion for the same chore on the same day.
       (Unchecking only removes a pending row for today, so a confirmed
       row for today remains and this guard still prevents re-award.) */
    var today = todayYmd();
    var existing = getCompletion(choreId, child.id, today);
    if (existing) {
        return;
    }

    completionsData.push({
        id: generateCompletionId(),
        choreId: choreId,
        childId: child.id,
        weekStart: activeWeekStart,
        date: today,
        status: 'pending',
        momBucks: chore.momBucks
    });
    saveCompletions(completionsData);

    renderChildHome();
}

function uncheckChore(choreId) {
    var child = getActiveChild();
    if (!child) return;

    /* Only remove today's pending completion. Older confirmed rows
       remain in history and cannot be undone. */
    var today = todayYmd();
    var newCompletions = [];
    for (var i = 0; i < completionsData.length; i++) {
        var c = completionsData[i];
        var match = (c.choreId === choreId && c.childId === child.id && c.date === today);
        if (match && c.status === 'pending') {
            continue;
        }
        newCompletions.push(c);
    }
    completionsData = newCompletions;
    saveCompletions(completionsData);

    renderChildHome();
}

/* ------------------------------------------------------------
   CONFIRM COMPLETED CHORES
   ------------------------------------------------------------ */

function createConfirmChoresScreen() {
    var contentArea = document.querySelector('.app-content');
    if (!contentArea) return null;

    var screen = document.createElement('div');
    screen.id = 'screen-confirm-chores';
    screen.className = 'app-screen';
    screen.innerHTML = '<div id="confirm-chores-root"></div>';

    contentArea.appendChild(screen);
    return screen;
}

function renderConfirmChoresScreen() {
    var root = document.getElementById('confirm-chores-root');
    if (!root) return;

    var html = '';

    html += childrenBackButtonHtml();

    html +=
        '<div class="section-title">' +
            '<span>Confirm Completed Chores</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>';

    var pending = [];
    for (var i = 0; i < completionsData.length; i++) {
        if (completionsData[i].status === 'pending') {
            pending.push(completionsData[i]);
        }
    }

    if (pending.length === 0) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No chores are waiting for confirmation.</p>' +
            '</div>';
        root.innerHTML = html;
        return;
    }

    /* Sort by completion date (day), newest first, tiebroken by week start. */
    pending.sort(function (a, b) {
        var ad = a.date || a.weekStart || '';
        var bd = b.date || b.weekStart || '';
        if (ad > bd) return -1;
        if (ad < bd) return 1;
        if (a.weekStart < b.weekStart) return -1;
        if (a.weekStart > b.weekStart) return 1;
        return 0;
    });

    for (var j = 0; j < pending.length; j++) {
        var comp = pending[j];
        var child = getChildById(comp.childId);
        var weekEntry = getWeekEntry(comp.weekStart);

        var choreName = '(chore no longer exists)';
        if (weekEntry && Array.isArray(weekEntry.chores)) {
            for (var k = 0; k < weekEntry.chores.length; k++) {
                if (weekEntry.chores[k].id === comp.choreId) {
                    choreName = weekEntry.chores[k].name;
                    break;
                }
            }
        }

        var childName = child ? child.name : '(child no longer exists)';
        var childAvatar = child ? child.avatar : '?';
        var dayLabel = comp.date ? formatPrettyDateShort(comp.date) : '';

        html +=
            '<div class="ui-card" style="margin-bottom:12px;">' +
                '<div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">' +
                    '<div class="avatar-circle" style="background-color: var(--color-blue); flex-shrink:0;">' +
                        escapeHtml(childAvatar) +
                    '</div>' +
                    '<div style="flex:1; min-width:0;">' +
                        '<div style="font-weight:700; font-size:1rem; text-transform:uppercase; letter-spacing:0.3px;">' +
                            escapeHtml(childName) +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div style="margin-bottom:8px;">' +
                    '<div style="font-weight:700; font-size:0.95rem;">' +
                        escapeHtml(choreName) +
                    '</div>' +
                    '<div style="font-size:0.9rem; font-weight:700; color:var(--color-green); margin-top:2px;">' +
                        comp.momBucks + ' Mom Bucks' +
                    '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); font-weight:600; margin-top:4px;">' +
                        (dayLabel ? escapeHtml(dayLabel) + ' · ' : '') +
                        escapeHtml(formatWeekLabel(comp.weekStart)) +
                    '</div>' +
                '</div>' +
                '<div style="display:flex; gap:10px;">' +
                    '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-green); ' +
                        'border-color:var(--color-green); color:#fff;" onclick="confirmCompletion(\'' + comp.id + '\')">Confirm</button>' +
                '</div>' +
            '</div>';
    }

    root.innerHTML = html;
}

function confirmCompletion(completionId) {
    var comp = getCompletionById(completionId);
    if (!comp) return;

    /* Guard: once confirmed, never award twice. */
    if (comp.status === 'confirmed') return;

    var child = getChildById(comp.childId);
    if (!child) {
        comp.status = 'confirmed';
        saveCompletions(completionsData);
        renderConfirmChoresScreen();
        return;
    }

    child.momBucks = (child.momBucks || 0) + comp.momBucks;
    saveChildren(childrenData);

    comp.status = 'confirmed';
    saveCompletions(completionsData);

    if (!findLedgerByCompletion(comp.id)) {
        var description = 'Chore';
        var weekEntry = getWeekEntry(comp.weekStart);
        if (weekEntry && Array.isArray(weekEntry.chores)) {
            for (var i = 0; i < weekEntry.chores.length; i++) {
                if (weekEntry.chores[i].id === comp.choreId) {
                    description = weekEntry.chores[i].name;
                    break;
                }
            }
        }

        ledgerData.push({
            id: generateLedgerId(),
            childId: comp.childId,
            type: 'earned',
            amount: comp.momBucks,
            description: description,
            choreId: comp.choreId,
            weekStart: comp.weekStart,
            date: comp.date || formatYmd(new Date()),
            completionId: comp.id
        });
        saveLedger(ledgerData);
    }

    renderConfirmChoresScreen();
}

/* ------------------------------------------------------------
   RECORD SPENDING LEDGER
   ------------------------------------------------------------ */

var spendingViewChildId = null;
var spendingFormState = null;
var spendingFormRemoveId = null;

function createSpendingLedgerScreen() {
    var contentArea = document.querySelector('.app-content');
    if (!contentArea) return null;

    var screen = document.createElement('div');
    screen.id = 'screen-spending-ledger';
    screen.className = 'app-screen';
    screen.innerHTML = '<div id="spending-ledger-root"></div>';

    contentArea.appendChild(screen);
    return screen;
}

function getSpendingViewChild() {
    if (spendingViewChildId) {
        var c = getChildById(spendingViewChildId);
        if (c) return c;
    }
    if (childrenData.length > 0) {
        spendingViewChildId = childrenData[0].id;
        return childrenData[0];
    }
    return null;
}

function renderSpendingLedgerScreen() {
    var root = document.getElementById('spending-ledger-root');
    if (!root) return;

    var child = getSpendingViewChild();

    var html = '';

    html += childrenBackButtonHtml();

    html +=
        '<div class="section-title">' +
            '<span>Record Spending Ledger</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>';

    if (childrenData.length === 0) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No children yet. Please add children first in Manage Children Profiles.</p>' +
            '</div>';
        root.innerHTML = html;
        return;
    }

    if (childrenData.length > 1) {
        html +=
            '<div class="context-input-card" style="margin-bottom:12px;">' +
                '<label>Child</label>' +
                '<select id="spending-child-picker" onchange="handleSpendingChildChange(this.value)" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;">';
        for (var i = 0; i < childrenData.length; i++) {
            var c = childrenData[i];
            var sel = (child && c.id === child.id) ? ' selected' : '';
            html += '<option value="' + c.id + '"' + sel + '>' + escapeHtml(c.name) + '</option>';
        }
        html +=
                '</select>' +
            '</div>';
    }

    if (!child) {
        root.innerHTML = html;
        return;
    }

    html +=
        '<div class="ui-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">' +
            '<div style="display:flex; align-items:center; gap:12px;">' +
                '<div class="avatar-circle" style="background-color: var(--color-blue); flex-shrink:0;">' +
                    escapeHtml(child.avatar) +
                '</div>' +
                '<div>' +
                    '<div style="font-weight:700; font-size:1rem; text-transform:uppercase; letter-spacing:0.3px;">' +
                        escapeHtml(child.name) +
                    '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); font-weight:500;">' +
                        'Current Balance' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div style="font-weight:700; font-size:1.4rem;">' + child.momBucks + '</div>' +
        '</div>';

    if (spendingFormState === 'remove' && spendingFormRemoveId) {
        var txToRemove = null;
        for (var t = 0; t < ledgerData.length; t++) {
            if (ledgerData[t].id === spendingFormRemoveId) {
                txToRemove = ledgerData[t];
                break;
            }
        }

        if (txToRemove) {
            var isEarnedRemove = txToRemove.type === 'earned';
            var signRemove = isEarnedRemove ? '+' : '-';

            html +=
                '<div class="ui-card" style="margin-bottom:16px; border:2px solid var(--color-coral);">' +
                    '<div style="font-weight:700; font-size:1.05rem; margin-bottom:6px;">' +
                        'Remove this transaction?' +
                    '</div>' +
                    '<div style="font-size:0.9rem; color:var(--text-muted); margin-bottom:6px;">' +
                        escapeHtml(txToRemove.description) + ' · ' + signRemove + txToRemove.amount + ' Mom Bucks' +
                    '</div>' +
                    '<div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:14px;">' +
                        'This cannot be undone.' +
                    '</div>' +
                    '<div style="display:flex; gap:10px;">' +
                        '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-coral); ' +
                            'border-color:var(--color-coral); color:#fff;" onclick="confirmRemoveSpending(\'' + txToRemove.id + '\')">Remove</button>' +
                        '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" ' +
                            'onclick="closeSpendingRemove()">Cancel</button>' +
                    '</div>' +
                '</div>';
        } else {
            spendingFormState = null;
            spendingFormRemoveId = null;
        }
    }

    if (spendingFormState !== 'remove') {
        html +=
            '<div class="ui-card" style="margin-bottom:16px;">' +
                '<div style="font-weight:700; font-size:0.95rem; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.3px;">' +
                    'Record a Purchase' +
                '</div>' +

                '<div class="context-input-card" style="margin-bottom:10px;">' +
                    '<label>What was it for?</label>' +
                    '<input id="spending-form-description" type="text" placeholder="e.g. Movie Night Treat" ' +
                        'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                        'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
                '</div>' +

                '<div class="context-input-card" style="margin-bottom:10px;">' +
                    '<label>Mom Bucks Spent</label>' +
                    '<input id="spending-form-amount" type="number" min="0" step="1" placeholder="e.g. 50" ' +
                        'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                        'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
                '</div>' +

                '<div id="spending-form-error" style="display:none; color:var(--color-coral); font-size:0.8rem; ' +
                    'font-weight:600; margin-bottom:10px;"></div>' +

                '<button class="btn-add-chore" style="margin-top:0; width:100%; background:var(--color-blue); ' +
                    'border-color:var(--color-blue); color:#fff;" onclick="saveSpending()">Record Spending</button>' +
            '</div>';
    }

    html +=
        '<div class="section-title" style="margin-top:20px;">' +
            '<span>Transaction History</span>' +
        '</div>';

    var entries = getLedgerForChild(child.id);

    if (entries.length === 0) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No transactions yet for this child.</p>' +
            '</div>';
        root.innerHTML = html;
        return;
    }

    html += '<div class="ui-card"><div class="ledger-list">';
    for (var k = 0; k < entries.length; k++) {
        var tx = entries[k];
        var isEarned = tx.type === 'earned';
        var amountClass = isEarned ? 'plus' : 'minus';
        var amountPrefix = isEarned ? '+' : '-';

        html +=
            '<div class="ledger-row">' +
                '<div class="ledger-info">' +
                    '<p>' + escapeHtml(tx.description) + '</p>' +
                    '<span>' + escapeHtml(formatPrettyDateShort(tx.date)) + '</span>' +
                '</div>' +
                '<div style="display:flex; align-items:center; gap:10px;">' +
                    '<div class="ledger-amount ' + amountClass + '">' +
                        amountPrefix + tx.amount +
                    '</div>' +
                    '<div class="control-pill" style="background:#FC6262; color:#fff; border-color:#FC6262;" ' +
                        'onclick="openSpendingRemove(\'' + tx.id + '\')">Remove</div>' +
                '</div>' +
            '</div>';
    }
    html += '</div></div>';

    root.innerHTML = html;
}

function handleSpendingChildChange(childId) {
    spendingViewChildId = childId;
    spendingFormState = null;
    spendingFormRemoveId = null;
    renderSpendingLedgerScreen();
}

function saveSpending() {
    var child = getSpendingViewChild();
    if (!child) return;

    var descInput = document.getElementById('spending-form-description');
    var amountInput = document.getElementById('spending-form-amount');

    var description = descInput ? descInput.value.trim() : '';
    var amountRaw = amountInput ? amountInput.value.trim() : '';

    if (description === '') {
        showFormError('spending-form-error', 'Description cannot be blank.');
        return;
    }

    if (amountRaw === '') {
        showFormError('spending-form-error', 'Amount is required.');
        return;
    }

    var amount = Number(amountRaw);
    if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
        showFormError('spending-form-error', 'Amount must be a valid number greater than 0.');
        return;
    }
    amount = Math.floor(amount);

    if (amount > (child.momBucks || 0)) {
        showFormError('spending-form-error', 'Not enough Mom Bucks. Balance: ' + child.momBucks + '.');
        return;
    }

    child.momBucks = (child.momBucks || 0) - amount;
    saveChildren(childrenData);

    ledgerData.push({
        id: generateLedgerId(),
        childId: child.id,
        type: 'spent',
        amount: amount,
        description: description,
        choreId: null,
        weekStart: null,
        date: formatYmd(new Date()),
        completionId: null
    });
    saveLedger(ledgerData);

    renderSpendingLedgerScreen();
}

function openSpendingRemove(id) {
    spendingFormState = 'remove';
    spendingFormRemoveId = id;
    renderSpendingLedgerScreen();
}

function closeSpendingRemove() {
    spendingFormState = null;
    spendingFormRemoveId = null;
    renderSpendingLedgerScreen();
}

function confirmRemoveSpending(id) {
    var tx = null;
    for (var i = 0; i < ledgerData.length; i++) {
        if (ledgerData[i].id === id) {
            tx = ledgerData[i];
            break;
        }
    }
    if (!tx) {
        spendingFormState = null;
        spendingFormRemoveId = null;
        renderSpendingLedgerScreen();
        return;
    }

    if (tx.type === 'spent') {
        var child = getChildById(tx.childId);
        if (child) {
            child.momBucks = (child.momBucks || 0) + tx.amount;
            saveChildren(childrenData);
        }
    } else if (tx.type === 'earned') {
        var childE = getChildById(tx.childId);
        if (childE) {
            childE.momBucks = (childE.momBucks || 0) - tx.amount;
            saveChildren(childrenData);
        }
    }

    var newLedger = [];
    for (var j = 0; j < ledgerData.length; j++) {
        if (ledgerData[j].id !== id) {
            newLedger.push(ledgerData[j]);
        }
    }
    ledgerData = newLedger;
    saveLedger(ledgerData);

    spendingFormState = null;
    spendingFormRemoveId = null;
    renderSpendingLedgerScreen();
}

/* ------------------------------------------------------------
   MODIFY SECURITY PIN
   ------------------------------------------------------------ */

var modifyPinMessage = null;

function createModifyPinScreen() {
    var contentArea = document.querySelector('.app-content');
    if (!contentArea) return null;

    var screen = document.createElement('div');
    screen.id = 'screen-modify-pin';
    screen.className = 'app-screen';
    screen.innerHTML = '<div id="modify-pin-root"></div>';

    contentArea.appendChild(screen);
    return screen;
}

function renderModifyPinScreen() {
    var root = document.getElementById('modify-pin-root');
    if (!root) return;

    var html = '';

    html += childrenBackButtonHtml();

    html +=
        '<div class="section-title">' +
            '<span>Modify Security PIN</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>';

    if (modifyPinMessage) {
        var bannerColor = modifyPinMessage.type === 'success'
            ? 'var(--color-green)'
            : 'var(--color-coral)';
        var bannerBorder = modifyPinMessage.type === 'success'
            ? 'var(--color-green)'
            : 'var(--color-coral)';

        html +=
            '<div class="ui-card" style="margin-bottom:16px; border:2px solid ' + bannerBorder + '; ' +
                'color:' + bannerColor + '; font-weight:700; text-align:center;">' +
                escapeHtml(modifyPinMessage.text) +
            '</div>';
    }

    html +=
        '<div class="ui-card" style="margin-bottom:16px;">' +

            '<div class="context-input-card" style="margin-bottom:10px;">' +
                '<label>Current PIN</label>' +
                '<input id="pin-form-current" type="password" inputmode="numeric" maxlength="' + PIN_MAX_LENGTH + '" ' +
                    'placeholder="Enter current PIN" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +

            '<div class="context-input-card" style="margin-bottom:10px;">' +
                '<label>New PIN</label>' +
                '<input id="pin-form-new" type="password" inputmode="numeric" maxlength="' + PIN_MAX_LENGTH + '" ' +
                    'placeholder="' + PIN_MIN_LENGTH + '–' + PIN_MAX_LENGTH + ' digits" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +

            '<div class="context-input-card" style="margin-bottom:10px;">' +
                '<label>Confirm New PIN</label>' +
                '<input id="pin-form-confirm" type="password" inputmode="numeric" maxlength="' + PIN_MAX_LENGTH + '" ' +
                    'placeholder="Re-enter new PIN" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +

            '<div id="pin-form-error" style="display:none; color:var(--color-coral); font-size:0.8rem; ' +
                'font-weight:600; margin-bottom:10px;"></div>' +

            '<button class="btn-add-chore" style="margin-top:0; width:100%; background:var(--color-blue); ' +
                'border-color:var(--color-blue); color:#fff;" onclick="savePin()">Save PIN</button>' +

        '</div>';

    root.innerHTML = html;
}

function savePin() {
    var currentInput = document.getElementById('pin-form-current');
    var newInput = document.getElementById('pin-form-new');
    var confirmInput = document.getElementById('pin-form-confirm');

    var current = currentInput ? currentInput.value.trim() : '';
    var newPin = newInput ? newInput.value.trim() : '';
    var confirmPin = confirmInput ? confirmInput.value.trim() : '';

    modifyPinMessage = null;

    if (current === '' || newPin === '' || confirmPin === '') {
        showFormError('pin-form-error', 'All fields are required.');
        return;
    }

    if (!/^\d+$/.test(current) || !/^\d+$/.test(newPin) || !/^\d+$/.test(confirmPin)) {
        showFormError('pin-form-error', 'PIN must contain only digits.');
        return;
    }

    if (current !== parentPin) {
        showFormError('pin-form-error', 'Current PIN is incorrect.');
        return;
    }

    if (newPin.length < PIN_MIN_LENGTH || newPin.length > PIN_MAX_LENGTH) {
        showFormError('pin-form-error', 'New PIN must be ' + PIN_MIN_LENGTH + '–' + PIN_MAX_LENGTH + ' digits.');
        return;
    }

    if (newPin !== confirmPin) {
        showFormError('pin-form-error', 'New PIN and confirmation do not match.');
        return;
    }

    if (newPin === current) {
        showFormError('pin-form-error', 'New PIN must be different from current PIN.');
        return;
    }

    parentPin = newPin;
    saveParentPin(parentPin);

    modifyPinMessage = { type: 'success', text: 'PIN updated successfully.' };
    renderModifyPinScreen();
}

/* ------------------------------------------------------------
   REWARDS LEDGER
   ------------------------------------------------------------ */

var rewardsViewChildId = null;

function getRewardsViewChild() {
    if (rewardsViewChildId) {
        var c = getChildById(rewardsViewChildId);
        if (c) return c;
    }
    if (childrenData.length > 0) {
        rewardsViewChildId = childrenData[0].id;
        return childrenData[0];
    }
    return null;
}

function renderRewardsLedger() {
    var screen = document.getElementById('screen-rewards');
    if (!screen) return;

    var child = getRewardsViewChild();

    var html = '';

    if (childrenData.length > 1) {
        html +=
            '<div class="context-input-card" style="margin-bottom:12px;">' +
                '<label>Child</label>' +
                '<select id="rewards-child-picker" onchange="handleRewardsChildChange(this.value)" ' +
                    'style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; ' +
                    'font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;">';
        for (var i = 0; i < childrenData.length; i++) {
            var c = childrenData[i];
            var sel = (child && c.id === child.id) ? ' selected' : '';
            html += '<option value="' + c.id + '"' + sel + '>' + escapeHtml(c.name) + '</option>';
        }
        html +=
                '</select>' +
            '</div>';
    }

    if (!child) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No children yet. Ask a parent to add a child profile.</p>' +
            '</div>';
        screen.innerHTML = html;
        return;
    }

    html +=
        '<div class="section-title">' +
            '<span>Mom Bucks Balance</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>';

    html +=
        '<div class="ui-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">' +
            '<div style="display:flex; align-items:center; gap:12px;">' +
                '<div class="avatar-circle" style="background-color: var(--color-blue); flex-shrink:0;">' +
                    escapeHtml(child.avatar) +
                '</div>' +
                '<div>' +
                    '<div style="font-weight:700; font-size:1rem; text-transform:uppercase; letter-spacing:0.3px;">' +
                        escapeHtml(child.name) +
                    '</div>' +
                    '<div style="font-size:0.8rem; color:var(--text-muted); font-weight:500;">' +
                        'Current Balance' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div style="font-weight:700; font-size:1.4rem;">' + child.momBucks + '</div>' +
        '</div>';

    html +=
        '<div class="section-title">' +
            '<span>Mom Bucks History</span>' +
        '</div>';

    var entries = getLedgerForChild(child.id);

    if (entries.length === 0) {
        html +=
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No Mom Bucks earned yet.</p>' +
            '</div>';
        screen.innerHTML = html;
        return;
    }

    html += '<div class="ui-card"><div class="ledger-list">';
    for (var k = 0; k < entries.length; k++) {
        var tx = entries[k];
        var isEarned = tx.type === 'earned';
        var amountClass = isEarned ? 'plus' : 'minus';
        var amountPrefix = isEarned ? '+' : '-';

        html +=
            '<div class="ledger-row">' +
                '<div class="ledger-info">' +
                    '<p>' + escapeHtml(tx.description) + '</p>' +
                    '<span>' + escapeHtml(formatPrettyDateShort(tx.date)) + '</span>' +
                '</div>' +
                '<div class="ledger-amount ' + amountClass + '">' +
                    amountPrefix + tx.amount +
                '</div>' +
            '</div>';
    }
    html += '</div></div>';

    screen.innerHTML = html;
}

function handleRewardsChildChange(childId) {
    rewardsViewChildId = childId;
    renderRewardsLedger();
}

/* ------------------------------------------------------------
   SHARED ERROR DISPLAY
   ------------------------------------------------------------ */

function showFormError(elementId, message) {
    var err = document.getElementById(elementId);
    if (err) {
        err.textContent = message;
        err.style.display = 'block';
    }
}

/* ------------------------------------------------------------
   PARENT MENU — UPDATE CHILD COUNT LABEL
   ------------------------------------------------------------ */

function updateParentMenuChildCount() {
    var menuItems = document.querySelectorAll('.parent-menu-item');
    for (var i = 0; i < menuItems.length; i++) {
        var label = menuItems[i].querySelector('div');
        if (label && label.textContent.indexOf('Manage Children Profiles') !== -1) {
            var span = menuItems[i].querySelector('span');
            if (span) {
                span.textContent = childrenData.length + ' Active Account' + (childrenData.length !== 1 ? 's' : '') + ' ➔';
            }
        }
    }
}

/* ------------------------------------------------------------
   UTILITY
   ------------------------------------------------------------ */

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}

/* ------------------------------------------------------------
   INITIALISE ON DOM READY
   ------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', function () {

    childrenData = loadChildren();
    weeklyChoresData = loadWeeklyChores();
    completionsData = loadCompletions();
    ledgerData = loadLedger();
    parentPin = loadParentPin();
    calendarEvents = loadCalendarEvents();

    parentUnlocked = false;
    pinGateError = null;

    var now = new Date();
    calendarViewYear = now.getFullYear();
    calendarViewMonth = now.getMonth();

    updateParentMenuChildCount();

    var menuItems = document.querySelectorAll('.parent-menu-item');
    for (var i = 0; i < menuItems.length; i++) {
        var label = menuItems[i].querySelector('div');
        if (!label) continue;

        if (label.textContent.indexOf('Manage Children Profiles') !== -1) {
            menuItems[i].onclick = function () {
                switchView('children', null);
            };
            menuItems[i].style.cursor = 'pointer';
        }

        if (label.textContent.indexOf('Weekly Chores') !== -1 ||
            label.textContent.indexOf('Chore Setup') !== -1 ||
            label.textContent.indexOf('Weekly Chores Config') !== -1) {
            menuItems[i].onclick = function () {
                switchView('chore-setup', null);
            };
            menuItems[i].style.cursor = 'pointer';
        }

        if (label.textContent.indexOf('Confirm Completed Chores') !== -1) {
            menuItems[i].onclick = function () {
                switchView('confirm-chores', null);
            };
            menuItems[i].style.cursor = 'pointer';
        }

        if (label.textContent.indexOf('Record Spending Ledger') !== -1) {
            menuItems[i].onclick = function () {
                switchView('spending-ledger', null);
            };
            menuItems[i].style.cursor = 'pointer';
        }

        if (label.textContent.indexOf('Modify Security PIN') !== -1) {
            menuItems[i].onclick = function () {
                modifyPinMessage = null;
                switchView('modify-pin', null);
            };
            menuItems[i].style.cursor = 'pointer';
        }

        if (label.textContent.indexOf('Backup & Restore') !== -1) {
            menuItems[i].onclick = function () {
                backupRestoreState.mode = null;
                backupRestoreState.pendingPayload = null;
                backupRestoreState.message = null;
                switchView('backup-restore', null);
            };
            menuItems[i].style.cursor = 'pointer';
        }
    }

    renderParentPinScreen();
    renderChildHome();
    renderRewardsLedger();
    renderCalendarScreen();
});
/* ------------------------------------------------------------
   PWA — register the service worker
   ------------------------------------------------------------ */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js').catch(function () {
            /* Registration failure is silently ignored. */
        });
    });
}
