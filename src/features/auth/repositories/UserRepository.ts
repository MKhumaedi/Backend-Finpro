import { prisma } from '../../../database/prisma';
import { Role } from '@prisma/client';

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { tenantProfile: true }
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { tenantProfile: true }
    });
  }

  async create(user: { email: string; name: string; role?: Role; isVerified?: boolean; avatarUrl?: string }) {
    return prisma.user.create({
      data: {
        email: user.email.toLowerCase(),
        name: user.name,
        role: user.role || Role.USER,
        isVerified: user.isVerified || false,
        avatarUrl: user.avatarUrl
      }
    });
  }

  async update(id: string, updates: any) {
    return prisma.user.update({
      where: { id },
      data: updates
    });
  }

  private buildWhere(search?: string, role?: Role) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (role) where.role = role;
    return where;
  }

  async findAll(page = 1, limit = 10, search?: string, role?: Role) {
    const where = this.buildWhere(search, role);
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { tenantProfile: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);
    return { data, total };
  }
}

export const userRepository = new UserRepository();
