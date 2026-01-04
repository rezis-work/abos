import { describe, it, expect } from 'vitest';

const BASE_URL = 'http://localhost:18080';

interface HealthResponse {
  status: string;
  service?: string;
  timestamp?: string;
  uptime?: number;
}

async function fetchHealth(endpoint: string): Promise<{ status: number; data: HealthResponse | string }> {
  const response = await fetch(`${BASE_URL}${endpoint}`);
  const contentType = response.headers.get('content-type');
  
  let data: HealthResponse | string;
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  
  return {
    status: response.status,
    data,
  };
}

describe('Gateway Health Endpoints', () => {
  describe('Nginx Health', () => {
    it('should return 200 OK for /health', async () => {
      const result = await fetchHealth('/health');
      
      expect(result.status).toBe(200);
      expect(result.data).toBe('OK\n');
    });
  });

  describe('IAM Service', () => {
    it('should route /iam/health through nginx', async () => {
      const result = await fetchHealth('/iam/health');
      
      expect(result.status).toBe(200);
      expect(typeof result.data).toBe('object');
      const data = result.data as HealthResponse;
      expect(data.status).toBe('ok');
      expect(data.service).toBe('iam-service');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
    });
  });

  describe('Buildings Service', () => {
    it('should route /buildings/health through nginx', async () => {
      const result = await fetchHealth('/buildings/health');
      
      expect(result.status).toBe(200);
      expect(typeof result.data).toBe('object');
      const data = result.data as HealthResponse;
      expect(data.status).toBe('ok');
      expect(data.service).toBe('buildings-service');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
    });
  });

  describe('Notifications Service', () => {
    it('should route /notifications/health through nginx', async () => {
      const result = await fetchHealth('/notifications/health');
      
      expect(result.status).toBe(200);
      expect(typeof result.data).toBe('object');
      const data = result.data as HealthResponse;
      expect(data.status).toBe('ok');
      expect(data.service).toBe('notifications-service');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Tickets Service', () => {
    it('should route /tickets/health through nginx', async () => {
      const result = await fetchHealth('/tickets/health');
      
      expect(result.status).toBe(200);
      expect(typeof result.data).toBe('object');
      const data = result.data as HealthResponse;
      expect(data.status).toBe('ok');
      expect(data.service).toBe('tickets-service');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
    });
  });

  describe('Community Service', () => {
    it('should route /community/health through nginx', async () => {
      const result = await fetchHealth('/community/health');
      
      expect(result.status).toBe(200);
      expect(typeof result.data).toBe('object');
      const data = result.data as HealthResponse;
      expect(data.status).toBe('ok');
      expect(data.service).toBe('community-service');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
    });
  });
});

