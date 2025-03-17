# LnKi.ng Implementation Guide

This document provides detailed implementation instructions for adapting the Dub URL shortener for the Nigerian market as LnKi.ng.

## 1. Database Migration: MySQL to PostgreSQL

### Prisma Schema Modifications

```prisma
// FROM:
datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}

// TO:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Data Type Adjustments

| MySQL Type | PostgreSQL Equivalent | Notes |
|------------|----------------------|-------|
| `TEXT` | `TEXT` | No change needed |
| `BLOB` | `BYTEA` | Convert binary data |
| `JSON` | `JSONB` | Better performance in PostgreSQL |
| `DATETIME` | `TIMESTAMP` | Time zone conversion may be needed |

### Migration Steps

1. Create a Neon PostgreSQL database
   ```bash
   # Install Neon CLI if not already installed
   npm install -g neonctl
   
   # Login and create database
   neonctl auth
   neonctl projects create --name lnking
   ```

2. Generate migration script
   ```bash
   # Update schema.prisma first
   npx prisma migrate dev --name mysql-to-postgresql
   ```

3. Export data from PlanetScale
   ```bash
   # Using PlanetScale CLI
   pscale database dump lnking --output-dir ./dump
   ```

4. Import data to PostgreSQL
   ```bash
   # Using Prisma
   npx prisma db push
   
   # Then use a migration script to import data
   node scripts/import-data.js
   ```

## 2. Flutterwave Integration

### API Setup

1. Register at [Flutterwave](https://flutterwave.com/gh/)
2. Create API keys in the dashboard
3. Set up webhook endpoints

### Implementation Files

| File to Create | Purpose |
|----------------|---------|
| `lib/flutterwave.ts` | Main Flutterwave API client |
| `app/api/flutterwave/webhook/route.ts` | Webhook handler for payment events |
| `components/billing/flutterwave-checkout.tsx` | Checkout component |

### Sample Code for Flutterwave Client

```typescript
// lib/flutterwave.ts
import { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";

const FW_API_URL = "https://api.flutterwave.com/v3";

export const flutterwaveClient = {
  async createPayment({
    amount,
    currency = "NGN",
    email,
    name,
    workspaceId,
    planId,
    successUrl,
    cancelUrl,
  }) {
    const response = await fetch(`${FW_API_URL}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: `workspace_${workspaceId}_plan_${planId}_${Date.now()}`,
        amount,
        currency,
        redirect_url: successUrl,
        customer: {
          email,
          name,
        },
        customizations: {
          title: "LnKi.ng Subscription",
          logo: "https://lnki.ng/logo.png",
        },
        meta: {
          workspaceId,
          planId,
        },
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || "Failed to create payment");
    }
    
    return data;
  },
  
  // Other methods for verification, subscriptions, etc.
};
```

### Webhook Handler

```typescript
// app/api/flutterwave/webhook/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.json();
  const signature = req.headers.get("verif-hash");
  
  // Verify webhook signature
  if (signature !== process.env.FLUTTERWAVE_WEBHOOK_SECRET) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  
  const { event, data } = body;
  
  if (event === "charge.completed") {
    const { tx_ref, status, amount, currency } = data;
    const [_, workspaceId, __, planId] = tx_ref.split("_");
    
    if (status === "successful") {
      await db.workspace.update({
        where: { id: workspaceId },
        data: {
          plan: planId,
          // Update other subscription details
        },
      });
      
      // Create transaction record
      await db.transaction.create({
        data: {
          workspaceId,
          amount,
          currency,
          status: "succeeded",
          provider: "flutterwave",
          externalId: data.id,
        },
      });
    }
  }
  
  return NextResponse.json({ received: true });
}
```

## 3. Location-Based Pricing

### Location Detection Middleware

```typescript
// middleware.ts - Add to existing middleware
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Check for existing currency preference
  const currencyPref = request.cookies.get("currency")?.value;
  
  if (!currencyPref) {
    // Detect country from headers (Vercel provides this automatically)
    const country = request.headers.get("x-vercel-ip-country") || "US";
    
    // Set currency based on country
    const currency = country === "NG" ? "NGN" : "USD";
    
    // Set currency in cookies
    response.cookies.set("currency", currency, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
  }
  
  return response;
}
```

### Multi-Currency Pricing Component

```typescript
// packages/utils/src/constants/pricing-multi-currency.tsx

import { currencyFormatter, nFormatter } from "../functions";
import { INFINITY_NUMBER } from "./misc";

const EXCHANGE_RATES = {
  USD: 1,
  NGN: 1550, // Example rate, should be updated dynamically
};

export const getCurrencyMultiplier = (currency: string = "USD") => {
  return EXCHANGE_RATES[currency] || 1;
};

export const getPriceInCurrency = (priceInUSD: number, currency: string = "USD") => {
  const multiplier = getCurrencyMultiplier(currency);
  return priceInUSD * multiplier;
};

export const formatPrice = (price: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
};

// Export modified plan objects with currency support
export const getPlansForCurrency = (currency: string = "USD") => {
  // Modify the existing PLANS to use the correct currency and prices
  return PLANS.map(plan => ({
    ...plan,
    price: {
      monthly: getPriceInCurrency(plan.price.monthly, currency),
      yearly: getPriceInCurrency(plan.price.yearly, currency),
      currency,
    },
  }));
};
```

### Currency Selector Component

```tsx
// components/pricing/currency-selector.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dub/ui";

export default function CurrencySelector() {
  const router = useRouter();
  const [currency, setCurrency] = useState("USD");
  
  useEffect(() => {
    // Get currency from cookies on client-side
    const cookieCurrency = document.cookie
      .split("; ")
      .find(row => row.startsWith("currency="))
      ?.split("=")[1];
      
    if (cookieCurrency) {
      setCurrency(cookieCurrency);
    }
  }, []);
  
  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    
    // Set cookie
    document.cookie = `currency=${value}; max-age=${60 * 60 * 24 * 30}; path=/`;
    
    // Reload page to update pricing
    router.reload();
  };
  
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-neutral-700">Currency:</span>
      <Select value={currency} onValueChange={handleCurrencyChange}>
        <SelectTrigger className="w-20">
          <SelectValue placeholder="Currency" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="USD">USD</SelectItem>
          <SelectItem value="NGN">NGN</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

## 4. UI Rebranding

### Logo Component Replacement

```tsx
// packages/ui/src/logo.tsx
import { cn } from "@dub/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-10 w-10 text-green-600 dark:text-green-400", className)}
    >
      {/* LnKi.ng logo SVG path - to be created */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 8H8V56H12V8ZM18 18H22V56H18V18ZM56 18H28V22H56V18ZM56 32H28V36H56V32ZM28 46H56V50H28V46Z"
        fill="currentColor"
      />
    </svg>
  );
}
```

### App Name and Domain Updates

Update the following environment variables:

```
NEXT_PUBLIC_APP_NAME=LnKi.ng
NEXT_PUBLIC_APP_DOMAIN=lnki.ng
NEXT_PUBLIC_APP_SHORT_DOMAIN=lnki.ng
```

### Color Theme Updates

Update the Tailwind configuration to incorporate Nigerian colors:

```typescript
// tailwind.config.ts
import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

export default {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Nigerian flag colors
        "nigerian-green": "#008751",
        "nigerian-white": "#ffffff",
        
        // Brand color replacements
        brand: {
          DEFAULT: "#008751", // Nigerian green instead of Dub's original color
          dark: "#006B3F",
          light: "#00A861",
        },
      },
    },
  },
  // Rest of the config...
} satisfies Config;
```

### Text Replacement

Create a script to replace all instances of "Dub" with "LnKi.ng":

```typescript
// scripts/rebrand-text.ts
import { glob } from "glob";
import fs from "fs";
import path from "path";

