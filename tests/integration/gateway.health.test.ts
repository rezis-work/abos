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

describe('OpenAPI Endpoints', () => {
  describe('IAM Service', () => {
    it('should return 200 and valid OpenAPI JSON for /iam/openapi.json', async () => {
      const response = await fetch(`${BASE_URL}/iam/openapi.json`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      
      const data = await response.json();
      expect(data).toHaveProperty('openapi');
      expect(data.openapi).toBe('3.0.0');
      expect(data).toHaveProperty('info');
      expect(data.info.title).toBe('IAM API');
      expect(data.info.version).toBe('1.0.0');
      expect(data).toHaveProperty('servers');
      expect(data.servers[0].url).toBe('/iam');
      expect(data).toHaveProperty('paths');
      expect(data.paths).toHaveProperty('/health');
      expect(data).toHaveProperty('components');
      expect(data.components).toHaveProperty('securitySchemes');
      expect(data.components.securitySchemes).toHaveProperty('bearerAuth');
    });

    it('should return 200 for /iam/docs (Swagger UI)', async () => {
      const response = await fetch(`${BASE_URL}/iam/docs`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });
  });

  describe('Buildings Service', () => {
    it('should return 200 and valid OpenAPI JSON for /buildings/openapi.json', async () => {
      const response = await fetch(`${BASE_URL}/buildings/openapi.json`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('openapi');
      expect(data.info.title).toBe('Buildings API');
    });
  });

  describe('Notifications Service', () => {
    it('should return 200 and valid OpenAPI JSON for /notifications/openapi.json', async () => {
      const response = await fetch(`${BASE_URL}/notifications/openapi.json`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('openapi');
      expect(data.info.title).toBe('Notifications API');
    });
  });

  describe('Tickets Service', () => {
    it('should return 200 and valid OpenAPI JSON for /tickets/openapi.json', async () => {
      const response = await fetch(`${BASE_URL}/tickets/openapi.json`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('openapi');
      expect(data.info.title).toBe('Tickets API');
    });
  });

  describe('Community Service', () => {
    it('should return 200 and valid OpenAPI JSON for /community/openapi.json', async () => {
      const response = await fetch(`${BASE_URL}/community/openapi.json`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('openapi');
      expect(data.info.title).toBe('Community API');
    });
  });
});

