// --- 1. INDIAN MARKET VEHICLES DATA ---
const cars = [
    {
        id: 1,
        make: 'Mahindra',
        model: 'Scorpio-N Z8 L 4WD',
        year: 2023,
        price: 2150000,
        mileage: 18500,
        transmission: 'Automatic',
        fuel: 'Diesel',
        bodyType: 'SUV',
        image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80',
        isFeatured: true,
        cpo: true,
        extColor: 'Napoli Black',
        intColor: 'Coffee Black & Rich Tan',
        ownership: '1st Owner',
        rto: 'MH-02 (Mumbai)'
    },
    {
        id: 2,
        make: 'Tata',
        model: 'Harrier Fearless Plus Dark Edition',
        year: 2023,
        price: 1980000,
        mileage: 14000,
        transmission: 'Automatic',
        fuel: 'Diesel',
        bodyType: 'SUV',
        image: 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=800&q=80',
        isFeatured: true,
        cpo: true,
        extColor: 'Oberon Black',
        intColor: 'Carnelian Red',
        ownership: '1st Owner',
        rto: 'DL-3C (Delhi)'
    },
    {
        id: 3,
        make: 'Tata',
        model: 'Nexon EV Empowered Plus',
        year: 2023,
        price: 1475000,
        mileage: 12500,
        transmission: 'Automatic',
        fuel: 'Electric',
        bodyType: 'EV',
        image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80',
        isFeatured: true,
        cpo: true,
        extColor: 'Empowered Oxide',
        intColor: 'Dual-Tone Grey',
        ownership: '1st Owner',
        rto: 'KA-01 (Bengaluru)'
    },
    {
        id: 4,
        make: 'Mahindra',
        model: 'Thar LX 4x4 Hard Top',
        year: 2022,
        price: 1420000,
        mileage: 26000,
        transmission: 'Manual',
        fuel: 'Diesel',
        bodyType: 'SUV',
        image: 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=800&q=80',
        isFeatured: true,
        cpo: true,
        extColor: 'Red Rage',
        intColor: 'All-Black',
        ownership: '1st Owner',
        rto: 'HR-26 (Gurugram)'
    },
    {
        id: 5,
        make: 'Maruti Suzuki',
        model: 'Grand Vitara Alpha+ Hybrid',
        year: 2023,
        price: 1680000,
        mileage: 16000,
        transmission: 'Automatic',
        fuel: 'Hybrid',
        bodyType: 'SUV',
        image: 'https://images.unsplash.com/photo-1617814076367-b75f4fd15328?w=800&q=80',
        isFeatured: false,
        cpo: true,
        extColor: 'Nexa Blue',
        intColor: 'Bordeaux & Black',
        ownership: '1st Owner',
        rto: 'TS-09 (Hyderabad)'
    },
    {
        id: 6,
        make: 'Maruti Suzuki',
        model: 'Swift ZXi Plus',
        year: 2022,
        price: 740000,
        mileage: 29000,
        transmission: 'Manual',
        fuel: 'Petrol',
        bodyType: 'Hatchback',
        image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&q=80',
        isFeatured: false,
        cpo: true,
        extColor: 'Solid Fire Red',
        intColor: 'Black',
        ownership: '1st Owner',
        rto: 'MH-12 (Pune)'
    }
];

