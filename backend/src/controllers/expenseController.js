import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination, parseSort, buildMeta } from "../utils/pagination.js";
import { getSettings } from "../services/settingsService.js";
import {
  EXPENSE_SORT_FIELDS,
  addExpenseAdjustment,
  createExpense,
  listExpenses,
} from "../services/expenseService.js";

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sort, EXPENSE_SORT_FIELDS, "-incurredOn");
  const { items, total } = await listExpenses({
    from: req.query.from,
    to: req.query.to,
    category: req.query.category,
    page,
    limit,
    skip,
    sort,
  });
  res.json({ data: items, meta: buildMeta({ page, limit, total }) });
});

export const create = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const expense = await createExpense(req.body, { actor: req.ownerId, settings });
  res.status(201).json({ data: { expense } });
});

export const addAdjustment = asyncHandler(async (req, res) => {
  const data = await addExpenseAdjustment(req.params.id, req.body, { actor: req.ownerId });
  res.status(201).json({ data });
});
