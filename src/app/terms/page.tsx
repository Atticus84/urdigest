import Link from 'next/link'
import { SUPPORT_EMAIL } from '@/lib/constants'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/" className="text-instagram-pink hover:underline mb-8 inline-block">
          ← Back to home
        </Link>

        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-gray-600 mb-8">Last updated: January 29, 2026</p>

        <div className="prose prose-lg max-w-none">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using urdigest ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            urdigest provides a service that collects Instagram posts shared to @urdigest via direct message and delivers AI-summarized email digests to users.
          </p>

          <h2>3. User Accounts</h2>
          <ul>
            <li>You must provide accurate and complete information when creating an account</li>
            <li>You are responsible for maintaining the security of your account</li>
            <li>You must be at least 13 years old to use the Service</li>
            <li>One account per person</li>
          </ul>

          <h2>4. Subscription and Payments</h2>
          <ul>
            <li><strong>Free Trial:</strong> Your first digest is free, no credit card required</li>
            <li><strong>Paid Subscription:</strong> After your first digest, continue for $5/month</li>
            <li><strong>Billing:</strong> Subscriptions auto-renew monthly until canceled</li>
            <li><strong>Cancellation:</strong> Cancel anytime from your dashboard. No partial refunds for the current billing period</li>
            <li><strong>Payment Processing:</strong> All payments processed securely through Stripe</li>
          </ul>

          <h2>5. User Responsibilities</h2>
          <p>You agree to:</p>
          <ul>
            <li>Use the Service only for lawful purposes</li>
            <li>Not abuse or overload the Service</li>
            <li>Respect Instagram's Terms of Service when sharing content</li>
            <li>Not share content you don't have permission to access</li>
            <li>Not attempt to circumvent payment or subscription limits</li>
          </ul>

          <h2>6. Instagram Integration</h2>
          <p>
            <strong>Important:</strong> urdigest works by receiving Instagram posts you share via direct message. By using this Service, you acknowledge that:
          </p>
          <ul>
            <li>We only access posts you explicitly share to @urdigest</li>
            <li>You are responsible for complying with Instagram's Terms of Service</li>
            <li>We cannot guarantee uninterrupted service if Instagram changes their policies or API</li>
            <li>Sharing posts from private accounts may not work properly</li>
          </ul>

          <h2>7. Intellectual Property</h2>
          <ul>
            <li><strong>Your Content:</strong> You retain all rights to the Instagram posts you share</li>
            <li><strong>AI Summaries:</strong> We generate summaries for your personal use only</li>
            <li><strong>Our Service:</strong> urdigest and its original content remain our property</li>
          </ul>

          <h2>8. Limitation of Liability</h2>
          <p>
            urdigest is provided "as is" without warranties of any kind. We are not liable for:
          </p>
          <ul>
            <li>Service interruptions or downtime</li>
            <li>Loss of data or content</li>
            <li>Actions taken by Instagram or other third parties</li>
            <li>Inaccuracies in AI-generated summaries</li>
            <li>Any damages arising from use of the Service</li>
          </ul>

          <h2>9. Service Modifications</h2>
          <p>
            We reserve the right to:
          </p>
          <ul>
            <li>Modify or discontinue the Service at any time</li>
            <li>Change pricing with 30 days notice</li>
            <li>Update these Terms of Service (users will be notified)</li>
          </ul>

          <h2>10. Termination</h2>
          <p>
            We may terminate or suspend your account if you:
          </p>
          <ul>
            <li>Violate these Terms of Service</li>
            <li>Engage in abusive or fraudulent behavior</li>
            <li>Fail to pay subscription fees</li>
          </ul>
          <p>
            You may terminate your account at any time from your dashboard.
          </p>

          <h2>11. Data and Privacy</h2>
          <p>
            Your use of the Service is also governed by our{' '}
            <Link href="/privacy" className="text-instagram-pink hover:underline">
              Privacy Policy
            </Link>
            , which explains how we collect, use, and protect your data.
          </p>

          <h2>12. Refund Policy</h2>
          <ul>
            <li><strong>Trial:</strong> First digest is free</li>
            <li><strong>Monthly Subscription:</strong> No refunds for partial months</li>
            <li><strong>Cancellation:</strong> Access continues until end of billing period</li>
            <li><strong>Exceptions:</strong> Refunds considered on a case-by-case basis for technical issues</li>
          </ul>

          <h2>13. Dispute Resolution</h2>
          <p>
            Any disputes arising from these Terms will be resolved through binding arbitration in accordance with the laws of the United States.
          </p>

          <h2>14. Contact</h2>
          <p>
            For questions about these Terms of Service, contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>

          <h2>15. Entire Agreement</h2>
          <p>
            These Terms of Service, together with our Privacy Policy, constitute the entire agreement between you and urdigest.
          </p>
        </div>
      </div>
    </div>
  )
}
