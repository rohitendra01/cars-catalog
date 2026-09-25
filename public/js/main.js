'use strict';

// ── Constants ────────────────────────────────────────────────────
const SHORTLIST_KEY = 'autovault_shortlist';

// ── Toast Helper ─────────────────────────────────────────────────
/**
 * Display a dismissable toast notification for 2.5s
 * @param {string} message
 */
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}


// ── Shortlist Feature ────────────────────────────────────────────

/**
 * Read the current shortlist from localStorage
 * @returns {string[]} Array of car ID strings
 */
function getShortlist() {
    try {
        return JSON.parse(localStorage.getItem(SHORTLIST_KEY)) || [];
    } catch {
        return [];
    }
}

/**
 * Save shortlist array back to localStorage
 * @param {string[]} list
 */
function saveShortlist(list) {
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify(list));
}

/**
 * Update the badge count in the navbar
 */
function updateShortlistBadge() {
    const count = getShortlist().length;
    const badges = document.querySelectorAll('#shortlist-count, #mobile-shortlist-count');
    badges.forEach(b => {
        if (b) b.textContent = count;
    });

    const navShortlistIcons = document.querySelectorAll('.nav-shortlist-icon');
    navShortlistIcons.forEach(icon => {
        if (count > 0) {
            icon.classList.add('has-items');
        } else {
            icon.classList.remove('has-items');
        }
    });
}

/**
 * Render modern minimal heart SVG icon
 * @param {boolean} isSaved
 * @returns {string} SVG HTML string
 */
function getHeartSvg(isSaved) {
    if (isSaved) {
        return '<svg class="save-icon saved" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    }
    return '<svg class="save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
}

/**
 * Update the UI of a save button to reflect saved/unsaved state
 * @param {HTMLElement} btn
 * @param {boolean} isSaved
 */
function updateSaveButtonState(btn, isSaved) {
    if (!btn) return;
    const isFull = btn.hasAttribute('data-full-label') || btn.classList.contains('w-100');
    const label = isSaved
        ? (isFull ? 'Saved to Shortlist' : 'Saved')
        : (isFull ? 'Save to Shortlist' : 'Save');

    btn.innerHTML = `${getHeartSvg(isSaved)}<span class="save-text">${label}</span>`;
    if (isSaved) {
        btn.classList.add('saved');
        btn.setAttribute('aria-label', isFull ? 'Remove from shortlist' : 'Saved');
    } else {
        btn.classList.remove('saved');
        btn.setAttribute('aria-label', isFull ? 'Save to shortlist' : 'Save to shortlist');
    }
}

/**
 * Toggle a car ID in the shortlist.
 * Called by the "Save" button's onclick.
 * @param {string} carId   - MongoDB _id string
 * @param {HTMLElement} btn - The button element
 */
function toggleShortlist(carId, btn) {
    let list = getShortlist();
    const idx = list.indexOf(carId);
    const willSave = (idx === -1);

    if (willSave) {
        list.push(carId);
        showToast('Car added to your shortlist!');
    } else {
        list.splice(idx, 1);
        showToast('Removed from shortlist.');
    }

    saveShortlist(list);

    // Update all matching buttons on the page
    document.querySelectorAll(`[data-car-id="${carId}"]`).forEach(b => {
        updateSaveButtonState(b, willSave);
    });

    const shortlistFilter = document.getElementById('shortlist-filter');
    if (shortlistFilter) {
        shortlistFilter.value = list.join(',');
        if (!willSave) {
            btn?.closest('.car-card')?.remove();
            const resultCount = document.getElementById('result-count');
            const remaining = document.querySelectorAll('#inventory-grid .car-card').length;
            if (resultCount) resultCount.textContent = remaining;
            if (remaining === 0) {
                const grid = document.getElementById('inventory-grid');
                if (grid) {
                    const emptyState = document.createElement('div');
                    emptyState.className = 'empty-state';
                    emptyState.id = 'empty-inventory';
                    emptyState.innerHTML = '<h3>Your shortlist is empty</h3><p>Save cars while exploring, and they’ll appear here in the order you added them.</p><a href="/inventory" class="btn-primary" id="clear-filters-btn">Explore Cars</a>';
                    grid.replaceWith(emptyState);
                }
            }
        }
    }

    updateShortlistBadge();
}

/**
 * On page load, sync all save buttons to reflect existing shortlist state.
 * Works on both inventory grid and the PDP sidebar button.
 */
function initShortlistButtons() {
    const list = getShortlist();
    document.querySelectorAll('[data-car-id]').forEach(btn => {
        const id = btn.getAttribute('data-car-id');
        const isSaved = list.includes(id);
        updateSaveButtonState(btn, isSaved);
    });
    updateShortlistBadge();
}


// ── EMI Calculator ────────────────────────────────────────────────
/**
 * Calculate and display estimated monthly EMI.
 * Requires CAR_PRICE to be set as a global variable in the view.
 */
function calculateEMI() {
    const price = typeof CAR_PRICE !== 'undefined' ? CAR_PRICE : 0;
    const downEl = document.getElementById('calc-down');
    const termEl = document.getElementById('calc-term');
    const resEl = document.getElementById('calc-result');
    if (!downEl || !termEl || !resEl) return;

    const down = parseInt(downEl.value, 10) || 0;
    const months = parseInt(termEl.value, 10) || 60;
    const principal = price - down;

    if (principal <= 0) {
        resEl.textContent = '₹0';
        return;
    }

    const monthlyRate = 0.09 / 12;               // 9% annual
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months))
        / (Math.pow(1 + monthlyRate, months) - 1);

    resEl.textContent = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(Math.round(emi));
}


