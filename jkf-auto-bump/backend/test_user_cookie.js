const fs = require('fs');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

function loadCookieJson() {
    const rawFromEnv = process.env.JKF_TEST_COOKIES_JSON;
    if (rawFromEnv && rawFromEnv.trim().length > 0) {
        return rawFromEnv.trim();
    }

    const filePath = process.env.JKF_TEST_COOKIES_FILE;
    if (filePath && fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
    }

    throw new Error(
        'Missing cookies. Set JKF_TEST_COOKIES_JSON or JKF_TEST_COOKIES_FILE.'
    );
}

function toPlaywrightCookies(rawJson) {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) {
        throw new Error('Cookie JSON must be an array.');
    }

    return parsed.map((c) => {
        const sanitized = {
            name: String(c.name || ''),
            value: String(c.value || ''),
            domain: c.domain,
            path: c.path || '/'
        };

        if (c.expirationDate) {
            sanitized.expires = Number(c.expirationDate);
        } else if (c.expires && c.expires !== -1) {
            sanitized.expires = Number(c.expires);
        }

        if (typeof c.httpOnly === 'boolean') sanitized.httpOnly = c.httpOnly;
        if (typeof c.secure === 'boolean') sanitized.secure = c.secure;
        if (sanitized.domain && !sanitized.domain.startsWith('.')) {
            sanitized.domain = '.' + sanitized.domain;
        }

        return sanitized;
    });
}

async function isGuest(page) {
    return page.evaluate(() => {
        const loggedNode = document.querySelector('[data-logged-in]');
        if (loggedNode) {
            const state = loggedNode.getAttribute('data-logged-in');
            if (state === 'false') return true;
            if (state === 'true') return false;
        }
        return !!document.querySelector('a[href*="login"], button[id*="login"], [class*="login"]');
    });
}

(async () => {
    const cookieJson = loadCookieJson();
    const cookies = toPlaywrightCookies(cookieJson);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto('https://jkforum.net/forum.php', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const guest = await isGuest(page);
    console.log('Is guest?', guest);

    if (guest) {
        await page.screenshot({ path: 'test_cookie_failed.png', fullPage: true });
        console.log('Saved screenshot to test_cookie_failed.png');
    } else {
        console.log('Cookie login looks valid.');
    }

    await browser.close();
})().catch((err) => {
    console.error('[test_user_cookie] Error:', err.message);
    process.exit(1);
});
