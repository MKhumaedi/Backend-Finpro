import { Request, Response } from 'express';
import { propertyRepository } from '../repositories/PropertyRepository';
import { propertyService } from '../services/PropertyService';
import { PropertySearchSchema, CalendarBulkUpdateSchema } from '../validations/PropertyValidation';

export class PropertyController {
  async listProperties(req: Request, res: Response): Promise<void> {
    try {
      const validated = PropertySearchSchema.parse({
        ...req.query,
        amenities: req.query.amenities ? (req.query.amenities as string).split(',') : undefined
      });
      const results = await propertyRepository.search(validated);
      res.json(results);
    } catch (err: any) {
      res.status(400).json({ error: err.message || err });
    }
  }

  async getProperty(req: Request, res: Response): Promise<void> {
    try {
      const property = await propertyRepository.findById(req.params.id);
      if (!property) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }
      const rooms = await propertyRepository.findRoomsByPropertyId(property.id);
      res.json({ property, rooms });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getQuotes(req: Request, res: Response): Promise<void> {
    const { propertyId, roomId, start, end } = req.query;
    try {
      const quote = await propertyService.calculateTotalQuote(
        propertyId as string,
        roomId as string,
        start as string,
        end as string
      );
      res.json(quote);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  async bulkUpdateCalendar(req: Request, res: Response): Promise<void> {
    try {
      const validated = CalendarBulkUpdateSchema.parse(req.body);
      await propertyRepository.bulkUpdateAvailability(
        validated.roomId,
        validated.dates,
        validated.isBlocked,
        validated.priceOverride
      );
      res.json({ success: true, message: 'Calendar updated successfully' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || err });
    }
  }
}

export const propertyController = new PropertyController();
