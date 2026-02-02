import Link from 'next/link'

export default function FollowConfirmedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">&#10003;</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You're subscribed
        </h1>
        <p className="text-gray-500 mb-6">
          Your email has been confirmed. You'll receive this digest whenever it's sent.
        </p>
        <Link
          href="/"
          className="text-instagram-pink font-semibold hover:underline"
        >
          Learn more about urdigest
        </Link>
      </div>
    </div>
  )
}
