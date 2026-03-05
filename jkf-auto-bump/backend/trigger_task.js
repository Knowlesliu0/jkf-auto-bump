const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign({ id: 1, role: 'admin' }, 'super-secret-key-change-in-production', { expiresIn: '1h' });
console.log('Token:', token);

const data = JSON.stringify({});
const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/tasks/26/trigger',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body);
    });
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
