# LnKi.ng - Nigerian Adaptation Plan for Dub URL Shortener

## Overview

This document outlines the plan to adapt the Dub URL shortener for the Nigerian market, rebranding it as "LnKi.ng". The adaptation will include database migration, payment system integration, location-based pricing, and UI rebranding.

## 1. Database Migration (MySQL to PostgreSQL)

### Current State
- Dub uses MySQL via PlanetScale with the following configuration:
  ```prisma
  datasource db {
    provider     = "mysql"
    url          = env("DATABASE_URL")
    relationMode = "prisma"
  }
  ```

### Migration Plan
1. **Update Prisma Schema**:
   - Modify schema.prisma to use PostgreSQL instead of MySQL
   - Update data types that may need adaptation (e.g., TEXT types)
   - Remove MySQL-specific features like `relationMode`

2. **Data Migration Strategy**:
   - Use Prisma Migrate to generate migration scripts
   - Export data from PlanetScale MySQL
   - Import data into Neon PostgreSQL

3. **Configuration Updates**:
   - Update environment variables for PostgreSQL connection
   - Configure connection pooling for optimal performance

## 2. Payment System Integration (Stripe to Flutterwave)

### Current State
- Dub uses Stripe for payment processing with:
  - Subscription management
  - Webhook integration
  - Currency handling primarily in USD

### Migration Plan
1. **Flutterwave Integration**:
   - Implement Flutterwave API client
   - Set up payment plans equivalent to current Stripe plans
   - Configure webhooks for payment notifications

2. **Required Components**:
   - Payment page/modal adaptation
   - Subscription management flows
   - Receipts and invoicing

3. **Code Changes**:
   - Replace Stripe API calls with Flutterwave equivalents
   - Update payment processing logic
   - Modify checkout flows

## 3. Environment Variables and Configuration

### Updates Required
1. **Database Configuration**:
   ```
   DATABASE_URL="postgresql://username:password@neon.io:5432/database"
   ```

2. **Payment Processing**:
   ```
   FLUTTERWAVE_PUBLIC_KEY=
   FLUTTERWAVE_SECRET_KEY=
   FLUTTERWAVE_ENCRYPTION_KEY=
   FLUTTERWAVE_WEBHOOK_SECRET=
   ```

3. **Other Service Replacements**:
   - Consider local alternatives for other services if needed
   - Review regional compliance requirements

## 4. Location-Based Pricing Implementation

### Current State
- Pricing is defined in `packages/utils/src/constants/pricing.tsx`
- No built-in location-based pricing mechanism

### Implementation Plan
1. **Location Detection**:
   - Use existing location detection from analytics
   - Implement middleware to detect Nigerian users
   - Store location information in session/cookies

2. **Dynamic Pricing Display**:
   - Create price multiplier/conversion for Naira
   - Extend pricing constants to include multi-currency support
   - Build UI components to display appropriate currency

3. **Implementation Details**:
   - Add logic to detect user location (Nigeria vs. International)
   - Create pricing variants with Naira equivalents
   - Ensure checkout flow respects selected currency

## 5. UI Rebranding

### Elements to Rebrand
1. **Logo and Brand Assets**:
   - Replace Dub logo with LnKi.ng logo
   - Update favicon and social media assets

2. **Text References**:
   - Update all instances of "Dub" to "LnKi.ng"
   - Modify domain references (dub.co → lnki.ng)
   - Update sample URLs and documentation

3. **UI Theme**:
   - Consider Nigerian color palette (green and white)
   - Update accent colors throughout the app

4. **Marketing Content**:
   - Adapt marketing copy for Nigerian audience
   - Update examples to be relevant to Nigerian users

## Services to Use

### 1. Database Options
- **Neon PostgreSQL**
  - Serverless PostgreSQL with generous free tier
  - Auto-scaling capability
  - Global availability
  
- **Supabase**
  - PostgreSQL database with extra features
  - Authentication and storage included
  - Good developer experience

- **Railway**
  - Simple deployment of PostgreSQL
  - Predictable pricing
  - Good performance

### 2. Payment Processing
- **Flutterwave**
  - Leading payment processor in Nigeria
  - Supports multiple payment methods (card, bank transfer, USSD)
  - Robust API and documentation
  - Supports Naira and other currencies

- **Paystack**
  - Alternative Nigerian payment processor
  - Good developer experience
  - International payments support
  - Subscription capabilities

### 3. Hosting Options
- **Vercel**
  - Continue using Vercel as in the original Dub
  - Global CDN for performance
  - Good integration with Next.js

- **Netlify**
  - Alternative if Vercel has limitations in Nigeria
  - Similar features

### 4. Analytics & Monitoring
- **Tinybird**
  - Continue using Tinybird for analytics
  - Add region-specific views

- **Upstash**
  - Keep using for Redis and QStash functionality
  - Good global presence

## Next Steps and Timeline

### Phase 1: Foundation (Week 1-2)
- Set up Neon PostgreSQL instance
- Adapt Prisma schema for PostgreSQL
- Update environment configurations

### Phase 2: Core Functionality (Week 2-4)
- Implement Flutterwave integration
- Create location detection system
- Add multi-currency support

### Phase 3: Rebranding & Polishing (Week 4-6)
- Complete UI rebranding
- Test payment flows
- QA and performance optimization

### Phase 4: Launch (Week 6-8)
- Final testing
- Documentation updates
- Marketing preparation
- Launch plan 