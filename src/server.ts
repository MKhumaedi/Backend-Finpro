import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import authRouter from './features/auth/routes/AuthRoutes';
import { propertyController } from './features/properties/controllers/PropertyController';
import { bookingController } from './features/bookings/controllers/BookingController';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API - Auth routes
  app.use('/api/auth', authRouter);

  // API - Property routes
  app.get('/api/properties', (req, res) => propertyController.listProperties(req, res));
  app.get('/api/properties/:id', (req, res) => propertyController.getProperty(req, res));
  app.get('/api/quotes', (req, res) => propertyController.getQuotes(req, res));
  app.post('/api/properties/calendar/bulk-update', (req, res) => propertyController.bulkUpdateCalendar(req, res));

  // API - Booking routes
  app.post('/api/bookings', (req, res) => bookingController.createBooking(req, res));
  app.post('/api/bookings/:id/payment', (req, res) => bookingController.uploadPaymentProof(req, res));
  app.get('/api/bookings', (req, res) => bookingController.listBookings(req, res));
  app.get('/api/reports', (req, res) => bookingController.getReports(req, res));

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), 'frontend/vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
export {};
