const test = require('node:test');
const assert = require('node:assert/strict');

const { hasNewReply } = require('../src/replyNotifications');

test('hasNewReply notifies existing tasks when reply baseline is missing', () => {
    assert.equal(
        hasNewReply(
            { last_reply_count: null, last_run: '2026-05-18T00:00:00.000Z' },
            { replyCount: 729970160759225 }
        ),
        true
    );
});

test('hasNewReply does not notify brand-new tasks before a first baseline exists', () => {
    assert.equal(
        hasNewReply(
            { last_reply_count: null, last_run: null },
            { replyCount: 729970160759225 }
        ),
        false
    );
});
