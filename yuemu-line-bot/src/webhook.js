const { handleMessage } = require('./messageHandler');

async function handleWebhook(req, res) {
    const events = req.body.events;

    const results = await Promise.allSettled(
        events.map((event) => {
            if (event.type === 'message' && event.message.type === 'text') {
                return handleMessage(event);
            }
            return Promise.resolve(null);
        })
    );

    // Log any errors
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            console.error(`Event ${i} failed:`, r.reason);
        }
    });

    res.json({ ok: true });
}

module.exports = { handleWebhook };
