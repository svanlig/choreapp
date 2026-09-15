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
    screen
