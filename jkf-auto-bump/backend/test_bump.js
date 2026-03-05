// Direct test script - runs autoBump synchronously to see all output
const { autoBump } = require('./src/scraper');

const url = 'https://jkforum.net/p/thread-20554874-1-1.html';
const cookieString = '[{"name":"apea","value":"100","domain":".jkforum.net","path":"/","expires":1806081180},{"name":"jkf-ap-pot","value":"eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJhdXRoX21ldGhvZCI6ImF1dGgtYnktcGFzc3dvcmQiLCJleHBpcmUiOjIwODc3NDM4NTAsIm9iamVjdF9pZCI6IjFkYzViNzIzLWFhYjQtNDc5NC1hNzM0LWQxNDg5ZTEzZTI0YSIsInRva2VuMSI6IjdmMmQ2NTc5LWI0YjUtNDlhOC05YmYxLWEwYmU3YWE0YzU3YyIsInRva2VuMiI6IjcyMDg4MjIyLTYzZTItNDZkNC05MWZjLTA4NGQzMjNjMDA5YSIsInVpZCI6NjE0MjQ4MX0.xIf7qVyLXj_fCnRHlprUWb96Vuiu_o8_glzmdVCECb2BfJAjJUFsllWIHSxXc4CXrJOlQ_VytfziIkUZHgUEvw","domain":".jkforum.net","path":"/","expires":-1},{"name":"didsalt","value":"3e235ac5-8336-46e8-a1c5-611fcc90433c","domain":".jkforum.net","path":"/","expires":1803921180.207938,"httpOnly":true},{"name":"deviceId","value":"edge-a7f34a678c4bcc203b56fbb534fa812e6d58b3f7bf597c646c010c61fdc929a1","domain":".jkforum.net","path":"/","expires":1803921180.208045}]';
const jkfUsername = 'kingfu899';
const jkfPassword = 'ad19781114';

console.log('=== Starting direct autoBump test ===');
console.log('Time:', new Date().toISOString());

autoBump(url, cookieString, jkfUsername, jkfPassword)
    .then(result => {
        console.log('\n=== autoBump Result ===');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    })
    .catch(err => {
        console.error('\n=== autoBump Error ===');
        console.error(err);
        process.exit(1);
    });
