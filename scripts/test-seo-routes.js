const http = require('http');

function get(path) {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3000' + path, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        }).on('error', reject);
    });
}

function post(path, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req = http.request('http://localhost:3000' + path, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function run() {
    console.log('--- Testing Core Routes ---');
    const home = await get('/');
    console.log('GET / -> Status:', home.status, 'Body length:', home.body.length);

    const inv = await get('/inventory');
    console.log('GET /inventory -> Status:', inv.status, 'Body length:', inv.body.length);

    const sitemap = await get('/sitemap.xml');
    console.log('GET /sitemap.xml -> Status:', sitemap.status, 'Content-Type:', sitemap.headers['content-type']);
    console.log('Sitemap body:\n' + sitemap.body);

    const robots = await get('/robots.txt');
    console.log('GET /robots.txt -> Status:', robots.status, '\n' + robots.body);

    const carsRedirect = await get('/cars');
    console.log('GET /cars -> Status:', carsRedirect.status, 'Location:', carsRedirect.headers.location);

    const leadRes = await post('/api/leads', {
        customerName: 'Aarav Sharma',
        phone: '9876543210',
        inquiryType: 'Schedule Visit',
        message: 'City / Pincode: Jabalpur 482002'
    });
    console.log('POST /api/leads -> Status:', leadRes.status, 'Response:', leadRes.body);

    const slugMatches = [...sitemap.body.matchAll(/<loc>https?:\/\/[^\/]+\/inventory\/([^<]+)<\/loc>/g)];
    if (slugMatches.length > 0) {
        const testSlug = slugMatches[0][1];
        console.log('\n--- Testing PDP SEO slug:', testSlug, '---');
        const pdp = await get('/inventory/' + testSlug);
        console.log('GET /inventory/' + testSlug + ' -> Status:', pdp.status);
        console.log('Contains canonical?', pdp.body.includes('rel="canonical"'));
        console.log('Contains og:title?', pdp.body.includes('property="og:title"'));
        console.log('Contains schema.org?', pdp.body.includes('@type') && pdp.body.includes('Car'));

        // Test uppercase slug redirect
        const upperSlug = testSlug.toUpperCase();
        const upperPdp = await get('/inventory/' + upperSlug);
        console.log('GET /inventory/' + upperSlug + ' -> Status:', upperPdp.status, 'Location:', upperPdp.headers.location);

        // Test /cars/:slug alias redirect
        const aliasCars = await get('/cars/' + testSlug);
        console.log('GET /cars/' + testSlug + ' -> Status:', aliasCars.status, 'Location:', aliasCars.headers.location);
    } else {
        console.log('No car slugs in sitemap. Listing might be empty or cars need seeding.');
    }
}

run().catch(console.error);
