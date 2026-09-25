/**
 * public/js/carAdmin.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AutoVault India — Admin Dashboard Client JS
 *
 * Responsibilities:
 *   • Fetch paginated + filtered car listings from /admin/cars
 *   • Render car table rows with inline actions
 *   • Open / close slide panel for create or edit
 *   • POST (create) and PUT (update) car records via FormData (multipart)
 *   • Manage image uploads: preview new picks, track existing, handle deletions
 *   • DELETE car records with Cloudinary cleanup signalled to server
 *   • Display toast notifications for success / error / info states
 *   • Compute and render dashboard stats strip
 *   • Render pagination controls and handle page changes
 */

/* ─── State ──────────────────────────────────────────────────────────────── */
var _state = {
    cars: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    isLoading: false,
    editCarId: null,         // null = create mode
    newFiles: [],           // File objects staged for upload
    imagesToDelete: [],         // Cloudinary public_ids marked for removal
    searchTimer: null,
    deleteTargetId: null,
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function formatINR(n) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(n);
}

function fuelEmoji(f) {
    return { Petrol: '⛽', Diesel: '🛢', CNG: '🌿', Electric: '⚡' }[f] || '—';
}

function el(id) { return document.getElementById(id); }

/* ─── Toast System ───────────────────────────────────────────────────────── */
var _toastId = 0;
function showToast(message, type) {
    // type: 'success' | 'error' | 'info'
    var id = 'toast-' + (++_toastId);
    var container = el('toastContainer');
    if (!container) return;

    var colors = {
        success: 'border-emerald-500 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950',
        error: 'border-red-500   bg-zinc-950 dark:bg-white text-white dark:text-zinc-950',
        info: 'border-brand     bg-zinc-950 dark:bg-white text-white dark:text-zinc-950',
    };
    var dots = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-brand',
    };

    var div = document.createElement('div');
    div.id = id;
    div.className = 'toast-enter pointer-events-auto border-l-4 ' + (colors[type] || colors.info) +
        ' px-4 py-3 flex items-start gap-3 shadow-2xl min-w-[260px] max-w-xs';
    div.innerHTML =
        '<div class="shrink-0 w-2 h-2 rounded-full mt-1.5 ' + (dots[type] || dots.info) + '"></div>' +
        '<p class="font-mono text-xs uppercase tracking-widest leading-relaxed flex-1">' + message + '</p>' +
        '<button onclick="removeToast(\'' + id + '\')" class="shrink-0 opacity-50 hover:opacity-100 transition-opacity text-xs leading-none mt-0.5">✕</button>';

    container.appendChild(div);

    // Auto remove after 3.5 s
    setTimeout(function () { removeToast(id); }, 3500);
}

function removeToast(id) {
    var t = el(id);
    if (!t) return;
    t.classList.remove('toast-enter');
    t.classList.add('toast-exit');
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
}

/* ─── Load Cars (API) ────────────────────────────────────────────────────── */
function getFilters() {
    return {
        search: (el('searchInput') || {}).value || '',
        fuelType: (el('filterFuel') || {}).value || '',
        bodyType: (el('filterBody') || {}).value || '',
        sort: (el('filterSort') || {}).value || 'newest',
    };
}

function buildQuery(extra) {
    var f = getFilters();
    var p = _state.pagination;
    var params = new URLSearchParams({
        page: extra && extra.page ? extra.page : p.page,
        limit: p.limit,
        search: f.search,
        fuelType: f.fuelType,
        bodyType: f.bodyType,
        sort: f.sort,
    });
    // Remove empty params to keep URL clean
    Array.from(params.keys()).forEach(function (k) {
        if (!params.get(k)) params.delete(k);
    });
    return params.toString();
}

