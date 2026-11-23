import { Router, type Request, type Response } from 'express';
import { loginSchema, registerSchema } from '@fluentpath/shared';
import { config } from '../config.ts';
import { createGuestUser, getUserById, loginUser, registerUser, toPublicUser } from '../services/authService.ts';

export const authRouter = Router();

function setAuthCookie(res: Response, token: string) {
  res.cookie('fp_auth', token, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: 14 * 24 * 3600 * 1000,
  });
}

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const { user, token } = await registerUser(data.email, data.password, data.name);
    setAuthCookie(res, token);
    return res.json({ user, token });
  } catch (err: any) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const { user, token } = await loginUser(data.email, data.password);
    setAuthCookie(res, token);
    return res.json({ user, token });
  } catch (err: any) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: err.message } });
  }
});

authRouter.post('/guest', async (_req: Request, res: Response) => {
  try {
    const { user, token } = await createGuestUser();
    setAuthCookie(res, token);
    return res.json({ user, token });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('fp_auth', {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
  });
  return res.json({ success: true });
});

authRouter.get('/me', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  const user = await getUserById(req.user.uid);
  if (!user) {
    return res.json({ user: null });
  }
  return res.json({ user: toPublicUser(user) });
});
