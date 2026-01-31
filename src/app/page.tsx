import Link from 'next/link'
import { SUPPORT_EMAIL } from '@/lib/constants'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">📧</span>
              <span className="text-xl font-bold bg-gradient-to-r from-instagram-pink to-instagram-purple bg-clip-text text-transparent">
                urdigest
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="bg-instagram-pink text-white px-4 py-2 rounded-lg font-medium hover:bg-instagram-pink/90 transition"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
            Turn Instagram Saves into
            <br />
            <span className="bg-gradient-to-r from-instagram-pink via-instagram-purple to-instagram-orange bg-clip-text text-transparent">
              Daily Email Digests
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Stop letting saved posts pile up. Get AI-summarized digests of your Instagram saves delivered every morning.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="bg-instagram-pink text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-instagram-pink/90 transition shadow-lg"
            >
              Start Free Trial
            </Link>
            <Link
              href="#how-it-works"
              className="bg-white text-gray-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-50 transition border-2 border-gray-200"
            >
              Learn More
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            First digest free. Then $5/month.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">1️⃣</div>
            <h3 className="text-xl font-semibold mb-3">Share Posts</h3>
            <p className="text-gray-600">
              Share Instagram posts to @urdigest throughout the day via DM.
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">2️⃣</div>
            <h3 className="text-xl font-semibold mb-3">AI Summarizes</h3>
            <p className="text-gray-600">
              Our AI reads each post and creates engaging summaries highlighting key insights.
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">3️⃣</div>
            <h3 className="text-xl font-semibold mb-3">Wake Up to Your Digest</h3>
            <p className="text-gray-600">
              Get a beautiful email digest every morning at 6am with all your saved posts.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Why urdigest?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="text-2xl">🤖</div>
              <div>
                <h3 className="font-semibold text-lg mb-2">AI-Powered Summaries</h3>
                <p className="text-gray-600">
                  Get concise, engaging summaries that highlight what makes each post valuable.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-2xl">⏰</div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Daily Delivery</h3>
                <p className="text-gray-600">
                  Wake up to a digest of yesterday's saves, delivered fresh every morning.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-2xl">📱</div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Simple Workflow</h3>
                <p className="text-gray-600">
                  Just share posts to @urdigest. No app switching, no manual copying.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-2xl">✨</div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Beautiful Emails</h3>
                <p className="text-gray-600">
                  Gorgeous, mobile-friendly emails with images, summaries, and direct links.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Simple Pricing</h2>
        <p className="text-gray-600 text-center mb-12">Try it free, then just $5/month</p>
        <div className="max-w-md mx-auto">
          <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-instagram-pink">
            <div className="text-center mb-6">
              <div className="text-5xl font-bold text-gray-900 mb-2">
                $5<span className="text-2xl text-gray-500">/month</span>
              </div>
              <p className="text-gray-600">First digest free</p>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Unlimited saved posts</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>AI-powered summaries</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Daily email digests</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Cancel anytime</span>
              </li>
            </ul>
            <Link
              href="/signup"
              className="block w-full bg-instagram-pink text-white text-center px-6 py-3 rounded-lg font-semibold hover:bg-instagram-pink/90 transition"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">FAQ</h2>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">How do I share posts?</h3>
              <p className="text-gray-600">
                Simply share any Instagram post to @urdigest via DM. We'll collect them and send your digest the next morning.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">What time is the digest sent?</h3>
              <p className="text-gray-600">
                Every morning at 6am in your timezone. You can customize this in settings.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-600">
                Yes! Cancel anytime from your dashboard. No questions asked.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">What if I don't save any posts?</h3>
              <p className="text-gray-600">
                No problem! We'll skip that day and only send digests when you have new posts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-instagram-pink to-instagram-purple rounded-2xl p-12 text-center text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to transform your Instagram saves?</h2>
          <p className="text-xl mb-8 opacity-90">
            Get your first digest free. No credit card required.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-instagram-pink px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition"
          >
            Start Free Trial →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">📧</span>
              <span className="text-xl font-bold">urdigest</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-600">
              <Link href="/privacy" className="hover:text-gray-900">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-gray-900">
                Terms
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-gray-900">
                Contact
              </a>
            </div>
            <div className="text-sm text-gray-500">
              © 2026 urdigest. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
