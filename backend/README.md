# BGMS API — Boxing Gym Management System

Owner-only backend for the gym console. Node.js 20+, Express 4, MongoDB 7 (Mongoose 8), ES modules, JSON only.
Money is stored as integer cents and exposed as decimal numbers at the API edge. Calendar dates are stored as
UTC-midnight dates and exposed as `YYYY-MM-DD`; "today" is resolved in the configured gym timezone.

---

## 1. Setup

```bash
cd backend
cp .env.example .env          # fill in JWT_SECRET, MONGODB_URI, SEED_OWNER_*
npm install

# Start MongoDB 7 locally (replica set, needed for attendance transactions)
docker compose up -d

npm run seed                  # sample data matching the frontend
npm run dev                   # http://localhost:5000
```

Other scripts:

| Script | Purpose |
| --- | --- |
| `npm start` | Run the API without a watcher |
| `npm run dev` | nodemon watcher |
| `npm test` | Unit + integration tests (in-memory MongoDB replica set) |
| `npm run test:coverage` | Coverage report; `services/` currently ~90% statements |
| `npm run seed` | Idempotent seed. `npm run seed -- --reset` wipes first; production also needs `--confirm` |

The API fails fast if any of `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `GYM_NAME`, `CURRENCY`, `TIMEZONE`,
`REMINDER_WINDOWS`, `INACTIVITY_DAYS` is missing. `SEED_OWNER_EMAIL` and `SEED_OWNER_PASSWORD` are required only
by the seed script; no credentials are hard-coded.

### Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `5000` | |
| `MONGODB_URI` | required | Use a replica set URI for transactional attendance |
| `JWT_SECRET` | required | Long random string |
| `JWT_EXPIRES_IN` | `12h` | JWT and cookie lifetime |
| `CORS_ORIGIN` | required | Comma-separated browser origins |
| `GYM_NAME` | required | Seed/default for settings |
| `CURRENCY` | required | `USD` |
| `TIMEZONE` | required | IANA zone (`UTC`) |
| `REMINDER_WINDOWS` | required | `7,3,1` |
| `INACTIVITY_DAYS` | required | `14` |
| `DATE_COUNTING_RULE` | `start_day_is_day_zero` | See assumptions |
| `COOKIE_SECURE` | `true` in production | Set `false` only for plain-HTTP dev |

---

## 2. Project tree

```
backend/
├─ docker-compose.yml
├─ vitest.config.js
├─ scripts/
│  └─ backup.sh                 # timestamped mongodump + retention
├─ tests/
│  ├─ helpers/
│  │  ├─ app.js                 # app boot, login agent, factories
│  │  └─ setup.js               # mongodb-memory-server replica set
│  ├─ unit/                     # money, dates, status functions
│  └─ integration/              # auth, customers, memberships, payments,
│                               # attendance, packages, reports, reminders
└─ src/
   ├─ server.js                 # connect DB, start HTTP, graceful shutdown
   ├─ app.js                    # express app, middleware, routes
   ├─ config/
   │  ├─ env.js                 # validated configuration
   │  └─ db.js                  # mongoose connection with retry
   ├─ models/                   # Owner, Customer, Package, PackageVersion,
   │                            # Membership, Payment, PaymentAdjustment,
   │                            # Attendance, TrainingSession, Expense,
   │                            # ExpenseAdjustment, Settings, AuditLog,
   │                            # ReminderReview, Counter
   ├─ controllers/              # request/response only
   ├─ services/                 # all business logic
   ├─ validators/               # strict zod schemas per resource
   ├─ middleware/               # auth, validate, errors, 404, rate limit,
   │                            # request id/timeout, operator-injection guard
   ├─ routes/                   # thin routers, one per resource
   ├─ utils/                    # money, dates, errors, pagination, csv,
   │                            # logger, transactions, async handler
   └─ seed/seed.js
```

---

## 3. Endpoints

Base path `/api/v1`. Success: `{ "data": ..., "meta"?: ... }`. Failure:
`{ "error": { "code", "message", "details"? } }`.

All routes except `POST /auth/login` and `/health*` require the owner cookie.

### Auth
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Owner sign-in; sets httpOnly, Secure (production), SameSite=Strict cookie |
| POST | `/auth/logout` | Clears the cookie |
| GET | `/auth/me` | Current owner |

### Health
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Status, uptime, database state |
| GET | `/health/ready` | Pings MongoDB; 200/503 |

### Dashboard
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard/summary?period=month\|7d\|30d\|quarter` | KPIs: customers, membership states, cash received, outstanding |
| GET | `/dashboard/reminders` | Computed reminders plus reviewed flags |
| POST | `/dashboard/reminders/:key/review` | Record that the owner reviewed a reminder |
| GET | `/dashboard/sessions-today` | Today's sessions with booked counts |

