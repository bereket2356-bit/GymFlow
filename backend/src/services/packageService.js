import mongoose from "mongoose";
import { Package } from "../models/Package.js";
import { PackageVersion } from "../models/PackageVersion.js";
import { Membership } from "../models/Membership.js";
import { nextSequence } from "../models/Counter.js";
import { recordAudit } from "./auditService.js";
import { serializePackage, serializePackageVersion } from "./serialize.js";
import { businessRule, conflict, notFound } from "../utils/errors.js";
import { todayInTimeZone } from "../utils/dates.js";
import { toCents } from "../utils/money.js";

const SORT_FIELDS = ["name", "priceCents", "createdAt", "updatedAt", "status", "type"];

async function findPackage(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound("Package not found.");
  const pkg = await Package.findById(id);
  if (!pkg) throw notFound("Package not found.");
  return pkg;
}

/** Memberships whose terms could still be affected by a package change. */
export async function activeMembershipCount(packageId, settings) {
  const todayISO = todayInTimeZone(settings?.timezone);
  const memberships = await Membership.find({
    package: packageId,
    state: { $in: ["scheduled", "active"] },
  }).lean();
  return memberships.filter((m) => {
    if (m.agreedPriceCents === undefined) return false;
    const expiry = m.expiryDate ? new Date(m.expiryDate).toISOString().slice(0, 10) : null;
    if (expiry && expiry < todayISO) return false;
    return true;
  }).length;
}

export async function listPackages({ status, type, search, page, limit, skip, sort }) {
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ name: { $regex: safe, $options: "i" } }, { description: { $regex: safe, $options: "i" } }];
  }
  const [items, total] = await Promise.all([
    Package.find(filter).sort(sort).skip(skip).limit(limit),
    Package.countDocuments(filter),
  ]);
  return { items: items.map((pkg) => serializePackage(pkg)), total };
}

export async function getPackage(id, settings) {
  const pkg = await findPackage(id);
  const versions = await PackageVersion.find({ package: pkg._id }).sort({ version: -1 });
  const affected = await activeMembershipCount(pkg._id, settings);
  return {
    package: serializePackage(pkg, { affectedMembershipCount: affected }),
    versions: versions.map(serializePackageVersion),
  };
}

async function writeVersion(pkg, changedFields, { session } = {}) {
  await PackageVersion.create(
    [
      {
        package: pkg._id,
        version: pkg.version,
        name: pkg.name,
        description: pkg.description,
        type: pkg.type,
        validityValue: pkg.validityValue,
        validityUnit: pkg.validityUnit,
        sessionAllowance: pkg.sessionAllowance,
        priceCents: pkg.priceCents,
        status: pkg.status,
        changedFields,
      },
    ],
    { session },
  );
}

export async function createPackage(payload, actor) {
  const seq = await nextSequence("package", { start: 1 });
  const pkg = await Package.create({
    code: `PKG-${String(seq).padStart(3, "0")}`,
    name: payload.name,
    description: payload.description ?? "",
    type: payload.type,
    validityValue: payload.validityValue,
    validityUnit: payload.validityUnit,
    sessionAllowance: payload.sessionAllowance,
    priceCents: toCents(payload.price),
    status: payload.status ?? "active",
    version: 1,
  });
  await writeVersion(pkg, ["created"]);
  await recordAudit({
    actor,
    action: "package.create",
    entityType: "Package",
    entityId: pkg._id,
    after: pkg,
  });
  return serializePackage(pkg);
}

/**
 * Editing a package captures a new immutable version. Changing the type or the
 * session allowance while live memberships exist requires `confirm: true`.
 */
export async function updatePackage(id, payload, { confirm = false, actor, settings }) {
  const pkg = await findPackage(id);
  const before = pkg.toObject();
  const affected = await activeMembershipCount(pkg._id, settings);
  const structuralChange =
    (payload.type !== undefined && payload.type !== pkg.type) ||
    (payload.sessionAllowance !== undefined && payload.sessionAllowance !== pkg.sessionAllowance);

  if (structuralChange && affected > 0 && !confirm) {
    throw conflict(
      `${affected} active membership${affected === 1 ? "" : "s"} exist on this package. ` +
        "Changing the type or session allowance only affects new memberships. Send confirm: true to proceed.",
      { confirmRequired: true, affectedMembershipCount: affected },
    );
  }

  const changedFields = [];
  const assign = (field, value) => {
    if (value !== undefined && value !== pkg[field]) {
      pkg[field] = value;
      changedFields.push(field);
    }
  };
  assign("name", payload.name);
  assign("description", payload.description);
  assign("type", payload.type);
  assign("validityValue", payload.validityValue);
  assign("validityUnit", payload.validityUnit);
  assign("sessionAllowance", payload.sessionAllowance);
  if (payload.price !== undefined) assign("priceCents", toCents(payload.price));
  assign("status", payload.status);

  if (changedFields.length === 0) {
    return { package: serializePackage(pkg, { affectedMembershipCount: affected }), affectedMembershipCount: affected };
  }

  pkg.version += 1;
  await pkg.save();
  await writeVersion(pkg, changedFields);
  await recordAudit({
    actor,
    action: "package.update",
    entityType: "Package",
    entityId: pkg._id,
    before,
    after: pkg.toObject(),
  });

  return { package: serializePackage(pkg, { affectedMembershipCount: affected }), affectedMembershipCount: affected };
}

export async function setPackageActive(id, status, { confirm = false, actor, settings, action }) {
  const pkg = await findPackage(id);
  if (status === "inactive") {
    const affected = await activeMembershipCount(pkg._id, settings);
    if (affected > 0 && !confirm) {
      throw conflict(
        `Deactivating this package affects ${affected} active membership${affected === 1 ? "" : "s"}. ` +
          "Existing memberships keep their terms; only new assignments are blocked. Send confirm: true to proceed.",
        { confirmRequired: true, affectedMembershipCount: affected },
      );
    }
    if (pkg.status === "inactive") {
      return { package: serializePackage(pkg), affectedMembershipCount: affected };
    }
    const before = pkg.toObject();
    pkg.status = "inactive";
    await pkg.save();
    await recordAudit({
      actor,
      action: action ?? "package.deactivate",
      entityType: "Package",
      entityId: pkg._id,
      before,
      after: pkg.toObject(),
    });
    return { package: serializePackage(pkg), affectedMembershipCount: affected };
  }

  if (pkg.status === "active") return { package: serializePackage(pkg), affectedMembershipCount: 0 };
  const before = pkg.toObject();
  pkg.status = "active";
  await pkg.save();
  await recordAudit({
    actor,
    action: action ?? "package.activate",
    entityType: "Package",
    entityId: pkg._id,
    before,
    after: pkg.toObject(),
  });
  return { package: serializePackage(pkg), affectedMembershipCount: 0 };
}

export async function deletePackage(id, actor) {
  const pkg = await findPackage(id);
  const membershipCount = await Membership.countDocuments({ package: pkg._id });
  if (membershipCount > 0) {
    throw conflict(
      `This package is used by ${membershipCount} membership${membershipCount === 1 ? "" : "s"} and cannot be deleted. ` +
        "Deactivate it instead so existing terms are preserved.",
      { membershipCount },
    );
  }
  await PackageVersion.deleteMany({ package: pkg._id });
  await pkg.deleteOne();
  await recordAudit({
    actor,
    action: "package.delete",
    entityType: "Package",
    entityId: pkg._id,
    before: pkg.toObject(),
  });
  return { deleted: true };
}

export const PACKAGE_SORT_FIELDS = SORT_FIELDS;
