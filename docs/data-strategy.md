# urdigest Data Collection & Packaging Strategy

## Current State

We already collect:
- **User profiles**: email, timezone, digest preferences, Instagram username
- **Saved posts**: Instagram URLs, captions, author info, post type (photo/video/reel/carousel), media URLs
- **Engagement signals**: total posts saved, total digests sent, last post received timestamp
- **Subscription data**: plan status, billing dates, Stripe events
- **Digest records**: AI summaries, post counts, send times, email open tracking (via Resend)

## What Makes Our Data Valuable

Unlike generic social media analytics, we know **what content people actively save and care about**. A "save" is a much stronger intent signal than a like or view. We can build precise interest profiles from this.

---

## Phase 1: Enriched Data Collection (Low Effort)

### 1.1 Content Categorization (AI-powered)
When summarizing posts, also extract and store:
- **Categories**: fitness, cooking, fashion, tech, finance, travel, etc.
- **Tags/topics**: specific keywords (e.g., "meal prep", "HIIT", "budgeting")
- **Sentiment**: positive/negative/neutral
- **Content format preference**: does this user save more reels vs. photos vs. carousels?

**Implementation**: Add fields to `saved_posts` table and update the OpenAI summarization prompt to return structured category/tag data.

```sql
ALTER TABLE saved_posts ADD COLUMN categories TEXT[] DEFAULT '{}';
ALTER TABLE saved_posts ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE saved_posts ADD COLUMN sentiment VARCHAR(20);
```

### 1.2 Email Engagement Tracking
- **Open rates**: Already have `opened_at` on digests — integrate Resend webhooks to populate it
- **Click tracking**: Track which summary links users click in digest emails (use redirect URLs)
- **Read depth**: If possible via email client, track scroll/engagement

```sql
CREATE TABLE digest_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id UUID REFERENCES digests(id),
  user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES saved_posts(id),
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.3 User Demographics (from onboarding)
During DM onboarding or dashboard settings, collect optional fields:
- **Age range** (18-24, 25-34, 35-44, etc.)
- **Gender**
- **Location** (city/country — can infer from timezone initially)
- **Occupation/industry**

```sql
ALTER TABLE users ADD COLUMN age_range VARCHAR(10);
ALTER TABLE users ADD COLUMN gender VARCHAR(20);
ALTER TABLE users ADD COLUMN city VARCHAR(100);
ALTER TABLE users ADD COLUMN country VARCHAR(100);
ALTER TABLE users ADD COLUMN occupation VARCHAR(100);
```

---

## Phase 2: Interest Profiles & Segments

### 2.1 User Interest Profiles
Build a per-user interest vector from their saved post categories/tags over time.

```sql
CREATE TABLE user_interest_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  interests JSONB NOT NULL DEFAULT '{}',
  -- e.g. {"fitness": 0.45, "cooking": 0.30, "tech": 0.15, "travel": 0.10}
  top_tags TEXT[] DEFAULT '{}',
  -- e.g. ["meal prep", "HIIT", "home workouts", "budget recipes"]
  content_format_preference VARCHAR(20),
  -- e.g. "reels", "carousels", "photos"
  avg_posts_per_week DECIMAL(5,2),
  engagement_score DECIMAL(5,2),
  -- based on open rates, click rates, save frequency
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Engagement score formula**:
- Posts saved per week (frequency)
- Email open rate (% of digests opened)
- Click-through rate (% of links clicked)
- Subscription tenure

### 2.2 Audience Segments
Group users into targetable cohorts:

| Segment | Definition | Ad Value |
|---------|-----------|----------|
| Fitness Enthusiasts | >40% fitness content | Supplements, activewear, gym apps |
| Foodies | >40% food/cooking content | Meal kits, kitchen gadgets, cookbooks |
| Fashion Forward | >40% fashion/beauty content | DTC brands, beauty subscriptions |
| Tech Early Adopters | >40% tech content | SaaS tools, gadgets, courses |
| Finance Focused | >40% finance content | Fintech, investing platforms |
| High Engagement | Top 20% engagement score | Premium ad placements |

