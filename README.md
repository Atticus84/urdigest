# urdigest - Turn Instagram Saves into Daily Email Digests

Transform your saved Instagram posts into AI-summarized email digests delivered every morning.

## Tech Stack

- **Frontend**: Next.js 14 + React + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (Vercel Edge Functions)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI**: OpenAI GPT-4o-mini
- **Email**: Resend + React Email
- **Payments**: Stripe
- **Jobs**: Inngest
- **Hosting**: Vercel

## Project Structure

```
urdigest-app/
├── src/
│   ├── app/                  # Next.js 14 App Router
│   │   ├── api/             # API routes
│   │   │   ├── posts/       # Post management endpoints
│   │   │   ├── user/        # User endpoints
│   │   │   ├── subscription/# Stripe subscription endpoints
│   │   │   ├── webhooks/    # Webhooks (Instagram, Stripe)
│   │   │   └── inngest/     # Inngest job handler
│   │   ├── (auth)/          # Auth pages (login, signup)
│   │   ├── dashboard/       # Dashboard pages
│   │   └── page.tsx         # Landing page
│   ├── components/          # React components
│   ├── lib/                 # Utilities
│   │   ├── supabase/        # Supabase clients
│   │   ├── ai/              # AI summarization
│   │   └── email/           # Email sending
│   ├── inngest/             # Background jobs
│   ├── emails/              # React Email templates
│   └── types/               # TypeScript types
├── supabase/
│   └── migrations/          # Database migrations
└── public/                  # Static assets
```

## Setup Instructions

### 1. Prerequisites

