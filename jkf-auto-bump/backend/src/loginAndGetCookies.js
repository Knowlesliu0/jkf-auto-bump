/**
 * Login flow that works within an EXISTING page (from the persistent browser context).
 * Does NOT launch its own browser — the caller provides the page.
 */

const path = require('path');
const fs = require('fs');

/**
 * Perform login on JKF using the provided page (from persistent context).
 * @param {import('playwright').Page} page - An existing page from the persistent browser context
 * @param {string} username - JKF username
 * @param {string} password - JKF password
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function loginOnPage(page, username, password) {
    try {
        // Step 1: Navigate to JKF homepage
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
                console.log(`[AutoLogin] Clicked 18+ button inside shadow DOM.`);
                await page.waitForTimeout(1000);
            }
        } catch (e) { /* ignore */ }

        // Step 2: Click the "登入" button to open the login modal
        console.log(`[AutoLogin] Clicking 登入 button to open modal...`);
        const loginButtonSelectors = [
            'span.cursor-pointer:has-text("登入")',
            'a:has-text("登入")',
            'button:has-text("登入")',
            'text=登入'
        ];

        let clickedLogin = false;
        for (const sel of loginButtonSelectors) {
            try {
                const el = page.locator(sel).first();
                if (await el.isVisible({ timeout: 2000 })) {
                    await el.click();
                    console.log(`[AutoLogin] Clicked: ${sel}`);
                    clickedLogin = true;
                    break;
                }
            } catch (e) { /* try next */ }
        }
        if (!clickedLogin) {
            return { success: false, message: '找不到登入按鈕' };
        }

        console.log(`[AutoLogin] Waiting for login modal iframe to load...`);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => console.log('Wait for networkidle timed out'));
        await page.waitForTimeout(2000);

        // Step 3: Find the login iframe
        let loginFrame = null;

        // Method 1: check for #pan-oauth-card
        const oauthCard = page.locator('#pan-oauth-card');
        if (await oauthCard.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log(`[AutoLogin] Found #pan-oauth-card`);
            console.log(`[AutoLogin] Waiting for login iframe to render (5s)...`);
            await page.waitForTimeout(5000);
        }

        // Method 2: find the login iframe by URL in page.frames()
        for (const frame of page.frames()) {
            if (frame.url().includes('pan-login') || frame.url().includes('hare200.com/login')) {
                loginFrame = frame;
                console.log(`[AutoLogin] Found login frame by URL: ${frame.url()}`);
                break;
            }
        }

        if (!loginFrame) {
            // Method 3: use frameLocator
            try {
                const fl = page.frameLocator('#pan-oauth-card iframe');
                const test = fl.locator('body');
                if (await test.isVisible({ timeout: 5000 }).catch(() => false)) {
                    // frameLocator doesn't give us a Frame object, we need to find it in page.frames()
                    for (const frame of page.frames()) {
                        if (frame.url().includes('login') || frame.url().includes('pan-login')) {
                            loginFrame = frame;
                            break;
                        }
                    }
                }
            } catch (e) { /* ignore */ }
        }

        if (!loginFrame) {
            await page.screenshot({ path: path.join(__dirname, '..', 'login_failure.png') });
            return { success: false, message: '找不到登入 iframe' };
        }

        // Step 4: Click "密碼登入" tab if present
        console.log(`[AutoLogin] Clicking 密碼登入 inside iframe...`);
        try {
            const passwordTabBtn = loginFrame.locator('text=密碼登入').first();
            if (await passwordTabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await passwordTabBtn.click();
                console.log(`[AutoLogin] ✅ Clicked 密碼登入`);
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log(`[AutoLogin] 密碼登入 tab not found or not needed`);
        }

        // Step 5: Fill in credentials
        console.log(`[AutoLogin] Filling login form for user: ${username}`);
        const usernameSelectors = [
            'input[placeholder*="帳號"]',
            'input[placeholder*="E-mail"]',
            'input[name="username"]',
            'input[type="text"]'
        ];
        const passwordSelectors = [
            'input[placeholder*="密碼"]',
            'input[name="password"]',
            'input[type="password"]'
        ];

        let usernameLocator = null;
        for (const sel of usernameSelectors) {
            try {
                const loc = loginFrame.locator(sel).first();
                if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
                    console.log(`[AutoLogin] Found username input: ${sel}`);
                    usernameLocator = loc;
                    break;
                }
            } catch (e) { /* try next */ }
        }

        let passwordLocator = null;
        for (const sel of passwordSelectors) {
            try {
                const loc = loginFrame.locator(sel).first();
                if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
                    console.log(`[AutoLogin] Found password input: ${sel}`);
                    passwordLocator = loc;
                    break;
                }
            } catch (e) { /* try next */ }
        }

        if (!usernameLocator || !passwordLocator) {
            await page.screenshot({ path: path.join(__dirname, '..', 'login_failure.png') });
            return { success: false, message: '找不到帳號或密碼輸入框' };
        }

        await usernameLocator.fill(username);
        await page.waitForTimeout(300);
        await passwordLocator.fill(password);
        console.log(`[AutoLogin] ✅ Filled credentials`);
        await page.waitForTimeout(500);

        // Step 6: Click submit
        const submitSelectors = [
            'button:has-text("登入")',
            'button[type="submit"]',
            'input[type="submit"]',
        ];
        let submitted = false;
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
            await passwordLocator.press('Enter');
            console.log(`[AutoLogin] Pressed Enter to submit.`);
        }

        // Step 7: Handle reCAPTCHA
        console.log(`[AutoLogin] Checking for reCAPTCHA challenge...`);
        await page.waitForTimeout(3000);

        let recaptchaFrame = null;
        for (const f of page.frames()) {
            const fUrl = f.url().toLowerCase();
            if (fUrl.includes('recaptcha')) {
                recaptchaFrame = f;
                console.log(`[AutoLogin] Found recaptcha frame: ${f.url()}`);
                break;
            }
        }

        if (recaptchaFrame) {
            console.log(`[AutoLogin] ⚠️ Detected reCAPTCHA! Attempting native locator click...`);

            try {
                // Use Playwright's native locator - it handles nested iframe coordinate math
                const checkbox = recaptchaFrame.locator('#recaptcha-anchor').first();
                await checkbox.waitFor({ state: 'visible', timeout: 5000 });

                // Simulate human-like behavior
                console.log(`[AutoLogin] Hovering over checkbox...`);
                await checkbox.hover();
                await page.waitForTimeout(800);

                console.log(`[AutoLogin] Clicking checkbox...`);
                await checkbox.click({ delay: 200 });

                console.log(`[AutoLogin] ✅ Clicked reCAPTCHA checkbox! Waiting 5s for validation...`);
                await page.waitForTimeout(5000);

                // Take screenshot to see result
                await page.screenshot({ path: path.join(__dirname, '..', 'recaptcha_result.png') });

                // Check if reCAPTCHA was solved (checkbox gets green checkmark)
                try {
                    const isChecked = await recaptchaFrame.locator('.recaptcha-checkbox-checked, [aria-checked="true"]').isVisible({ timeout: 2000 });
                    if (isChecked) {
                        console.log(`[AutoLogin] ✅ reCAPTCHA solved!`);
                    } else {
                        console.log(`[AutoLogin] ⚠️ reCAPTCHA may not be solved yet.`);
                    }
                } catch (e) { /* ignore */ }

                // Try clicking submit again after reCAPTCHA
                for (const sel of submitSelectors) {
                    try {
                        // Re-find login frame
                        let currentLoginFrame = null;
                        for (const frame of page.frames()) {
                            if (frame.url().includes('pan-login') || frame.url().includes('login')) {
                                currentLoginFrame = frame;
                                break;
                            }
                        }
                        if (!currentLoginFrame) continue;

                        const btn = currentLoginFrame.locator(sel).first();
                        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
                            await btn.click({ force: true });
                            console.log(`[AutoLogin] Clicked submit again after reCAPTCHA`);
                            break;
                        }
                    } catch (e) { /* try next */ }
                }
            } catch (err) {
                console.log(`[AutoLogin] Error with reCAPTCHA:`, err.message);
            }
        } else {
            console.log(`[AutoLogin] No reCAPTCHA detected (stealth may have bypassed it).`);
        }

        // Step 8: Wait for login to complete
        console.log(`[AutoLogin] Waiting for login to complete...`);
        await page.waitForTimeout(5000);
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { });
        await page.waitForTimeout(3000);

        // Step 9: Check login result
        const isGuest = await page.evaluate(() => {
            const text = document.body?.innerText || '';
            return text.includes('訪客') && !text.includes('個人空間');
        });

        if (isGuest) {
            console.log(`[AutoLogin] [FAILED] Still showing as guest after login attempt.`);
            await page.screenshot({ path: path.join(__dirname, '..', 'login_failure.png'), fullPage: true });
            return { success: false, message: '登入失敗，可能是密碼錯誤或驗證碼未通過。查看 backend/login_failure.png' };
        }

        console.log(`[AutoLogin] [SUCCESS] ✅ Logged in!`);
        return { success: true, message: '成功登入！' };

    } catch (error) {
        console.error(`[AutoLogin] Error:`, error);
        return { success: false, message: `System Error: ${error.message}` };
    }
}

module.exports = { loginOnPage };