async function loadCars(page) {
    if (_state.isLoading) return;
    _state.isLoading = true;

    if (page) _state.pagination.page = page;

    showTableLoading();

    try {
        var res = await fetch('/admin/cars?' + buildQuery(), {
            headers: { 'Accept': 'application/json' }
        });

        if (res.status === 401) {
            window.location.replace('/admin/login');
            return;
        }
        if (!res.ok) {
            var err = await res.json().catch(function () { return {}; });
            throw new Error(err.error || 'Server error ' + res.status);
        }

        var data = await res.json();
        _state.cars = data.cars || [];
        _state.pagination = data.pagination || _state.pagination;

        renderTable();
        renderPagination();
        updateStats();
    } catch (err) {
        console.error('loadCars error:', err);
        showToast('Failed to load cars: ' + err.message, 'error');
        showTableEmpty('Error loading data. Check console.');
    } finally {
        _state.isLoading = false;
    }
}

/* ─── Table Rendering ────────────────────────────────────────────────────── */
function showTableLoading() {
    var tb = el('carTableBody');
    if (!tb) return;
    tb.innerHTML =
        '<tr><td colspan="9" class="px-6 py-20 text-center">' +
        '<div class="inline-flex flex-col items-center gap-3">' +
        '<svg class="w-7 h-7 text-zinc-300 dark:text-zinc-700 animate-spin" fill="none" viewBox="0 0 24 24">' +
        '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>' +
        '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>' +
        '</svg>' +
        '<span class="font-mono text-xs text-zinc-400 uppercase tracking-widest">Loading…</span>' +
        '</div></td></tr>';
}

function showTableEmpty(msg) {
    var tb = el('carTableBody');
    if (!tb) return;
    tb.innerHTML =
        '<tr><td colspan="9" class="px-6 py-20 text-center font-mono text-xs text-zinc-400 uppercase tracking-widest">' +
        (msg || 'No cars found.') + '</td></tr>';
}

