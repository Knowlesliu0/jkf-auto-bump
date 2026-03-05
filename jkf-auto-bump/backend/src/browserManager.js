/**
 * BrowserManager - Singleton that maintains a persistent Chromium browser
 * and per-account BrowserContexts so session cookies survive across bump runs.
 *
 * Key idea: instead of launch → bump → close on every run,
 * we launch ONCE and keep contexts alive. Session cookies (expires: -1)
 * persist because the "browser session" never ends.
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

class BrowserManager {
    constructor() {
        /** @type {import('playwright').Browser | null} */
        this.browser = null;
        /** @type {Map<string, import('playwright').BrowserContext>} */
        this.contexts = new Map(); // key = jkf_username or 'default'
        this._launching = null; // prevent concurrent launches
    }

    /** Launch the browser if not already running */
    async ensureBrowser() {
        if (this.browser && this.browser.isConnected()) {
            return this.browser;
        }

        // Prevent concurrent launch calls
        if (this._launching) return this._launching;

        this._launching = (async () => {
            console.log('[BrowserManager] Launching persistent browser...');
            this.browser = await chromium.launch({
                headless: true,
                args: ['--disable-blink-features=AutomationControlled']
            });

            // If the browser crashes or disconnects, clean up
            this.browser.on('disconnected', () => {
                console.log('[BrowserManager] Browser disconnected. Will relaunch on next request.');
                this.browser = null;
                this.contexts.clear();
            });

            console.log('[BrowserManager] Browser launched successfully.');
            this._launching = null;
            return this.browser;
        })();

        return this._launching;
    }

    /**
     * Get or create a persistent BrowserContext for the given account.
     * If `cookieString` is provided and the context is new, cookies are injected.
     *
     * @param {string} accountKey - jkf_username or a unique key
     * @param {string} [cookieString] - JSON cookie string to inject on first creation
     * @returns {Promise<import('playwright').BrowserContext>}
     */
    async getContext(accountKey, cookieString) {
        await this.ensureBrowser();

        const key = accountKey || 'default';

        // Reuse existing context if it's still alive
        if (this.contexts.has(key)) {
            const ctx = this.contexts.get(key);
            try {
                // Quick health check - try to get cookies
                await ctx.cookies();
                return ctx;
            } catch (e) {
                // Context is dead, remove and recreate
                console.log(`[BrowserManager] Context for "${key}" is dead, recreating...`);
                this.contexts.delete(key);
            }
        }

        // Create new context
        console.log(`[BrowserManager] Creating new context for "${key}"...`);
        const context = await this.browser.newContext({
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

        // Hide webdriver property
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        // Inject cookies if provided
        if (cookieString) {
            const cookies = this._parseCookies(cookieString);
            if (cookies.length > 0) {
                console.log(`[BrowserManager] Injecting ${cookies.length} cookies for "${key}"`);
                await context.addCookies(cookies);
            }
        }

        this.contexts.set(key, context);
        return context;
    }

    /**
     * Update cookies for an existing context (e.g. after user pastes new cookies).
     * Clears old cookies and injects fresh ones.
     */
    async refreshCookies(accountKey, cookieString) {
        const key = accountKey || 'default';
        if (this.contexts.has(key)) {
            const ctx = this.contexts.get(key);
            try {
                await ctx.clearCookies();
                const cookies = this._parseCookies(cookieString);
                if (cookies.length > 0) {
                    await ctx.addCookies(cookies);
                    console.log(`[BrowserManager] Refreshed ${cookies.length} cookies for "${key}"`);
                }
            } catch (e) {
                // Context is dead, will be recreated on next getContext call
                this.contexts.delete(key);
            }
        }
        // If context doesn't exist yet, cookies will be injected on next getContext call
    }

    /**
     * Destroy a context for a specific account (e.g. when user deletes a task).
     */
    async destroyContext(accountKey) {
        const key = accountKey || 'default';
        if (this.contexts.has(key)) {
            try {
                await this.contexts.get(key).close();
            } catch (e) { /* ignore */ }
            this.contexts.delete(key);
            console.log(`[BrowserManager] Destroyed context for "${key}"`);
        }
    }

    /**
     * Get current cookies from a context (for saving back to DB).
     */
    async getCookies(accountKey) {
        const key = accountKey || 'default';
        if (this.contexts.has(key)) {
            try {
                const cookies = await this.contexts.get(key).cookies();
                return JSON.stringify(cookies);
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /** Parse cookie string (JSON array or raw string) into Playwright format */
    _parseCookies(cookieString) {
        let cookies = [];
        const trimmed = (cookieString || '').trim();

        if (trimmed.startsWith('[')) {
            try {
                cookies = JSON.parse(trimmed);
                cookies = cookies.map(c => {
                    const sanitized = {
                        name: String(c.name || ''),
                        value: String(c.value || ''),
                        domain: c.domain,
                        path: c.path || '/'
                    };
                    // Handle both "expires" (Playwright format) and "expirationDate" (Cookie-Editor format)
                    const exp = c.expires !== undefined ? c.expires : c.expirationDate;
                    // Don't pass expires: -1, let it be a session cookie
                    if (exp !== undefined && exp !== -1) {
                        sanitized.expires = Number(exp);
                    }
                    if (typeof c.httpOnly === 'boolean') sanitized.httpOnly = c.httpOnly;
                    if (typeof c.secure === 'boolean') sanitized.secure = c.secure;
                    return sanitized;
                });
            } catch (e) {
                console.warn('[BrowserManager] Failed to parse cookie JSON:', e.message);
            }
        } else if (trimmed.length > 0) {
            // Raw string format: "key=value; key2=value2"
            cookies = trimmed.split(';').map(pair => {
                const [name, ...rest] = pair.trim().split('=');
                return {
                    name: (name || '').trim(),
                    value: (rest.join('=') || '').trim(),
                    domain: '.jkforum.net',
                    path: '/'
                };
            }).filter(c => c.name.length > 0);
        }

        // Ensure '.' prefix on domains
        cookies = cookies.map(c => {
            if (c.domain && !c.domain.startsWith('.')) {
                c.domain = '.' + c.domain;
            }
            return c;
        });

        return cookies;
    }

    /** Graceful shutdown */
    async shutdown() {
        console.log('[BrowserManager] Shutting down...');
        for (const [key, ctx] of this.contexts) {
            try { await ctx.close(); } catch (e) { /* ignore */ }
        }
        this.contexts.clear();
        if (this.browser) {
            try { await this.browser.close(); } catch (e) { /* ignore */ }
            this.browser = null;
        }
    }
}

// Singleton
const browserManager = new BrowserManager();

// Graceful shutdown on process exit
process.on('SIGINT', async () => {
    await browserManager.shutdown();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await browserManager.shutdown();
    process.exit(0);
});

module.exports = browserManager;
