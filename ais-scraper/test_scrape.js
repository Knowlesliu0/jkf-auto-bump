require('dotenv').config();

async function testScrapeAuction() {
    try {
        const res = await fetch('http://localhost:3000/api/scrape-auction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: process.env.AIS_USERNAME,
                password: process.env.AIS_PASSWORD,
                requests: [
                    {
                        aucClientName: '測試客戶',
                        aucBrand: 'HONDA',
                        aucModel: 'CRV',
                        aucYearStart: '2015',
                        aucYearEnd: '2017',
                        aucColors: ['白'],
                        aucGrades: ['A+', 'A', 'B+', 'B'],
                        aucCarTypes: ['小客車']
                    }
                ]
            })
        });
        const text = await res.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Request failed:", e);
    }
}
testScrapeAuction();
