import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { ApiError } from '../utils/ApiError.js';

export const authRouter = Router();

// POST /api/v1/auth/register (First-time setup only)
authRouter.post('/register', async (req, res, next) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount > 0) {
      throw new ApiError(403, 'Admin already exists. Use the dashboard to create more users.');
    }

    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      throw new ApiError(400, 'Name, email, and password are required');
    }

    const user = new User({
      email: email.toLowerCase().trim(),
      password,
      name: name.trim(),
      role: 'admin',
      allowedSections: ['*'],
      status: 'active'
    });

    await user.save();
    res.json({ success: true, message: 'Admin user created successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new ApiError(400, 'Email and password are required');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      throw new ApiError(401, 'auth/user-not-found');
    }

    if (user.status === 'disabled') {
      throw new ApiError(401, 'auth/user-disabled');
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw new ApiError(401, 'auth/wrong-password');
    }

    const secret = process.env.JWT_SECRET || 'fallback-secret-for-dev';
    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role, tenantId: user.tenantId },
      secret,
      { expiresIn: '7d' }
    );

    // Set HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      token,
      user: {
        uid: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        isMainAdmin: user.role === 'admin',
        imageUrl: user.imageUrl,
        allowedSections: user.allowedSections || ['dashboard'],
        status: user.status,
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
authRouter.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// GET /api/v1/auth/me
authRouter.get('/me', requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json({
    user: {
      uid: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      isMainAdmin: user.role === 'admin',
      imageUrl: user.imageUrl,
      allowedSections: user.allowedSections || ['dashboard'],
      status: user.status,
    }
  });
});
