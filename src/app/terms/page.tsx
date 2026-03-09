import Link from "next/link";

export const metadata = {
  title: "Terms of Service - ContentFlow",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        &larr; Back to home
      </Link>

      <h1 className="mt-8 text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: March 9, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">1. Acceptance of Terms</h2>
          <p>
            By accessing or using ContentFlow at dotdasher.com (&quot;the Service&quot;), you agree to be bound
            by these Terms of Service. If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">2. Description of Service</h2>
          <p>
            ContentFlow is a web application that helps you convert YouTube video content into
            blog-ready articles. The Service imports video metadata and captions from your YouTube
            channel, generates content drafts using AI, and provides editing and export tools.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">3. Accounts</h2>
          <p>You must sign in with a Google account to use the Service. You are responsible for maintaining the security of your account and for all activity that occurs under it.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">4. Your Content</h2>
          <p>You retain ownership of all content you create using the Service, including edited drafts and exports. You grant us a limited license to store and process your content solely to provide the Service to you.</p>
          <p className="mt-2">You are responsible for ensuring you have the right to use and repurpose the video content you import. ContentFlow does not claim ownership over your YouTube videos or the content derived from them.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">5. YouTube Data</h2>
          <p>The Service accesses your YouTube data through the YouTube Data API. By using the Service, you also agree to be bound by the <a href="https://www.youtube.com/t/terms" className="underline hover:text-zinc-900 dark:hover:text-zinc-100" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">6. AI-Generated Content</h2>
          <p>The Service uses AI to clean transcripts and generate draft content. AI-generated output may contain errors or inaccuracies. You are responsible for reviewing and editing all content before publishing.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">7. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li>Use the Service for any unlawful purpose</li>
            <li>Import content you do not have rights to</li>
            <li>Attempt to gain unauthorized access to the Service or its systems</li>
            <li>Interfere with or disrupt the Service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">8. Limitation of Liability</h2>
          <p>The Service is provided &quot;as is&quot; without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">9. Termination</h2>
          <p>We may suspend or terminate your access to the Service at any time for violation of these terms. You may stop using the Service and request deletion of your data at any time.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">10. Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">11. Contact</h2>
          <p>For questions about these terms, contact us at <a href="mailto:support@dotdasher.com" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">support@dotdasher.com</a>.</p>
        </section>
      </div>
    </div>
  );
}
