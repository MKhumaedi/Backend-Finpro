import { Request, Response } from 'express';
import { authService } from '../services/AuthService';
import { 
  RegisterSchema, 
  LoginSchema, 
  VerifySchema, 
  ResetPasswordRequestSchema, 
  ResetPasswordSubmitSchema 
} from '../validations/AuthValidation';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const parsed = RegisterSchema.parse(req.body);
      const result = await authService.register(parsed.name, parsed.email, parsed.role as any);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || err });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const parsed = LoginSchema.parse(req.body);
      const result = await authService.login(parsed.email);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message || err });
    }
  }

  async verify(req: Request, res: Response): Promise<void> {
    try {
      const parsed = VerifySchema.parse(req.body);
      const user = await authService.verifyEmailToken(parsed.token);
      res.status(200).json({ success: true, user });
    } catch (err: any) {
      res.status(400).json({ error: err.message || err });
    }
  }

  async requestReset(req: Request, res: Response): Promise<void> {
    try {
      const parsed = ResetPasswordRequestSchema.parse(req.body);
      const result = await authService.requestPasswordReset(parsed.email);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || err });
    }
  }

  async completeReset(req: Request, res: Response): Promise<void> {
    try {
      const parsed = ResetPasswordSubmitSchema.parse(req.body);
      const result = await authService.completePasswordReset(parsed.token);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || err });
    }
  }
}

export const authController = new AuthController();
