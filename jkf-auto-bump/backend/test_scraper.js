const { chromium } = require('playwright');
const fs = require('fs');

async function testBump() {
    let browser;
    try {
        browser = await chromium.launch({ headless: true, channel: 'msedge' });
        const context = await browser.newContext();
        const page = await context.newPage();

        // test URL, try to go to a typical jkf thread
        const url = "https://www.jkforum.net/thread-16383679-1-1.html"; // Just a random thread for testing
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });

        console.log("Page loaded. Looking for button...");

        // dump the HTML to see what's actually there
        const html = await page.content();
        fs.writeFileSync('page_dump.html', html);
        console.log("Dumped HTML to page_dump.html");

        // Take a screenshot
        await page.screenshot({ path: 'page_dump.png', fullPage: true });
        console.log("Dumped screenshot to page_dump.png");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        if (browser) await browser.close();
    }
}

testBump();
