/**
 * Navigation Constants — role-scoped simplification.
 *
 * Health: 7 primary items (was 12, simplified to 6, then X1-FIX-C added
 * `help` so the help center is reachable from every operational HEALTH
 * page — X1-A audit §6 flagged that /help was only reachable from
 * /onboarding or by direct URL).
 * Provider: 6 primary items (was 11)
 *
 * Design principles:
 * - Only show what the user needs NOW
 * - Post-certification features hidden until earned
 * - Notifications via bell icon, not nav item
 * - Settings under profile, not top-level
 *
 * See: docs/architecture/navigation-simplification-plan.md
 */

import {
  Award,
  CreditCard,
  FileText,
  Home,
  Sprout,
  User,
  Users,
  LayoutGrid,
  ClipboardCheck,
  Banknote,
  Settings,
  Calendar,
  BarChart3,
  Inbox,
  HelpCircle,
  Shield,
  Scale,
  ClipboardList,
  Database as DatabaseIcon,
  Leaf,
  ScanEye,
} from 'lucide-react';
import { CANONICAL_ROLES } from '@/lib/constants/canonical-roles';
// NAV_ROLE_RULES is now PROJECTED from the single source of truth in
// provider-role-config.ts (which also drives PROVIDER_ROUTE_ROLE_RULES + the
// post-login landing). Imported here (local binding for visibleProviderNavItems)
// and re-exported below under the original name so consumers are unchanged.
import { NAV_ROLE_RULES, providerLandingPath } from '@/lib/provider-role-config';
// Nav-config SSOT: farmer nav is now derived from nav-config.ts FARMER_NAV
import { FARMER_NAV } from '@/lib/navigation/nav-config';

export type AppRole = 'health' | 'provider';

export interface NavigationItem {
  key: string;
  label: string;
  href: string;
  icon: typeof Home;
}

/**
 * Health-side navigation — derived from nav-config.ts FARMER_NAV (SSOT)
 * Kept as healthNavigation export for backward compatibility with existing consumers.
 * Shape: { key, label, href, icon } (old NavigationItem format).
 *
 * Built by key-mapping from FARMER_NAV items, with legacy-only items
 * (dashboard, applications-list, profile) in explicit LEGACY_ONLY_NAV block.
 * Labels are BYTE-IDENTICAL to pre-task values (live sidebar in layout.tsx renders them today).
 * Paths and icons derive from FARMER_NAV where available.
 * The 'applications' key maps to the LIST page (/health/applications), not /new.
 *
 * Backward-compatibility order preserved: dashboard, applications, payments,
 * certificates, planting, profile, workspaces, surveys, herbs, help.
 */

// LEGACY_LABELS — byte-identical labels from pre-task healthNavigation (src/app/health/layout.tsx renders these).
// Kept to prevent sidebar label drift while icons/paths come from nav-config FARMER_NAV.
// Type-exhaustive Record to ensure all keys are defined at compile time.
const LEGACY_LABELS = {
  dashboard: 'แดชบอร์ด',
  applications: 'คำขอรับรอง',
  payments: 'ค่าธรรมเนียม',
  certificates: 'ใบรับรอง',
  profile: 'โปรไฟล์',
  help: 'ช่วยเหลือ',
} as const;

// LEGACY_ONLY_NAV — items not in nav-config FARMER_NAV, deprecated but kept for backward compatibility.
// Not part of the tile-home redesign.
const LEGACY_ONLY_NAV: readonly NavigationItem[] = [
  { key: 'dashboard', label: LEGACY_LABELS.dashboard, href: '/health/dashboard', icon: Home },
  { key: 'profile', label: LEGACY_LABELS.profile, href: '/health/profile', icon: User },
] as const;

// Safe helper to lookup FARMER_NAV item by key, throws on missing (for static type safety).
function requireFarmerNavItem(key: string): typeof FARMER_NAV[0] {
  const item = FARMER_NAV.find(i => i.key === key);
  if (!item) throw new Error(`nav-config: FARMER_NAV item '${key}' not found`);
  return item;
}

