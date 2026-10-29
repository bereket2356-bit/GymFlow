import { fromCents } from "../utils/money.js";
import { toISODate } from "../utils/dates.js";

const idOf = (value) => (value && typeof value === "object" && value._id ? String(value._id) : value ? String(value) : null);

export function serializeOwner(owner) {
  return {
    id: String(owner._id),
    email: owner.email,
    name: owner.name,
    role: owner.role,
    lastLoginAt: owner.lastLoginAt ? new Date(owner.lastLoginAt).toISOString() : null,
  };
}

export function serializeCustomerSummary(customer) {
  if (!customer) return null;
  return {
    id: String(customer._id),
    customerId: customer.customerId,
    name: customer.name,
  };
}

export function serializeCustomer(customer) {
  return {
    id: String(customer._id),
    customerId: customer.customerId,
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? null,
    notes: customer.notes ?? "",
    status: customer.status,
    registeredAt: toISODate(customer.registeredAt),
    archivedAt: customer.archivedAt ? new Date(customer.archivedAt).toISOString() : null,
    createdAt: customer.createdAt ? new Date(customer.createdAt).toISOString() : null,
    updatedAt: customer.updatedAt ? new Date(customer.updatedAt).toISOString() : null,
  };
}

export function serializePackage(pkg, { affectedMembershipCount } = {}) {
  const data = {
    id: String(pkg._id),
    code: pkg.code,
    name: pkg.name,
    description: pkg.description ?? "",
    type: pkg.type,
    validityValue: pkg.validityValue,
    validityUnit: pkg.validityUnit,
    sessionAllowance: pkg.sessionAllowance,
    price: fromCents(pkg.priceCents),
    status: pkg.status,
    version: pkg.version,
    createdAt: pkg.createdAt ? new Date(pkg.createdAt).toISOString() : null,
    updatedAt: pkg.updatedAt ? new Date(pkg.updatedAt).toISOString() : null,
  };
  if (affectedMembershipCount !== undefined) data.affectedMembershipCount = affectedMembershipCount;
  return data;
}

export function serializePackageVersion(version) {
  return {
    id: String(version._id),
    version: version.version,
    name: version.name,
    description: version.description ?? "",
    type: version.type,
    validityValue: version.validityValue,
    validityUnit: version.validityUnit,
    sessionAllowance: version.sessionAllowance,
    price: fromCents(version.priceCents),
    status: version.status,
    changedFields: version.changedFields ?? [],
    createdAt: version.createdAt ? new Date(version.createdAt).toISOString() : null,
  };
}

export function serializeSnapshot(snapshot) {
  return {
    name: snapshot.name,
    type: snapshot.type,
    validityValue: snapshot.validityValue,
    validityUnit: snapshot.validityUnit,
    sessionAllowance: snapshot.sessionAllowance,
    price: fromCents(snapshot.priceCents),
  };
}

export function serializeMembership(membership, { status, balance, paymentStatus, customer, packageDoc } = {}) {
  const data = {
    id: String(membership._id),
    code: membership.code,
    customer: customer
      ? serializeCustomerSummary(customer)
      : { id: idOf(membership.customer) },
    package: {
      id: idOf(membership.package),
      name: membership.packageSnapshot?.name,
    },
    packageSnapshot: membership.packageSnapshot ? serializeSnapshot(membership.packageSnapshot) : null,
    startDate: toISODate(membership.startDate),
    expiryDate: membership.expiryDate ? toISODate(membership.expiryDate) : null,
    sessionsTotal: membership.sessionsTotal,
    sessionsUsed: membership.sessionsUsed,
    sessionsRemaining: membership.sessionsRemaining,
    agreedPrice: fromCents(membership.agreedPriceCents),
    state: membership.state,
    renewedFromId: membership.renewedFromId ? String(membership.renewedFromId) : null,
    cancelledAt: membership.cancelledAt ? new Date(membership.cancelledAt).toISOString() : null,
    createdAt: membership.createdAt ? new Date(membership.createdAt).toISOString() : null,
  };
  if (status) data.status = status;
  if (balance !== undefined) data.balance = fromCents(balance);
  if (paymentStatus) data.paymentStatus = paymentStatus;
  if (packageDoc) data.package = { id: String(packageDoc._id), code: packageDoc.code, name: packageDoc.name };
  return data;
}

export function serializePayment(payment, { customer, membership, adjustedCents } = {}) {
  const data = {
    id: String(payment._id),
    code: payment.code,
    customer: customer ? serializeCustomerSummary(customer) : { id: idOf(payment.customer) },
    membership: membership
      ? { id: idOf(membership), code: membership.code ?? null }
      : { id: payment.membership ? String(payment.membership) : null },
    amount: fromCents(payment.amountCents),
    method: payment.method,
    receivedOn: toISODate(payment.receivedOn),
    reference: payment.reference ?? null,
    recordedBy: idOf(payment.recordedBy),
    createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : null,
  };
  if (adjustedCents !== undefined) data.netAmount = fromCents(payment.amountCents + adjustedCents);
  return data;
}

export function serializeAdjustment(adjustment) {
  return {
    id: String(adjustment._id),
    originalPayment: idOf(adjustment.originalPayment),
    amount: fromCents(adjustment.amountCents),
    reason: adjustment.reason,
    recordedBy: idOf(adjustment.recordedBy),
    createdAt: adjustment.createdAt ? new Date(adjustment.createdAt).toISOString() : null,
  };
}

export function serializeAttendance(record, { customer, session } = {}) {
  const data = {
    id: String(record._id),
    customer: customer ? serializeCustomerSummary(customer) : { id: idOf(record.customer) },
    session: session
      ? { id: String(session._id), title: session.title, startsAt: new Date(session.startsAt).toISOString() }
      : { id: idOf(record.session) },
    membership: record.membership ? String(record.membership) : null,
    status: record.status,
    deducted: record.deducted,
    markedAt: record.markedAt ? new Date(record.markedAt).toISOString() : null,
  };
  return data;
}

export function serializeSession(session, { bookedCount } = {}) {
  const data = {
    id: String(session._id),
    code: session.code,
    title: session.title,
    startsAt: new Date(session.startsAt).toISOString(),
    durationMinutes: session.durationMinutes,
    capacity: session.capacity,
    status: session.status,
    instructor: session.instructor ?? null,
  };
  if (bookedCount !== undefined) data.booked = bookedCount;
  return data;
}

export function serializeExpense(expense) {
  return {
    id: String(expense._id),
    category: expense.category,
    description: expense.description,
    amount: fromCents(expense.amountCents),
    incurredOn: toISODate(expense.incurredOn),
    recordedBy: idOf(expense.recordedBy),
    createdAt: expense.createdAt ? new Date(expense.createdAt).toISOString() : null,
  };
}

export function serializeExpenseAdjustment(adjustment) {
  return {
    id: String(adjustment._id),
    originalExpense: idOf(adjustment.originalExpense),
    amount: fromCents(adjustment.amountCents),
    reason: adjustment.reason,
    recordedBy: idOf(adjustment.recordedBy),
    createdAt: adjustment.createdAt ? new Date(adjustment.createdAt).toISOString() : null,
  };
}
