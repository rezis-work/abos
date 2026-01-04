import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'services/iam',
  'services/buildings',
  'services/notifications',
  'services/tickets',
  'services/community',
]);

