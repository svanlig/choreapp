/* ============================================================
   APP.JS — Chore & Reward App
   Feature implemented: Parent Hub → Children management
   ============================================================ */

var CHILDREN_STORAGE_KEY = 'children';

/* ------------------------------------------------------------
   CHILDREN DATA LAYER
   ------------------------------------------------------------ */

function generateId() {
    return 'child_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

    /* Initial seed — Emma must exist */
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
   EXISTING PROTOTYPE: VIEW SWITCHING
   ------------------------------------------------------------ */

function switchView(viewName, btnElement) {
    /* Remove active from all screens */
    var screens = document.querySelectorAll('.app-screen');
    for (var i = 0; i < screens.length; i++) {
        screens[i].classList.remove('active');
    }

    /* Determine target screen id */
    var targetId = 'screen-' + viewName;
    var target = document.getElementById(targetId);

    if (!target) {
        /* Dynamically create Children screen if it doesn't exist */
        if (viewName === 'children') {
            target = createChildrenScreen();
        }
    }

    if (target) {
        target.classList.add('active');
    }

    /* Update prototype toolbar buttons */
    var protoButtons = document.querySelectorAll('.btn-proto');
    for (var j = 0; j < protoButtons.length; j++) {
        protoButtons[j].classList.remove('active');
    }
    if (btnElement) {
        btnElement.classList.add('active');
    }

    /* Update bottom nav active state based on view */
    updateNavForView(viewName);

    /* Refresh children screen content if visible */
    if (viewName === 'children') {
        renderChildrenScreen();
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
   CHILDREN SCREEN — DYNAMIC CREATION
   ------------------------------------------------------------ */

function createChildrenScreen() {
    var contentArea = document.querySelector('.app-content');
    if (!contentArea) return null;

    var screen = document.createElement('div');
    screen.id = 'screen-children';
    screen.className = 'app-screen';
    screen.innerHTML =
        '<div class="section-title">' +
            '<span>Children Profiles</span>' +
            '<span class="whimsical-shape star"></span>' +
        '</div>' +
        '<div id="children-panel-container"></div>' +
        '<div id="children-list-container"></div>' +
        '<button class="btn-add-chore" id="btn-add-child" onclick="handleAddChild()">+ Add Child</button>';

    contentArea.appendChild(screen);
    return screen;
}

function renderChildrenScreen() {
    var container = document.getElementById('children-list-container');
    if (!container) return;

    if (childrenData.length === 0) {
        container.innerHTML =
            '<div class="ui-card" style="text-align:center; color: var(--text-muted);">' +
                '<p>No children yet. Tap + Add Child to create a profile.</p>' +
            '</div>';
        return;
    }

    var html = '';
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
                    '<div class="control-pill" onclick="handleEditChild(\'' + child.id + '\')">Edit</div>' +
                    '<div class="control-pill" style="background:#FC6262; color:#fff; border-color:#FC6262;" onclick="handleRemoveChild(\'' + child.id + '\')">Remove</div>' +
                '</div>' +
            '</div>';
    }
    container.innerHTML = html;
}

/* ------------------------------------------------------------
   IN-APP PANEL HELPERS
   ------------------------------------------------------------ */

function getPanelContainer() {
    return document.getElementById('children-panel-container');
}

function clearPanel() {
    var panel = getPanelContainer();
    if (panel) panel.innerHTML = '';
}

function renderAddChildPanel() {
    var panel = getPanelContainer();
    if (!panel) return;

    panel.innerHTML =
        '<div class="ui-card" style="margin-bottom:12px;">' +
            '<div style="font-weight:700; font-size:1rem; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.3px;">Add Child</div>' +
            '<div class="context-input-card" style="margin-bottom:8px;">' +
                '<label>Child Name</label>' +
                '<input id="child-form-name" type="text" placeholder="e.g. Liam" style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +
            '<div class="context-input-card" style="margin-bottom:12px;">' +
                '<label>Avatar Placeholder</label>' +
                '<input id="child-form-avatar" type="text" maxlength="2" placeholder="e.g. L" style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +
            '<div id="child-form-error" style="display:none; color:var(--color-coral); font-size:0.8rem; font-weight:600; margin-bottom:8px;"></div>' +
            '<div style="display:flex; gap:8px;">' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1;" onclick="saveNewChild()">Save</button>' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" onclick="cancelChildPanel()">Cancel</button>' +
            '</div>' +
        '</div>';

    var nameInput = document.getElementById('child-form-name');
    if (nameInput) nameInput.focus();
}

function renderEditChildPanel(id) {
    var child = getChildById(id);
    if (!child) return;

    var panel = getPanelContainer();
    if (!panel) return;

    panel.innerHTML =
        '<div class="ui-card" style="margin-bottom:12px;">' +
            '<div style="font-weight:700; font-size:1rem; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.3px;">Edit Child</div>' +
            '<div class="context-input-card" style="margin-bottom:8px;">' +
                '<label>Child Name</label>' +
                '<input id="child-form-name" type="text" value="' + escapeHtml(child.name) + '" style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +
            '<div class="context-input-card" style="margin-bottom:12px;">' +
                '<label>Avatar Placeholder</label>' +
                '<input id="child-form-avatar" type="text" maxlength="2" value="' + escapeHtml(child.avatar) + '" style="width:100%; border:none; background:transparent; font-family:\'Quicksand\',sans-serif; font-size:0.95rem; font-weight:600; color:var(--text-primary); outline:none; padding:4px 0;" />' +
            '</div>' +
            '<div id="child-form-error" style="display:none; color:var(--color-coral); font-size:0.8rem; font-weight:600; margin-bottom:8px;"></div>' +
            '<div style="display:flex; gap:8px;">' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1;" onclick="saveEditChild(\'' + child.id + '\')">Save</button>' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" onclick="cancelChildPanel()">Cancel</button>' +
            '</div>' +
        '</div>';

    var nameInput = document.getElementById('child-form-name');
    if (nameInput) nameInput.focus();
}

function renderRemoveChildPanel(id) {
    var child = getChildById(id);
    if (!child) return;

    var panel = getPanelContainer();
    if (!panel) return;

    panel.innerHTML =
        '<div class="ui-card" style="margin-bottom:12px; border:2px solid var(--color-coral);">' +
            '<div style="font-weight:700; font-size:1rem; margin-bottom:6px;">Remove ' + escapeHtml(child.name) + '?</div>' +
            '<div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">This cannot be undone.</div>' +
            '<div style="display:flex; gap:8px;">' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; border-style:solid;" onclick="cancelChildPanel()">Cancel</button>' +
                '<button class="btn-add-chore" style="margin-top:0; flex:1; background:var(--color-coral); color:#fff; border-color:var(--color-coral);" onclick="confirmRemoveChild(\'' + child.id + '\')">Remove</button>' +
            '</div>' +
        '</div>';
}

function showFormError(message) {
    var err = document.getElementById('child-form-error');
    if (err) {
        err.textContent = message;
        err.style.display = 'block';
    }
}

function cancelChildPanel() {
    clearPanel();
}

/* ------------------------------------------------------------
   CHILDREN ACTIONS — IN-APP FORMS
   ------------------------------------------------------------ */

function handleAddChild() {
    clearPanel();
    renderAddChildPanel();
}

function saveNewChild() {
    var nameInput = document.getElementById('child-form-name');
    var avatarInput = document.getElementById('child-form-avatar');

    var name = nameInput ? nameInput.value.trim() : '';
    var avatar = avatarInput ? avatarInput.value.trim() : '';

    if (name === '') {
        showFormError('Child name cannot be blank.');
        return;
    }

    if (isDuplicateName(name, null)) {
        showFormError('A child with that name already exists.');
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
    clearPanel();
    renderChildrenScreen();
    updateParentMenuChildCount();
}

function handleEditChild(id) {
    clearPanel();
    renderEditChildPanel(id);
}

function saveEditChild(id) {
    var child = getChildById(id);
    if (!child) return;

    var nameInput = document.getElementById('child-form-name');
    var avatarInput = document.getElementById('child-form-avatar');

    var newName = nameInput ? nameInput.value.trim() : '';
    var newAvatar = avatarInput ? avatarInput.value.trim() : '';

    if (newName === '') {
        showFormError('Child name cannot be blank.');
        return;
    }

    if (isDuplicateName(newName, id)) {
        showFormError('A child with that name already exists.');
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
    clearPanel();
    renderChildrenScreen();
    updateParentMenuChildCount();
}

function handleRemoveChild(id) {
    clearPanel();
    renderRemoveChildPanel(id);
}

function confirmRemoveChild(id) {
    var child = getChildById(id);
    if (!child) return;

    var newData = [];
    for (var i = 0; i < childrenData.length; i++) {
        if (childrenData[i].id !== id) {
            newData.push(childrenData[i]);
        }
    }
    childrenData = newData;
    saveChildren(childrenData);
    clearPanel();
    renderChildrenScreen();
    updateParentMenuChildCount();
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
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/* ------------------------------------------------------------
   INITIALISE ON DOM READY
   ------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', function () {

    /* Ensure children data is loaded (already loaded at top) */
    childrenData = loadChildren();

    /* Update parent menu child count */
    updateParentMenuChildCount();

    /* Attach click handler to "Manage Children Profiles" menu item */
    var menuItems = document.querySelectorAll('.parent-menu-item');
    for (var i = 0; i < menuItems.length; i++) {
        var label = menuItems[i].querySelector('div');
        if (label && label.textContent.indexOf('Manage Children Profiles') !== -1) {
            menuItems[i].onclick = function () {
                switchView('children', null);
            };
            menuItems[i].style.cursor = 'pointer';
        }
    }

    /* Update header to reflect first child (Emma) */
    syncHeaderWithChild();
});

/* ------------------------------------------------------------
   SYNC HEADER WITH CHILD DATA
   ------------------------------------------------------------ */

function syncHeaderWithChild() {
    var firstChild = childrenData.length > 0 ? childrenData[0] : null;
    if (!firstChild) return;

    var avatarEl = document.getElementById('dynamic-avatar');
    var titleEl = document.getElementById('dynamic-title');
    var balanceValue = document.querySelector('#dynamic-balance-container .balance-value');

    if (avatarEl) avatarEl.textContent = firstChild.avatar;
    if (titleEl) titleEl.textContent = firstChild.name;
    if (balanceValue) balanceValue.textContent = firstChild.momBucks;
}
