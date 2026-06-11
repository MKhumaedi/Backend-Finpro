import { prisma } from '../../../database/prisma';

export class AuthTokenRepository {
  async createVerificationToken(userId: string, token: string, expiresAt: Date) {
    return prisma.emailVerification.create({
      data: { userId, token, expiresAt }
    });
  }

  async findVerificationToken(token: string) {
    return prisma.emailVerification.findUnique({
      where: { token }
    });
  }

  async removeVerificationToken(token: string) {
    return prisma.emailVerification.deleteMany({
      where: { token }
    });
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date) {
    return prisma.passwordReset.create({
      data: { userId, token, expiresAt }
    });
  }

  async findPasswordResetToken(token: string) {
    return prisma.passwordReset.findUnique({
      where: { token }
    });
  }

  async removePasswordResetToken(token: string) {
    return prisma.passwordReset.deleteMany({
      where: { token }
    });
  }
}

export const authTokenRepository = new AuthTokenRepository();
