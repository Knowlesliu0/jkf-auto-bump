require('dotenv').config();
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false }); // 非無頭，可以看到畫面
    const page = await browser.newPage();

    await page.goto('https://www.sinjang.com.tw/Portal/');
    console.log('填入帳號密碼...');
    await page.fill('#ctl00_BodyContent_ACCOUNT', process.env.AIS_USERNAME);
    await page.fill('#ctl00_BodyContent_PASSWORD', process.env.AIS_PASSWORD);

    await page.click('#ctl00_BodyContent_LOGIN_BTN', { noWaitAfter: true });
    await page.waitForTimeout(4000);

    const url = page.url();
    const loginBtnStillExists = await page.locator('#ctl00_BodyContent_LOGIN_BTN').isVisible().catch(() => false);
    const errorTextVisible = await page.locator('text=帳號或密碼錯誤').isVisible().catch(() => false);

    console.log('Current URL:', url);
    console.log('Login btn still visible:', loginBtnStillExists);
    console.log('Error text visible:', errorTextVisible);
    console.log('Page title:', await page.title());

    await page.waitForTimeout(2000);
    await browser.close();
})();
