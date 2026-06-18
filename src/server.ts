import express from 'express';
import path from 'path';
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

  

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
export {};
