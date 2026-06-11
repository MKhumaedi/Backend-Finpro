import { prisma } from '../../../database/prisma';

export class PropertyRepository {
  async findById(id: string) {
    return prisma.property.findUnique({
      where: { id },
      include: { category: true }
    });
  }

  async findRoomsByPropertyId(propertyId: string) {
    return prisma.room.findMany({
      where: { propertyId }
    });
  }

  async getAvailabilities(roomId: string) {
    return prisma.roomAvailability.findMany({
      where: { roomId }
    });
  }

  async getPeakRates(propertyId: string) {
    return prisma.peakSeasonRate.findMany({
      where: { propertyId }
    });
  }

  async createProperty(data: any) {
    return prisma.property.create({ data });
  }

  async updateProperty(id: string, data: any) {
    return prisma.property.update({ where: { id }, data });
  }

  async bulkUpdateAvailability(
    roomId: string,
    dates: string[],
    isBlocked: boolean,
    priceOverride?: number
  ): Promise<void> {
    await Promise.all(dates.map(date => 
      prisma.roomAvailability.upsert({
        where: { roomId_date: { roomId, date } },
        update: { isBlocked, priceOverride: priceOverride || null },
        create: { roomId, date, isBlocked, priceOverride: priceOverride || null }
      })
    ));
  }

  private buildQueryWhere(f: any) {
    const where: any = {};
    if (f.category) where.categoryId = f.category;
    if (f.search) {
      where.OR = [
        { name: { contains: f.search, mode: 'insensitive' } },
        { city: { contains: f.search, mode: 'insensitive' } }
      ];
    }
    const bp: any = {};
    if (f.minPrice) bp.gte = f.minPrice;
    if (f.maxPrice) bp.lte = f.maxPrice;
    if (f.minPrice || f.maxPrice) where.basePrice = bp;
    if (f.amenities?.length) where.amenities = { hasEvery: f.amenities };
    return where;
  }

  private buildOrderBy(sort?: string) {
    if (sort === 'price_asc') return { basePrice: 'asc' as const };
    if (sort === 'price_desc') return { basePrice: 'desc' as const };
    if (sort === 'rating_desc') return { rating: 'desc' as const };
    return { createdAt: 'desc' as const };
  }

  async search(filters: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    amenities?: string[];
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const where = this.buildQueryWhere(filters);
    const [data, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.buildOrderBy(filters.sort),
        include: { category: true }
      }),
      prisma.property.count({ where })
    ]);
    return { data, total };
  }

  async save(prop: any) {
    return prisma.property.upsert({
      where: { id: prop.id },
      update: prop,
      create: prop
    });
  }
}

export const propertyRepository = new PropertyRepository();
