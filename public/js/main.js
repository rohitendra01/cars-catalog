/* ─────────────────────────────────────────────────────────────────
   AutoVault India — main.js
   Client-side features:
     • Shortlist (localStorage)
     • EMI Calculator
     • Gallery Image Switch
     • PDP Tab Switch
     • Sort (inventory)
     • Mobile nav toggle
     • Toast notification
     • Price label update
     • Subscribe form handler
   ───────────────────────────────────────────────────────────────── */

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

    if (idx === -1) {
        list.push(carId);
        btn.textContent = '❤️ Saved';
        btn.classList.add('saved');
        showToast('Car added to your shortlist!');
    } else {
        list.splice(idx, 1);
        btn.textContent = '🤍 Save';
        btn.classList.remove('saved');
        showToast('Removed from shortlist.');
    }

    saveShortlist(list);
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
        if (list.includes(id)) {
            btn.textContent = '❤️ Saved';
            btn.classList.add('saved');
        }
    });
    updateShortlistBadge();
}


// ── EMI Calculator ────────────────────────────────────────────────
/**
 * Calculate and display estimated monthly EMI.
 * Requires CAR_PRICE to be set as a global variable in the view.
 */
function calculateEMI() {
    const price   = typeof CAR_PRICE !== 'undefined' ? CAR_PRICE : 0;
    const downEl  = document.getElementById('calc-down');
    const termEl  = document.getElementById('calc-term');
    const resEl   = document.getElementById('calc-result');
    if (!downEl || !termEl || !resEl) return;

    const down    = parseInt(downEl.value, 10) || 0;
    const months  = parseInt(termEl.value, 10) || 60;
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
function toggleShortlistPanel(e) {
    e.preventDefault();
    const list = getShortlist();
    if (list.length === 0) {
        showToast('Your shortlist is empty. Save some cars first!');
    } else {
        showToast(`${list.length} car${list.length > 1 ? 's' : ''} shortlisted. Visit inventory to view.`);
    }
}


// ── Test Drive Form ───────────────────────────────────────────────
function handleTestDrive(e) {
    e.preventDefault();
    const name  = document.getElementById('td-name')?.value.trim();
    const phone = document.getElementById('td-phone')?.value.trim();
    const city  = document.getElementById('td-city')?.value.trim();
    if (name && phone && city) {
        showToast(`✅ Test drive booked for ${name}! We'll call you at ${phone}.`);
        e.target.reset();
    }
}


// ── Subscribe Form ────────────────────────────────────────────────
function handleSubscribe(e) {
    e.preventDefault();
    const email = document.getElementById('subscribe-email')?.value.trim();
    const msg   = document.getElementById('subscribe-msg');
    if (email && msg) {
        msg.textContent = '🎉 Subscribed! You\'ll get alerts for new listings.';
        e.target.reset();
    }
}


// ── Initialization ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
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