const FILES_TO_SCAN = [
  "./app/**/*.{js,ts,jsx,tsx}",
  "./components/**/*.{js,ts,jsx,tsx}",
  "./ui/**/*.{js,ts,jsx,tsx}",
  "./lib/**/*.{js,ts}",
];

const REPLACEMENTS = [
  { from: "Dub", to: "LnKi.ng" },
  { from: "dub.co", to: "lnki.ng" },
  { from: "dub.sh", to: "lnki.ng" },
  { from: "d.to", to: "ln.ki" },
];

async function main() {
  const files = await glob(FILES_TO_SCAN);
  
  for (const file of files) {
    let content = fs.readFileSync(file, "utf8");
    let changed = false;
    
    for (const { from, to } of REPLACEMENTS) {
      // Case sensitive replacement
      if (content.includes(from)) {
        content = content.replace(new RegExp(from, "g"), to);
        changed = true;
      }
      
      // Case insensitive replacement for certain types
      if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
        const fromLower = from.toLowerCase();
        if (content.toLowerCase().includes(fromLower)) {
          content = content.replace(
            new RegExp(fromLower, "gi"), 
            (match) => match === match.toLowerCase() ? to.toLowerCase() : to
          );
          changed = true;
        }
      }
    }
    
    if (changed) {
      fs.writeFileSync(file, content, "utf8");
      console.log(`Updated: ${file}`);
    }
  }
}

main().catch(console.error);
```

## 5. Testing Strategy

### Database Testing

```bash
# Test PostgreSQL connection
npx prisma db pull
npx prisma db push
```

### Payment Integration Testing

1. Use Flutterwave test environment
   ```
   FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxx
   FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxx
   ```

2. Test the following scenarios:
   - New subscription creation
   - Payment success/failure
   - Webhook handling
   - Currency conversion

### Location Detection Testing

```bash
# Test with different country headers
curl -H "x-vercel-ip-country: NG" https://lnki.ng/api/pricing
curl -H "x-vercel-ip-country: US" https://lnki.ng/api/pricing
```

## 6. Deployment Checklist

- [ ] Set up Neon PostgreSQL database
- [ ] Configure Flutterwave test environment
- [ ] Update all environment variables
- [ ] Run database migrations
- [ ] Test location-based pricing
- [ ] Verify correct currency display
- [ ] Complete UI rebranding
- [ ] Final QA testing
- [ ] Production deployment 