// Helper to convert FARMER_NAV item to legacy NavigationItem (path+icon from nav-config, label from LEGACY_LABELS).
function legacyNavFromFarmer(key: keyof typeof LEGACY_LABELS): NavigationItem {
  const farmerItem = requireFarmerNavItem(key);
  const label: string = LEGACY_LABELS[key];
  return {
    key: farmerItem.key,
    label,
    href: farmerItem.path,
    icon: farmerItem.icon,
  };
}

// Construct healthNavigation in backward-compatible order:
// 1. Legacy dashboard (from LEGACY_ONLY_NAV)
// 2. 'applications' list page (legacy-only, not /new)
// 3. FARMER_NAV items (payments, certificates, help)
//    EXCLUDING 'status' and 'home' which are new items not in pre-task nav
//    planting / workspaces / surveys / herbs ถูกตัดออกจาก GACP Lite ทั้งโมดูล
// 4. Legacy profile (from LEGACY_ONLY_NAV)
const legacyDashboard: NavigationItem = LEGACY_ONLY_NAV[0]!; // dashboard item from legacy-only block
const legacyProfile: NavigationItem = LEGACY_ONLY_NAV[1]!; // profile item from legacy-only block
export const healthNavigation: NavigationItem[] = [
  legacyDashboard,
  {
    key: 'applications',
    label: LEGACY_LABELS.applications,
    href: '/health/applications', // legacy list page, not /new
    icon: FileText,
  },
  legacyNavFromFarmer('payments'),
  legacyNavFromFarmer('certificates'),
  legacyProfile,
  legacyNavFromFarmer('help'),
];

/* Provider-side: 8 items.
 *
 * Previously 6 — but several built pages (calendar, analytics) had no nav
 * entry, which is the main source of "provider dashboard ยังไม่เสร็จ"
 * perception. Sub-pages (criteria, management, documents, receipts, reports)
 * are surfaced as in-page tabs/sub-nav inside their parent section.
 */
export const providerNavigation: NavigationItem[] = [
  { key: 'dashboard', label: 'แดชบอร์ด', href: '/provider/dashboard', icon: LayoutGrid },
  { key: 'work', label: 'งานของฉัน', href: '/provider/work', icon: Inbox },
  { key: 'applications', label: 'คำขอ', href: '/provider/applications', icon: FileText },
  { key: 'audits', label: 'ตรวจประเมิน', href: '/provider/audits', icon: ClipboardCheck },
  { key: 'calendar', label: 'ปฏิทิน', href: '/provider/calendar', icon: Calendar },
  { key: 'analytics', label: 'รายงาน', href: '/provider/analytics', icon: BarChart3 },
  { key: 'certificates', label: 'ใบรับรอง', href: '/provider/certificates', icon: Award },
  // สัญญา C05F680149 ต้นแบบที่ 1 (ระบบวิเคราะห์มาตรฐาน GACP 3 ระบบ): unrestricted
  // nav item (no NAV_ROLE_RULES entry) + unlisted route prefix → default-allowed
  // to every provider role (FE-XC-03) — read-only gap-analysis tool.
  { key: 'standards', label: 'มาตรฐาน', href: '/provider/standards', icon: Scale },
  { key: 'settings', label: 'ตั้งค่า', href: '/provider/settings/system', icon: Settings },
  // P1-F: an ADMIN landing on /provider/dashboard had NO clickable path to the
  // admin console (/admin/*) — their #1 tool (user management etc.). This
  // ADMIN-only item surfaces it. Restricted via NAV_ROLE_RULES['admin-console']
  // = [ADMIN] (projected from the admin-area navRules in provider-role-config);
  // ADMIN bypasses every route rule so nav⊆route coherence stays green.
  { key: 'admin-console', label: 'ผู้ดูแลระบบ', href: '/admin/dashboard', icon: Shield },
];

