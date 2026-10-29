import mongoose from "mongoose";
import { Customer } from "../models/Customer.js";
import { Membership } from "../models/Membership.js";
import { Payment } from "../models/Payment.js";
import { TrainingSession } from "../models/TrainingSession.js";
import { Expense } from "../models/Expense.js";
import { notFound } from "../utils/errors.js";

export async function findCustomerOrThrow(idOrCode) {
  const query = mongoose.isValidObjectId(idOrCode)
    ? { $or: [{ _id: idOrCode }, { customerId: String(idOrCode) }] }
    : { customerId: String(idOrCode) };
  const customer = await Customer.findOne(query);
  if (!customer) throw notFound("Customer not found.");
  return customer;
}

export async function findMembershipOrThrow(idOrCode) {
  const query = mongoose.isValidObjectId(idOrCode)
    ? { $or: [{ _id: idOrCode }, { code: String(idOrCode) }] }
    : { code: String(idOrCode) };
  const membership = await Membership.findOne(query);
  if (!membership) throw notFound("Membership not found.");
  return membership;
}

export async function findPaymentOrThrow(idOrCode) {
  const query = mongoose.isValidObjectId(idOrCode)
    ? { $or: [{ _id: idOrCode }, { code: String(idOrCode) }] }
    : { code: String(idOrCode) };
  const payment = await Payment.findOne(query);
  if (!payment) throw notFound("Payment not found.");
  return payment;
}

export async function findSessionOrThrow(idOrCode) {
  const query = mongoose.isValidObjectId(idOrCode)
    ? { $or: [{ _id: idOrCode }, { code: String(idOrCode) }] }
    : { code: String(idOrCode) };
  const session = await TrainingSession.findOne(query);
  if (!session) throw notFound("Session not found.");
  return session;
}

export async function findExpenseOrThrow(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound("Expense not found.");
  const expense = await Expense.findById(id);
  if (!expense) throw notFound("Expense not found.");
  return expense;
}
