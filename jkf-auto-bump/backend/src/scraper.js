const { chromium } = require('playwright');
const { loginAndGetCookies } = require('./loginAndGetCookies');

async function autoBump(url, cookieString, jkfUsername, jkfPassword) {
    let browser;
    try {
        browser = await chromium.launch({
            headless: true
        });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            locale: 'zh-TW',
            timezoneId: 'Asia/Taipei',
            extraHTTPHeaders: {
                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        // Add an evasion script to hide the 'webdriver' property
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        // Parse cookie string into playwright format
        // Supports both JSON array (from Playwright export) and raw string (from document.cookie)
        let cookies = [];
        const trimmed = (cookieString || '').trim();
        if (trimmed.startsWith('[')) {
            // JSON array format (e.g. from previous scraper runs)
            try {
                cookies = JSON.parse(trimmed);
                cookies = cookies.map(c => {
                    const sanitized = {
                        name: String(c.name || ''),
                        value: String(c.value || ''),
                        domain: c.domain,
                        path: c.path || '/'
                    };
                    if (c.expires) sanitized.expires = Number(c.expires);
                    if (typeof c.httpOnly === 'boolean') sanitized.httpOnly = c.httpOnly;
                    if (typeof c.secure === 'boolean') sanitized.secure = c.secure;
                    return sanitized;
                });
            } catch (e) {
                console.warn('[AutoBump] Failed to parse cookie JSON:', e.message);
            }
        } else if (trimmed.length > 0) {
            // Raw string format from document.cookie (e.g. "bbs_sid=abc; bbs_token=xyz")
            console.log('[AutoBump] Parsing raw cookie string...');
            const url_obj = new URL(url);
            // Ensure domain starts with '.' for proper subdomain matching
            let cookieDomain = url_obj.hostname.replace(/^www\./, '');
            if (!cookieDomain.startsWith('.')) {
                cookieDomain = '.' + cookieDomain;
            }
            cookies = trimmed.split(';').map(pair => {
                const [name, ...rest] = pair.trim().split('=');
                return {
                    name: (name || '').trim(),
                    value: (rest.join('=') || '').trim(),
                    domain: cookieDomain,
                    path: '/'
                };
            }).filter(c => c.name.length > 0);
            console.log(`[AutoBump] Parsed ${cookies.length} cookies from raw string. Domain: ${cookieDomain}`);
        }

        // Fix domain for JSON cookies too - ensure '.' prefix
        cookies = cookies.map(c => {
            if (c.domain && !c.domain.startsWith('.')) {
                c.domain = '.' + c.domain;
            }
            return c;
        });

        if (cookies.length > 0) {
            console.log(`[AutoBump] Adding ${cookies.length} cookies. Domains: ${[...new Set(cookies.map(c => c.domain))].join(', ')}`);
            await context.addCookies(cookies);
        } else {
            console.warn('[AutoBump] WARNING: No cookies to add! Login will fail.');
        }

        const page = await context.newPage();
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log("Waiting for network idle to ensure dynamic content loads...");
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => console.log('Wait for networkidle timed out'));

        console.log("Waiting 5s for JKF specific rendering delays...");
        await page.waitForTimeout(5000);

        // Check if we are logged in
        const isGuest = await page.evaluate(() => {
            const body = document.body.innerText;
            return body.includes('訪客') && body.includes('登入');
        });
        if (isGuest) {
            console.warn('[AutoBump] WARNING: Page loaded as GUEST - cookies expired!');

            // Auto re-login if credentials are available
            if (jkfUsername && jkfPassword) {
                console.log('[AutoBump] Attempting auto re-login with stored credentials...');
                await browser.close();
                browser = null;

                const loginResult = await loginAndGetCookies(url, jkfUsername, jkfPassword);
                if (loginResult.success && loginResult.cookieString) {
                    console.log('[AutoBump] Auto re-login successful! Retrying bump with new cookies...');
                    // Recursively retry with new cookies (no credentials to avoid infinite loop on bad password)
                    const retryResult = await autoBump(url, loginResult.cookieString, null, null);
                    // Pass back the new cookie string
                    retryResult.newCookieString = loginResult.cookieString;
                    retryResult.autoRelogin = true;
                    return retryResult;
                } else {
                    console.error('[AutoBump] Auto re-login failed:', loginResult.message);
                    return { success: false, message: `自動重新登入失敗: ${loginResult.message}`, newCookieString: null };
                }
            }

            // No credentials — fall back to old behavior
            const path = require('path');
            const screenshotPath = path.join(__dirname, '..', 'failure.png');
            await page.screenshot({ path: screenshotPath, fullPage: false });

            const rawCookies = await context.cookies();
            const newCookieString = JSON.stringify(rawCookies);
            return { success: false, message: 'Cookie 已失效，請重新輸入 Cookie 或設定帳密以自動登入。', newCookieString };
        } else {
            console.log('[AutoBump] Login appears successful.');
        }

        // 0. Handle 18+ Age Verification Modal (button is inside <apea-logo> shadow DOM)
        try {
            const ageClicked = await page.evaluate(() => {
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                    if (el.shadowRoot) {
                        const btns = el.shadowRoot.querySelectorAll('button, a, [role="button"]');
                        for (const btn of btns) {
                            if (btn.textContent && (btn.textContent.includes('18') || btn.textContent.includes('滿'))) {
                                btn.click();
                                return true;
                            }
                        }
                    }
                }
                return false;
            });
            if (ageClicked) {
                console.log(`[AutoBump] Clicked 18+ button inside shadow DOM.`);
                await page.waitForTimeout(1000);
            }
        } catch (ageErr) {
            // Ignore if not present
        }

        // We try multiple locators to find it, including the new UI layout.
        // For the new Nuxt UI, it's a <button> with classes like 'jkf-button', 'bg-yellow-400', etc.
        const bumpLocatorNuxt = page.locator('button.jkf-button:has-text("現在有空"), button.bg-yellow-400:has-text("現在有空")').first();
        const bumpLocatorNewDiv = page.locator('div:has-text("現在有空")').filter({ hasNot: page.locator('div:has-text("營業狀態")') }).first(); // Targets the inner div
        const bumpLocatorText1 = page.locator('text=我有空').first();
        const bumpLocatorText2 = page.locator('text=現在有空').first();
        const bumpLocatorImg = page.locator('img[alt*="我有空"], img[src*="free"]').first();
        const bumpLocatorLink = page.locator('a:has-text("我有空"), a:has-text("現在有空")').first();
        const bumpLocatorCss = page.locator('a.free_bump, a.bump_btn, #free_bump, .oshr_free_bump a').first();

        let bumped = false;

        // Start from most specific/newest locators to generic ones
        if (await bumpLocatorNuxt.isVisible()) {
            await bumpLocatorNuxt.click();
            bumped = true;
            console.log(`[AutoBump] Clicked Nuxt UI button`);
        } else if (await bumpLocatorNewDiv.isVisible()) {
            await bumpLocatorNewDiv.click();
            bumped = true;
            console.log(`[AutoBump] Clicked modern div UI button`);
        } else if (await bumpLocatorCss.isVisible()) {
            await bumpLocatorCss.click();
            bumped = true;
        } else if (await bumpLocatorText2.isVisible()) {
            await bumpLocatorText2.click();
            bumped = true;
        } else if (await bumpLocatorText1.isVisible()) {
            await bumpLocatorText1.click();
            bumped = true;
        } else if (await bumpLocatorImg.isVisible()) {
            await bumpLocatorImg.click();
            bumped = true;
        } else if (await bumpLocatorLink.isVisible()) {
            await bumpLocatorLink.click();
            bumped = true;
        }

        if (bumped) {
            console.log(`[Success] Successfully clicked "我有空" on ${url}`);

            // The new Nuxt UI does an AJAX/fetch request. Wait for network idle or a specific toast message.
            console.log(`[AutoBump] Waiting for network to settle after click...`);
            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { });

            // Wait for a second in case the page needs to refresh the expiration time dynamically via DOM update
            await page.waitForTimeout(3000);

            let topExpiresAt = null;
            let freeStatus = null;
            try {
                const bodyText = await page.innerText('body');
                // The Nuxt UI might show a toast saying "更新狀態成功" or change the button text
                if (bodyText.includes('處理中') || bodyText.includes('更新狀態成功') || bodyText.includes('推文成功')) {
                    console.log(`[AutoBump] Detected success message in DOM.`);
                }

                // Extract business status (營業狀態) text
                const statusMatch = bodyText.match(/營業狀態[-.—\s]*([^\n]+)/);
                if (statusMatch && statusMatch[1]) {
                    freeStatus = statusMatch[1].trim();
                    console.log(`[Scraped] Business status: ${freeStatus}`);
                }
            } catch (e) {
                console.log("[Notice] Could not extract page info:", e.message);
            }

            let threadTitle = await page.title();
            threadTitle = threadTitle.replace(/ - JKF.*/, '').trim();

            const rawCookies = await context.cookies();
            const newCookieString = JSON.stringify(rawCookies);

            return { success: true, message: 'Successfully clicked bump button.', topExpiresAt, freeStatus, threadTitle, newCookieString };
        } else {
            // Button not found — check if already in "現在有空" state (countdown is active)
            console.log(`[Info] Bump button not found on ${url}, checking if already free...`);

            const bodyText = await page.innerText('body');
            const alreadyFree = bodyText.includes('現在有空') || bodyText.includes('營業狀態') && bodyText.match(/剩下\s*\d+:\d+/);

            if (alreadyFree) {
                console.log(`[Success] Already in "現在有空" state, no need to click.`);

                let topExpiresAt = null;
                let freeStatus = null;
                try {
                    const topMatch = bodyText.match(/一般置頂\s*時間到[：:]\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/);
                    if (topMatch && topMatch[1]) {
                        topExpiresAt = topMatch[1];
                    }
                    const statusMatch = bodyText.match(/營業狀態[-.—\s]*([^\n]+)/);
                    if (statusMatch && statusMatch[1]) {
                        freeStatus = statusMatch[1].trim();
                    }
                } catch (e) { /* ignore */ }

                let threadTitle = await page.title();
                threadTitle = threadTitle.replace(/ - JKF.*/, '').trim();

                const rawCookies = await context.cookies();
                const newCookieString = JSON.stringify(rawCookies);

                return { success: true, message: '已在有空狀態中，無需再次點擊。', topExpiresAt, freeStatus, threadTitle, newCookieString };
            }

            // Truly not found — save debug info
            const title = await page.title();
            console.log(`[Failed] Page Title was: ${title}`);
            const path = require('path');
            const fs = require('fs');
            const screenshotPath = path.join(__dirname, '..', 'failure.png');
            const htmlPath = path.join(__dirname, '..', 'failure.html');
            await page.screenshot({ path: screenshotPath, fullPage: true });

            try {
                const pageContent = await page.content();
                fs.writeFileSync(htmlPath, pageContent);
            } catch (e) {
                console.error('Could not save failure HTML:', e);
            }

            const rawCookies = await context.cookies();
            const newCookieString = JSON.stringify(rawCookies);

            return { success: false, message: `Button not found. Title: ${title}. Check backend/failure.png`, newCookieString };
        }

    } catch (error) {
        console.error(`[Error] Error in autoBump for ${url}:`, error);
        return { success: false, message: error.message };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { autoBump };
