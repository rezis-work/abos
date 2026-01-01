import { healthCheckRoute } from '@common/http';
import { getEnv } from '@common/env';

const env = getEnv();
export const healthRoute = healthCheckRoute(env.SERVICE_NAME || 'template-service');

