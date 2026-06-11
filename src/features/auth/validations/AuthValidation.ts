import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters long' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  role: z.enum(['USER', 'TENANT', 'HOST', 'ADMIN']).optional().default('TENANT')
});

export const LoginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' })
});

export const VerifySchema = z.object({
  token: z.string().min(1, { message: 'Token is required' })
});

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' })
});

export const ResetPasswordSubmitSchema = z.object({
  token: z.string().min(1, { message: 'Token is required' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters long' })
});
