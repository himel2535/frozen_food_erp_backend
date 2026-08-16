import { Router } from 'express';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { scheduleReplacedCloudinaryDeletes } from '../utils/cloudinary.js';
import mongoose from 'mongoose';

export const adminRouter = Router();

// Middleware to ensure the caller is a main admin
adminRouter.use(requireAuth);
adminRouter.use((req: any, _res, next) => {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Forbidden: Admin access required'));
  }
  next();
});

// GET /api/v1/admin/users
adminRouter.get('/users', async (_req, res, next) => {
  try {
    const users = await User.find().lean();
    
    const formatted = users.map(u => ({
      uid: (u as any)._id.toString(),
      name: u.name,
      email: u.email,
      imageUrl: u.imageUrl,
      imagePublicId: (u as { imagePublicId?: string }).imagePublicId,
      role: u.role,
      isMainAdmin: u.role === 'admin',
      status: u.status,
      allowedSections: u.allowedSections || [],
      allowedPermissions: (u as { allowedPermissions?: string[] }).allowedPermissions || [],
      createdAt: (u as any).createdAt,
    }));
    
    res.json({ data: formatted });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/admin/users
adminRouter.post('/users', async (req, res, next) => {
  try {
    const { name, email, password, imageUrl, imagePublicId, allowedSections, allowedPermissions, isMainAdmin } = req.body;
    
    if (!name || !email || !password) {
      throw new ApiError(400, 'Name, email, and password are required');
    }
    
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      throw new ApiError(400, 'A user with this email already exists');
    }
    
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      imageUrl: imageUrl || undefined,
      imagePublicId: imagePublicId || undefined,
      role: isMainAdmin ? 'admin' : 'user',
      allowedSections: isMainAdmin ? ['*'] : allowedSections || [],
      allowedPermissions: isMainAdmin ? [] : (Array.isArray(allowedPermissions) ? allowedPermissions : []),
      status: 'active'
    });
    
    await user.save();
    
    res.status(201).json({
      data: {
        uid: user._id.toString(),
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
        imagePublicId: (user as { imagePublicId?: string }).imagePublicId,
        role: user.role,
        isMainAdmin: user.role === 'admin',
        status: user.status,
        allowedSections: user.allowedSections,
        allowedPermissions: (user as { allowedPermissions?: string[] }).allowedPermissions || [],
        createdAt: (user as any).createdAt,
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/admin/users/:id
adminRouter.put('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, 'Invalid user ID');
    }
    
    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    const adminUid = (req as any).user._id.toString();
    const previous = {
      imageUrl: user.imageUrl,
      imagePublicId: (user as { imagePublicId?: string }).imagePublicId,
    };
    const { name, imageUrl, imagePublicId, allowedSections, allowedPermissions, status, password, isMainAdmin } = req.body;
    
    if (status === 'disabled' && id === adminUid) {
      throw new ApiError(400, 'You cannot disable your own account');
    }
    
    if (name !== undefined) user.name = name.trim();
    if (imageUrl !== undefined) user.imageUrl = imageUrl.trim();
    if (imagePublicId !== undefined) {
      (user as { imagePublicId?: string }).imagePublicId = String(imagePublicId).trim();
    }
    
    if (status === 'active' || status === 'disabled') {
      user.status = status;
    }
    
    if (typeof isMainAdmin === 'boolean') {
      user.role = isMainAdmin ? 'admin' : 'user';
      user.allowedSections = isMainAdmin ? ['*'] : allowedSections || user.allowedSections;
      (user as { allowedPermissions?: string[] }).allowedPermissions = isMainAdmin
        ? []
        : (Array.isArray(allowedPermissions) ? allowedPermissions : (user as { allowedPermissions?: string[] }).allowedPermissions || []);
    } else {
      if (allowedSections) {
        user.allowedSections = user.role === 'admin' ? ['*'] : allowedSections;
      }
      if (Array.isArray(allowedPermissions)) {
        (user as { allowedPermissions?: string[] }).allowedPermissions = user.role === 'admin' ? [] : allowedPermissions;
      }
    }
    
    if (password && password.trim().length > 0) {
      user.password = password; // Will be hashed by pre-save hook
    }
    
    await user.save();

    scheduleReplacedCloudinaryDeletes(previous, {
      imageUrl: user.imageUrl,
      imagePublicId: (user as { imagePublicId?: string }).imagePublicId,
    });
    
    res.json({
      data: {
        uid: user._id.toString(),
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
        imagePublicId: (user as { imagePublicId?: string }).imagePublicId,
        role: user.role,
        isMainAdmin: user.role === 'admin',
        status: user.status,
        allowedSections: user.allowedSections,
        allowedPermissions: (user as { allowedPermissions?: string[] }).allowedPermissions || [],
        createdAt: (user as any).createdAt,
      }
    });
  } catch (err) {
    next(err);
  }
});
