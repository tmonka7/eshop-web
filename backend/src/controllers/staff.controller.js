'use strict';

const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const {
  ROLES, STAFF_ROLES, PERMISSION_VALUES,
} = require('../config/constants');

/** Roles a super admin may assign. Never SUPER_ADMIN - see `assertAssignable`. */
const ASSIGNABLE_ROLES = [ROLES.MANAGER, ROLES.ADMIN];

const PUBLIC_FIELDS = 'name email role permissions isActive avatar phone lastLoginAt createdAt';

/**
 * A super admin can create and edit staff below them, but cannot mint another
 * super admin through this API. Promotion to the top tier stays a deliberate
 * out-of-band act (the seed, or a DB change), so a compromised admin session
 * cannot manufacture a peer that outlives it.
 */
function assertAssignable(role) {
  if (role === undefined) return;
  if (!ASSIGNABLE_ROLES.includes(role)) {
    throw ApiError.badRequest('error.roleNotAssignable');
  }
}

/** Keeps only permissions the system actually defines, de-duplicated. */
function cleanPermissions(input) {
  if (!Array.isArray(input)) return undefined;
  return [...new Set(input.filter((p) => PERMISSION_VALUES.includes(p)))];
}

/** Rejects edits that target a super admin or the caller themselves. */
function assertEditable(target, req) {
  if (!target || !STAFF_ROLES.includes(target.role)) {
    throw ApiError.notFound('error.staffNotFound');
  }
  if (target.role === ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('error.cannotEditSuperAdmin');
  }
  if (String(target._id) === String(req.user._id)) {
    // Defensive: a super admin is not editable above, so this can only be hit
    // if the tiers are ever loosened. Locking yourself out is worse than a 403.
    throw ApiError.forbidden('error.cannotEditSelf');
  }
}

/* -------------------------------------------------------------------------- */

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);

  const filter = { role: { $in: STAFF_ROLES } };
  if (req.query.role && STAFF_ROLES.includes(req.query.role)) filter.role = req.query.role;
  if (req.query.status === 'active') filter.isActive = true;
  if (req.query.status === 'inactive') filter.isActive = false;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return paginated(res, items, { page, limit, total }, 'success.staffList');
});

exports.getOne = asyncHandler(async (req, res) => {
  const staff = await User.findById(req.params.id).select(PUBLIC_FIELDS).lean();
  if (!staff || !STAFF_ROLES.includes(staff.role)) throw ApiError.notFound('error.staffNotFound');
  return ok(res, staff, 'success.staffFetched');
});

exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, role, permissions, phone } = req.body;
  assertAssignable(role);

  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) throw ApiError.conflict('error.emailExists');

  // The password is hashed by the User model's save hook, so it is passed
  // through as-is rather than hashed twice here.
  const staff = await User.create({
    name,
    email,
    password,
    phone: phone || '',
    role: role || ROLES.MANAGER,
    permissions: cleanPermissions(permissions) || [],
  });

  const plain = staff.toObject();
  delete plain.password;
  delete plain.refreshTokens;
  return created(res, plain, 'success.staffCreated');
});

exports.update = asyncHandler(async (req, res) => {
  const staff = await User.findById(req.params.id);
  assertEditable(staff, req);

  const { name, phone, role, permissions, isActive, password } = req.body;
  assertAssignable(role);

  if (name !== undefined) staff.name = name;
  if (phone !== undefined) staff.phone = phone;
  if (role !== undefined) staff.role = role;
  if (isActive !== undefined) staff.isActive = Boolean(isActive);

  const nextPermissions = cleanPermissions(permissions);
  if (nextPermissions !== undefined) staff.permissions = nextPermissions;

  // A blank password field in the edit form means "leave it alone", not
  // "set the password to empty".
  if (password) staff.password = password;

  // Any change to what an account may do invalidates its live sessions, so
  // the next request has to re-authenticate against the new role.
  if (role !== undefined || nextPermissions !== undefined || isActive === false) {
    staff.refreshTokens = [];
  }

  await staff.save();

  const plain = staff.toObject();
  delete plain.password;
  delete plain.refreshTokens;
  return ok(res, plain, 'success.staffUpdated');
});

exports.remove = asyncHandler(async (req, res) => {
  const staff = await User.findById(req.params.id);
  assertEditable(staff, req);

  await staff.deleteOne();
  return ok(res, { id: req.params.id }, 'success.staffDeleted');
});

/** The permission catalogue, so the panel does not hardcode its own copy. */
exports.options = asyncHandler(async (_req, res) =>
  ok(res, { roles: ASSIGNABLE_ROLES, permissions: PERMISSION_VALUES }, 'success.staffOptions'));
