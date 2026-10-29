import { LegalPage, LegalSection, legalLink } from "@/components/site/legal-page";

export const metadata = {
  title: "Privacy policy - ContentFlow",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="March 9, 2026" updatedIso="2026-03-09">
      <LegalSection title="Overview">
        <p>
          ContentFlow (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates at dotdasher.com. This policy
          explains how we collect, use, and protect your information when you use our service.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p><strong>Account information:</strong> When you sign in with Google, we receive your name, email address, and profile picture from your Google account.</p>
        <p><strong>YouTube data:</strong> With your permission, we access your YouTube channel information, playlists, video metadata, and captions using the YouTube Data API. This data is used solely to generate content drafts within the app. We access this data in read-only mode and never modify your YouTube account.</p>
        <p><strong>Content you create:</strong> Drafts, edits, and exports you create within ContentFlow are stored in our database and associated with your workspace.</p>
      </LegalSection>

      <LegalSection title="How we use your information">
        <ul className="list-disc space-y-2 pl-5">
          <li>Authenticate your identity and manage your account</li>
          <li>Import your YouTube video library and captions</li>
          <li>Generate and store content drafts based on your videos</li>
          <li>Provide the core functionality of the service</li>
        </ul>
        <p>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
      </LegalSection>

      <LegalSection title="Third-party services">
        <p>We use the following third-party services:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Google OAuth &amp; YouTube Data API:</strong> For authentication and accessing your YouTube data. Google&apos;s privacy policy applies to data collected by Google. See <a href="https://policies.google.com/privacy" className={legalLink} target="_blank" rel="noopener noreferrer">Google&apos;s Privacy Policy</a>.</li>
          <li><strong>OpenAI:</strong> Video transcripts may be sent to OpenAI&apos;s API for cleanup and content generation. See <a href="https://openai.com/privacy" className={legalLink} target="_blank" rel="noopener noreferrer">OpenAI&apos;s Privacy Policy</a>.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Google API Services User Data Policy">
        <p>
          ContentFlow&apos;s use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className={legalLink} target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection title="Data storage and security">
        <p>Your data is stored on secured servers. We use encryption in transit (HTTPS) and follow industry-standard security practices. Access to user data is restricted to authenticated users within their workspace.</p>
      </LegalSection>

      <LegalSection title="Data retention and deletion">
        <p>You can delete your account and all associated data at any time by contacting us. When you delete your account, we remove all your personal information, YouTube data, and content from our servers.</p>
      </LegalSection>

      <LegalSection title="Revoking access">
        <p>
          You can revoke ContentFlow&apos;s access to your Google account at any time through your <a href="https://myaccount.google.com/permissions" className={legalLink} target="_blank" rel="noopener noreferrer">Google Account permissions</a> page.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>We may update this policy from time to time. We will notify users of significant changes by posting a notice on the site.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>For questions about this privacy policy or your data, contact us at <a href="mailto:privacy@dotdasher.com" className={legalLink}>privacy@dotdasher.com</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
