import { ArrowLeft, Map } from "lucide-react";
import { Link } from "react-router-dom";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Map className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-700 text-foreground">Dronie</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-muted-foreground">Terms of Service</span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        <h1 className="font-display font-700 text-3xl text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>By accessing or using Dronie ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
            <p>Dronie provides cloud-based drone photogrammetry processing services, including but not limited to orthomosaic generation, point cloud creation, digital surface models, flight planning, and map viewing tools.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. User Accounts</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activities that occur under your account.</li>
              <li>You must be at least 18 years old to use the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. User Content & Data</h2>
            <p>You retain ownership of all drone imagery, flight plans, and other data you upload to the Service. By using the Service, you grant Dronie a limited license to process, store, and display your content solely for the purpose of providing the Service to you.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the Service for any unlawful purpose or in violation of aviation regulations.</li>
              <li>Upload malicious files, viruses, or harmful code.</li>
              <li>Attempt to gain unauthorized access to other users' accounts or data.</li>
              <li>Use the Service to process imagery obtained in violation of privacy laws or airspace regulations.</li>
              <li>Resell or redistribute the Service without authorization.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Service Availability</h2>
            <p>We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable for maintenance, updates, or circumstances beyond our control. We are not liable for any loss resulting from service interruptions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Payment & Billing</h2>
            <p>Certain features of the Service require a paid subscription. Fees are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law. We reserve the right to change pricing with 30 days' notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Dronie shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, profits, or business opportunities arising from your use of the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Termination</h2>
            <p>We may suspend or terminate your account if you violate these Terms. You may delete your account at any time. Upon termination, your project data will be retained for 30 days before permanent deletion, unless otherwise required by law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Changes to Terms</h2>
            <p>We reserve the right to modify these Terms at any time. We will notify users of material changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Contact</h2>
            <p>For questions about these Terms, contact us at <span className="text-primary font-medium">legal@dronie.app</span>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
