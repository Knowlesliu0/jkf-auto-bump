const https = require('https');
const { URL } = require('url');

function httpGet(urlStr) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        https.get(urlStr, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
            }
        }, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
}

(async () => {
    // Fetch the LoginView JS
    console.log('Fetching LoginView JS...');
    const res = await httpGet('https://pan-login.hare200.com/assets/LoginView-C3UhHW9Y.js');
    console.log('Status:', res.status, 'Size:', res.body.length);

    // Search for fetch/axios/post calls
    const fetchCalls = res.body.match(/fetch\s*\([^)]+\)/g);
    console.log('\nfetch() calls:', fetchCalls ? fetchCalls.length : 0);
    if (fetchCalls) fetchCalls.forEach(f => console.log('  ', f.substring(0, 150)));

    const postCalls = res.body.match(/\.post\s*\([^)]+\)/g);
    console.log('\n.post() calls:', postCalls ? postCalls.length : 0);
    if (postCalls) postCalls.forEach(f => console.log('  ', f.substring(0, 150)));

    // Search for API paths
    const apiPaths = res.body.match(/["'][^"']*(?:login|auth|session|token|signin|password)[^"']*["']/gi);
    console.log('\nAuth-related strings:');
    if (apiPaths) {
        [...new Set(apiPaths)].filter(p => p.length < 120).forEach(p => console.log('  ', p));
    }

    // Find axios/http calls with method
    const httpMethods = res.body.match(/method\s*:\s*["'][^"']+["']/g);
    console.log('\nHTTP methods:', httpMethods || 'none');

    // Find URL patterns
    const urlPatterns = res.body.match(/url\s*:\s*["'][^"']+["']/g);
    console.log('\nURL patterns:');
    if (urlPatterns) urlPatterns.forEach(u => console.log('  ', u));

    // Look for any /api/ references
    const allApiRefs = res.body.match(/["']\/api\/[^"']+["']/g);
    console.log('\nAll /api/ references:');
    if (allApiRefs) [...new Set(allApiRefs)].forEach(r => console.log('  ', r));

    // Also fetch the pan-core JS to check for login API
    console.log('\n\nFetching pan-core-frontend.js...');
    const coreRes = await httpGet('https://public.hare200.com/pan-core/v0.52.12/pan-core-frontend.js');
    console.log('Status:', coreRes.status, 'Size:', coreRes.body.length);

    const coreApiRefs = coreRes.body.match(/["']\/api\/[^"']+["']/g);
    console.log('\nAll /api/ references in pan-core:');
    if (coreApiRefs) [...new Set(coreApiRefs)].slice(0, 30).forEach(r => console.log('  ', r));

    const coreLoginRefs = coreRes.body.match(/["'][^"']*(?:login|auth|session|password|signin)[^"']*["']/gi);
    console.log('\nAuth references in pan-core:');
    if (coreLoginRefs) [...new Set(coreLoginRefs)].filter(r => r.length < 80).slice(0, 20).forEach(r => console.log('  ', r));

})();
