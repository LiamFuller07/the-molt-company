const http = require('http');

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    port: port,
    pid: process.pid,
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Test server listening on 0.0.0.0:${port}`);
});
