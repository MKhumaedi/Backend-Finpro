# StayEase Final Production Database Blueprint

This blueprint incorporates the complete, final production-ready Prisma schema and seeding solution for StayEase, designed to scale with PostgreSQL hosted on Supabase.

---

## 🚀 1. Database Module & Client Configuration

Connection persistence represents the core of StayEase server queries. We initialize Prisma using a globally cached instance:

- **Location**: `/src/backend/database/prisma.ts`
- **Configuration**:
  - Automatically limits active connections to prevent pool exhaustion on serverless environments (Supabase / Cloud Run).
  - Configures contextual logging levels during local development to view query statistics, whilst remaining quiet in production to save bandwidth.

---

## 📈 2. Indexing Strategy

To support widgets, dynamic pricing, and real-time calendars on modern travelers and tenant portals, we have implemented custom relational and column indexes in `schema.prisma`:

### Primary Performance Lanes
1. **User Indexes** (`User`):
   - `@@index([email])`: Supports fast authentication and sign-in pipelines on the Auth router.
   - `@@index([role])`: Optimizes authorization checks for administrative or tenant dashboard widgets.
2. **Property Queries** (`Property`):
   - `@@index([city])` & `@@index([location])`: Drives instant geographic searching on the homepage.
   - `@@index([basePrice])` & `@@index([rating])`: Powers fast sorting by rate ranges and five-star rating thresholds.
3. **Calendar Search Paths** (`RoomAvailability` & `PeakSeasonRate`):
   - `@@unique([roomId, date])`: Protects double-booking at the database layer with sub-millisecond calendar lookup.
   - `@@index([startDate, endDate])`: Accelerates checking seasonal rate multipliers during dynamic price calculations.
4. **Transaction History** (`Booking`):
   - `@@index([bookingCode])`: Optimizes direct confirmation looks by booking code identifier.
   - `@@index([status])`: Speeds up state filtering (e.g. `WAITING_CONFIRMATION` or `CONFIRMED`) on dashboard calendars.

---

## 🛠️ 3. Migration Strategy

To run safe schemas against Supabase, follow this step-by-step production flow:

### A. Local Development Iteration
When fine-tuning schemas locally, use `dev` mode to automatically compute SQL differentials:
```bash
npx prisma migrate dev --name initStayEaseSchema
```
*Note: This generates SQL files under `prisma/migrations` and builds strongly-typed Prisma client definitions internally.*

### B. Production Deployment (Supabase)
For live servers or staging containers, **do not** run the dev reset command. Use the safe, non-destructive migration apply tool:
```bash
npx prisma migrate deploy
```
*Tip: Ensure your Supabase Database Connection string is defined correctly in `DATABASE_URL`.*

### C. Seeding High-Fidelity Data
To seed exactly 10 Users, 5 Tenants, 8 Categories, 30 Properties, 90 Rooms, season multi-overrides, and matching reviews/payment tokens:
```bash
npx prisma db seed
```

---

## 💎 4. Relational Constraints & Cascade Deletion Rules

- **Deterministic Chains**: Dependencies like child records (`EmailVerification`, `PasswordReset`, `TenantProfile`) use `onDelete: Cascade` aligned with `User` deletions.
- **Booking Safeguards**: Changing property metadata or categories enforces `onDelete: Restrict` so historic financial logs and bookings are preserved and never orphaned.
- **Room Multi-Availability**: Rooms utilize `onDelete: Cascade` on day-rates to completely clean up schedule indexes when a building is retired or removed.
