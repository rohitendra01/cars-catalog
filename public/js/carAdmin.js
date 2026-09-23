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
    cars:         [],
    pagination:   { page: 1, limit: 20, total: 0, totalPages: 0 },
    isLoading:    false,
    editCarId:    null,         // null = create mode
    newFiles:     [],           // File objects staged for upload
    imagesToDelete: [],         // Cloudinary public_ids marked for removal
    searchTimer:  null,
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
    var id   = 'toast-' + (++_toastId);
    var container = el('toastContainer');
    if (!container) return;

    var colors = {
        success: 'border-emerald-500 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950',
        error:   'border-red-500   bg-zinc-950 dark:bg-white text-white dark:text-zinc-950',
        info:    'border-brand     bg-zinc-950 dark:bg-white text-white dark:text-zinc-950',
    };
    var dots = {
        success: 'bg-emerald-500',
        error:   'bg-red-500',
        info:    'bg-brand',
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
        search:   (el('searchInput')  || {}).value  || '',
        fuelType: (el('filterFuel')   || {}).value  || '',
        bodyType: (el('filterBody')   || {}).value  || '',
        sort:     (el('filterSort')   || {}).value  || 'newest',
    };
}

function buildQuery(extra) {
    var f = getFilters();
    var p = _state.pagination;
    var params = new URLSearchParams({
        page:    extra && extra.page ? extra.page : p.page,
        limit:   p.limit,
        search:  f.search,
        fuelType: f.fuelType,
        bodyType: f.bodyType,
        sort:    f.sort,
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
        var res  = await fetch('/admin/cars?' + buildQuery(), {
            headers: { 'Accept': 'application/json' }
        });

        if (res.status === 401) {
            showToast('Session expired — please refresh and log in again.', 'error');
            showTableEmpty('Unauthorised — please log in.');
            return;
        }
        if (!res.ok) {
            var err = await res.json().catch(function () { return {}; });
            throw new Error(err.error || 'Server error ' + res.status);
        }

        var data = await res.json();
        _state.cars       = data.cars       || [];
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
        var img    = car.primaryImage || '';
        var price  = formatINR(car.price);
        var featured = car.isFeatured
            ? '<span class="inline-block px-2 py-0.5 bg-brand/10 text-brand font-mono text-[9px] uppercase tracking-widest border border-brand/30">Featured</span>'
            : '<span class="inline-block px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono text-[9px] uppercase tracking-widest">Standard</span>';

        return '<tr class="car-row" data-id="' + car._id + '">' +
            // Photo
            '<td class="px-4 py-3">' +
            '<div class="w-14 h-10 bg-zinc-100 dark:bg-zinc-900 overflow-hidden shrink-0">' +
            (img ? '<img src="' + img + '" alt="' + car.make + ' ' + car.model + '" class="w-full h-full object-cover"/>' :
                '<div class="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">' +
                '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' +
                '</div>') +
            '</div></td>' +
            // Brand
            '<td class="px-4 py-3"><span class="font-bold text-zinc-950 dark:text-white text-sm">' + (car.make || '—') + '</span></td>' +
            // Model
            '<td class="px-4 py-3"><span class="font-mono text-zinc-700 dark:text-zinc-300 text-xs">' + (car.model || '—') + '</span></td>' +
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
    var bar      = el('paginationBar');
    var info     = el('paginationInfo');
    var btnsEl   = el('paginationBtns');
    var p        = _state.pagination;
    var sub      = el('inventorySubtitle');

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
    var to   = Math.min(p.page * p.limit, p.total);
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
    var end   = Math.min(p.totalPages, start + 4);
    start     = Math.max(1, end - 4);

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
    var p    = _state.pagination;

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
        var res  = await fetch('/admin/cars?limit=100&page=1', { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        var data = await res.json();
        var all  = data.cars || [];

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
    _state.editCarId      = carId || null;
    _state.newFiles       = [];
    _state.imagesToDelete = [];

    // Reset form
    var form = el('carForm');
    if (form) form.reset();
    el('editCarId').value = '';
    el('newImgsGrid').innerHTML      = '';
    el('existingImgsSection').classList.add('hidden');
    el('existingImgsGrid').innerHTML = '';
    updateImgCounter();

    if (carId) {
        // Edit mode — fetch car data
        el('panelTitle').textContent    = 'Edit Car';
        el('panelSubtitle').textContent = 'Update existing listing';
        el('submitBtnText').textContent = 'Update Listing';
        fetchAndPopulateForm(carId);
    } else {
        // Create mode
        el('panelTitle').textContent    = 'Add New Car';
        el('panelSubtitle').textContent = 'Fill in all required fields';
        el('submitBtnText').textContent = 'Save Car Listing';
    }

    el('slidePanel').classList.add('open');
    el('overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePanel() {
    el('slidePanel').classList.remove('open');
    el('overlay').classList.remove('active');
    document.body.style.overflow = '';
    _state.editCarId      = null;
    _state.newFiles       = [];
    _state.imagesToDelete = [];
}

async function fetchAndPopulateForm(carId) {
    try {
        var res = await fetch('/admin/cars/' + carId, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Failed to fetch car data');
        var data = await res.json();
        var car  = data.car;
        populateForm(car);
    } catch (err) {
        showToast('Could not load car details: ' + err.message, 'error');
    }
}

function populateForm(car) {
    el('editCarId').value     = car._id;
    el('fBrand').value        = car.make         || '';
    el('fModel').value        = car.model        || '';
    el('fYear').value         = car.year         || '';
    el('fBodyType').value     = car.bodyType     || 'Sedan';
    el('fFuelType').value     = car.fuelType     || 'Petrol';
    el('fTransmission').value = car.transmission || 'Manual';
    el('fSeats').value        = car.seats        || 5;
    el('fMileage').value      = car.mileage      || '';
    el('fPrice').value        = car.price        || '';
    el('fOwnership').value    = car.ownership    || '1st Owner';
    el('fRTO').value          = car.rto          || '';
    el('fExtColor').value     = car.extColor     || '';
    el('fIntColor').value     = car.intColor     || '';
    el('fDescription').value  = car.description  || '';
    el('fFeatured').checked   = !!car.isFeatured;

    // Trigger price preview
    updatePricePreview();

    // Render existing images
    if (car.images && car.images.length > 0) {
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
    var existing  = el('existingImgsGrid').children.length - _state.imagesToDelete.length;
    var maxNew    = 10 - existing - _state.newFiles.length;
    var picked    = Array.from(input.files).slice(0, Math.max(0, maxNew));

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
    var v   = parseFloat(el('fPrice').value);
    var pp  = el('pricePreview');
    if (!pp) return;
    pp.textContent = v && !isNaN(v) ? '≈ ' + formatINR(v) : '';
}

/* ─── Form Submit ────────────────────────────────────────────────────────── */
el('carForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = el('submitBtn');
    var txt = el('submitBtnText');
    var spn = el('submitSpinner');

    // Disable + show spinner
    btn.disabled = true;
    if (spn) spn.classList.remove('hidden');
    if (txt) txt.textContent = _state.editCarId ? 'Updating…' : 'Saving…';

    try {
        var fd = new FormData();

        // Scalar fields
        var fields = {
            make:         el('fBrand').value.trim(),
            model:        el('fModel').value.trim(),
            year:         el('fYear').value,
            bodyType:     el('fBodyType').value,
            fuelType:     el('fFuelType').value,
            transmission: el('fTransmission').value,
            seats:        el('fSeats').value,
            mileage:      el('fMileage').value,
            price:        el('fPrice').value,
            ownership:    el('fOwnership').value,
            rto:          el('fRTO').value.trim(),
            extColor:     el('fExtColor').value.trim(),
            intColor:     el('fIntColor').value.trim(),
            description:  el('fDescription').value.trim(),
            isFeatured:   el('fFeatured').checked ? 'true' : 'false',
        };

        Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });

        // Images to delete (edit mode)
        if (_state.imagesToDelete.length > 0) {
            fd.append('imagesToDelete', JSON.stringify(_state.imagesToDelete));
        }

        // New image files
        _state.newFiles.forEach(function (file) { fd.append('images', file); });

        var url    = _state.editCarId ? '/admin/cars/' + _state.editCarId : '/admin/cars';
        var method = _state.editCarId ? 'PUT' : 'POST';

        var res = await fetch(url, { method: method, body: fd });
        var data = await res.json();

        if (!res.ok) {
            // Build error message from server response
            var errMsg = data.error || 'Request failed.';
            if (data.missing) errMsg += ' Missing: ' + data.missing.join(', ');
            if (data.fields)  errMsg += ' ' + data.fields.map(function (f) { return f.field + ': ' + f.message; }).join('. ');
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
        btn.disabled = false;
        if (spn) spn.classList.add('hidden');
        if (txt) txt.textContent = _state.editCarId ? 'Update Listing' : 'Save Car Listing';
    }
});

/* ─── Delete Flow ────────────────────────────────────────────────────────── */
function openDeleteModal(carId, carLabel) {
    _state.deleteTargetId = carId;
    el('deleteCarName').textContent = carLabel;
    var modal = el('deleteModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeDeleteModal() {
    _state.deleteTargetId = null;
    var modal = el('deleteModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

el('confirmDeleteBtn').addEventListener('click', async function () {
    if (!_state.deleteTargetId) return;

    var spn = el('deleteSpinner');
    var btn = el('confirmDeleteBtn');
    btn.disabled = true;
    if (spn) spn.classList.remove('hidden');

    try {
        var res  = await fetch('/admin/cars/' + _state.deleteTargetId, { method: 'DELETE', headers: { Accept: 'application/json' } });
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
        btn.disabled = false;
        if (spn) spn.classList.add('hidden');
    }
});

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
    loadCars(1);
});
