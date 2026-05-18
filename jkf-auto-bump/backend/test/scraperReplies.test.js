const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildLatestCommentsApiUrl,
    getMaxCommentId,
    getReplyCount
} = require('../src/scraper');

test('buildLatestCommentsApiUrl targets JKF latest comment API', () => {
    assert.equal(
        buildLatestCommentsApiUrl('https://jkforum.net/p/thread-20057222-1-1.html'),
        'https://jkforum.net/api/jkf-forum/v1/CommentThread/20057222?authorOnly=false&sortingType=2&commentSortingColumn=0&Offset=0&Limit=20'
    );
});

test('getMaxCommentId reads max comment id from API content', () => {
    assert.equal(
        getMaxCommentId({
            content: [
                { id: 1712076790, floor: 1 },
                { id: 729970160759225, floor: 46 },
                { id: 728692796279422, floor: 44 }
            ]
        }),
        729970160759225
    );
});

test('getReplyCount prefers latest comment API over first-page DOM comments', async () => {
    const calls = [];
    const page = {
        url: () => 'https://jkforum.net/p/thread-20057222-1-1.html',
        evaluate: async (fn, arg) => {
            calls.push(arg || 'dom');
            if (typeof arg === 'string' && arg.includes('/CommentThread/20057222')) {
                return 729970160759225;
            }
            return 1729578240;
        }
    };

    const replyCount = await getReplyCount(page, 'https://jkforum.net/p/thread-20057222-1-1.html');

    assert.equal(replyCount, 729970160759225);
    assert.match(calls[0], /sortingType=2/);
});
