import { describe, expect, it } from 'vitest';
import { KEY_PREFIX, addKeyPrefix } from '../../src/lib/redisClient.js';

describe('Redis keyPrefix logic', () => {
  it('has the correct KEY_PREFIX value', () => {
    expect(KEY_PREFIX).toBe('frozen_food:');
  });

  it('prepends frozen_food: prefix to raw keys', () => {
    expect(addKeyPrefix('erp:cache:test')).toBe('frozen_food:erp:cache:test');
    expect(addKeyPrefix('session:123')).toBe('frozen_food:session:123');
    expect(addKeyPrefix('otp:user1')).toBe('frozen_food:otp:user1');
  });

  it('does not duplicate prefix if key already has frozen_food:', () => {
    expect(addKeyPrefix('frozen_food:erp:cache:test')).toBe('frozen_food:erp:cache:test');
  });
});
