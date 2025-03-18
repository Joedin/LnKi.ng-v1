/**
 * Flutterwave API client for payment processing.
 * Replaces Stripe for the Nigerian market.
 */

const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY || '';
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';
const FLUTTERWAVE_WEBHOOK_HASH = process.env.FLUTTERWAVE_WEBHOOK_HASH || '';
const FLUTTERWAVE_ENCRYPTION_KEY = process.env.FLUTTERWAVE_ENCRYPTION_KEY || '';

interface PaymentPlan {
  name: string;
  amount: number;
  interval: 'monthly' | 'yearly';
  currency: 'NGN' | 'USD';
  duration?: number;
  status?: 'active' | 'cancelled';
  id?: string;
}

interface SubscriptionPayload {
  customer: {
    email: string;
    name: string;
    phone_number?: string;
  };
  plan_id: string;
  currency: string;
  amount: number;
  redirect_url: string;
}

interface TransactionResponse {
  status: string;
  message: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    redirect_url: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: string;
    payment_type: string;
    customer: {
      id: number;
      name: string;
      email: string;
      phone_number: string;
    };
  };
}

interface VerifyTransactionResponse {
  status: string;
  message: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: string;
    payment_type: string;
    customer: {
      id: number;
      name: string;
      email: string;
      phone_number: string;
    };
  };
}

/**
 * Create a payment plan in Flutterwave
 */
export async function createPaymentPlan(plan: PaymentPlan): Promise<{ id: string }> {
  try {
    const response = await fetch(`${FLUTTERWAVE_API_URL}/payment-plans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(plan)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to create payment plan');
    }
    
    return { id: data.data.id };
  } catch (error) {
    console.error('Error creating payment plan:', error);
    throw error;
  }
}

/**
 * Initiate a subscription payment
 */
export async function initiateSubscription(payload: SubscriptionPayload): Promise<TransactionResponse> {
  try {
    const response = await fetch(`${FLUTTERWAVE_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...payload,
        payment_options: 'card,banktransfer,ussd',
        customizations: {
          title: 'LnKi.ng Subscription',
          description: `Subscribe to LnKi.ng ${payload.amount} ${payload.currency === 'NGN' ? '₦' : '$'} plan`,
          logo: 'https://your-logo-url.com/logo.png'
        }
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to initiate subscription');
    }
    
    return data;
  } catch (error) {
    console.error('Error initiating subscription:', error);
    throw error;
  }
}

/**
 * Verify a transaction
 */
export async function verifyTransaction(transactionId: string): Promise<VerifyTransactionResponse> {
  try {
    const response = await fetch(
      `${FLUTTERWAVE_API_URL}/transactions/${transactionId}/verify`,
      {
        headers: {
          'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`
        }
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to verify transaction');
    }
    
    return data;
  } catch (error) {
    console.error('Error verifying transaction:', error);
    throw error;
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<any> {
  try {
    const response = await fetch(
      `${FLUTTERWAVE_API_URL}/subscriptions/${subscriptionId}/cancel`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to cancel subscription');
    }
    
    return data;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

/**
 * Get a single subscription
 */
export async function getSubscription(subscriptionId: string): Promise<any> {
  try {
    const response = await fetch(
      `${FLUTTERWAVE_API_URL}/subscriptions/${subscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${FLUTTERWAVE_SECRET_KEY}`
        }
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get subscription');
    }
    
    return data;
  } catch (error) {
    console.error('Error getting subscription:', error);
    throw error;
  }
}

/**
 * Validate webhook signature
 */
export function validateWebhookSignature(signature: string): boolean {
  return signature === FLUTTERWAVE_WEBHOOK_HASH;
}

/**
 * Currency utility to get display currency based on user's country
 */
export function getDisplayCurrency(country?: string): 'NGN' | 'USD' {
  // List of African countries to show NGN pricing
  const africanCountries = [
    'NG', 'GH', 'KE', 'ZA', 'TZ', 'UG', 'RW', 'CM', 'CI', 'SN', 'ZM', 'ET'
  ];
  
  if (!country) return 'USD';
  
  return africanCountries.includes(country) ? 'NGN' : 'USD';
}

/**
 * Get price for display based on currency and interval
 */
export function getPriceForDisplay(planName: string, interval: 'monthly' | 'yearly', currency: 'NGN' | 'USD'): number {
  const plans = {
    pro: {
      monthly: {
        NGN: 10000,
        USD: 15
      },
      yearly: {
        NGN: 96000,
        USD: 144
      }
    },
    business: {
      monthly: {
        NGN: 25000,
        USD: 37
      },
      yearly: {
        NGN: 240000,
        USD: 355
      }
    },
    businessPlus: {
      monthly: {
        NGN: 50000,
        USD: 75
      },
      yearly: {
        NGN: 480000,
        USD: 720
      }
    },
    businessExtra: {
      monthly: {
        NGN: 105000,
        USD: 155
      },
      yearly: {
        NGN: 1008000,
        USD: 1488
      }
    },
    businessMax: {
      monthly: {
        NGN: 205000,
        USD: 312
      },
      yearly: {
        NGN: 1968000,
        USD: 2995
      }
    }
  };
  
  const plan = plans[planName];
  if (!plan) throw new Error(`Plan "${planName}" not found`);
  
  return plan[interval][currency];
}

export default {
  createPaymentPlan,
  initiateSubscription,
  verifyTransaction,
  cancelSubscription,
  getSubscription,
  validateWebhookSignature,
  getDisplayCurrency,
  getPriceForDisplay
}; 