// Stripe Elements integration (test mode)
// Will be initialized with the tenant's Stripe publishable key

export function getStripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';
}

// TODO: Initialize @stripe/stripe-js when ready
// import { loadStripe } from '@stripe/stripe-js';
// export const stripePromise = loadStripe(getStripePublishableKey());
