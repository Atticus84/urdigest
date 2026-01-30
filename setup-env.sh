#!/bin/bash

# urdigest Local Environment Setup Script
# This script helps you configure your .env.local file

echo "🚀 urdigest - Local Environment Setup"
echo "======================================"
echo ""

# Check if .env.local exists
if [ -f .env.local ]; then
    echo "⚠️  .env.local already exists!"
    read -p "Do you want to overwrite it? (yes/no): " overwrite
    if [ "$overwrite" != "yes" ]; then
        echo "Setup cancelled."
        exit 0
    fi
    cp .env.local .env.local.backup
    echo "✅ Backup created: .env.local.backup"
fi

echo ""
echo "📋 We'll collect credentials from 5 services:"
echo "   1. Supabase (Database + Auth)"
echo "   2. Stripe (Payments)"
echo "   3. OpenAI (AI Summarization)"
echo "   4. Resend (Email Delivery)"
echo "   5. Inngest (Background Jobs)"
echo ""
read -p "Press Enter to continue..."

# Supabase
echo ""
echo "1️⃣  SUPABASE SETUP"
echo "==================="
echo "Go to: https://supabase.com/dashboard"
echo "Navigate to: Settings → API"
echo ""
read -p "Enter your Supabase Project URL: " SUPABASE_URL
read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
read -p "Enter your Supabase Service Role Key: " SUPABASE_SERVICE_KEY

# Stripe
echo ""
echo "2️⃣  STRIPE SETUP (Test Mode)"
echo "============================="
echo "Go to: https://dashboard.stripe.com/test/apikeys"
echo ""
read -p "Enter your Stripe Publishable Key (pk_test_...): " STRIPE_PUB_KEY
read -p "Enter your Stripe Secret Key (sk_test_...): " STRIPE_SECRET_KEY
echo ""
echo "Now create a product:"
echo "Go to: https://dashboard.stripe.com/test/products"
echo "Create a product: 'urdigest Premium' at $5/month"
echo ""
read -p "Enter your Stripe Price ID (price_...): " STRIPE_PRICE_ID
echo ""
echo "Note: Webhook secret will be configured after first deployment"
STRIPE_WEBHOOK_SECRET=""

# OpenAI
echo ""
echo "3️⃣  OPENAI SETUP"
echo "================"
echo "Go to: https://platform.openai.com/api-keys"
echo ""
read -p "Enter your OpenAI API Key (sk-...): " OPENAI_KEY

# Resend
echo ""
echo "4️⃣  RESEND SETUP"
echo "================"
echo "Go to: https://resend.com/api-keys"
echo ""
read -p "Enter your Resend API Key (re_...): " RESEND_KEY

# Inngest
echo ""
echo "5️⃣  INNGEST SETUP"
echo "================="
echo "Go to: https://app.inngest.com/settings/keys"
echo ""
read -p "Enter your Inngest Event Key: " INNGEST_EVENT_KEY
read -p "Enter your Inngest Signing Key: " INNGEST_SIGNING_KEY

# Write .env.local
echo ""
echo "✍️  Writing .env.local file..."

cat > .env.local << EOF
# Supabase
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY

# Stripe
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$STRIPE_PUB_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID=$STRIPE_PRICE_ID

# OpenAI
OPENAI_API_KEY=$OPENAI_KEY

# Resend
RESEND_API_KEY=$RESEND_KEY

# Inngest
INNGEST_EVENT_KEY=$INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY=$INNGEST_SIGNING_KEY

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
EOF

echo ""
echo "✅ .env.local file created successfully!"
echo ""
echo "📝 IMPORTANT NEXT STEPS:"
echo "========================"
echo ""
echo "1. Run the database migration in Supabase:"
echo "   - Go to: $SUPABASE_URL (SQL Editor)"
echo "   - Copy contents of: supabase/migrations/001_initial_schema.sql"
echo "   - Paste and execute"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Open: http://localhost:3000"
echo ""
echo "🎉 Setup complete! Happy coding!"
