import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferRiderNotificationCategory,
  RIDER_NOTIFICATION_CATEGORY,
  RIDER_NOTIFICATION_TITLES,
  RIDER_NOTIFICATION_TYPES,
  riderNotificationChannelId,
} from './rider-notification.constants';

test('maps notification types to categories', () => {
  assert.equal(
    inferRiderNotificationCategory(RIDER_NOTIFICATION_TYPES.PICKUP_ASSIGNMENT),
    RIDER_NOTIFICATION_CATEGORY.ASSIGNMENT,
  );
  assert.equal(
    inferRiderNotificationCategory(RIDER_NOTIFICATION_TYPES.PICKUP_OVERDUE),
    RIDER_NOTIFICATION_CATEGORY.REMINDER,
  );
  assert.equal(
    inferRiderNotificationCategory(RIDER_NOTIFICATION_TYPES.EARNINGS_CREDITED),
    RIDER_NOTIFICATION_CATEGORY.EARNINGS,
  );
  assert.equal(
    inferRiderNotificationCategory(RIDER_NOTIFICATION_TYPES.PLATFORM_ANNOUNCEMENT),
    RIDER_NOTIFICATION_CATEGORY.SYSTEM,
  );
});

test('uses spec titles for core notification types', () => {
  assert.equal(RIDER_NOTIFICATION_TITLES.NEW_PICKUP_ASSIGNED, 'New Pickup Assigned');
  assert.equal(RIDER_NOTIFICATION_TITLES.PICKUP_OVERDUE, 'Pickup Overdue');
  assert.equal(RIDER_NOTIFICATION_TITLES.EARNINGS_CREDITED, 'Earnings Credited');
  assert.equal(RIDER_NOTIFICATION_TITLES.PLATFORM_ANNOUNCEMENT, 'Platform Announcement');
});

test('maps categories to push channel ids', () => {
  assert.equal(riderNotificationChannelId(RIDER_NOTIFICATION_CATEGORY.REMINDER), 'reminders');
  assert.equal(riderNotificationChannelId(RIDER_NOTIFICATION_CATEGORY.EARNINGS), 'earnings');
});
