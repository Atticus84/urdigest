# Debugging Instagram API Usage

## Problem
Your Instagram API is being consumed (34% of limit) even though you're not actively using the app.

## Root Causes

### 1. **Webhook Events Triggering Responses**
Every time your Instagram webhook receives an event, it may send a response message, which consumes API quota:
- New user onboarding messages
- Command responses (help, status, pause, resume)
- Post save confirmations
- Error messages

### 2. **Possible Sources of Webhook Events**
- **Test events from Meta**: Meta may send test webhook events
- **Duplicate deliveries**: Meta sometimes sends the same event multiple times
- **Non-message events**: Events like `message_edit`, `message_reactions` that shouldn't trigger responses
- **Users messaging but not actively using**: Users who messaged once but aren't actively using the app

## Solutions Implemented

### 1. **Message Deduplication**
- Added tracking of processed message IDs to prevent processing the same message twice
- Prevents duplicate API calls from webhook retries

### 2. **Better Logging**
- All Instagram API calls are now logged with timestamps and message previews
- Webhook events are logged with event type counts
- Non-message events are clearly marked as skipped

### 3. **Disable Messages Mode**
- Set `INSTAGRAM_DISABLE_MESSAGES=true` in your environment variables to disable all message sending
- Useful for debugging without consuming API quota
- Messages will be logged but not sent

## How to Debug

### Step 1: Check Your Logs
Look at your Vercel logs (or wherever you're hosting) for:
- `📥 Instagram webhook POST received` - Shows when webhooks are received
- `✅ Instagram API call successful` - Shows when API calls are made
- `⏭️ Skipping duplicate message` - Shows duplicate messages being filtered

### Step 2: Temporarily Disable Messages
Add to your `.env` or Vercel environment variables:
```bash
INSTAGRAM_DISABLE_MESSAGES=true
```

This will:
- Log all messages that would be sent
- Prevent actual API calls
- Help you see what's triggering responses

### Step 3: Check Webhook Subscriptions
In your Meta App Dashboard:
1. Go to Webhooks → Instagram
2. Check what events you're subscribed to
3. Consider unsubscribing from events you don't need (like `message_edit`, `message_reactions`)

### Step 4: Review Recent Webhook Activity
Check your logs for patterns:
- Are you receiving many webhook calls?
- What event types are being received?
- Are there duplicate message IDs?

## Monitoring API Usage

### Check Instagram API Usage
1. Go to Meta App Dashboard
2. Navigate to your app → Settings → Basic
3. Check "Application Rate Limit" section
4. Review usage over time

### Track in Your Logs
The improved logging will show:
- When each API call is made
- What message was sent
- To which recipient
- Whether it succeeded or failed

## Best Practices

1. **Only subscribe to needed webhook events** - Unsubscribe from events you don't use
2. **Monitor your logs regularly** - Check for unexpected webhook activity
3. **Use disable mode for testing** - Set `INSTAGRAM_DISABLE_MESSAGES=true` when testing
4. **Review user activity** - Check if inactive users are triggering responses

## Environment Variables

```bash
# Disable Instagram messaging (for debugging)
INSTAGRAM_DISABLE_MESSAGES=true

# Your existing Instagram config
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=...
INSTAGRAM_PAGE_ID=...
```

## Next Steps

1. **Deploy the changes** - The improved logging and deduplication are now in place
2. **Monitor logs** - Watch for a few days to see what's triggering API calls
3. **Review webhook subscriptions** - Remove unnecessary event subscriptions
4. **Consider rate limiting** - If needed, add rate limiting to prevent excessive responses