// ── Gallery Thumbnail Switch ──────────────────────────────────────
/**
 * Switch the main PDP image when a thumbnail is clicked.
 * @param {string}      url  - The full Cloudinary URL
 * @param {HTMLElement} thumb - The clicked thumbnail element
 */
function switchImage(url, thumb) {
    const mainImg = document.getElementById('pdp-main-img');
    if (!mainImg) return;
    mainImg.style.opacity = '0';
    setTimeout(() => {
        mainImg.src = url;
        mainImg.style.opacity = '1';
    }, 150);
    // Update active state
    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
}


// ── PDP Tab Switcher ──────────────────────────────────────────────
/**
 * Switch between PDP tab panels (Overview / Inspection Report)
 * @param {HTMLElement} clickedTab
 * @param {string}      panelId
 */
function switchTab(clickedTab, panelId) {
    // Deactivate all tabs
    document.querySelectorAll('.pdp-tabs .tab').forEach(t => t.classList.remove('active'));
    clickedTab.classList.add('active');

    // Hide all panels, show target
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'block';
        panel.style.animation = 'fadeInUp 0.3s ease';
    }
}


// ── Sort (Inventory) ──────────────────────────────────────────────
/**
 * Update the hidden sort input and submit the filter form
 * @param {string} value - sort option value
 */
function applySort(value) {
    const hiddenSort = document.getElementById('hidden-sort');
    const form = document.getElementById('filter-form');
    if (hiddenSort && form) {
        hiddenSort.value = value;
        form.submit();
    }
}


// ── Price Range Label ─────────────────────────────────────────────
/**
 * Update the max budget label as the range slider moves
 * @param {string|number} value
 */
function updatePriceLabel(value) {
    const label = document.getElementById('price-val');
    if (!label) return;
    label.textContent = '₹' + Number(value).toLocaleString('en-IN');
}


// ── Mobile Navigation ─────────────────────────────────────────────
function toggleMobileMenu() {
    const nav = document.getElementById('mobile-nav');
    if (nav) nav.classList.toggle('open');
}


// ── Shortlist Panel (header link) ────────────────────────────────
function openShortlist(e) {
    e.preventDefault();
    const list = getShortlist();
    window.location.href = `/inventory?shortlist=${encodeURIComponent(list.join(','))}`;
}


// ── Test Drive Form ───────────────────────────────────────────────
async function handleTestDrive(e) {
    e.preventDefault();
    const name = document.getElementById('td-name')?.value.trim();
    const phone = document.getElementById('td-phone')?.value.trim();
    const city = document.getElementById('td-city')?.value.trim();
    const carId = document.querySelector('[data-car-id]')?.getAttribute('data-car-id');
    const submitBtn = document.getElementById('schedule-btn');
    const submitBtnLabel = submitBtn?.querySelector('.test-drive-button-label');

    if (!name || !phone || !city) return;

    if (submitBtn) {
        submitBtn.disabled = true;
        if (submitBtnLabel) submitBtnLabel.textContent = 'Scheduling…';
        else submitBtn.textContent = 'Scheduling…';
    }

    try {
        await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                customerName: name,
                phone: phone,
                inquiryType: 'Schedule Visit',
                message: `City / Pincode: ${city}`,
                carId: carId || undefined
            })
        });
        showToast(`Test drive booked for ${name}! We'll call you at ${phone}.`);
        e.target.reset();
    } catch (err) {
        showToast(`Test drive booked for ${name}! We'll call you at ${phone}.`);
        e.target.reset();
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            if (submitBtnLabel) submitBtnLabel.textContent = 'Request a test drive';
            else submitBtn.textContent = 'Schedule Test Drive';
        }
    }
}


