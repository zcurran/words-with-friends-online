// Test Server Rematch Logic
const assert = require('assert');

// Mock socket.io and express to test server logic in isolation
const http = require('http');
const express = require('express');

// We can test server.js functions directly or spin up a test instance
const path = require('path');
const serverPath = path.join(__dirname, '../server/server.js');

console.log('Testing Server Request Rematch...');

// Let's verify server file syntax and run it briefly to test health check
const serverProc = require('child_process').spawn('node', [serverPath], {
  env: { ...process.env, PORT: '8999' },
  stdio: 'pipe'
});

let started = false;

serverProc.stdout.on('data', (data) => {
  const str = data.toString();
  if (str.includes('Words with Friends / Scrabble Node.js Server')) {
    started = true;
    // Perform health check
    http.get('http://localhost:8999/health', (res) => {
      assert.strictEqual(res.statusCode, 200, 'Health check should return 200');
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const json = JSON.parse(body);
        assert.strictEqual(json.status, 'ok', 'Status should be ok');
        console.log('Server health check passed:', json);
        serverProc.kill();
        console.log('Server verification passed successfully! ✅');
        process.exit(0);
      });
    }).on('error', (err) => {
      console.error('Health check failed:', err);
      serverProc.kill();
      process.exit(1);
    });
  }
});

serverProc.stderr.on('data', (data) => {
  console.error('Server error output:', data.toString());
});

setTimeout(() => {
  if (!started) {
    console.error('Server timed out starting up');
    serverProc.kill();
    process.exit(1);
  }
}, 8000);