function renderTable() {
    var tb = el('carTableBody');
    if (!tb) return;

    if (!_state.cars.length) {
        showTableEmpty('No cars match your filters.');
        return;
    }

    tb.innerHTML = _state.cars.map(function (car) {
        var img = car.primaryImage || '';
        var price = formatINR(car.price);
        var carUrl = '/inventory/' + (car.slug || car._id);
        var featured = car.isFeatured
            ? '<span class="inline-block px-2 py-0.5 bg-brand/10 text-brand font-mono text-[9px] uppercase tracking-widest border border-brand/30">Featured</span>'
            : '<span class="inline-block px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono text-[9px] uppercase tracking-widest">Standard</span>';

        return '<tr class="car-row" data-id="' + car._id + '">' +
            // Photo
            '<td class="px-4 py-3">' +
            '<a href="' + carUrl + '" target="_blank" class="block w-14 h-10 bg-zinc-100 dark:bg-zinc-900 overflow-hidden shrink-0 group">' +
            (img ? '<img src="' + img + '" alt="' + car.make + ' ' + car.model + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform"/>' :
                '<div class="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">' +
                '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' +
                '</div>') +
            '</a></td>' +
            // Brand
            '<td class="px-4 py-3"><a href="' + carUrl + '" target="_blank" class="font-bold text-zinc-950 dark:text-white text-sm hover:text-brand transition-colors">' + (car.make || '—') + '</a></td>' +
            // Model
            '<td class="px-4 py-3"><a href="' + carUrl + '" target="_blank" class="font-mono text-zinc-700 dark:text-zinc-300 text-xs hover:text-brand transition-colors">' + (car.model || '—') + '</a></td>' +
            // Year
            '<td class="px-4 py-3 hidden md:table-cell"><span class="font-mono text-zinc-500 text-xs">' + (car.year || '—') + '</span></td>' +
            // Fuel
            '<td class="px-4 py-3 hidden lg:table-cell"><span class="font-mono text-xs">' + fuelEmoji(car.fuelType) + ' ' + (car.fuelType || '—') + '</span></td>' +
            // Body
            '<td class="px-4 py-3 hidden lg:table-cell"><span class="font-mono text-zinc-500 text-[11px] uppercase tracking-wider">' + (car.bodyType || '—') + '</span></td>' +
            // Price
            '<td class="px-4 py-3"><span class="font-bold text-zinc-950 dark:text-white font-mono text-sm">' + price + '</span></td>' +
            // Status
            '<td class="px-4 py-3 hidden md:table-cell">' + featured + '</td>' +
            // Actions
            '<td class="px-4 py-3 text-right">' +
            '<div class="flex items-center justify-end gap-2">' +
            '<a href="' + carUrl + '" target="_blank" title="View Listing" ' +
            'class="p-2 text-zinc-500 hover:text-brand border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>' +
            '</a>' +
            '<button onclick="openPanel(\'' + car._id + '\')" title="Edit" ' +
            'class="p-2 text-zinc-500 hover:text-brand border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>' +
            '</button>' +
            '<button onclick="openDeleteModal(\'' + car._id + '\', \'' + escapeHtml(car.make + ' ' + car.model + ' (' + car.year + ')') + '\')" title="Delete" ' +
            'class="p-2 text-zinc-500 hover:text-red-600 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition-colors">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>' +
            '</button>' +
            '</div></td>' +
            '</tr>';
    }).join('');
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

/* ─── Pagination ─────────────────────────────────────────────────────────── */
function renderPagination() {
    var bar = el('paginationBar');
    var info = el('paginationInfo');
    var btnsEl = el('paginationBtns');
    var p = _state.pagination;
    var sub = el('inventorySubtitle');

    if (sub) {
        sub.textContent = p.total + ' vehicle' + (p.total !== 1 ? 's' : '') + ' in inventory — page ' + p.page + ' of ' + (p.totalPages || 1);
    }

    if (!bar || !info || !btnsEl) return;

    if (p.totalPages <= 1) {
        bar.classList.add('hidden');
        bar.classList.remove('flex');
        return;
    }

    bar.classList.remove('hidden');
    bar.classList.add('flex');

    var from = (p.page - 1) * p.limit + 1;
    var to = Math.min(p.page * p.limit, p.total);
    info.textContent = 'Showing ' + from + '–' + to + ' of ' + p.total;

    // Build page buttons (show prev, numbered window, next)
    var html = '';
    var btnBase = 'page-btn px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px] uppercase tracking-widest transition-colors hover:border-brand hover:text-brand ';

    // Prev
    if (p.hasPrev) {
        html += '<button class="' + btnBase + '" onclick="loadCars(' + (p.page - 1) + ')">← Prev</button>';
    }

    // Page numbers (show at most 5)
    var start = Math.max(1, p.page - 2);
    var end = Math.min(p.totalPages, start + 4);
    start = Math.max(1, end - 4);

    for (var i = start; i <= end; i++) {
        html += '<button class="' + btnBase + (i === p.page ? 'active ' : '') + '" onclick="loadCars(' + i + ')">' + i + '</button>';
    }

    // Next
    if (p.hasNext) {
        html += '<button class="' + btnBase + '" onclick="loadCars(' + (p.page + 1) + ')">Next →</button>';
    }

    btnsEl.innerHTML = html;
}

/* ─── Stats Strip ────────────────────────────────────────────────────────── */
function updateStats() {
    var cars = _state.cars;
    var p = _state.pagination;

    // Total (from server pagination)
    var statTotal = el('statTotal');
    if (statTotal) statTotal.textContent = p.total;

    // We only have the current page of cars for stat calc, so fetch full count separately
    // For featured and avg price, fetch full unfiltered set once
    fetchAllStatsOnce();
}

var _statsFetched = false;
async function fetchAllStatsOnce() {
    if (_statsFetched) return;
    _statsFetched = true;

    try {
        var res = await fetch('/admin/cars?limit=100&page=1', { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        var data = await res.json();
        var all = data.cars || [];

        // Total from pagination
        var statTotal = el('statTotal');
        if (statTotal) statTotal.textContent = data.pagination.total;

        // Featured
        var featuredCount = all.filter(function (c) { return c.isFeatured; }).length;
        var statFeat = el('statFeatured');
        if (statFeat) statFeat.textContent = featuredCount;

        // Avg price
        if (all.length > 0) {
            var avgP = all.reduce(function (s, c) { return s + (c.price || 0); }, 0) / all.length;
            var statAvg = el('statAvgPrice');
            if (statAvg) statAvg.textContent = formatINR(Math.round(avgP));
        }

        // Top body type
        var bodyCount = {};
        all.forEach(function (c) { if (c.bodyType) bodyCount[c.bodyType] = (bodyCount[c.bodyType] || 0) + 1; });
        var topBody = Object.keys(bodyCount).sort(function (a, b) { return bodyCount[b] - bodyCount[a]; })[0];
        var statTopBody = el('statTopBody');
        var statTopBodyCount = el('statTopBodyCount');
        if (topBody && statTopBody) {
            statTopBody.textContent = topBody;
            if (statTopBodyCount) statTopBodyCount.textContent = bodyCount[topBody] + ' vehicles';
        }
    } catch (e) {
        console.warn('Stats fetch failed:', e);
    }
}

/* ─── Panel Open / Close ─────────────────────────────────────────────────── */
function openPanel(carId) {
    _state.editCarId = carId || null;
    _state.newFiles = [];
    _state.imagesToDelete = [];

    // Reset form
    var form = el('carForm');
    if (form) form.reset();
    if (el('editCarId')) el('editCarId').value = '';
    if (el('newImgsGrid')) el('newImgsGrid').innerHTML = '';
    if (el('existingImgsSection')) el('existingImgsSection').classList.add('hidden');
    if (el('existingImgsGrid')) el('existingImgsGrid').innerHTML = '';
    var slugBox = el('liveSlugContainer');
    if (slugBox) slugBox.classList.add('hidden');
    updateImgCounter();

    if (carId) {
        // Edit mode — fetch car data
        if (el('panelTitle')) el('panelTitle').textContent = 'Edit Car';
        if (el('panelSubtitle')) el('panelSubtitle').textContent = 'Update existing listing';
        if (el('submitBtnText')) el('submitBtnText').textContent = 'Update Listing';
        fetchAndPopulateForm(carId);
    } else {
        // Create mode
        if (el('panelTitle')) el('panelTitle').textContent = 'Add New Car';
        if (el('panelSubtitle')) el('panelSubtitle').textContent = 'Fill in all required fields';
        if (el('submitBtnText')) el('submitBtnText').textContent = 'Save Car Listing';
    }

    if (el('slidePanel')) el('slidePanel').classList.add('open');
    if (el('overlay')) el('overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePanel() {
    if (el('slidePanel')) el('slidePanel').classList.remove('open');
    if (el('overlay')) el('overlay').classList.remove('active');
    document.body.style.overflow = '';
    _state.editCarId = null;
    _state.newFiles = [];
    _state.imagesToDelete = [];
}

async function fetchAndPopulateForm(carId) {
    try {
        var res = await fetch('/admin/cars/' + carId, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Failed to fetch car data');
        var data = await res.json();
        var car = data.car;
        populateForm(car);
    } catch (err) {
        showToast('Could not load car details: ' + err.message, 'error');
    }
}

function populateForm(car) {
    if (!car) return;
    if (el('editCarId')) el('editCarId').value = car._id;
    if (el('fBrand')) el('fBrand').value = car.make || '';
    if (el('fModel')) el('fModel').value = car.model || '';
    if (el('fVariant')) el('fVariant').value = car.variant || '';
    if (el('fYear')) el('fYear').value = car.year || '';
    if (el('fManufacturedDate')) el('fManufacturedDate').value = car.manufacturedDate ? String(car.manufacturedDate).slice(0, 10) : '';
    if (el('fReferenceId')) el('fReferenceId').value = car.referenceId || '';
    if (el('fBodyType')) el('fBodyType').value = car.bodyType || 'Sedan';
    if (el('fFuelType')) el('fFuelType').value = car.fuelType || 'Petrol';
    if (el('fTransmission')) el('fTransmission').value = car.transmission || 'Manual';
    if (el('fSeats')) el('fSeats').value = car.seats || 5;
    if (el('fMileage')) el('fMileage').value = car.mileage || '';
    if (el('fEngine')) el('fEngine').value = car.engine || '';
    if (el('fPrice')) el('fPrice').value = car.price || '';
    if (el('fOwnership')) el('fOwnership').value = car.ownership || '1st Owner';
    if (el('fRTO')) el('fRTO').value = car.rtoLocation || car.rto || '';
    if (el('fRegistrationState')) el('fRegistrationState').value = car.registrationState || '';
    if (el('fInsuranceType')) el('fInsuranceType').value = car.insuranceType || '';
    if (el('fExtColor')) el('fExtColor').value = car.extColor || '';
    if (el('fIntColor')) el('fIntColor').value = car.intColor || '';
    if (el('fDescription')) el('fDescription').value = car.description || '';
    if (el('fEquipment')) el('fEquipment').value = Array.isArray(car.equipment) ? car.equipment.join(', ') : '';
    if (el('fFeatured')) el('fFeatured').checked = !!car.isFeatured;

    // Features
    var feats = car.features || {};
    if (el('fFeatSunroof')) el('fFeatSunroof').checked = !!feats.sunroof;
    if (el('fFeatAlloys')) el('fFeatAlloys').checked = !!feats.alloyWheels;
    if (el('fFeatTouchscreen')) el('fFeatTouchscreen').checked = !!feats.touchscreen;
    if (el('fFeatCamera')) el('fFeatCamera').checked = !!feats.reverseCamera;

    // Show live SEO URL preview
    var slugBox = el('liveSlugContainer');
    var slugLink = el('liveSlugLink');
    var slugText = el('liveSlugText');
    if (slugBox && slugLink && slugText && (car.slug || car._id)) {
        var slugVal = car.slug || car._id;
        slugBox.classList.remove('hidden');
        slugLink.href = '/inventory/' + slugVal;
        slugText.textContent = '/inventory/' + slugVal;
    }

    // Trigger price preview
    updatePricePreview();

    // Render existing images
    if (car.images && car.images.length > 0 && el('existingImgsSection') && el('existingImgsGrid')) {
        el('existingImgsSection').classList.remove('hidden');
        var grid = el('existingImgsGrid');
        grid.innerHTML = car.images.map(function (img) {
            return '<div class="img-thumb" data-pid="' + img.public_id + '">' +
                '<img src="' + img.url + '" alt="car image"/>' +
                '<button type="button" class="remove-btn" onclick="markImageForDelete(this, \'' + img.public_id + '\')" title="Remove image">✕</button>' +
                '</div>';
        }).join('');
    }

    updateImgCounter();
}

/* ─── Image Handling ─────────────────────────────────────────────────────── */
function handleImagePick(input) {
    var existing = el('existingImgsGrid').children.length - _state.imagesToDelete.length;
    var maxNew = 10 - existing - _state.newFiles.length;
    var picked = Array.from(input.files).slice(0, Math.max(0, maxNew));

    picked.forEach(function (file) {
        _state.newFiles.push(file);
        var reader = new FileReader();
        reader.onload = function (e) {
            var div = document.createElement('div');
            div.className = 'img-thumb';
            var idx = _state.newFiles.indexOf(file);
            div.innerHTML =
                '<img src="' + e.target.result + '" alt="preview"/>' +
                '<button type="button" class="remove-btn" onclick="removeNewImage(this, ' + idx + ')" title="Remove">✕</button>';
            el('newImgsGrid').appendChild(div);
        };
        reader.readAsDataURL(file);
    });

    // Reset input so same file can be re-picked if removed
    input.value = '';
    updateImgCounter();
}

function markImageForDelete(btn, publicId) {
    _state.imagesToDelete.push(publicId);
    var thumb = btn.parentNode;
    thumb.style.opacity = '0.3';
    btn.textContent = '↩';
    btn.onclick = function () { unmarkImageForDelete(btn, publicId, thumb); };
    updateImgCounter();
}

function unmarkImageForDelete(btn, publicId, thumb) {
    _state.imagesToDelete = _state.imagesToDelete.filter(function (p) { return p !== publicId; });
    thumb.style.opacity = '1';
    btn.textContent = '✕';
    btn.onclick = function () { markImageForDelete(btn, publicId); };
    updateImgCounter();
}

function removeNewImage(btn, idx) {
    _state.newFiles.splice(idx, 1);
    var thumb = btn.parentNode;
    thumb.parentNode.removeChild(thumb);
    // Reindex data-idx on remaining thumbs
    Array.from(el('newImgsGrid').children).forEach(function (child, i) {
        var rb = child.querySelector('.remove-btn');
        if (rb) rb.setAttribute('onclick', 'removeNewImage(this, ' + i + ')');
    });
    updateImgCounter();
}

function updateImgCounter() {
    var existingCount = el('existingImgsGrid').children.length - _state.imagesToDelete.length;
    var total = Math.max(0, existingCount) + _state.newFiles.length;
    var ctr = el('imgCounter');
    if (ctr) ctr.textContent = total + ' / 10 Max';
}

/* ─── Price Preview ──────────────────────────────────────────────────────── */
function updatePricePreview() {
    var v = parseFloat(el('fPrice').value);
    var pp = el('pricePreview');
    if (!pp) return;
    pp.textContent = v && !isNaN(v) ? '≈ ' + formatINR(v) : '';
}

/* ─── Form Submit ────────────────────────────────────────────────────────── */
var _carForm = el('carForm');
if (_carForm) {
    _carForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = el('submitBtn');
        var txt = el('submitBtnText');
        var spn = el('submitSpinner');

        // Disable + show spinner
        if (btn) btn.disabled = true;
        if (spn) spn.classList.remove('hidden');
        if (txt) txt.textContent = _state.editCarId ? 'Updating…' : 'Saving…';

        try {
            var fd = new FormData();

            // Scalar fields
            var fields = {
                make: el('fBrand') ? el('fBrand').value.trim() : '',
                model: el('fModel') ? el('fModel').value.trim() : '',
                variant: el('fVariant') ? el('fVariant').value.trim() : '',
                year: el('fYear') ? el('fYear').value : '',
                manufacturedDate: el('fManufacturedDate') ? el('fManufacturedDate').value : '',
                referenceId: el('fReferenceId') ? el('fReferenceId').value.trim() : '',
                bodyType: el('fBodyType') ? el('fBodyType').value : 'Sedan',
                fuelType: el('fFuelType') ? el('fFuelType').value : 'Petrol',
                transmission: el('fTransmission') ? el('fTransmission').value : 'Manual',
                seats: el('fSeats') ? el('fSeats').value : 5,
                mileage: el('fMileage') ? el('fMileage').value : '',
                engine: el('fEngine') ? el('fEngine').value.trim() : '',
                price: el('fPrice') ? el('fPrice').value : '',
                ownership: el('fOwnership') ? el('fOwnership').value : '1st Owner',
                rtoLocation: el('fRTO') ? el('fRTO').value.trim() : '',
                registrationState: el('fRegistrationState') ? el('fRegistrationState').value.trim() : '',
                insuranceType: el('fInsuranceType') ? el('fInsuranceType').value.trim() : '',
                extColor: el('fExtColor') ? el('fExtColor').value.trim() : '',
                intColor: el('fIntColor') ? el('fIntColor').value.trim() : '',
                description: el('fDescription') ? el('fDescription').value.trim() : '',
                equipment: el('fEquipment') ? el('fEquipment').value.trim() : '',
                isFeatured: el('fFeatured') && el('fFeatured').checked ? 'true' : 'false',
                featSunroof: el('fFeatSunroof') && el('fFeatSunroof').checked ? 'true' : 'false',
                featAlloyWheels: el('fFeatAlloys') && el('fFeatAlloys').checked ? 'true' : 'false',
                featTouchscreen: el('fFeatTouchscreen') && el('fFeatTouchscreen').checked ? 'true' : 'false',
                featReverseCamera: el('fFeatCamera') && el('fFeatCamera').checked ? 'true' : 'false',
            };

            Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });

            // Images to delete (edit mode)
            if (_state.imagesToDelete.length > 0) {
                fd.append('imagesToDelete', JSON.stringify(_state.imagesToDelete));
            }

            // New image files
            _state.newFiles.forEach(function (file) { fd.append('images', file); });

            var url = _state.editCarId ? '/admin/cars/' + _state.editCarId : '/admin/cars';
            var method = _state.editCarId ? 'PUT' : 'POST';

            var res = await fetch(url, { method: method, body: fd });
            var data = await res.json();

            if (!res.ok) {
                var errMsg = data.error || 'Request failed.';
                if (data.missing) errMsg += ' Missing: ' + data.missing.join(', ');
                if (data.fields) errMsg += ' ' + data.fields.map(function (f) { return f.field + ': ' + f.message; }).join('. ');
                throw new Error(errMsg);
            }

            showToast(
                _state.editCarId ? 'Car updated successfully.' : 'New car added to inventory.',
                'success'
            );
            closePanel();
            _state.pagination.page = 1;
            _statsFetched = false;
            await loadCars(1);

        } catch (err) {
            console.error('Form submit error:', err);
            showToast('Error: ' + err.message, 'error');
        } finally {
            if (btn) btn.disabled = false;
            if (spn) spn.classList.add('hidden');
            if (txt) txt.textContent = _state.editCarId ? 'Update Listing' : 'Save Car Listing';
        }
    });
}

/* ─── Delete Flow ────────────────────────────────────────────────────────── */
function openDeleteModal(carId, carLabel) {
    _state.deleteTargetId = carId;
    if (el('deleteCarName')) el('deleteCarName').textContent = carLabel;
    var modal = el('deleteModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeDeleteModal() {
    _state.deleteTargetId = null;
    var modal = el('deleteModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

var _confirmDeleteBtn = el('confirmDeleteBtn');
if (_confirmDeleteBtn) {
    _confirmDeleteBtn.addEventListener('click', async function () {
        if (!_state.deleteTargetId) return;

        var spn = el('deleteSpinner');
        var btn = el('confirmDeleteBtn');
        if (btn) btn.disabled = true;
        if (spn) spn.classList.remove('hidden');

        try {
            var res = await fetch('/admin/cars/' + _state.deleteTargetId, { method: 'DELETE', headers: { Accept: 'application/json' } });
            var data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Deletion failed.');

            showToast('Car deleted and Cloudinary media scrubbed.', 'success');
            closeDeleteModal();
            _statsFetched = false;
            await loadCars(1);
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Delete failed: ' + err.message, 'error');
        } finally {
            if (btn) btn.disabled = false;
            if (spn) spn.classList.add('hidden');
        }
    });
}

/* ─── Search / Filter debounce ───────────────────────────────────────────── */
function onFilterChange() {
    _state.pagination.page = 1;
    clearTimeout(_state.searchTimer);
    _state.searchTimer = setTimeout(function () { loadCars(1); }, 350);
}

(function wireFilters() {
    ['searchInput', 'filterFuel', 'filterBody', 'filterSort'].forEach(function (id) {
        var elem = el(id);
        if (!elem) return;
        var evt = elem.tagName === 'INPUT' ? 'input' : 'change';
        elem.addEventListener(evt, onFilterChange);
    });
})();

/* ─── Price preview wire ─────────────────────────────────────────────────── */
(function () {
    var priceInput = el('fPrice');
    if (priceInput) priceInput.addEventListener('input', updatePricePreview);
})();

/* ─── Init ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
    if (el('carTableBody')) {
        loadCars(1);
    }
});

/* ─── Keep the admin UI in sync when another device signs in ─────────────── */
(function watchAdminSession() {
    var checkInProgress = false;

    async function checkSession() {
        if (checkInProgress) return;
        checkInProgress = true;
        try {
            var res = await fetch('/admin/session', {
                headers: { Accept: 'application/json' },
                cache: 'no-store'
            });
            if (res.status === 401) window.location.replace('/admin/login');
        } catch (err) {
            // A transient network issue should not sign the admin out.
        } finally {
            checkInProgress = false;
        }
    }

    window.setInterval(checkSession, 30000);
})();
