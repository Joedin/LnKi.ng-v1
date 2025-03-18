# Flutterwave Integration Documentation

## Overview
This document outlines the implementation details for Flutterwave payment integration with Lnki.ng, focusing on subscription-based payments.

## Table of Contents
1. [Payment Plans](#payment-plans)
2. [Subscription Flow](#subscription-flow)
3. [Webhooks](#webhooks)
4. [Error Handling](#error-handling)
5. [Testing](#testing)

## Payment Plans

### Plan Configuration
```typescript
interface PaymentPlan {
  name: string;           // Name of the plan
  amount: number;         // Amount to be charged
  interval: 'monthly' | 'yearly'; // Billing frequency
  currency: 'NGN' | 'USD'; // Plan currency
  duration?: number;      // Optional: Number of charges to be made
  status?: 'active' | 'cancelled'; // Plan status
}

// Complete plan configuration
const subscriptionPlans = {
  pro: {
    monthly: {
      NGN: {
        amount: 10000,    // ₦10,000/month
        planId: 'pro_monthly_ngn'
      },
      USD: {
        amount: 15,       // $15/month
        planId: 'pro_monthly_usd'
      }
    },
    yearly: {
      NGN: {
        amount: 96000,    // ₦96,000/year (₦8,000/month)
        planId: 'pro_yearly_ngn'
      },
      USD: {
        amount: 144,      // $144/year ($12/month)
        planId: 'pro_yearly_usd'
      }
    }
  },
  business: {
    monthly: {
      NGN: {
        amount: 25000,    // ₦25,000/month
        planId: 'business_monthly_ngn'
      },
      USD: {
        amount: 37,       // $37/month
        planId: 'business_monthly_usd'
      }
    },
    yearly: {
      NGN: {
        amount: 240000,   // ₦240,000/year (₦20,000/month)
        planId: 'business_yearly_ngn'
      },
      USD: {
        amount: 355,      // $355/year ($29.58/month)
        planId: 'business_yearly_usd'
      }
    }
  },
  businessPlus: {
    monthly: {
      NGN: {
        amount: 50000,    // ₦50,000/month
        planId: 'business_plus_monthly_ngn'
      },
      USD: {
        amount: 75,       // $75/month
        planId: 'business_plus_monthly_usd'
      }
    },
    yearly: {
      NGN: {
        amount: 480000,   // ₦480,000/year (₦40,000/month)
        planId: 'business_plus_yearly_ngn'
      },
      USD: {
        amount: 720,      // $720/year ($60/month)
        planId: 'business_plus_yearly_usd'
      }
    }
  },
  businessExtra: {
    monthly: {
      NGN: {
        amount: 105000,   // ₦105,000/month
        planId: 'business_extra_monthly_ngn'
      },
      USD: {
        amount: 155,      // $155/month
        planId: 'business_extra_monthly_usd'
      }
    },
    yearly: {
      NGN: {
        amount: 1008000,  // ₦1,008,000/year (₦84,000/month)
        planId: 'business_extra_yearly_ngn'
      },
      USD: {
        amount: 1488,     // $1,488/year ($124/month)
        planId: 'business_extra_yearly_usd'
      }
    }
  },
  businessMax: {
    monthly: {
      NGN: {
        amount: 205000,   // ₦205,000/month
        planId: 'business_max_monthly_ngn'
      },
      USD: {
        amount: 312,      // $312/month
        planId: 'business_max_monthly_usd'
      }
    },
    yearly: {
      NGN: {
        amount: 1968000,  // ₦1,968,000/year (₦164,000/month)
        planId: 'business_max_yearly_ngn'
      },
      USD: {
        amount: 2995,     // $2,995/year ($249.58/month)
        planId: 'business_max_yearly_usd'
      }
    }
  }
};

// Plan limits configuration
const planLimits = {
  pro: {
    links: 1000,
    clicks: 50000,
    domains: 10,
    users: 5
  },
  business: {
    links: 5000,
    clicks: 150000,
    domains: 40,
    users: 15
  },
  businessPlus: {
    links: 15000,
    clicks: 400000,
    domains: 100,
    users: 30
  },
  businessExtra: {
    links: 40000,
    clicks: 1000000,
    domains: 250,
    users: 50
  },
  businessMax: {
    links: 100000,
    clicks: 2500000,
    domains: 500,
    users: 100
  }
};

// Function to create a payment plan
async function createPaymentPlan(plan: PaymentPlan) {
  try {
    const response = await fetch('https://api.flutterwave.com/v3/payment-plans', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(plan)
    });
    return await response.json();
  } catch (error) {
    console.error('Error creating payment plan:', error);
    throw error;
  }
}

// Function to get plan by user location
function getPlanPricing(planName: string, interval: 'monthly' | 'yearly', country: string) {
  const plan = subscriptionPlans[planName];
  if (!plan) throw new Error('Invalid plan name');
  
  const pricing = plan[interval];
  // Use NGN for African countries, USD for others
  const currency = isAfricanCountry(country) ? 'NGN' : 'USD';
  return pricing[currency];
}
```

## Subscription Flow

### 1. Initiate Subscription
```typescript
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

async function initiateSubscription(payload: SubscriptionPayload) {
  try {
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...payload,
        payment_options: 'card,banktransfer',
        customizations: {
          title: 'Dub.sh Pro Subscription',
          description: 'Subscribe to Dub.sh Pro plan',
          logo: 'https://your-logo-url.com/logo.png'
        }
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Error initiating subscription:', error);
    throw error;
  }
}
```

### 2. Verify Transaction
```typescript
async function verifyTransaction(transactionId: string) {
  try {
    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`
        }
      }
    );
    return await response.json();
  } catch (error) {
    console.error('Error verifying transaction:', error);
    throw error;
  }
}
```

## Webhooks

### 1. Webhook Configuration
```typescript
interface WebhookPayload {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
    customer: {
      email: string;
      name: string;
      phone_number: string;
    };
  };
}

