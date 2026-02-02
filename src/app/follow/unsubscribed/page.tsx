import Link from 'next/link'

export default function FollowUnsubscribedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Unsubscribed
        </h1>
        <p className="text-gray-500 mb-6">
          You've been removed from this digest and won't receive it anymore.
        </p>
        <Link
          href="/"
          className="text-instagram-pink font-semibold hover:underline"
        >
          Back to urdigest
        </Link>
      </div>
    </div>
  )
}
