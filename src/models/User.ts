import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { timestampsConfig } from './shared.js';
import bcrypt from 'bcrypt';
import { invalidateAuthUserCache } from '../middleware/authUserCache.js';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
    imageUrl: String,
    imagePublicId: String,
    allowedSections: [String],
    allowedPermissions: [String],
  },
  timestampsConfig,
);

userSchema.pre('save', async function (this: any, next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};

function invalidateUserAuthCache(doc: { _id?: unknown } | null | undefined) {
  if (doc?._id) invalidateAuthUserCache(String(doc._id));
  else invalidateAuthUserCache();
}

userSchema.post('save', function (doc) {
  invalidateUserAuthCache(doc as { _id?: unknown });
});
userSchema.post('findOneAndUpdate', function (doc) {
  invalidateUserAuthCache(doc as { _id?: unknown } | null);
});
userSchema.post('findOneAndDelete', function (doc) {
  invalidateUserAuthCache(doc as { _id?: unknown } | null);
});

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
  comparePassword: (candidate: string) => Promise<boolean>;
};

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);
