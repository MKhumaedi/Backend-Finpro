import { prisma } from '../../../database/prisma';
import { BookingStatus } from '@prisma/client';

export class BookingRepository {
  async findById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: { property: true, room: true, paymentProof: true }
    });
  }

  async findByCode(code: string) {
    return prisma.booking.findUnique({
      where: { bookingCode: code.toUpperCase() },
      include: { property: true, room: true, paymentProof: true }
    });
  }

  async findByGuestId(guestId: string) {
    return prisma.booking.findMany({
      where: { guestId },
      include: { property: true, room: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(booking: {
    guestId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    propertyId: string;
    roomId: string;
    startDate: string;
    endDate: string;
    nights: number;
    totalAmount: number;
    status: BookingStatus;
  }) {
    const codeNum = Math.floor(1000 + Math.random() * 9000);
    return prisma.booking.create({
      data: {
        bookingCode: `SE-${codeNum}`,
        ...booking
      }
    });
  }

  async updateStatus(id: string, status: BookingStatus) {
    return prisma.booking.update({
      where: { id },
      data: { status }
    });
  }

  async saveProof(id: string, proofUrl: string) {
    return prisma.paymentProof.upsert({
      where: { bookingId: id },
      update: { proofUrl },
      create: { bookingId: id, proofUrl }
    });
  }

  async expireOldPendingBookings(maxAgeMinutes = 30): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const result = await prisma.booking.updateMany({
      where: {
        status: BookingStatus.WAITING_PAYMENT,
        createdAt: { lt: cutoff }
      },
      data: { status: BookingStatus.CANCELLED }
    });
    return result.count;
  }

  private buildWhere(filters: any) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { guestName: { contains: filters.search, mode: 'insensitive' } },
        { bookingCode: { contains: filters.search, mode: 'insensitive' } }
      ];
    }
    return where;
  }

  async search(filters: { status?: BookingStatus; search?: string; page?: number; limit?: number; }) {
    const { page = 1, limit = 10 } = filters;
    const where = this.buildWhere(filters);
    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: { property: true, room: true, paymentProof: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.booking.count({ where })
    ]);
    return { data, total };
  }
}

export const bookingRepository = new BookingRepository();
