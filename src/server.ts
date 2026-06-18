import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import authRouter from './features/auth/routes/AuthRoutes';
import notificationRouter from './features/notifications/routes/NotificationRoutes';
import reviewRouter from './features/reviews/routes/ReviewRoutes';
import { propertyController } from './features/properties/controllers/PropertyController';
import { favoriteController } from './features/properties/controllers/FavoriteController';
import { bookingController } from './features/bookings/controllers/BookingController';
import { requireAuth } from './middlewares/AuthMiddleware';
import { prisma } from './database/prisma';
import { IdempotencyMiddleware, DuplicateSubmissionGuard, RequestGuard } from './protection';

async function setupDatabaseTriggers() {
  try {
    console.log('[DatabaseTriggers] Initializing StayEase email verification synchronization triggers on PostgreSQL...');

    // A. Create HostApplication table if not exists (dynamic database support)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public."HostApplication" (
          id text PRIMARY KEY,
          "userId" text UNIQUE NOT NULL,
          status text NOT NULL DEFAULT 'PENDING',
          "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
          "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
          CONSTRAINT "HostApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "HostApplication_userId_idx" ON public."HostApplication" ("userId");
      `);
      console.log('[DatabaseTriggers] Successfully verified or created "HostApplication" table.');
    } catch (e: any) {
      console.error('[DatabaseTriggers] Error ensuring "HostApplication" table exists:', e.message);
    }

    // B. Create Favorite table if not exists
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public."Favorite" (
          id text PRIMARY KEY,
          "userId" text NOT NULL,
          "propertyId" text NOT NULL,
          "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
          CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON DELETE CASCADE,
          CONSTRAINT "Favorite_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES public."Property"(id) ON DELETE CASCADE
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_userId_propertyId_key" ON public."Favorite" ("userId", "propertyId");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Favorite_userId_idx" ON public."Favorite" ("userId");
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Favorite_propertyId_idx" ON public."Favorite" ("propertyId");
      `);
      console.log('[DatabaseTriggers] Successfully verified or created "Favorite" table.');
    } catch (e: any) {
      console.error('[DatabaseTriggers] Error ensuring "Favorite" table exists:', e.message);
    }

    // 1. Create the helper function to synchronize verified status automatically
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.sync_auth_user_verified()
      RETURNS trigger AS $$
      BEGIN
        UPDATE public."User"
        SET "isVerified" = (NEW.email_confirmed_at IS NOT NULL)
        WHERE id::text = NEW.id::text;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    // 2. Set up trigger for update actions on auth.users
    try {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;');
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER on_auth_user_updated
        AFTER UPDATE OF email_confirmed_at ON auth.users
        FOR EACH ROW
        EXECUTE PROCEDURE public.sync_auth_user_verified();
      `);
      console.log('[DatabaseTriggers] Successfully registered UPDATE trigger on auth.users.');
    } catch (e: any) {
      console.warn('[DatabaseTriggers] Skipping auth schema triggers (Expected if running in local sandbox or restricted credential level):', e.message);
    }

    // 3. Set up trigger for insert actions on auth.users (to handle pre-confirmed users)
    try {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS on_auth_user_inserted ON auth.users;');
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER on_auth_user_inserted
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE PROCEDURE public.sync_auth_user_verified();
      `);
      console.log('[DatabaseTriggers] Successfully registered INSERT trigger on auth.users.');
    } catch (e: any) {
      console.warn('[DatabaseTriggers] Skipping insert trigger setup:', e.message);
    }

    // 4. Force a one-off synchronization at boot to reconcile any out-of-sync confirmed users
    try {
      const updatedRowsCount = await prisma.$executeRawUnsafe(`
        UPDATE public."User" u
        SET "isVerified" = true
        FROM auth.users au
        WHERE u.id::text = au.id::text
          AND au.email_confirmed_at IS NOT NULL
          AND u."isVerified" = false;
      `);
      console.log('[DatabaseTriggers] Reconciled existing user verifications. Total updated records:', updatedRowsCount);
    } catch (e: any) {
      console.warn('[DatabaseTriggers] Manual batch synchronization skipped:', e.message);
    }
  } catch (error: any) {
    console.error('[DatabaseTriggers] Unexpected error during trigger setup:', error);
  }
}

