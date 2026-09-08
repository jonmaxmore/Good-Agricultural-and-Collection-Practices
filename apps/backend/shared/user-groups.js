/**
 * @module shared/user-groups
 *
 * Resolution helpers for the M2M user × role-group model (ADR-016 Phase 1C).
 *
 * Read paths:
 *   - getUserGroups(prisma, userId): canonical group codes the user belongs to.
 *     Falls back to [normalizeRole(user.role)] when the user has no
 *     memberships (e.g. fresh signup before ops adds them to groups).
 *   - userInGroup(prisma, userId, groupCode): O(1) check used by claim/route guards.
 *   - listGroupMemberUserIds(prisma, organizationId, groupCode): "everyone in
 *     group X for tenant Y" — used by notification dispatch + queue UIs.
 *
 * Write paths (admin-only) live in routes/api/provider/admin/user-groups.js.
 *
 * Backward-compatible note: User.role stays. New code that wants to
 * "find users with role X in tenant T" should call listGroupMemberUserIds
 * instead of doing prisma.user.findMany({ where: { role, ... } }) — that
 * older query misses users whose primary role is something else but who
 * also belong to group X via memberships.
 */

'use strict';

const { normalizeRole, CANONICAL_ROLES } = require('./canonical-rbac');

// In-memory cache of role-group code → id, populated lazily. The
// role_groups table is seeded by migration and never edited at runtime,
// so this cache is safe and never invalidated.
let _groupIdByCode = null;

async function loadGroupIdMap(prisma) {
    if (_groupIdByCode) {return _groupIdByCode;}
    const rows = await prisma.roleGroup.findMany({
        where: { isActive: true },
        select: { id: true, code: true },
    });
    _groupIdByCode = Object.fromEntries(rows.map((r) => [r.code, r.id]));
    return _groupIdByCode;
}

function clearCache() {
    _groupIdByCode = null;
}

async function getUserGroups(prisma, userId) {
    if (!userId) {return [];}
    const memberships = await prisma.userGroupMembership.findMany({
        where: { userId, isActive: true },
        select: { group: { select: { code: true, isActive: true } } },
    });
    const codes = memberships
        .filter((m) => m.group?.isActive)
        .map((m) => m.group.code);

    if (codes.length > 0) {
        return codes;
    }

    // Fallback to legacy User.role for users without memberships.
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    const canonical = normalizeRole(user?.role);
    return canonical ? [canonical] : [];
}

async function userInGroup(prisma, userId, groupCode) {
    if (!userId || !groupCode) {return false;}
    const target = normalizeRole(groupCode) || groupCode;

    // Admin shortcut: if the user is in the admin group (via membership
    // OR via legacy User.role), grant access to every group.
    const groups = await getUserGroups(prisma, userId);
    if (groups.includes(CANONICAL_ROLES.ADMIN)) {return true;}
    return groups.includes(target);
}

async function listGroupMemberUserIds(prisma, organizationId, groupCode) {
    if (!organizationId || !groupCode) {return [];}
    const target = normalizeRole(groupCode) || groupCode;

    // 1) Members via the M2M memberships
    const map = await loadGroupIdMap(prisma);
    const groupId = map[target];
    let memberRows = [];
    if (groupId) {
        memberRows = await prisma.userGroupMembership.findMany({
            where: {
                groupId,
                organizationId,
                isActive: true,
                user: { isDeleted: false, isLocked: false },
            },
            select: { userId: true },
        });
    }

    // 2) Plus any user whose User.role still matches and who has no
    //    membership row yet — defensive fallback for new users created
    //    before being added to a group.
    //
    //    Migration 20260801000000_canonicalize_user_role made User.role
    //    CANONICAL (lowercase, alias-collapsed), and the four writers were
    //    flipped to canonical in the same phase, so `target` is exactly the
    //    value stored in the column. This filter was widened to accept the
    //    legacy spelling too while rows of both existed; the production run
    //    reported zero legacy rows remaining, so the second spelling can only
    //    ever match nothing and is gone.
    let fallbackRows = [];
    if (target) {
        fallbackRows = await prisma.user.findMany({
            where: {
                organizationId,
                role: target,
                isDeleted: false,
                isLocked: false,
            },
            select: { id: true },
        });
    }

    const seen = new Set();
    for (const r of memberRows) {seen.add(r.userId);}
    for (const r of fallbackRows) {seen.add(r.id);}
    return Array.from(seen);
}

/**
 * Convenience: full picture for one user — primary role from User.role
 * plus the canonical group codes from memberships, deduped.
 */
async function describeUserAccess(prisma, userId) {
    if (!userId) {return { primaryRole: null, groups: [] };}
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    const groups = await getUserGroups(prisma, userId);
    return {
        primaryRole: normalizeRole(user?.role),
        groups,
    };
}

module.exports = {
    getUserGroups,
    userInGroup,
    listGroupMemberUserIds,
    describeUserAccess,
    clearCache,
};
