const browserManager = require('./browserManager');
const path = require('path');
const fs = require('fs');
const { loginOnPage } = require('./loginAndGetCookies');

async function getReplyCount(page) {
    try {
        return await page.evaluate(() => {
            // Method 1: Count post elements (JKF uses li[id^="pid"] or [id^="post_"])
            const posts = document.querySelectorAll('li[id^="pid"], [id^="post_"], .postlist .post');
            if (posts.length > 1) return posts.length - 1; // subtract OP post

            // Method 2: Find reply count in body text
            const bodyText = document.body?.innerText || '';
            const match = bodyText.match(/回覆[數数]?\s*[：:\s]\s*(\d+)/);
            if (match) return parseInt(match[1]);

            // Method 3: Count reply elements in thread
            const replies = document.querySelectorAll('.reply, [class*="reply-item"], [class*="comment-item"]');
            if (replies.length > 0) return replies.length;

            return 0;
        });
    } catch (e) {
        return 0;
    }
}

function hasJkfAuthCookie(cookies = []) {
    return cookies.some(c => c && c.name === 'jkf-ap-pot' && String(c.value || '').length > 10);
}

async function isGuestPage(page) {
    return await page.evaluate(() => {
        const loggedNode = document.querySelector('[data-logged-in]');
        if (loggedNode) {
            const state = loggedNode.getAttribute('data-logged-in');
            if (state === 'true') return false;
            if (state === 'false') return true;
        }

        const hasLogoutLink = !!document.querySelector('a[href*="logout"], a[href*="signout"]');
        const hasLoginHint = !!document.querySelector('a[href*="login"], button[id*="login"], [class*="login"]');
        if (hasLogoutLink) return false;
        return hasLoginHint;
    });
}

async function openTargetPage(page, url) {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log("Waiting for network idle to ensure dynamic content loads...");
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => console.log('Wait for networkidle timed out'));

    console.log("Waiting 5s for JKF specific rendering delays...");
    await page.waitForTimeout(5000);
}

