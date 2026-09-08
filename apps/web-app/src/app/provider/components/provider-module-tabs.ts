/**
 * Module sub-navigation for the provider portal — which tabs a route gets.
 *
 * Why this lives here rather than in a route `layout.tsx`.
 *
 * The provider chrome (header, nav, footer) is NOT in the Next route layout:
 * `provider/layout.tsx` renders only `<>{children}</>` and each page imports a
 * `ProviderLayout` *component* instead. Two modules used to draw their tab bar
 * from a real route-level `layout.tsx`, and Next nests a route layout above the
 * page it wraps — so those tab bars rendered above the global header (measured:
 * sub-nav at top:0, header at top:69).
 *
 * Hoisting the chrome into the route layout is the proper fix, but it means
 * rewriting 92 `<ProviderLayout>` call sites and rehoming the title/subtitle
 * props 36 of them pass. Until that happens the rule runs the other way: chrome
 * is inside the page, so the module tabs must be inside it too.
 *
 * `ProviderLayout` therefore derives its tabs from the pathname through this
 * module, and the sub-layouts are gone. One place decides what a route gets,
 * no page has to remember to wire anything up, and a module page added later
 * gets its tab bar — in the right position — without being told to.
 */



export interface ModuleTab {
    href: string;
    label: string;
    isActive: boolean;
}

export interface ModuleTabGroup {
    /** Accessible name for the <nav>, in Thai like the rest of the portal. */
    ariaLabel: string;
    tabs: ModuleTab[];
}

const SETTINGS_TABS = [
    { href: '/provider/settings/system', label: 'ระบบ' },
    { href: '/provider/settings/work-config', label: 'คิวงาน' },
] as const;

/**
 * The tab group for a route, or null when the route is not part of a tabbed
 * module (most of the portal).
 *
 * ระบบเต็มมีโมดูลบัญชีซึ่งซ่อนแท็บฝั่งแพลตฟอร์มจากเจ้าหน้าที่ฝั่งกรมฯ — GACP Lite
 * ไม่มีโมดูลบัญชี (ไม่มีเอกสารการเงิน) จึงเหลือกลุ่มแท็บเดียวคือหน้าตั้งค่า
 */
export function moduleTabsFor(pathname: string | null): ModuleTabGroup | null {
    if (!pathname) {
        return null;
    }

    if (pathname.startsWith('/provider/settings')) {
        return {
            ariaLabel: 'เมนูตั้งค่า',
            tabs: SETTINGS_TABS.map((tab) => ({
                href: tab.href,
                label: tab.label,
                isActive: pathname.startsWith(tab.href),
            })),
        };
    }

    return null;
}
