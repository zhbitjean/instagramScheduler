import test from 'node:test';
import assert from 'node:assert/strict';
import { HASHTAG_POOL, applyJitter, sampleHashtags } from '../postflow-core.mjs';

test('hashtag pool contains 20-30 unique local tags', () => {
  assert.ok(HASHTAG_POOL.length >= 20 && HASHTAG_POOL.length <= 30);
  assert.equal(new Set(HASHTAG_POOL).size, HASHTAG_POOL.length);
  assert.ok(HASHTAG_POOL.every((tag) => tag.startsWith('#')));
});

test('selects 8-12 unique hashtags', () => {
  const tags = sampleHashtags(8, 12, () => 0.5);
  assert.ok(tags.length >= 8 && tags.length <= 12);
  assert.equal(new Set(tags).size, tags.length);
});

test('jitter stays between 15 minutes early and 30 minutes late', () => {
  const scheduledAt = '2026-09-05T16:00:00.000Z';
  assert.equal(applyJitter(scheduledAt, 15, 30, () => 0).offsetMinutes, -15);
  assert.equal(applyJitter(scheduledAt, 15, 30, () => 0.9999).offsetMinutes, 30);
});
