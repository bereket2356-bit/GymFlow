import { asyncHandler } from "../utils/asyncHandler.js";
import { getSettings } from "../services/settingsService.js";
import {
  attendanceHeatmap,
  exportCsv,
  outstandingReport,
  paymentsByWeek,
  reportSummary,
} from "../services/reportService.js";

export const summary = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({
    data: await reportSummary({ from: req.query.from, to: req.query.to, settings }),
  });
});

export const payments = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({
    data: await paymentsByWeek({
      weeks: req.query.weeks,
      to: req.query.to,
      settings,
    }),
  });
});

export const heatmap = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({
    data: await attendanceHeatmap({
      weeks: req.query.weeks,
      to: req.query.to,
      settings,
    }),
  });
});

export const outstanding = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({ data: await outstandingReport({ settings }) });
});

export const csv = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const { filename, csv: body } = await exportCsv({
    type: req.query.type,
    from: req.query.from,
    to: req.query.to,
    settings,
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`\uFEFF${body}`);
});
