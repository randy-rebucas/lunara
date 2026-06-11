/** Customer-facing copy for live order / dispatch events (socket + push). */
export const ORDER_EVENT_MESSAGES: Record<string, string> = {
  awaitingDispatch:
    'Payment received. Your order is pending dispatch to a laundry partner.',
  shopAssigned: 'Your order was assigned to a laundry partner shop.',
  riderAssignedPickup: 'A pickup rider has been assigned to your order.',
  branchAssigned: 'Your order was assigned to a laundry partner branch.',
  findingRider: 'Finding a nearby rider for your pickup…',
  riderAssigned: 'A rider accepted your pickup and is on the way.',
  riderArrived: 'Your rider has arrived at your address.',
  pickedUp: 'Laundry collected from your address.',
  pickupReceiptGenerated: 'Pickup receipt generated for your order.',
  inTransitToShop: 'Your laundry is on the way to the partner shop.',
  laundryReceivedAtShop: 'Laundry received at the partner shop.',
  shopWeightVerified: 'The shop verified your laundry weight.',
  receivedAtShop: 'Items confirmed at the partner shop.',
  partnerAccepted: 'Your laundry partner accepted your order.',
  staffAssigned: 'A staff member was assigned to process your laundry.',
  staffJobAccepted: 'Processing has started at the partner shop.',
  processingAdvanced: 'Your laundry is being processed at the shop.',
  awaitingDeliveryDispatch:
    'Your laundry is ready. Lunara operations is assigning a delivery rider.',
  findingDeliveryRider: 'Looking for a rider to deliver your laundry…',
  riderAssignedDelivery: 'A delivery rider has been assigned to your order.',
  deliveryRiderAssigned: 'Your delivery rider is on the way.',
  riderPickedUpFromShop: 'Your laundry was picked up from the partner shop.',
  outForDelivery: 'Your clean laundry is on the way.',
  customerReceivedDelivery: 'You received your laundry from the rider.',
  deliveryPhotoProof: 'Delivery photo proof was captured.',
  deliveryRiderArrived: 'Your delivery rider has arrived.',
  customerVerifiedDelivery: 'You verified the delivery.',
  customerSignedDelivery: 'You signed for your delivery.',
  delivered: 'Laundry delivered successfully.',
  completed: 'Order complete. Thank you!',
  paymentReceived: 'Cash payment received — thank you!',
  reviewRequested: 'How was your experience? Leave a review when you have a moment.',
  reviewPublished: 'Thank you for your review!',
  refundProcessed: 'Your refund has been processed.',
  refundNotified: 'Refund update on your order.',
};

export function orderEventTitle(event: string): string {
  switch (event) {
    case 'awaitingDispatch':
      return 'Order received';
    case 'shopAssigned':
    case 'branchAssigned':
      return 'Shop assigned';
    case 'findingRider':
    case 'findingDeliveryRider':
      return 'Finding rider';
    case 'riderAssigned':
    case 'riderAssignedPickup':
    case 'riderAssignedDelivery':
    case 'deliveryRiderAssigned':
      return 'Rider assigned';
    case 'riderArrived':
    case 'deliveryRiderArrived':
      return 'Rider arrived';
    case 'pickedUp':
    case 'riderPickedUpFromShop':
      return 'Pickup update';
    case 'outForDelivery':
      return 'Out for delivery';
    case 'delivered':
    case 'completed':
      return 'Delivered';
    case 'refundProcessed':
    case 'refundNotified':
      return 'Refund update';
    case 'reviewRequested':
      return 'Rate your order';
    default:
      return 'Order update';
  }
}

export function resolveOrderEventMessage(
  event: string,
  payload?: { message?: string },
): string | undefined {
  return payload?.message ?? ORDER_EVENT_MESSAGES[event];
}
