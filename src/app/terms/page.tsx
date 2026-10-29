import { LegalPage, LegalSection, legalLink } from "@/components/site/legal-page";

export const metadata = {
  title: "Terms of service - ContentFlow",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="March 9, 2026" updatedIso="2026-03-09">
      <LegalSection title="1. Acceptance of terms">
        <p>
          By accessing or using ContentFlow at dotdasher.com (&quot;the Service&quot;), you agree to be bound
          by these Terms of Service. If you do not agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. Description of service">
        <p>
          ContentFlow is a web application that helps you convert YouTube video content into
          blog-ready articles. The Service imports video metadata and captions from your YouTube
          channel, generates content drafts using AI, and provides editing and export tools.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts">
        <p>You must sign in with a Google account to use the Service. You are responsible for maintaining the security of your account and for all activity that occurs under it.</p>
      </LegalSection>

      <LegalSection title="4. Your content">
        <p>You retain ownership of all content you create using the Service, including edited drafts and exports. You grant us a limited license to store and process your content solely to provide the Service to you.</p>
        <p>You are responsible for ensuring you have the right to use and repurpose the video content you import. ContentFlow does not claim ownership over your YouTube videos or the content derived from them.</p>
      </LegalSection>

      <LegalSection title="5. YouTube data">
        <p>The Service accesses your YouTube data through the YouTube Data API. By using the Service, you also agree to be bound by the <a href="https://www.youtube.com/t/terms" className={legalLink} target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>.</p>
      </LegalSection>

      <LegalSection title="6. AI-generated content">
        <p>The Service uses AI to clean transcripts and generate draft content. AI-generated output may contain errors or inaccuracies. You are responsible for reviewing and editing all content before publishing.</p>
      </LegalSection>

      <LegalSection title="7. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use the Service for any unlawful purpose</li>
          <li>Import content you do not have rights to</li>
          <li>Attempt to gain unauthorized access to the Service or its systems</li>
          <li>Interfere with or disrupt the Service</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Limitation of liability">
        <p>The Service is provided &quot;as is&quot; without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
      </LegalSection>

      <LegalSection title="9. Termination">
        <p>We may suspend or terminate your access to the Service at any time for violation of these terms. You may stop using the Service and request deletion of your data at any time.</p>
      </LegalSection>

      <LegalSection title="10. Changes to terms">
        <p>We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>For questions about these terms, contact us at <a href="mailto:support@dotdasher.com" className={legalLink}>support@dotdasher.com</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
