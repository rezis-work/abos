#!/usr/bin/env node

const http = require('http');

const url = process.argv[2] || 'http://localhost:18080/health';
const maxAttempts = 30;
const intervalMs = 2000;

function checkHealth() {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'GET',
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        reject(new Error(`Health check returned status ${res.statusCode}`));
      }
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Health check timeout'));
    });

    req.end();
  });
}

async function waitForHealth() {
  console.log(`Waiting for ${url} to be healthy...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await checkHealth();
      console.log(`✓ Health check passed after ${attempt} attempt(s)`);
      process.exit(0);
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error(`✗ Health check failed after ${maxAttempts} attempts`);
        console.error(`Last error: ${error.message}`);
        process.exit(1);
      }
      console.log(`Attempt ${attempt}/${maxAttempts} failed: ${error.message}, retrying in ${intervalMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

waitForHealth();