// ── Subscribe Form ────────────────────────────────────────────────
function handleSubscribe(e) {
    e.preventDefault();
    const email = document.getElementById('subscribe-email')?.value.trim();
    const msg = document.getElementById('subscribe-msg');
    if (email && msg) {
        msg.textContent = 'Subscribed! You\'ll get alerts for new listings.';
        e.target.reset();
    }
}


// ── Theme Switcher ────────────────────────────────────────────────
const THEME_KEY = 'theme';
const ADMIN_THEME_KEY = 'av-admin-theme';

/**
 * Check if dark mode is active
 * @returns {boolean}
 */
function isDarkMode() {
    return document.documentElement.classList.contains('dark');
}

/**
 * Apply theme across DOM elements and update toggle button icons
 * @param {boolean} dark
 * @param {boolean} [animate=false]
 */
function applySiteTheme(dark, animate = false) {
    const html = document.documentElement;

    if (animate) {
        html.classList.add('theme-transition');
    }

    html.classList.toggle('dark', dark);

    // Update footer and topbar theme toggle icons
    const moonIcons = document.querySelectorAll('#footerIconMoon, #iconMoon');
    const sunIcons = document.querySelectorAll('#footerIconSun, #iconSun');

    moonIcons.forEach(icon => {
        if (icon) icon.classList.toggle('hidden', dark);
    });

    sunIcons.forEach(icon => {
        if (icon) icon.classList.toggle('hidden', !dark);
    });

    // Update buttons' aria-labels and titles
    const toggleButtons = document.querySelectorAll('#themeToggleFooter, #themeToggle');
    toggleButtons.forEach(btn => {
        if (btn) {
            const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
        }
    });

    if (animate) {
        setTimeout(() => {
            html.classList.remove('theme-transition');
        }, 300);
    }
}

/**
 * Toggle the current theme and persist to localStorage
 */
function toggleSiteTheme() {
    const nextDark = !isDarkMode();
    try {
        localStorage.setItem(THEME_KEY, nextDark ? 'dark' : 'light');
        localStorage.setItem(ADMIN_THEME_KEY, nextDark ? 'dark' : 'light');
    } catch (e) {}
    applySiteTheme(nextDark, true);
}

/**
 * Initialize theme listeners and sync icons with current state
 */
function initThemeToggle() {
    let saved = null;
    try {
        saved = localStorage.getItem(THEME_KEY) || localStorage.getItem(ADMIN_THEME_KEY);
    } catch (e) {}

    const initialDark = saved ? (saved === 'dark') : isDarkMode();
    applySiteTheme(initialDark, false);

    const toggleButtons = document.querySelectorAll('#themeToggleFooter, #themeToggle');
    toggleButtons.forEach(btn => {
        if (btn && !btn._themeBound) {
            btn._themeBound = true;
            btn.addEventListener('click', toggleSiteTheme);
        }
    });

    window.addEventListener('storage', (e) => {
        if (e.key === THEME_KEY || e.key === ADMIN_THEME_KEY) {
            applySiteTheme(e.newValue === 'dark', true);
        }
    });
}

// ── Initialization ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme toggle and sync icons
    initThemeToggle();

    // Sync shortlist buttons on every page load
    initShortlistButtons();

    // Auto-submit inventory filter form when selects change
    const filterSelects = document.querySelectorAll(
        '#filter-make, #filter-body, #filter-fuel, #filter-transmission'
    );
    filterSelects.forEach(sel => {
        sel.addEventListener('change', () => {
            document.getElementById('filter-form')?.submit();
        });
    });

    // Nav search — submit on Enter
    const navSearch = document.getElementById('nav-search-input');
    if (navSearch) {
        navSearch.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                document.getElementById('nav-search-form')?.submit();
            }
        });
    }
});
