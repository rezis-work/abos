#!/usr/bin/env node

const { execSync } = require('child_process');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function runCommand(command, options = {}) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      stdio: 'inherit',
      ...options,
    });
    return { stdout, stderr };
  } catch (error) {
    throw error;
  }
}

async function waitForHealth() {
  const http = require('http');
  const url = 'http://localhost:18080/health';
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

  console.log(`Waiting for ${url} to be healthy...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await checkHealth();
      console.log(`✓ Health check passed after ${attempt} attempt(s)`);
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(`Health check failed after ${maxAttempts} attempts: ${error.message}`);
      }
      process.stdout.write(`Attempt ${attempt}/${maxAttempts}... `);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

async function cleanup() {
  console.log('\nCleaning up test stack...');
  try {
    execSync('docker compose -f docker-compose.test.yml down -v', {
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Warning: Cleanup failed:', error.message);
  }
}

async function main() {
  let stackStarted = false;
  let containersCreated = false;
  
  try {
    // Start test stack
    console.log('Starting test stack...');
    try {
      execSync('docker compose -f docker-compose.test.yml up -d --build', {
        stdio: 'inherit',
      });
      stackStarted = true;
      containersCreated = true;
    } catch (error) {
      // Even if up fails, containers might have been created
      containersCreated = true;
      throw error;
    }

    // Wait for health
    await waitForHealth();

    // Run integration tests
    console.log('\nRunning integration tests...');
    execSync('pnpm vitest run tests/integration', {
      stdio: 'inherit',
    });

    console.log('\n✓ Integration tests passed!');
  } catch (error) {
    console.error('\n✗ Integration tests failed:', error.message);
    process.exitCode = 1;
  } finally {
    // Always cleanup if containers were created
    if (containersCreated) {
      await cleanup();
    }
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT, cleaning up...');
  await cleanup();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n\nReceived SIGTERM, cleaning up...');
  await cleanup();
  process.exit(1);
});

main();

