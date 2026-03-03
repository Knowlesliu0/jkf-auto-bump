const username = process.env.AIS_USERNAME || 'test';
const password = process.env.AIS_PASSWORD || 'test';

async function testScrape() {
    try {
        const res = await fetch('http://localhost:3000/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                password: password,
                need: 'E92 335I',
                brand: '',
                model: '',
                year: '',
                budgetMin: '',
                budgetMax: ''
            })
        });
        const text = await res.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Request failed:", e);
    }
}
testScrape();
