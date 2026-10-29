import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination, parseSort, buildMeta } from "../utils/pagination.js";
import { getSettings } from "../services/settingsService.js";
import {
  PACKAGE_SORT_FIELDS,
  createPackage,
  deletePackage,
  getPackage,
  listPackages,
  setPackageActive,
  updatePackage,
} from "../services/packageService.js";

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
  const sort = parseSort(req.query.sort, PACKAGE_SORT_FIELDS, "name");
  const { items, total } = await listPackages({
    status: req.query.status,
    type: req.query.type,
    search: req.query.search,
    page,
    limit,
    skip,
    sort,
  });
  res.json({ data: items, meta: buildMeta({ page, limit, total }) });
});

export const create = asyncHandler(async (req, res) => {
  const pkg = await createPackage(req.body, req.ownerId);
  res.status(201).json({ data: { package: pkg } });
});

export const detail = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ data: await getPackage(req.params.id, settings) });
});

export const update = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const { confirm, ...patch } = req.body;
  const data = await updatePackage(req.params.id, patch, {
    confirm: confirm === true,
    actor: req.ownerId,
    settings,
  });
  res.json({ data });
});

export const activate = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await setPackageActive(req.params.id, "active", {
    actor: req.ownerId,
    settings,
    action: "package.activate",
  });
  res.json({ data });
});

export const deactivate = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await setPackageActive(req.params.id, "inactive", {
    confirm: req.body.confirm === true,
    actor: req.ownerId,
    settings,
    action: "package.deactivate",
  });
  res.json({ data });
});

export const remove = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await deletePackage(req.params.id, req.ownerId, settings);
  res.json({ data });
});