async function autoBump(url, cookieString, jkfUsername, jkfPassword) {
    let page;
    try {
        // Get persistent context for this account (or 'default')
        const accountKey = jkfUsername || 'default';
        const context = await browserManager.getContext(accountKey, cookieString);

        // If caller provided fresh cookies, check if context needs them
        if (cookieString) {
            const existingCookies = await context.cookies();
            const hasJkfToken = hasJkfAuthCookie(existingCookies);
            if (!hasJkfToken) {
                await browserManager.refreshCookies(accountKey, cookieString);
                console.log(`[AutoBump] Injected fresh cookies into persistent context for "${accountKey}"`);
            }
        }
        page = await context.newPage();
        await openTargetPage(page, url);

        // Check if we are logged in. If guest and credentials exist, try auto-login once.
        let isGuest = await isGuestPage(page);

        if (isGuest && jkfUsername && jkfPassword) {
            console.warn('[AutoBump] WARNING: Page loaded as GUEST. Trying credential login...');
            const loginResult = await loginOnPage(page, jkfUsername, jkfPassword);

            if (loginResult.success) {
                console.log('[AutoBump] Auto-login succeeded, reloading target page...');
                await openTargetPage(page, url);
                isGuest = await isGuestPage(page);
            } else {
                const screenshotPath = path.join(__dirname, '..', 'login_failure.png');
                await page.screenshot({ path: screenshotPath, fullPage: false });

                const rawCookies = await context.cookies();
                const newCookieString = JSON.stringify(rawCookies);
                const hasAuthCookie = hasJkfAuthCookie(rawCookies);

                await page.close().catch(() => { });
                page = null;
                await browserManager.destroyContext(accountKey);

                return {
                    success: false,
                    message: hasAuthCookie
                        ? `Cookie expired, and auto-login failed: ${loginResult.message}`
                        : `Cookie is missing auth token (jkf-ap-pot), and auto-login failed: ${loginResult.message}`,
                    newCookieString
                };
            }
        }

        if (isGuest) {
            console.warn('[AutoBump] WARNING: Page still loaded as GUEST.');

            const screenshotPath = path.join(__dirname, '..', 'login_failure.png');
            await page.screenshot({ path: screenshotPath, fullPage: false });
            const rawCookies = await context.cookies();
            const newCookieString = JSON.stringify(rawCookies);
            const hasAuthCookie = hasJkfAuthCookie(rawCookies);

            await page.close().catch(() => { });
            page = null;
            await browserManager.destroyContext(accountKey);

            return {
                success: false,
                message: hasAuthCookie
                    ? 'Cookie expired. Please paste a valid Cookie, or update credentials and retry.'
                    : 'Cookie is missing auth token (jkf-ap-pot). Please copy Cookie again while logged in to JKF.',
                newCookieString
            };
        }

        console.log('[AutoBump] Login verified (persistent context).');



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

        // We try multiple locators to find the bump button
        const bumpLocatorNuxt = page.locator('button.jkf-button:has-text("現在有空"), button.bg-yellow-400:has-text("現在有空")').first();
        const bumpLocatorNewDiv = page.locator('div:has-text("現在有空")').filter({ hasNot: page.locator('div:has-text("營業狀態")') }).first();
        const bumpLocatorText1 = page.locator('text=我有空').first();
        const bumpLocatorText2 = page.locator('text=現在有空').first();
        const bumpLocatorImg = page.locator('img[alt*="我有空"], img[src*="free"]').first();
        const bumpLocatorLink = page.locator('a:has-text("我有空"), a:has-text("現在有空")').first();
        const bumpLocatorCss = page.locator('a.free_bump, a.bump_btn, #free_bump, .oshr_free_bump a').first();

        let bumped = false;

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

            console.log(`[AutoBump] Waiting for network to settle after click...`);
            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { });
            await page.waitForTimeout(3000);

            let topExpiresAt = null;
            let freeStatus = null;
            try {
                await page.waitForTimeout(3000);

                const bodyText = await page.innerText('body');
                if (bodyText.includes('處理中') || bodyText.includes('更新狀態成功') || bodyText.includes('推文成功')) {
                    console.log(`[AutoBump] Detected success message in DOM.`);
                }

                const statusMatch = bodyText.match(/營業狀態[-.—\s]*([^\n]+)/);
                if (statusMatch && statusMatch[1]) {
                    freeStatus = statusMatch[1].trim();
                    console.log(`[Scraped] Business status: ${freeStatus}`);
                }

                const timeMatch = bodyText.match(/時間到\s*[：:]\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/);
                if (timeMatch && timeMatch[1]) {
                    topExpiresAt = timeMatch[1];
                    console.log(`[Scraped] Top expires at (from body text): ${topExpiresAt}`);
                } else {
                    const buttons = await page.locator('button').allInnerTexts();
                    for (const text of buttons) {
                        const btnMatch = text.match(/時間到\s*[：:]\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/);
                        if (btnMatch && btnMatch[1]) {
                            topExpiresAt = btnMatch[1];
                            console.log(`[Scraped] Top expires at (from button list): ${topExpiresAt}`);
                            break;
                        }
                    }
                    if (!topExpiresAt) {
                        console.log(`[Notice] Could not find expiration time in body text or buttons.`);
                    }
                }
            } catch (e) {
                console.log("[Notice] Could not extract page info:", e.message);
            }

            let threadTitle = await page.title();
            threadTitle = threadTitle.replace(/ - JKF.*/, '').trim();

            const replyCount = await getReplyCount(page);

            // Save cookies from persistent context back to caller
            const rawCookies = await context.cookies();
            const newCookieString = JSON.stringify(rawCookies);

            await page.close().catch(() => { });
            page = null;

            return { success: true, message: 'Successfully clicked bump button.', topExpiresAt, freeStatus, threadTitle, newCookieString, replyCount };
        } else {
            // Button not found — check if already in "現在有空" state
            console.log(`[Info] Bump button not found on ${url}, checking if already free...`);

            const bodyText = await page.innerText('body');
            const alreadyFree = bodyText.includes('現在有空') || bodyText.includes('營業狀態') && bodyText.match(/剩下\s*\d+:\d+/);

            if (alreadyFree) {
                console.log(`[Success] Already in "現在有空" state, no need to click.`);

                let topExpiresAt = null;
                let freeStatus = null;
                try {
                    const statusMatch = bodyText.match(/營業狀態[-.—\s]*([^\n]+)/);
                    if (statusMatch && statusMatch[1]) {
                        freeStatus = statusMatch[1].trim();
                    }

                    const timeMatch = bodyText.match(/時間到\s*[：:]\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/);
                    if (timeMatch && timeMatch[1]) {
                        topExpiresAt = timeMatch[1];
                    } else {
                        const buttons = await page.locator('button').allInnerTexts();
                        for (const text of buttons) {
                            const btnMatch = text.match(/時間到\s*[：:]\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/);
                            if (btnMatch && btnMatch[1]) {
                                topExpiresAt = btnMatch[1];
                                break;
                            }
                        }
                    }
                } catch (e) { /* ignore */ }

                let threadTitle = await page.title();
                threadTitle = threadTitle.replace(/ - JKF.*/, '').trim();

                const replyCount = await getReplyCount(page);

                const rawCookies = await context.cookies();
                const newCookieString = JSON.stringify(rawCookies);

                await page.close().catch(() => { });
                page = null;

                return { success: true, message: '已在有空狀態中，無需再次點擊。', topExpiresAt, freeStatus, threadTitle, newCookieString, replyCount };
            }

            // Truly not found — save debug info
            const title = await page.title();
            console.log(`[Failed] Page Title was: ${title}`);
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

            await page.close().catch(() => { });
            page = null;

            return { success: false, message: `Button not found. Title: ${title}. Check backend/failure.png`, newCookieString };
        }

    } catch (error) {
        console.error(`[Error] Error in autoBump for ${url}:`, error);
        return { success: false, message: error.message };
    } finally {
        // Only close the PAGE, NOT the browser or context!
        if (page) {
            await page.close().catch(() => { });
        }
    }
}

module.exports = { autoBump };