// --- 2. APP LOGIC & STATE ---
const app = {
    currentCarId: null,

    // View Router
    navigate: function (viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(viewName + '-view');
        if (targetView) targetView.classList.add('active');

        window.scrollTo(0, 0);

        if (viewName === 'home') {
            this.renderFeatured();
            const heroVideo = document.getElementById('hero-video');
            if (heroVideo) {
                heroVideo.play().catch(err => console.log("Autoplay deferred:", err));
            }
        }
        if (viewName === 'inventory') {
            this.filterInventory();
        }
    },

    // Formatter for INR Currency (₹)
    formatPrice: function (price) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(price);
    },

    // Card Template Generator
    generateCardHTML: function (car) {
        return `
            <div class="car-card" onclick="app.viewDetails(${car.id})">
                <div class="car-img-wrapper">
                    <img src="${car.image}" alt="${car.make} ${car.model}">
                    ${car.cpo ? '<div class="cpo-tag">✓ AutoVault Certified</div>' : ''}
                </div>
                <div class="car-details">
                    <div class="car-title">${car.year} ${car.make} ${car.model}</div>
                    <div class="car-specs">${car.mileage.toLocaleString('en-IN')} km | ${car.fuel} | ${car.transmission}</div>
                    <div class="car-location">📍 ${car.rto} • ${car.ownership}</div>
                    <div class="car-price">${this.formatPrice(car.price)}</div>
                </div>
            </div>
        `;
    },

    // Render Featured Cars
    renderFeatured: function () {
        const featured = cars.filter(c => c.isFeatured).slice(0, 3);
        const grid = document.getElementById('featured-grid');
        if (grid) grid.innerHTML = featured.map(c => this.generateCardHTML(c)).join('');
    },

    // Header Search bar handler
    handleSearch: function (query) {
        const filterSearch = document.getElementById('filter-search');
        if (filterSearch) filterSearch.value = query;
        this.navigate('inventory');
        this.filterInventory();
    },

    // Home Quick-Finder bridge
    applyQuickFinder: function () {
        const makeVal = document.getElementById('qf-make').value;
        const bodyVal = document.getElementById('qf-body').value;
        const priceVal = document.getElementById('qf-price').value;

        // Sync with Inventory sidebar filters
        const filterMake = document.getElementById('filter-make');
        const filterBody = document.getElementById('filter-body');
        const filterPrice = document.getElementById('filter-price');

        if (filterMake) filterMake.value = makeVal;
        if (filterBody) filterBody.value = bodyVal;
        if (filterPrice) filterPrice.value = priceVal;

        this.navigate('inventory');
    },

    // Category click handler
    filterByCategory: function (category) {
        this.resetFilters(false);
        const filterBody = document.getElementById('filter-body');
        if (filterBody) filterBody.value = category;
        this.navigate('inventory');
    },

    // Reset all inventory filters
    resetFilters: function (runFilter = true) {
        const navSearch = document.getElementById('nav-search-input');
        const filterSearch = document.getElementById('filter-search');
        const filterMake = document.getElementById('filter-make');
        const filterBody = document.getElementById('filter-body');
        const filterFuel = document.getElementById('filter-fuel');
        const filterPrice = document.getElementById('filter-price');
        const sortSelect = document.getElementById('sort-select');

        if (navSearch) navSearch.value = '';
        if (filterSearch) filterSearch.value = '';
        if (filterMake) filterMake.value = 'all';
        if (filterBody) filterBody.value = 'all';
        if (filterFuel) filterFuel.value = 'all';
        if (filterPrice) filterPrice.value = '3500000';
        if (sortSelect) sortSelect.value = 'price-asc';

        if (runFilter) this.filterInventory();
    },

    // Robust Multi-Filter System
    filterInventory: function () {
        const priceInput = document.getElementById('filter-price');
        const searchInput = document.getElementById('filter-search');
        const makeSelect = document.getElementById('filter-make');
        const bodySelect = document.getElementById('filter-body');
        const fuelSelect = document.getElementById('filter-fuel');
        const sortSelect = document.getElementById('sort-select');

        // Extract Current Filter Values
        const maxPrice = priceInput ? parseInt(priceInput.value, 10) : 3500000;
        const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedMake = makeSelect ? makeSelect.value.toLowerCase() : 'all';
        const selectedBody = bodySelect ? bodySelect.value.toLowerCase() : 'all';
        const selectedFuel = fuelSelect ? fuelSelect.value.toLowerCase() : 'all';
        const sortMode = sortSelect ? sortSelect.value : 'price-asc';

        // Update Price Label
        const priceLabel = document.getElementById('price-val');
        if (priceLabel) {
            priceLabel.innerText = this.formatPrice(maxPrice);
        }

        // Apply Multi-Condition Filtering
        let filtered = cars.filter(car => {
            // 1. Price
            if (car.price > maxPrice) return false;

            // 2. Brand / Make
            if (selectedMake !== 'all' && car.make.toLowerCase() !== selectedMake) {
                return false;
            }

            // 3. Body Style
            if (selectedBody !== 'all' && car.bodyType.toLowerCase() !== selectedBody) {
                return false;
            }

            // 4. Fuel Type
            if (selectedFuel !== 'all' && !car.fuel.toLowerCase().includes(selectedFuel)) {
                return false;
            }

            // 5. Search Text
            if (searchQuery !== '') {
                const combinedData = `${car.make} ${car.model} ${car.year} ${car.fuel} ${car.bodyType} ${car.rto}`.toLowerCase();
                if (!combinedData.includes(searchQuery)) return false;
            }

            return true;
        });

        // Apply Sorting
        if (sortMode === 'price-asc') filtered.sort((a, b) => a.price - b.price);
        if (sortMode === 'price-desc') filtered.sort((a, b) => b.price - a.price);
        if (sortMode === 'year-desc') filtered.sort((a, b) => b.year - a.year);
        if (sortMode === 'km-asc') filtered.sort((a, b) => a.mileage - b.mileage);

        // Render Results or Empty State
        const grid = document.getElementById('inventory-grid');
        const count = document.getElementById('result-count');

        if (count) count.innerText = filtered.length;

        if (grid) {
            if (filtered.length > 0) {
                grid.innerHTML = filtered.map(c => this.generateCardHTML(c)).join('');
            } else {
                grid.innerHTML = `
                    <div class="empty-state">
                        <h3>No cars match your search filters</h3>
                        <p>Try widening your budget, removing specific brand criteria, or resetting all filters.</p>
                        <button class="btn-primary" onclick="app.resetFilters()">Clear Filters</button>
                    </div>
                `;
            }
        }
    },

    // PDP Routing & Data Population
    viewDetails: function (id) {
        this.currentCarId = id;
        const car = cars.find(c => c.id === id);
        if (!car) return;

        document.getElementById('pdp-main-img').src = car.image;
        document.getElementById('pdp-title').innerText = `${car.year} ${car.make} ${car.model}`;
        document.getElementById('pdp-price').innerText = this.formatPrice(car.price);

        const cpoTag = document.getElementById('pdp-cpo');
        if (cpoTag) {
            cpoTag.style.display = car.cpo ? 'inline-block' : 'none';
        }

        const specsHTML = `
            <div class="spec-item"><span>Kilometers Run</span> ${car.mileage.toLocaleString('en-IN')} km</div>
            <div class="spec-item"><span>Fuel Type</span> ${car.fuel}</div>
            <div class="spec-item"><span>Transmission</span> ${car.transmission}</div>
            <div class="spec-item"><span>RTO Registration</span> ${car.rto}</div>
            <div class="spec-item"><span>Ownership</span> ${car.ownership}</div>
            <div class="spec-item"><span>Body Style</span> ${car.bodyType}</div>
            <div class="spec-item"><span>Exterior Color</span> ${car.extColor}</div>
            <div class="spec-item"><span>Interior Color</span> ${car.intColor}</div>
        `;
        document.getElementById('pdp-specs').innerHTML = specsHTML;

        this.calculateFinance();
        this.navigate('pdp');
    },

    // EMI Calculator Logic (9% Indian Auto Loan Standard)
    calculateFinance: function () {
        if (!this.currentCarId) return;

        const car = cars.find(c => c.id === this.currentCarId);
        const downPayment = parseInt(document.getElementById('calc-down').value, 10) || 0;
        const months = parseInt(document.getElementById('calc-term').value, 10) || 60;

        const principal = car.price - downPayment;

        if (principal <= 0) {
            document.getElementById('calc-result').innerText = '₹0';
            return;
        }

        const monthlyRate = (0.09 / 12);
        const estimatedEMI = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);

        document.getElementById('calc-result').innerText = this.formatPrice(Math.round(estimatedEMI));
    },

    // Initialization
    init: function () {
        const downPaymentInput = document.getElementById('calc-down');
        if (downPaymentInput) downPaymentInput.addEventListener('input', () => this.calculateFinance());

        const termSelect = document.getElementById('calc-term');
        if (termSelect) termSelect.addEventListener('change', () => this.calculateFinance());

        const heroVideo = document.getElementById('hero-video');
        if (heroVideo) {
            heroVideo.play().catch(err => console.log("Autoplay deferred:", err));
        }

        this.navigate('home');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});