async function startServer() {
  const app = reportExpress();
  const expressInstance = express();
  const PORT = 3000;

  expressInstance.use(express.json());

  // CORS Middleware for independent frontend/backend local dev and production
  expressInstance.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:5173'
    ].filter(Boolean);

    if (allowedOrigins.includes(origin) || process.env.CORS_ORIGIN === '*') {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Set up SQL triggers and sync state prior to servicing traffic
  await setupDatabaseTriggers();

  // API - Auth routes
  expressInstance.use('/api/auth', authRouter);

  // API - Notification routes
  expressInstance.use('/api/notifications', notificationRouter);

  // API - Review routes
  expressInstance.use('/api/reviews', reviewRouter);

  // API - Property routes
  expressInstance.get('/api/properties/filter-options', async (req, res) => {
    try {
      const dbProperties = await prisma.property.findMany({
        where: { deletedAt: null, status: { in: ['ACTIVE', 'PUBLISHED'] } },
        select: {
          city: true,
          location: true,
          amenities: true,
        }
      });

      const categories = await prisma.propertyCategory.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' }
      });
      const uniqueCities = Array.from(new Set(
        dbProperties.map(p => {
          if (p.city && p.city.trim() !== '') {
            return p.city.trim();
          }
          if (p.location && p.location.trim() !== '') {
            const parts = p.location.split(',');
            return parts[0].trim();
          }
          return '';
        })
      ))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      // Extract unique amenities
      const uniqueAmenities = Array.from(new Set(
        dbProperties.flatMap(p => p.amenities || [])
      )).filter(Boolean);

      // Dynamically calculate min/max room basePrice
      const roomAggr = await prisma.room.aggregate({
        where: {
          deletedAt: null,
          property: {
            deletedAt: null,
            status: { in: ['ACTIVE', 'PUBLISHED'] }
          }
        },
        _min: { basePrice: true },
        _max: { basePrice: true }
      });

      const propAggr = await prisma.property.aggregate({
        where: { deletedAt: null, status: { in: ['ACTIVE', 'PUBLISHED'] } },
        _min: { basePrice: true },
        _max: { basePrice: true }
      });

      const minPrice = roomAggr._min.basePrice ?? propAggr._min.basePrice ?? 50000;
      const maxPrice = roomAggr._max.basePrice ?? propAggr._max.basePrice ?? 5000000;

      res.json({
        cities: uniqueCities,
        categories: categories,
        amenities: uniqueAmenities,
        minPrice,
        maxPrice
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  expressInstance.get('/api/properties', (req, res) => propertyController.listProperties(req, res));
  expressInstance.get('/api/properties/:id', (req, res) => propertyController.getProperty(req, res));
  expressInstance.get('/api/quotes', (req, res) => propertyController.getQuotes(req, res));
  expressInstance.post('/api/properties/calendar/bulk-update', (req, res) => propertyController.bulkUpdateCalendar(req, res));
  expressInstance.post('/api/properties', requireAuth as any, IdempotencyMiddleware as any, DuplicateSubmissionGuard as any, RequestGuard('property_create', (req) => req.body.name || '') as any, (req, res) => propertyController.createProperty(req, res));
  expressInstance.put('/api/properties/:id', requireAuth as any, IdempotencyMiddleware as any, DuplicateSubmissionGuard as any, RequestGuard('property_update', (req) => req.params.id) as any, (req, res) => propertyController.updateProperty(req, res));
  expressInstance.delete('/api/properties/:id', requireAuth as any, IdempotencyMiddleware as any, DuplicateSubmissionGuard as any, RequestGuard('property_delete', (req) => req.params.id) as any, (req, res) => propertyController.deleteProperty(req, res));

  // Favorites API
  expressInstance.get('/api/favorites', requireAuth as any, (req, res) => favoriteController.getFavorites(req, res));
  expressInstance.get('/api/favorites/count', requireAuth as any, (req, res) => favoriteController.getFavoritesCount(req, res));
  expressInstance.post('/api/favorites/toggle', requireAuth as any, (req, res) => favoriteController.toggleFavorite(req, res));

  expressInstance.get('/api/categories', async (req, res) => {
    try {
      const categories = await prisma.propertyCategory.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' }
      });
      res.json({ categories });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API - Booking routes
  expressInstance.post('/api/bookings', requireAuth as any, IdempotencyMiddleware as any, DuplicateSubmissionGuard as any, RequestGuard('booking_create', (req) => req.body.propertyId + '_' + req.body.startDate) as any, (req, res) => bookingController.createBooking(req, res));
  expressInstance.post('/api/bookings/:id/payment', requireAuth as any, IdempotencyMiddleware as any, DuplicateSubmissionGuard as any, RequestGuard('payment_upload', (req) => req.params.id) as any, (req, res) => bookingController.uploadPaymentProof(req, res));
  expressInstance.put('/api/bookings/:id/status', requireAuth as any, (req, res) => bookingController.updateStatus(req, res));
  expressInstance.get('/api/bookings', requireAuth as any, (req, res) => bookingController.listBookings(req, res));
  expressInstance.get('/api/reports', requireAuth as any, (req, res) => bookingController.getReports(req, res));

  // Vite Integration - Dev mode runs purely as standalone API service
  if (process.env.NODE_ENV !== 'production') {
    console.log('[ViteIntegration] Running solely as standalone API server in development mode.');
  } else {
    const possibleDistPaths = [
      path.join(process.cwd(), 'dist'),
      path.join(process.cwd(), '../dist'),
      path.resolve(__dirname, '../../dist'),
      path.resolve(__dirname, '../../../dist')
    ];

    let distPath = '';
    for (const p of possibleDistPaths) {
      if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
        distPath = p;
        break;
      }
    }

    if (distPath) {
      console.log(`[ViteIntegration] Serving production static files from: ${distPath}`);
      expressInstance.use(express.static(distPath));
      expressInstance.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('[ViteIntegration] dist/ build output folder not detected. Backend running as a pure standalone API service.');
    }
  }

  expressInstance.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

function reportExpress() {
  return express;
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
export {};