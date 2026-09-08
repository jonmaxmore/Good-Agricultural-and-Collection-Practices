/**
 * Constants — Unified Entry Point (OBW-2)
 *
 * Single import path for all application constants.
 * Re-exports from both `@/constants/` and `@/lib/constants/` namespaces.
 *
 * New code should import from here:
 *   import { GACP_APPLICATION_FEE, WORKFLOW_STATES } from '@/constants';
 *
 * Existing imports from sub-paths still work and are NOT deprecated.
 */

// Fees & Options
export * from './fees';
export * from './options';

// Auth & Workflow (from lib/constants/)
export * from '../lib/constants/auth-routes';
export * from '../lib/constants/canonical-roles';
export * from '../lib/constants/workflow-states';
