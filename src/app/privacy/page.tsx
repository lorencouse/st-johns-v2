import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - ContentFlow",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        &larr; Back to home
      </Link>

      <h1 className="mt-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: March 9, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Overview</h2>
          <p>
            ContentFlow (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates at dotdasher.com. This policy
            explains how we collect, use, and protect your information when you use our service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Information We Collect</h2>
          <p><strong>Account information:</strong> When you sign in with Google, we receive your name, email address, and profile picture from your Google account.</p>
          <p className="mt-2"><strong>YouTube data:</strong> With your permission, we access your YouTube channel information, playlists, video metadata, and captions using the YouTube Data API. This data is used solely to generate content drafts within the app. We access this data in read-only mode and never modify your YouTube account.</p>
          <p className="mt-2"><strong>Content you create:</strong> Drafts, edits, and exports you create within ContentFlow are stored in our database and associated with your workspace.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">How We Use Your Information</h2>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li>Authenticate your identity and manage your account</li>
            <li>Import your YouTube video library and captions</li>
            <li>Generate and store content drafts based on your videos</li>
            <li>Provide the core functionality of the service</li>
          </ul>
          <p className="mt-2">We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li><strong>Google OAuth &amp; YouTube Data API:</strong> For authentication and accessing your YouTube data. Google&apos;s privacy policy applies to data collected by Google. See <a href="https://policies.google.com/privacy" className="underline hover:text-zinc-900 dark:hover:text-zinc-100" target="_blank" rel="noopener noreferrer">Google&apos;s Privacy Policy</a>.</li>
            <li><strong>OpenAI:</strong> Video transcripts may be sent to OpenAI&apos;s API for cleanup and content generation. See <a href="https://openai.com/privacy" className="underline hover:text-zinc-900 dark:hover:text-zinc-100" target="_blank" rel="noopener noreferrer">OpenAI&apos;s Privacy Policy</a>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Google API Services User Data Policy</h2>
          <p>
            ContentFlow&apos;s use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="underline hover:text-zinc-900 dark:hover:text-zinc-100" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Data Storage and Security</h2>
          <p>Your data is stored on secured servers. We use encryption in transit (HTTPS) and follow industry-standard security practices. Access to user data is restricted to authenticated users within their workspace.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Data Retention and Deletion</h2>
          <p>You can delete your account and all associated data at any time by contacting us. When you delete your account, we remove all your personal information, YouTube data, and content from our servers.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Revoking Access</h2>
          <p>
            You can revoke ContentFlow&apos;s access to your Google account at any time through your <a href="https://myaccount.google.com/permissions" className="underline hover:text-zinc-900 dark:hover:text-zinc-100" target="_blank" rel="noopener noreferrer">Google Account permissions</a> page.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Changes to This Policy</h2>
          <p>We may update this policy from time to time. We will notify users of significant changes by posting a notice on the site.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Contact</h2>
          <p>For questions about this privacy policy or your data, contact us at <a href="mailto:privacy@dotdasher.com" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">privacy@dotdasher.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
