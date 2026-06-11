import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { userRepository } from '../repositories/UserRepository';
import { authTokenRepository } from '../repositories/AuthTokenRepository';

const JWT_SECRET = process.env.JWT_SECRET || 'stayease-secret-key-9021';

export class AuthService {
  async register(name: string, email: string, role: Role) {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new Error('Email already registered');
    const user = await userRepository.create({
      email, name, role, isVerified: false,
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`
    });
    const token = `verify_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await authTokenRepository.createVerificationToken(user.id, token, expiresAt);
    return { user, verificationToken: token };
  }

  async login(email: string): Promise<{ user: any; token: string }> {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new Error('Invalid credentials');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    return { user, token };
  }

  async verifyEmailToken(token: string) {
    const record = await authTokenRepository.findVerificationToken(token);
    if (!record) throw new Error('Invalid or expired verification token');
    if (new Date() > record.expiresAt) throw new Error('Token has expired');
    const user = await userRepository.update(record.userId, { isVerified: true });
    await authTokenRepository.removeVerificationToken(token);
    return user;
  }

  async requestPasswordReset(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new Error('Email address not registered');
    const token = `reset_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await authTokenRepository.createPasswordResetToken(user.id, token, expiresAt);
    return { email, resetToken: token };
  }

  async completePasswordReset(token: string) {
    const record = await authTokenRepository.findPasswordResetToken(token);
    if (!record) throw new Error('Invalid or expired reset token');
    if (new Date() > record.expiresAt) throw new Error('Reset token has expired');
    await authTokenRepository.removePasswordResetToken(token);
    return { success: true, userId: record.userId };
  }
}

export const authService = new AuthService();
