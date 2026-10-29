import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination, parseSort, buildMeta } from "../utils/pagination.js";
import { getSettings } from "../services/settingsService.js";
import {
  PAYMENT_SORT_FIELDS,
  addPaymentAdjustment,
  getPayment,
  listPayments,
  recordPayment,
} from "../services/paymentService.js";

export const create = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await recordPayment(req.body, { actor: req.ownerId, settings });
  res.status(201).json({ data });
});

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sort, PAYMENT_SORT_FIELDS, "-receivedOn");
  const { items, total, netTotal } = await listPayments({
    customerId: req.query.customerId,
    membershipId: req.query.membershipId,
    from: req.query.from,
    to: req.query.to,
    method: req.query.method,
    page,
    limit,
    skip,
    sort,
  });
  res.json({ data: items, meta: { ...buildMeta({ page, limit, total }), netTotal } });
});

export const addAdjustment = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const data = await addPaymentAdjustment(req.params.id, req.body, { actor: req.ownerId, settings });
  res.status(201).json({ data });
});

export const detail = asyncHandler(async (req, res) => {
  res.json({ data: await getPayment(req.params.id) });
});