// Webhook handler
async function handleWebhook(payload: WebhookPayload) {
  const hash = req.headers['verif-hash'];
  
  if (!hash || hash !== process.env.FLUTTERWAVE_WEBHOOK_HASH) {
    throw new Error('Invalid webhook signature');
  }

  switch (payload.event) {
    case 'subscription.created':
      await handleSubscriptionCreated(payload.data);
      break;
    case 'subscription.cancelled':
      await handleSubscriptionCancelled(payload.data);
      break;
    case 'charge.completed':
      await handleChargeCompleted(payload.data);
      break;
    case 'transfer.failed':
      await handleTransferFailed(payload.data);
      break;
    default:
      console.log('Unhandled webhook event:', payload.event);
  }
}
```

## Error Handling

```typescript
class FlutterwaveError extends Error {
  constructor(
    message: string,
    public code: string,
    public data?: any
  ) {
    super(message);
    this.name = 'FlutterwaveError';
  }
}

const errorCodes = {
  INVALID_CARD: 'Card validation failed',
  INSUFFICIENT_FUNDS: 'Insufficient funds in account',
  TRANSACTION_FAILED: 'Transaction processing failed',
  SUBSCRIPTION_EXISTS: 'Active subscription already exists'
};

function handlePaymentError(error: any) {
  if (error.response) {
    const { status, data } = error.response;
    switch (status) {
      case 400:
        throw new FlutterwaveError(
          'Invalid request parameters',
          'INVALID_REQUEST',
          data
        );
      case 401:
        throw new FlutterwaveError(
          'Authentication failed',
          'AUTH_ERROR',
          data
        );
      case 500:
        throw new FlutterwaveError(
          'Flutterwave service error',
          'SERVER_ERROR',
          data
        );
      default:
        throw new FlutterwaveError(
          'Unknown error occurred',
          'UNKNOWN_ERROR',
          data
        );
    }
  }
  throw error;
}
```

## Testing

### Test Cards
```typescript
const testCards = {
  successful: {
    number: '5531 8866 5214 2950',
    cvv: '564',
    expiry: '09/32',
    pin: '3310',
    otp: '12345'
  },
  failed: {
    number: '5258 5859 2266 6506',
    cvv: '883',
    expiry: '09/31',
    pin: '3310',
    otp: '12345'
  }
};
```

### Testing Environment
- Test Secret Key: Get from Flutterwave Dashboard
- Test Public Key: Get from Flutterwave Dashboard
- Webhook URL: Configure in Dashboard
- Test Mode: Enable in Dashboard

### Important Notes
1. Always use test credentials in development
2. Test all webhook events using Flutterwave's test mode
3. Verify webhook signatures for security
4. Handle failed payments gracefully
5. Implement proper error messages for users
6. Test subscription cancellation flow
7. Monitor webhook delivery and implement retry mechanism

### Implementation Checklist
- [ ] Set up payment plans for both NGN and USD
- [ ] Configure webhook endpoint and verify signatures
- [ ] Implement subscription initiation flow
- [ ] Handle successful payment completion
- [ ] Implement subscription cancellation
- [ ] Set up error handling and logging
- [ ] Test with various payment methods
- [ ] Monitor webhook events
- [ ] Implement retry mechanism for failed webhooks
- [ ] Set up subscription status tracking

### Best Practices
1. Always verify transactions server-side
2. Store subscription status in your database
3. Implement idempotency for webhook processing
4. Log all webhook events for debugging
5. Implement proper error handling for failed payments
6. Use environment variables for API keys
7. Implement proper security measures for webhook endpoints
8. Regular monitoring of subscription status
9. Proper handling of subscription cancellation
10. Clear communication of payment status to users

## Notes

1. **Important Considerations**
   - Always verify webhook signatures
   - Store transaction references
   - Implement idempotency
   - Handle currency conversion edge cases

2. **Best Practices**
   - Use webhook retries for failed notifications
   - Implement subscription status monitoring
   - Regular test card validation
   - Maintain transaction logs

3. **Limitations**
   - Subscription changes require cancellation and resubscription
   - Some payment methods not available in all regions
   - Currency restrictions for certain payment types 