---

## Phase 3: Monetization — Targeted Newsletter Ads

### 3.1 Ad Insertion in Digests
Add a sponsored content section to the digest email template:
- 1 ad slot per digest (non-intrusive, matches email design)
- Targeted based on user's interest profile
- Clearly labeled as "Sponsored" for trust

### 3.2 Ad Matching System

```
Advertiser defines:
  - Target categories (e.g., ["fitness", "health"])
  - Target demographics (age, gender, location)
  - Budget (CPM or CPC)
  - Creative (image + copy + link)

System matches:
  - User interest profile overlaps with ad targets
  - Demographic match
  - Engagement score threshold (advertisers pay more for engaged users)
```

### 3.3 Pricing Model
- **CPM (cost per 1,000 impressions)**: $15-50 depending on segment specificity
- **CPC (cost per click)**: $1-5 depending on category
- Premium for high-engagement users and narrow targeting

### 3.4 Database Schema for Ads

```sql
CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name VARCHAR(255) NOT NULL,
  target_categories TEXT[] DEFAULT '{}',
  target_age_ranges TEXT[] DEFAULT '{}',
  target_genders TEXT[] DEFAULT '{}',
  target_countries TEXT[] DEFAULT '{}',
  budget_cents INTEGER NOT NULL,
  spent_cents INTEGER DEFAULT 0,
  pricing_model VARCHAR(10) NOT NULL, -- 'cpm' or 'cpc'
  rate_cents INTEGER NOT NULL, -- CPM rate or CPC rate
  image_url TEXT,
  headline VARCHAR(255),
  body_text TEXT,
  cta_url TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES ad_campaigns(id),
  user_id UUID REFERENCES users(id),
  digest_id UUID REFERENCES digests(id),
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  clicked_at TIMESTAMPTZ
);
```

---

## Phase 4: Data Packaging for Investors / Partners

### 4.1 Aggregate Analytics Dashboard (Internal)
Build a `/admin/analytics` page showing:
- Total users, growth rate
- Posts saved per day/week (content velocity)
- Category distribution across all users
- Top trending tags this week
- Email open rates and click-through rates
- Revenue metrics (subscriptions + ad revenue)
- Cohort retention curves

### 4.2 Investor Data Deck — Key Metrics to Highlight

| Metric | Why It Matters |
|--------|---------------|
| **Save intent signal** | Saves > likes. Each data point is a deliberate action. |
| **Interest accuracy** | We know categories with high confidence from actual saved content, not inferred from browsing. |
| **Category distribution** | Shows market breadth — we cover many verticals. |
| **Engagement rates** | Email open/click rates prove users value the product. |
| **Content velocity** | Posts saved/day shows active usage and growing dataset. |
| **Demographic + interest overlap** | "We have 500 women aged 25-34 interested in fitness" — that's a media buyer's dream. |

### 4.3 Anonymized Data Products (Future)
Sell aggregate trend reports to brands/agencies:
- "What content categories are trending among 25-34 year olds this month?"
- "Which Instagram creators drive the most saves in the fitness category?"
- "Content format preferences by demographic (reels vs. carousels)"

**All data sold in aggregate only — never individual user data.**

---

## Privacy & Compliance

- Update **Terms of Service** and **Privacy Policy** to cover data usage for ads and anonymized analytics
- Add opt-out mechanism for targeted ads (users can switch to generic ads)
- Never sell individual user data — only aggregated/anonymized insights
- GDPR/CCPA compliance: data deletion requests, export functionality
- Store consent timestamps for each data collection point

---

## Implementation Priority

1. **Now**: Add category/tag extraction to AI summarization (small prompt change)
2. **Now**: Integrate Resend open/click webhooks
3. **Soon**: Add demographic fields to onboarding flow
4. **Soon**: Build user interest profiles (nightly batch job via Inngest)
5. **Later**: Ad campaign system + ad insertion in digest template
6. **Later**: Admin analytics dashboard
7. **Later**: Anonymized trend reports for partners
