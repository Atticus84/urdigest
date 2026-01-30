import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link href="/" className="text-instagram-pink hover:underline mb-8 inline-block">
          ← Back to home
        </Link>

        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-gray-600 mb-8">Last updated: January 29, 2026</p>

        <div className="prose prose-lg max-w-none">
          <h2>1. Information We Collect</h2>
          <p>
            When you use urdigest, we collect the following information:
          </p>
          <ul>
            <li><strong>Account Information:</strong> Email address, password (encrypted)</li>
            <li><strong>Instagram Posts:</strong> URLs, captions, author usernames, and thumbnails of posts you share to @urdigest</li>
            <li><strong>Usage Data:</strong> Number of posts saved, digests sent, and subscription status</li>
            <li><strong>Payment Information:</strong> Processed securely by Stripe (we never see your card details)</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Send you daily email digests of your saved posts</li>
            <li>Generate AI summaries of your saved content</li>
            <li>Process payments and manage subscriptions</li>
            <li>Improve our service and user experience</li>
            <li>Send important service updates and notifications</li>
          </ul>

          <h2>3. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul>
            <li><strong>Supabase:</strong> Database and authentication</li>
            <li><strong>Stripe:</strong> Payment processing</li>
            <li><strong>OpenAI:</strong> AI-powered summarization</li>
            <li><strong>Resend:</strong> Email delivery</li>
          </ul>
          <p>Each service has its own privacy policy governing how they handle your data.</p>

          <h2>4. Data Storage and Security</h2>
          <p>
            Your data is stored securely in encrypted databases. We use industry-standard security measures to protect your information, including:
          </p>
          <ul>
            <li>HTTPS/TLS encryption for all data in transit</li>
            <li>Encrypted database storage</li>
            <li>Secure authentication with hashed passwords</li>
          </ul>

          <h2>5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your data</li>
            <li><strong>Delete:</strong> Request deletion of your account and all associated data</li>
            <li><strong>Export:</strong> Download your saved posts as JSON/CSV</li>
            <li><strong>Opt-out:</strong> Disable digests or delete your account at any time</li>
          </ul>

          <h2>6. Data Retention</h2>
          <ul>
            <li><strong>Saved Posts:</strong> Retained until you delete them or close your account</li>
            <li><strong>Digests:</strong> Email content deleted after 90 days (metadata retained)</li>
            <li><strong>Account Data:</strong> Deleted within 30 days of account closure</li>
          </ul>

          <h2>7. Cookies</h2>
          <p>
            We use essential cookies for authentication and session management. We do not use tracking or advertising cookies.
          </p>

          <h2>8. Children's Privacy</h2>
          <p>
            urdigest is not intended for users under 13 years of age. We do not knowingly collect information from children.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you of significant changes via email.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have questions about this privacy policy or your data, contact us at{' '}
            <a href="mailto:archontechnologiesllc@gmail.com">archontechnologiesllc@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}