### Customers
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/customers` | Search (`search`), filter (`status`), sort, pagination |
| POST | `/customers` | Create with generated `CUS-####` |
| GET | `/customers/:id` | Detail with memberships, balances, private notes |
| PATCH | `/customers/:id` | Update name, phone, email, notes |
| POST | `/customers/:id/archive` | Archive |
| POST | `/customers/:id/restore` | Restore |
| GET | `/customers/:id/ledger` | Charges, payments, adjustments, running balance |
| GET | `/customers/:id/attendance?days=30` | Visit history and counts |
| POST | `/customers/:id/memberships` | Create a membership |

`:id` accepts an ObjectId or the human id (`CUS-1042`, `MEM-3312`, `S-1`, `PAY-9041`).

### Memberships
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/memberships/:id/renew` | New membership linked by `renewedFromId` |
| GET | `/memberships/:id` | Membership, balance, payments |
| POST | `/memberships/:id/cancel` | Cancel with optional reason |

### Payments (append-only)
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/payments` | Record a payment; rejects overpayment with 422 |
| GET | `/payments` | Filter by customer, membership, method, date range |
| GET | `/payments/:id` | Payment plus adjustments |
| POST | `/payments/:id/adjustments` | Append a signed correction/refund |

There is intentionally no `PATCH` or `DELETE` on payments.

### Packages
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/packages` | Filter by status, type, search |
| POST | `/packages` | Create (version 1) |
| GET | `/packages/:id` | Package plus version history and affected member count |
| PATCH | `/packages/:id` | New version; `confirm: true` for type/session changes with live members |
| POST | `/packages/:id/activate` | Activate |
| POST | `/packages/:id/deactivate` | Deactivate; returns affected count; `confirm` when members exist |
| DELETE | `/packages/:id` | 409 when any membership references it |

### Sessions and attendance
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/sessions?from&to` | Sessions in a date range |
| POST | `/sessions` | Create |
| PATCH | `/sessions/:id` | Update |
| POST | `/sessions/:id/cancel` | Cancel |
| GET | `/sessions/:id/attendance` | Roster and saved marks |
| PUT | `/sessions/:id/attendance` | Bulk upsert; returns `deducted` and `restored` counts |

### Expenses
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/expenses` | Filter by category, date range |
| POST | `/expenses` | Record |
| POST | `/expenses/:id/adjustments` | Append a signed correction |

### Reports
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/reports/summary?from&to` | Cash received, membership value, outstanding, new customers, attendance |
| GET | `/reports/payments-by-week?weeks=8` | Weekly cash series |
| GET | `/reports/attendance-heatmap?weeks=4` | 7 × N grid of present/late visits |
| GET | `/reports/outstanding` | Open balances today with membership detail |
| GET | `/reports/export.csv?type=summary\|payments\|outstanding\|attendance` | CSV download |

### Settings and audit
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/settings` | Gym name, currency, timezone, windows, inactivity, date rule |
| PATCH | `/settings` | Owner update; audit logged |
| GET | `/audit` | Read-only audit log, filter by entity, action, date |

Pagination: `?page=1&limit=20`, max 100, `meta: { page, limit, total, totalPages }`.
Sorting: `?sort=-createdAt`; only whitelisted fields are accepted.

---

## 4. Business rules and where they live

| Rule | Implementation |
| --- | --- |
| Membership status and payment status are computed separately | `services/statusService.js` — `membershipStatus()` and `paymentStatus()`; serializers expose both |
| Balance = agreed total − recorded payments − signed adjustments | `services/balanceService.js` — single aggregation per customer/membership; never stored |
| Payments are never edited or deleted; corrections are appended and reference the original | `models/Payment.js` (no update routes), `routes/paymentRoutes.js`, `services/paymentService.js#addPaymentAdjustment`, `models/PaymentAdjustment.js` |
| Reminders are dashboard-only; the system never messages customers | `services/reminderService.js`; no mail/SMS dependency exists in `package.json` |
| Packages used by memberships cannot be deleted, only deactivated | `services/packageService.js#deletePackage` / `#setPackageActive` |
| Package changes apply to new memberships only; memberships keep a snapshot | `models/Membership.js` (`packageSnapshot`), `services/membershipService.js#buildFromPackage`, `models/PackageVersion.js` |
| Session deduction happens once per Present/Late attendance | `services/attendanceService.js` — `deducted` flag guard, `$inc` with `sessionsRemaining > 0`, transaction |
| Overlapping time-based memberships require confirmation | `services/membershipService.js#guardOverlap` → 409 with `confirmRequired` |
| Expiry windows come from settings | `services/settingsService.js`, `services/reminderService.js` |
| Reviewing a reminder changes nothing but the review record | `models/ReminderReview.js`, `services/reminderService.js#reviewReminder` |
| Overpayment is rejected | `services/paymentService.js#recordPayment` → 422 |
| Audit trail on every mutation | `services/auditService.js`, called by each service |
| Private notes only on customer detail | `services/customerService.js` (list omits `notes`), `services/serialize.js` |
| Status changes are derived, not stored as editable fields | `state` stores the last known lifecycle state; `status` is computed on read |

