import { Router } from 'express';
import { authController } from '../controllers/AuthController';

const router = Router();

router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.post('/verify', (req, res) => authController.verify(req, res));
router.post('/reset-password/request', (req, res) => authController.requestReset(req, res));
router.post('/reset-password/complete', (req, res) => authController.completeReset(req, res));

export default router;
