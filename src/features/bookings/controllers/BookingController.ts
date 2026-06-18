import { Response } from 'express';
import { bookingService } from '../services/BookingService';
import { bookingRepository } from '../repositories/BookingRepository';
import { CreateBookingSchema, UploadPaymentProofSchema, BookingSearchSchema } from '../validations/BookingValidation';
import { AuthenticatedRequest } from '../../../middlewares/AuthMiddleware';

export class BookingController {
  async createBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validated = CreateBookingSchema.parse(req.body);
      if (req.userId !== validated.guestId) {
        res.status(403).json({ error: 'Guests cannot create bookings for other users.' });
        return;
      }
      const booking = await bookingService.initiateBooking(validated);
      res.status(201).json(booking);
    } catch (err: any) {
      res.status(400).json({ error: err.message || err });
    }
  }

  async uploadPaymentProof(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validated = UploadPaymentProofSchema.parse(req.body);
      const booking = await bookingService.confirmBookingPayment(req.params.id, validated.proofUrl);
      res.json(booking);
    } catch (err: any) {
      res.status(400).json({ error: err.message || err });
    }
  }

  async listBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validated = BookingSearchSchema.parse(req.query);
      await bookingRepository.expireOldPendingBookings(30);
      const results = await bookingRepository.search({
        status: validated.status as any, search: validated.search,
        page: validated.page, limit: validated.limit,
        guestId: req.userRole === 'USER' ? req.userId : undefined,
        tenantId: req.userRole === 'TENANT' ? req.userId : undefined
      });
      res.json(results);
    } catch (err: any) {
      res.status(400).json({ error: err.message || err });
    }
  }

  async getReports(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const landlordId = req.userId;
      const stats = await bookingService.getReportStats(landlordId);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.userId;

      if (!userId) {
        res.status(401).json({ error: 'Session required' });
        return;
      }

      const booking = await bookingRepository.findById(id);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }

      const isGuest = booking.guestId === userId;
      const isHost = booking.property.tenantId === userId;

      if (!isGuest && !isHost) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const updated = await bookingRepository.updateStatus(id, status as any);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || err });
    }
  }
}

export const bookingController = new BookingController();
