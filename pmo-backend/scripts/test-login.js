const http = require('http');

const data = JSON.stringify({
  identifier: 'admin@test.com',
  password: 'admin123',
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
    if (res.statusCode === 200 || res.statusCode === 201) {
      const parsed = JSON.parse(body);
      const token = parsed.access_token;
      // Decode JWT (base64)
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('\nDecoded JWT Payload:');
      console.log(JSON.stringify(payload, null, 2));
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
