/* ============================================================
   APP.JS — Chore & Reward App
   Features implemented:
     - Parent Hub → Children management
     - Parent Hub → Weekly Chores Setup (per-week slate)
     - In-page Back navigation for Parent Hub & Children
   ============================================================ */

var CHILDREN_STORAGE_KEY = 'children';
var WEEKLY_CHORES_STORAGE_KEY = 'weeklyChores';

/* ------------------------------------------------------------
   CHILDREN DATA LAYER
   ------------------------------------------------------------ */

function generateId() {
    return 'child_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateChoreId() {
    return 'chore_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
   Structure:
   [
     {
       weekStart: "YYYY-MM-DD",
       weekContext: "string",
       chores: [ { id, name, momBucks, assignedChildren: [] } ]
     },
     ...
   ]
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
        entry = { weekStart: weekStart, weekContext: '', chores: [] };
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

/* ------------------------------------------------------------
   EXISTING PROTOTYPE: VIEW SWITCHING
   ------------------------------------------------------------ */

function switchView(viewName, btnElement) {
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
    } else if (viewName === 'parent-area') {
        renderParentHubBackButton();
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
        'chore-setup': 'nav-parent'
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
   EXISTING PROTOTYPE: PARENT PIN BYPASS
   ------------------------------------------------------------ */

function demoBypassPIN() {
    switchView('parent-area', document.querySelectorAll('.btn-proto')[4]);
}

/* ------------------------------------------------------------
   BACK BUTTON HELPERS (in-page, use switchView)
   ------------------------------------------------------------ */

function goBackToParentHub() {
    switchView('parent-area', document.querySelectorAll('.btn-proto')[4]);
}

function goBackToParentPin() {
    switchView('parent-pin', document.querySelectorAll('.btn-proto')[3]);
}

/* ------------------------------------------------------------
   PARENT HUB — INJECT IN-PAGE BACK BUTTON
   ------------------------------------------------------------ */

function renderParentHubBackButton() {
    var parentScreen = document.getElementById('screen-parent-area');
    if (!parentScreen) return;

    if (document.getElementById('parent-hub-back-btn')) return;

    var backBtn = document.createElement('div');
    backBtn.id = 'parent-hub-back-btn';
    backBtn.className = 'control-pill';
    backBtn.style.cssText = 'display:inline-block; margin-bottom:12px; cursor:pointer;';
    backBtn.textContent = '← Back';
    backBtn.onclick = function () {
        goBackToParentPin();
    };

    parentScreen.insertBefore(backBtn, parentScreen.firstChild);
}

/* ------------------------------------------------------------
   CHILDREN SCREEN — SINGLE CONTAINER, MULTIPLE STATES
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

/* ------------------------------------------------------------
   WEEK SELECTION HANDLERS
   ------------------------------------------------------------ */

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

/* ------------------------------------------------------------
   CHORE CRUD — WITHIN ACTIVE WEEK
   ------------------------------------------------------------ */

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

/* ------------------------------------------------------------
   CHORE FORM HTML BUILDERS
   ------------------------------------------------------------ */

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

/* ------------------------------------------------------------
   CHORE SAVE / REMOVE
   ------------------------------------------------------------ */

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

    choreFormState = null;
    choreFormEditId = null;
    renderChoreSetupScreen();
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
    }

    renderParentHubBackButton();
});
