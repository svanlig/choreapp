/* =========================================================
   app.js
   General application logic for the Chore & Reward prototype.
   Contains: view switching, header updating, system nav,
   the demo PIN bypass, AND the Children data system.
   ========================================================= */


/* =========================================================
   CHILDREN DATA SYSTEM
   ---------------------------------------------------------
   Stores children in localStorage under the key "children".
   Each child: { id, name, avatar, momBucks }
   Default child (created on first use): Emma / E / 0
   ========================================================= */

var CHILDREN_STORAGE_KEY = 'children';

/**
 * Returns the full array of children from localStorage.
 * If nothing is stored yet, seeds ONE default child (Emma)
 * and persists it, then returns the array.
 * @returns {Array<{id:string, name:string, avatar:string, momBucks:number}>}
 */
function getChildren() {
    var raw = localStorage.getItem(CHILDREN_STORAGE_KEY);
    if (!raw) {
        var defaultChild = {
            id: generateChildId(),
            name: 'Emma',
            avatar: 'E',
            momBucks: 0
        };
        var seeded = [defaultChild];
        saveChildren(seeded);
        return seeded;
    }
    try {
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed;
    } catch (e) {
        console.warn('Children data was corrupt. Resetting to default.', e);
        var fallbackChild = {
            id: generateChildId(),
            name: 'Emma',
            avatar: 'E',
            momBucks: 0
        };
        var fallback = [fallbackChild];
        saveChildren(fallback);
        return fallback;
    }
}

/**
 * Persists the given children array to localStorage.
 * @param {Array} children
 */
function saveChildren(children) {
    localStorage.setItem(CHILDREN_STORAGE_KEY, JSON.stringify(children));
}

/**
 * Generates a simple unique id for a child record.
 * @returns {string}
 */
function generateChildId() {
    return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Adds a new child and persists the list.
 * @param {string} name
 * @param {string} [avatar] - optional single-character avatar; defaults to first letter of name
 * @returns {object} the newly created child
 */
function addChild(name, avatar) {
    var children = getChildren();
    var trimmed = (name || '').trim();
    var initial = (avatar && avatar.trim()) ? avatar.trim().charAt(0).toUpperCase()
                                            : (trimmed.charAt(0).toUpperCase() || '?');
    var newChild = {
        id: generateChildId(),
        name: trimmed || 'New Child',
        avatar: initial,
        momBucks: 0
    };
    children.push(newChild);
    saveChildren(children);
    return newChild;
}

/**
 * Edits an existing child by id. Only provided fields are changed.
 * @param {string} id
 * @param {{name?:string, avatar?:string, momBucks?:number}} updates
 * @returns {object|null} the updated child, or null if not found
 */
function editChild(id, updates) {
    var children = getChildren();
    var index = children.findIndex(function (c) { return c.id === id; });
    if (index === -1) return null;

    var child = children[index];
    if (updates && typeof updates === 'object') {
        if (typeof updates.name === 'string')   child.name = updates.name.trim() || child.name;
        if (typeof updates.avatar === 'string' && updates.avatar.trim() !== '') {
            child.avatar = updates.avatar.trim().charAt(0).toUpperCase();
        }
        if (typeof updates.momBucks === 'number' && !isNaN(updates.momBucks)) {
            child.momBucks = updates.momBucks;
        }
    }
    children[index] = child;
    saveChildren(children);
    return child;
}

/**
 * Deletes a child by id and persists the list.
 * @param {string} id
 * @returns {boolean} true if a child was removed
 */
function deleteChild(id) {
    var children = getChildren();
    var filtered = children.filter(function (c) { return c.id !== id; });
    if (filtered.length === children.length) return false;
    saveChildren(filtered);
    return true;
}


/* =========================================================
   EXISTING PROTOTYPE VIEW LOGIC (unchanged)
   ========================================================= */

/**
 * Switch the active screen and update toolbar + nav highlights.
 * @param {string} screenId - e.g. 'child-home', 'rewards', 'parent-pin'
 * @param {HTMLElement} toolbarBtn - the .btn-proto element that triggered this
 */
function switchView(screenId, toolbarBtn) {
    // Update Toolbar Button Visual Selection
    document.querySelectorAll('.btn-proto').forEach(btn => btn.classList.remove('active'));
    if (toolbarBtn) toolbarBtn.classList.add('active');

    // Toggle Screens Content
    document.querySelectorAll('.app-screen').forEach(screen => screen.classList.remove('active'));
    const targetScreen = document.getElementById('screen-' + screenId);
    if (targetScreen) targetScreen.classList.add('active');

    // Sync Main Application Navigation System Highlights
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    // Context Headings Modifications based on selected views
    const avatar = document.getElementById('dynamic-avatar');
    const title = document.getElementById('dynamic-title');
    const subtitle = document.getElementById('dynamic-subtitle');
    const balanceBox = document.getElementById('dynamic-balance-container');

    if (screenId === 'parent-area' || screenId === 'chore-setup' || screenId === 'parent-pin') {
        document.getElementById('nav-parent').classList.add('active');
        avatar.innerText = 'P';
        avatar.className = 'avatar-circle parent';
        title.innerText = 'Parent Mode';
        subtitle.innerText = 'Family Settings Access';
        balanceBox.style.visibility = 'hidden';
    } else {
        avatar.innerText = 'E';
        avatar.className = 'avatar-circle';
        title.innerText = 'Emma';
        subtitle.innerText = 'Monday, Sept 14, 2026';
        balanceBox.style.visibility = 'visible';

        if (screenId === 'child-home') document.getElementById('nav-home').classList.add('active');
        if (screenId === 'rewards') document.getElementById('nav-rewards').classList.add('active');
        if (screenId === 'calendar') document.getElementById('nav-calendar').classList.add('active');
    }
}

/**
 * Handle clicks on the bottom system navigation bar.
 * Maps nav IDs to the corresponding prototype toolbar button index,
 * then delegates to switchView.
 * @param {string} screenId
 * @param {HTMLElement} navItem
 */
function handleSystemNav(screenId, navItem) {
    let correspondingProtoBtnIndex = 0;
    if (screenId === 'child-home') correspondingProtoBtnIndex = 0;
    if (screenId === 'rewards') correspondingProtoBtnIndex = 1;
    if (screenId === 'calendar') correspondingProtoBtnIndex = 2;
    if (screenId === 'parent-pin') correspondingProtoBtnIndex = 3;

    const btn = document.querySelectorAll('.btn-proto')[correspondingProtoBtnIndex];
    switchView(screenId, btn);
}

/**
 * Prototype helper: skip the PIN screen and jump straight to the
 * parent workspace. Wired to the "OK" keypad button.
 */
function demoBypassPIN() {
    switchView('parent-area', document.querySelectorAll('.btn-proto')[4]);
}


/* =========================================================
   STARTUP
   ---------------------------------------------------------
   Load children from localStorage (seeds default Emma on
   first use). This runs once when the script loads.
   ========================================================= */
(function initChildrenSystem() {
    var children = getChildren();
    console.log('[children] loaded:', children);
})();
switchView('child-home', document.querySelectorAll('.btn-proto')[0]);
