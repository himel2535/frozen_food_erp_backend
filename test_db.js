import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Customer } from './dist/models/Customer.js';

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const filter = { tenantId: 'default' };

  const aggregateResult = await Customer.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalDue: {
          $sum: { $ifNull: ['$totalDue', { $ifNull: ['$due', 0] }] },
        },
        withDue: {
          $sum: {
            $cond: [{ $gt: [{ $ifNull: ['$totalDue', { $ifNull: ['$due', 0] }] }, 0] }, 1, 0],
          },
        },
      },
    },
  ]);

  console.log('ALL CUSTOMERS DUE AGGREGATE:', aggregateResult);

  await mongoose.disconnect();
}

main().catch(console.error);
