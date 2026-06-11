import { propertyRepository } from '../repositories/PropertyRepository';

export class PropertyService {
  async calculatePrice(roomId: string, propertyId: string, dateString: string): Promise<number> {
    const room = (await propertyRepository.findRoomsByPropertyId(propertyId)).find(r => r.id === roomId);
    if (!room) return 0;
    let finalPrice = room.basePrice;
    const overrides = await propertyRepository.getAvailabilities(roomId);
    const dateOverride = overrides.find(o => o.date === dateString);
    if (dateOverride?.priceOverride) {
      return dateOverride.priceOverride;
    }
    const peaks = await propertyRepository.getPeakRates(propertyId);
    const applicablePeak = this.findPeakForDate(peaks, dateString);
    if (applicablePeak) {
      finalPrice = Math.round(finalPrice * Number(applicablePeak.rateMultiplier));
    }
    return finalPrice;
  }

  private findPeakForDate(peaks: any[], date: string) {
    return peaks.find(p => date >= p.startDate && date <= p.endDate);
  }

  async calculateTotalQuote(propertyId: string, roomId: string, start: string, end: string) {
    const room = (await propertyRepository.findRoomsByPropertyId(propertyId)).find(r => r.id === roomId);
    const base = room ? room.basePrice : 300;
    const nights = Math.max(1, this.diffDays(start, end));
    const sub = base * nights;
    const clean = 85;
    const svc = Math.round(sub * 0.12);
    const tax = 120;
    return {
      nightlyRate: base, subtotal: sub, cleaningFee: clean, serviceFee: svc, taxes: tax,
      total: sub + clean + svc + tax
    };
  }

  private diffDays(start: string, end: string): number {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }
}

export const propertyService = new PropertyService();
