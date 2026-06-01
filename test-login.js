// Test login endpoint
const http = require('http');

function testLogin(username, password) {
    console.log(`\n--- Testing login with ${username}/${password} ---`);
    
    const postData = JSON.stringify({
        username: username,
        password: password
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log('Response:', JSON.stringify(result, null, 2));
                console.log('Status:', res.statusCode);
            } catch (e) {
                console.log('Raw response:', data);
            }
        });
    });

    req.on('error', err => console.error('Request error:', err));
    req.write(postData);
    req.end();
}

// Test với admin account
setTimeout(() => testLogin('admin', 'admin123'), 100);
setTimeout(() => testLogin('tien01', '123456'), 200);