/**
 * X4-FIX-A NAV-1 — provider-side nav visibility rules per canonical role.
 *
 * Each key is a `providerNavigation` item key; the value is the list of
 * canonical roles that may SEE the link. Items with NO entry are visible to
 * every authenticated provider role.
 *
 * MOVED (role-config Phase 1): the table itself now lives in
 * `provider-role-config.ts` as a projection of the single source of truth (the
 * same module that drives `PROVIDER_ROUTE_ROLE_RULES` + the post-login landing),
 * so nav ↔ route ↔ landing can no longer silently drift. It is imported above
 * (a local binding `visibleProviderNavItems` reads) and re-exported here under
 * the original name `NAV_ROLE_RULES` so every consumer + Jest guard is unchanged.
 */
export { NAV_ROLE_RULES };

/**
 * C1-1 (role-specific nav): rewrite the always-visible `dashboard` item so its
 * "home" affordance points at the role's OWN landing instead of the generic
 * /provider/dashboard. Each provider role has a dedicated launchpad
 * (reviewer/coordinator/audits/accounting) — `providerLandingPath(role)` returns it
 * (or `null` for ADMIN / legacy ACCOUNT / unknown, who stay on /provider/dashboard).
 * The label becomes "หน้าหลัก" (Home) since it's now role-specific, not the generic
 * "แดชบอร์ด". Key stays `'dashboard'` so the nav rule (unrestricted) + the existing
 * key-based tests are unchanged, and the href is guaranteed route-allowed for the
 * role (every landing ∈ allowed routes — landing-route-coherence + nav-middleware-
 * coherence both pin this).
 */
function roleAwareDashboardItem(item: NavigationItem, role: string | null | undefined): NavigationItem {
  const landing = providerLandingPath(role);
  return {
    ...item,
    href: landing || '/provider/dashboard',
    label: 'หน้าหลัก',
  };
}

/**
 * Pure helper: given a role (canonical), return the providerNavigation
 * items it should see. Used by `provider-layout.tsx` AND by Jest tests.
 *
 * Admins always see everything. Items with no rule entry are public.
 * The `dashboard` item is always rewritten to be role-aware (its href targets
 * the role's own landing; ADMIN keeps /provider/dashboard).
 */
export function visibleProviderNavItems(role: string | null | undefined): NavigationItem[] {
  const mapDashboard = (item: NavigationItem): NavigationItem =>
    item.key === 'dashboard' ? roleAwareDashboardItem(item, role) : item;

  // P1-F (fail-closed null-role nav): a null / unknown / not-yet-resolved role
  // MUST NOT render the full admin nav. The provider layout swallows a failed
  // /auth/provider/me and passes role=null; previously this branch fell into the
  // ADMIN case below and leaked every admin-only sidebar link (settings/etc.) to
  // an unauthenticated/errored session — display-only over-exposure (routes still
  // enforce, but the menu should never advertise admin tools). Render the
  // least-privilege set instead: only the unrestricted items (no NAV_ROLE_RULES
  // entry). ADMIN keeps the full nav via its own explicit branch below.
  if (!role) {
    return providerNavigation
      .filter((item) => !NAV_ROLE_RULES[item.key]) // unrestricted items only
      .map(mapDashboard);
  }
  if (role === CANONICAL_ROLES.ADMIN) {
    return providerNavigation.map(mapDashboard);
  }
  return providerNavigation
    .filter((item) => {
      const allowed = NAV_ROLE_RULES[item.key];
      if (!allowed) {
        return true;  // unrestricted nav item
      }
      return allowed.includes(role);
    })
    .map(mapDashboard);
}

/**
 * DEMO_MODE — set to true to disable all wizard step validation,
 * allowing free Next navigation for testing and client demos.
 * Set to false for production.
 */
export const DEMO_MODE = false;  // OFF — production wizard validation enforced