- Node.js 18+
- npm or yarn
- Accounts:
  - [Supabase](https://supabase.com) (free tier)
  - [Stripe](https://stripe.com) (test mode)
  - [OpenAI](https://platform.openai.com) (API key)
  - [Resend](https://resend.com) (free tier)
  - [Inngest](https://www.inngest.com) (free tier)
  - [Vercel](https://vercel.com) (free tier)

### 2. Clone and Install

```bash
git clone <repository-url>
cd urdigest-app
npm install
```

### 3. Supabase Setup

1. Create a new Supabase project
2. Run the database migration:
   - Go to SQL Editor in Supabase dashboard
   - Paste contents of `supabase/migrations/001_initial_schema.sql`
   - Run the query
3. Get your credentials:
   - Project URL: Settings → API
   - Anon key: Settings → API
   - Service role key: Settings → API (keep secret!)

### 4. Stripe Setup

1. Create a Stripe account (use test mode)
2. Create a product:
   - Dashboard → Products → Add Product
   - Name: "urdigest Premium"
   - Price: $5/month (recurring)
   - Copy the Price ID (starts with `price_...`)
3. Get your API keys:
   - Developers → API keys
   - Copy Publishable key and Secret key
4. Set up webhook:
   - Developers → Webhooks → Add endpoint
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events: Select `customer.subscription.*` and `invoice.*`
   - Copy webhook secret (starts with `whsec_...`)

### 5. OpenAI Setup

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Create an API key
3. Add billing info (pay-as-you-go)

### 6. Resend Setup

1. Create a [Resend](https://resend.com) account
2. Verify your sending domain (or use their test domain)
3. Create an API key
4. Configure sender:
   - Add domain: `urdigest.com` (or your domain)
   - Verify DNS records
   - Use `digest@urdigest.com` as sender

### 7. Inngest Setup

1. Create an [Inngest](https://www.inngest.com) account
2. Create a new app
3. Get your Event Key and Signing Key from Settings

### 8. Environment Variables

Create `.env.local`:

```bash
cp .env.example .env.local
```

Fill in all variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# OpenAI
OPENAI_API_KEY=sk-...

# Resend
RESEND_API_KEY=re_...

# Inngest
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 9. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 10. Test Instagram Webhook (Optional)

For Instagram DM integration:

1. Create a Meta App at [developers.facebook.com](https://developers.facebook.com)
2. Add Instagram Messaging product
3. Configure webhook URL: `https://your-domain.com/api/webhooks/instagram`
4. Set verify token in your `.env.local`:
   ```
   INSTAGRAM_WEBHOOK_VERIFY_TOKEN=urdigest_verify_token
   ```
5. Subscribe to messaging events
6. Go through App Review to get `instagram_manage_messages` permission

## Development Workflow

### Testing the Digest Generation

Trigger a manual digest for a user:

```bash
# Using Inngest Dev Server
npx inngest-cli dev

# Send test event
curl -X POST http://localhost:8288/e/urdigest \
  -H "Content-Type: application/json" \
  -d '{"name": "digest/manual", "data": {"userId": "user-uuid"}}'
```

### Database Migrations

When making schema changes:

1. Create a new migration file in `supabase/migrations/`
2. Run it in Supabase SQL Editor
3. Update TypeScript types in `src/types/database.ts`

### Email Template Development

Preview emails:

```bash
npm run email:dev
```

This starts the React Email dev server at http://localhost:3000

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

### Post-Deployment Setup

1. **Configure Stripe Webhook**:
   - Update webhook URL to production domain
   - Test webhook with Stripe CLI

2. **Configure Inngest**:
   - Add production app URL in Inngest dashboard
   - Sync functions: `npx inngest-cli sync`

3. **Test End-to-End**:
   - Sign up as a test user
   - Simulate saving posts (manually insert into database)
   - Trigger manual digest
   - Verify email delivery

## API Endpoints

### Posts

- `POST /api/posts/sync` - Sync posts from extension
- `GET /api/posts` - Get user's saved posts
- `DELETE /api/posts/:id` - Delete a post

### User

- `GET /api/user/me` - Get current user
- `PATCH /api/user/settings` - Update settings

### Subscription

- `POST /api/subscription/create-checkout-session` - Start Stripe checkout
- `POST /api/subscription/create-portal-session` - Manage subscription

### Webhooks

- `POST /api/webhooks/instagram` - Instagram DM events
- `POST /api/webhooks/stripe` - Stripe subscription events

### Background Jobs

- `POST /api/inngest` - Inngest job handler

## Monitoring

### Logs

- Vercel: Dashboard → Logs
- Supabase: Dashboard → Logs
- Stripe: Dashboard → Events
- Inngest: Dashboard → Runs

### Metrics to Track

- User signups
- Posts saved per user
- Digests sent
- Email open rates (Resend analytics)
- Conversion rate (trial → paid)
- Churn rate
- AI costs (OpenAI usage)

## Troubleshooting

### Digest not sending

1. Check Inngest dashboard for failed runs
2. Verify user has `digest_enabled = true`
3. Check subscription status
4. Look for errors in Vercel logs

### Email not delivering

1. Check Resend dashboard for bounce/complaint
2. Verify domain DNS records
3. Test with different email provider

### Stripe webhook failing

1. Verify webhook secret matches
2. Check Vercel logs for errors
3. Test locally with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

## Cost Breakdown (at 1,000 users)

- **Supabase**: $25/month (Pro plan)
- **Vercel**: $20/month (Pro plan)
- **OpenAI**: ~$60/month (10 posts/user/day)
- **Resend**: $20/month (30k emails/month)
- **Stripe**: ~$595/month (fees on $5k revenue)
- **Inngest**: Free (within limits)

**Total**: ~$740/month
**Revenue**: $5,000/month (1,000 × $5)
**Margin**: 85%

## Next Steps

1. Build Chrome extension (separate repo)
2. Create landing page
3. Add analytics (PostHog/Plausible)
4. Implement error monitoring (Sentry)
5. Add more digest customization options
6. Build web dashboard UI

## License

Proprietary - All rights reserved

## Support

For issues or questions, contact: archontechnologiesllc@gmail.com