---

## 5. SRS conflicts and assumptions

The SRS file (`Boxing_Gym_Management_System_SRS.docx`) was not present in the environment, so this build follows
the written requirements plus the frontend prototype. The following assumptions were necessary:

1. **Date-counting default is `start_day_is_day_zero`.** The frontend label says "start date counts as day one",
   but its sample memberships run start → start + 30 days. To keep seeded data identical to the UI, day zero is the
   default. Switching `dateCountingRule` to `start_day_is_day_one` shortens new memberships by one day.
2. **Nine sample customers, not eight.** The frontend data contains `CUS-1042`…`CUS-1050` (one archived). All are
   seeded so the UI and API match.
3. **Frontend plans differ from the package catalogue.** The prototype's memberships use plan terms (Fight Camp
   $180/30 days) that are not the catalogue packages (Monthly Training $120/1 month). Memberships are seeded with
   the plan terms in `packageSnapshot` and reference the mapped catalogue package, which is exactly how versioned
   snapshots are meant to work.
4. **Refunds reduce cash received.** The requirements phrase cash as "payments minus negative adjustments"; the
   implementation uses the signed sum, so a −20 refund lowers cash by 20 (and raises the balance owed by 20).
5. **Expense corrections needed a model.** The API lists `POST /expenses/:id/adjustments` but the data model does
   not; `ExpenseAdjustment` mirrors `PaymentAdjustment`.
6. **Session packs have no expiry.** The model says expiry is for time-based memberships only, so session packs stay
   valid until exhausted even though the frontend shows an end date on them.
7. **Human codes were added** (`Package.code`, `Membership.code`, `Payment.code`, `TrainingSession.code`) because
   the frontend keys on `PKG-*`, `MEM-*`, `PAY-*`, `S-*`.
8. **Cookie `Secure` is production-only** so the login cookie is not dropped on plain-HTTP localhost. Set
   `COOKIE_SECURE=true` to force it.
9. **Logout is stateless.** The JWT is cleared from the cookie; there is no server-side revocation list in this
   single-owner release.
10. **Payments may be unallocated.** A payment without `membershipId` is allowed; membership-level balances then
    reflect only allocated payments, while the customer-level balance includes every payment.
11. **Attendance requires a replica set.** On a standalone MongoDB the service logs a warning and runs without a
    transaction. `docker-compose.yml` configures a single-node replica set.
12. **`expiring_soon` is a derived status**, not a stored `state`; the stored `state` values remain the SRS list.

---

## 6. Frontend data the backend now owns

| Frontend prototype | Backend equivalent |
| --- | --- |
| `GYM` object held in memory | `Settings` singleton (`GET/PATCH /settings`, audit logged) |
| `isReviewed` map held in memory | `ReminderReview` collection via `POST /dashboard/reminders/:key/review` |
| `SEED_CUSTOMERS` / `SEED_PAYMENTS` / `SEED_ATTENDANCE` | `npm run seed`, using the same ids and offsets |
| `ROSTERS` / `SEED_MARKS` | `TrainingSession` + `Attendance` records |
| `memStatus`, `payStatus`, `memBalance` calculations | Computed server-side and returned with every membership |
| `packageDays`, plan labels | Raw `validityValue`/`validityUnit`; the client formats labels |
| `TZ_LABEL` ("GMT+3") | IANA `timezone` in settings; the client formats the offset |
| Sparkline placeholder arrays | Not provided (they were mock trend data); use `reports/payments-by-week` for real history |
| `booked` counts | Derived count of attendance records per session |
| Client-side CSV export | `GET /reports/export.csv` with formula-injection protection |

---

## 7. Backup and operations

```bash
# Nightly at 02:00
0 2 * * * cd /srv/bgms/backend && ./scripts/backup.sh >> /var/log/bgms-backup.log 2>&1
```

`scripts/backup.sh` writes a gzip `mongodump` into `backups/bgms-<timestamp>/`, records a manifest, and deletes
folders older than `RETENTION_DAYS` (default 14). Restore with:

```bash
mongorestore --uri="$MONGODB_URI" --gzip --drop backups/bgms-2026-10-29T02-00-00Z
```

Local MongoDB: `docker compose up -d` starts Mongo 7 with a persistent `mongo-data` volume and initialises replica
set `rs0`. Use `MONGODB_URI=mongodb://127.0.0.1:27017/gymflow?replicaSet=rs0`.

Logs are structured JSON (pino). Phone numbers and credentials are never logged; `maskPhone` is available for
debug output. Every response carries `X-Request-Id`, and the same id appears in the HTTP log line.
