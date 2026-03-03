const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function loginAndGetCookies(url, username, password) {
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

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        const page = await context.newPage();

        // Step 1: Navigate to JKF homepage (the login modal only triggers from UI clicks)
        console.log(`[AutoLogin] Navigating to JKF homepage...`);
        await page.goto('https://www.jkforum.net/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
        await page.waitForTimeout(3000);

        // Handle 18+ Age Verification (shadow DOM)
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
                console.log(`[AutoLogin] Clicked 18+ button.`);
                await page.waitForTimeout(1500);
            }
        } catch (e) { }

        // Step 2: Click the 登入 button to open the login modal
        console.log(`[AutoLogin] Clicking 登入 button to open modal...`);
        const loginButtonSelectors = [
            'span.cursor-pointer:has-text("登入")',
            '.left-user-info span:has-text("登入")',
            'button:has-text("登入")',
            'a:has-text("登入")',
            'text=登入',
        ];

        let modalOpened = false;
        for (const sel of loginButtonSelectors) {
            try {
                const btn = page.locator(sel).first();
                if (await btn.isVisible({ timeout: 2000 })) {
                    await btn.click({ force: true });
                    console.log(`[AutoLogin] Clicked: ${sel}`);
                    modalOpened = true;
                    break;
                }
            } catch (e) { /* try next */ }
        }

        if (!modalOpened) {
            console.log(`[AutoLogin] Could not find any login button. Taking screenshot...`);
            await page.screenshot({ path: path.join(__dirname, '..', 'login_no_button.png'), fullPage: true });
        }

        // Wait for modal + iframe to load
        console.log(`[AutoLogin] Waiting for login modal iframe to load...`);
        await page.waitForTimeout(5000);

        // Wait for the shadow DOM host to appear
        try {
            await page.waitForSelector('#pan-oauth-card', { timeout: 15000 });
            console.log(`[AutoLogin] Found #pan-oauth-card`);
        } catch (e) {
            console.log(`[AutoLogin] #pan-oauth-card not found. Taking screenshot...`);
            await page.screenshot({ path: path.join(__dirname, '..', 'login_no_modal.png'), fullPage: true });
            throw new Error('登入 modal 未出現（找不到 #pan-oauth-card）');
        }

        console.log(`[AutoLogin] Waiting for login iframe to render (5s)...`);
        await page.waitForTimeout(5000); // Give the iframe time to load its cross-origin content

        // ========================================================
        // Find the iframe by checking all frames on the page
        // The login iframe is loaded from pan-login.hare200.com
        // ========================================================
        let loginFrame = null;
        for (const frame of page.frames()) {
            if (frame.url().includes('pan-login') || frame.url().includes('login')) {
                loginFrame = frame;
                console.log(`[AutoLogin] Found login frame by URL: ${frame.url()}`);
                break;
            }
        }

        if (!loginFrame) {
            // Fallback to shadow piercing locator if URL match fails
            console.log(`[AutoLogin] Could not find login frame by URL. Falling back to CSS frameLocator.`);
            loginFrame = page.frameLocator('#pan-oauth-card >>> iframe');
        }

        // Step 3: Click 密碼登入 inside the iframe
        console.log(`[AutoLogin] Clicking 密碼登入 inside iframe...`);
        try {
            // We use 'evaluate' inside the frame as the most bulletproof way, as getByText can still fail if Vue wraps text in comments
            const clicked = await loginFrame.evaluate(() => {
                const all = Array.from(document.querySelectorAll('*'));
                for (const el of all) {
                    if (el.textContent && el.textContent.trim() === '密碼登入') {
                        el.click();
                        return true;
                    }
                }
                return false;
            }).catch(() => false);

            if (clicked) {
                console.log(`[AutoLogin] ✅ Clicked 密碼登入 via evaluate`);
            } else {
                throw new Error('evaluate returned false');
            }
        } catch (e) {
            console.log(`[AutoLogin] evaluate('密碼登入') failed: ${e.message}`);
            // Fallback: try locator
            try {
                await loginFrame.locator('text=密碼登入').first().click({ timeout: 5000 });
                console.log(`[AutoLogin] ✅ Clicked 密碼登入 via text locator`);
            } catch (e2) {
                console.log(`[AutoLogin] text locator also failed. Taking screenshot...`);
                await page.screenshot({ path: path.join(__dirname, '..', 'login_modal_debug.png'), fullPage: true });
                throw new Error('無法在 iframe 內點擊密碼登入');
            }
        }

        await page.waitForTimeout(3000); // Wait for password form to render

        // Step 4: Fill username and password inside the iframe
        console.log(`[AutoLogin] Filling login form for user: ${username}`);

        // Try to find username input
        const usernameSelectors = [
            'input[placeholder="輸入你的JKF帳號或是E-mail"]',
            'input[placeholder*="JKF帳號"]',
            'input[name="username"]',
            'input[type="text"]'
        ];
        let usernameLocator = null;
        for (const sel of usernameSelectors) {
            try {
                const loc = loginFrame.locator(sel).first();
                if (await loc.isVisible({ timeout: 2000 })) {
                    usernameLocator = loc;
                    console.log(`[AutoLogin] Found username input: ${sel}`);
                    break;
                }
            } catch (e) { /* try next */ }
        }

        if (!usernameLocator) {
            console.log(`[AutoLogin] [FAILED] No username input found in iframe.`);
            await page.screenshot({ path: path.join(__dirname, '..', 'login_page_debug.png'), fullPage: true });
            throw new Error(`點了密碼登入但找不到帳號輸入框`);
        }

        // Find password input
        let passwordLocator = null;
        const passwordSelectors = [
            'input[placeholder="輸入你的JKF密碼"]',
            'input[placeholder*="JKF密碼"]',
            'input[name="password"]',
            'input[type="password"]'
        ];
        for (const sel of passwordSelectors) {
            try {
                const loc = loginFrame.locator(sel).first();
                if (await loc.isVisible({ timeout: 2000 })) {
                    passwordLocator = loc;
                    console.log(`[AutoLogin] Found password input: ${sel}`);
                    break;
                }
            } catch (e) { /* try next */ }
        }

        if (!passwordLocator) {
            passwordLocator = loginFrame.locator('input[type="password"]').first();
        }

        // Fill credentials
        await usernameLocator.fill(username);
        await passwordLocator.fill(password);
        console.log(`[AutoLogin] ✅ Filled credentials`);

        await page.waitForTimeout(1500);

        // Step 5: Click submit button
        let submitted = false;
        const submitSelectors = [
            'button[type="submit"]',
            'button:has-text("登入")',
            'input[type="submit"]',
            'button:has-text("Login")',
        ];
        for (const sel of submitSelectors) {
            try {
                const btn = loginFrame.locator(sel).first();
                if (await btn.isVisible({ timeout: 2000 })) {
                    await btn.click();
                    console.log(`[AutoLogin] ✅ Clicked submit: ${sel}`);
                    submitted = true;
                    break;
                }
            } catch (e) { /* try next */ }
        }

        if (!submitted) {
            // Press Enter as fallback
            await passwordLocator.press('Enter');
            console.log(`[AutoLogin] Pressed Enter to submit.`);
        }

        console.log(`[AutoLogin] Waiting for login to complete...`);
        await page.waitForTimeout(5000);
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { });
        await page.waitForTimeout(3000);

        // Check login success — look for the user menu or check we're no longer a guest
        const isGuest = await page.evaluate(() => {
            const text = document.body?.innerText || '';
            return text.includes('訪客') && !text.includes('個人空間');
        });

        if (isGuest) {
            console.log(`[AutoLogin] [FAILED] Still showing as guest after login attempt.`);
            await page.screenshot({ path: path.join(__dirname, '..', 'login_failure.png'), fullPage: true });
            return { success: false, message: '登入失敗，可能是密碼錯誤或需要驗證碼。查看 backend/login_failure.png' };
        }

        console.log(`[AutoLogin] [SUCCESS] ✅ Logged in! Extracting session cookies...`);

        const rawCookies = await context.cookies();
        const cookieString = JSON.stringify(rawCookies);

        return {
            success: true,
            cookieString: cookieString,
            message: `成功登入並取得新 cookies。`
        };

    } catch (error) {
        console.error(`[AutoLogin] Error:`, error);
        return { success: false, message: `System Error: ${error.message}` };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { loginAndGetCookies };
