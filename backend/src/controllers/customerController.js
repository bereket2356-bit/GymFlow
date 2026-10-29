import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination, parseSort, buildMeta } from "../utils/pagination.js";
import { getSettings } from "../services/settingsService.js";
import {
  CUSTOMER_SORT_FIELDS,
  archiveCustomer,
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomerAttendance,
  getCustomerLedger,
  listCustomers,
  restoreCustomer,
  updateCustomer,
} from "../services/customerService.js";

export const list = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sort, CUSTOMER_SORT_FIELDS, "-registeredAt");
  const { items, total } = await listCustomers({
    search: req.query.search,
    status: req.query.status,
    sort,
    page,
    limit,
    skip,
    settings,
  });
  res.json({ data: items, meta: buildMeta({ page, limit, total }) });
});

export const create = asyncHandler(async (req, res) => {
  const customer = await createCustomer(req.body, { actor: req.ownerId });
  res.status(201).json({ data: { customer } });
});

export const detail = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ data: await getCustomer(req.params.id, settings) });
});

export const update = asyncHandler(async (req, res) => {
  const customer = await updateCustomer(req.params.id, req.body, { actor: req.ownerId });
  res.json({ data: { customer } });
});

export const archive = asyncHandler(async (req, res) => {
  const customer = await archiveCustomer(req.params.id, { actor: req.ownerId });
  res.json({ data: { customer } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteCustomer(req.params.id, { actor: req.ownerId });
  res.json({ data: { deleted: true } });
});

export const restore = asyncHandler(async (req, res) => {
  const customer = await restoreCustomer(req.params.id, { actor: req.ownerId });
  res.json({ data: { customer } });
});

export const ledger = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ data: await getCustomerLedger(req.params.id, settings) });
});

export const attendance = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const days = req.query.days ?? 30;
  res.json({ data: await getCustomerAttendance(req.params.id, { days, settings }) });
});
