import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from './config/env.js';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: 'admin' },
  allowedSections: [String],
  status: { type: String, default: 'active' },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function main() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log('Connected to MongoDB.');

    const exists = await User.findOne({ email: 'admin@toysfactory.com' });
    if (exists) {
      console.log('Admin user already exists.');
    } else {
      const admin = new User({
        email: 'admin@toysfactory.com',
        password: 'password123',
        name: 'Main Admin',
        role: 'admin',
        allowedSections: ['*'],
      });
      await admin.save();
      console.log('Admin user created successfully.');
    }
  } catch (err) {
    console.error('Failed to create admin:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
