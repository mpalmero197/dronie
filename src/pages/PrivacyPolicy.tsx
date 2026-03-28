import { ArrowLeft, Map } from "lucide-react";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
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
          <span className="text-sm text-muted-foreground">Privacy Policy</span>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        <h1 className="font-display font-700 text-3xl text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
            <p>When you use Dronie, we may collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Account Information:</strong> Name, email address, and password when you create an account.</li>
              <li><strong className="text-foreground">Project Data:</strong> Drone images, flight plans, map data, and processing outputs you upload or generate.</li>
              <li><strong className="text-foreground">Usage Data:</strong> Information about how you interact with our services, including pages visited, features used, and session duration.</li>
              <li><strong className="text-foreground">Device Information:</strong> Browser type, operating system, and device identifiers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
            <p>We use the collected information to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide, maintain, and improve our drone photogrammetry processing services.</li>
              <li>Process your drone imagery and generate orthomosaics, point clouds, and other outputs.</li>
              <li>Communicate with you about your account, projects, and service updates.</li>
              <li>Ensure the security and integrity of our platform.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Data Storage & Security</h2>
            <p>Your project data, including uploaded images and processing outputs, is stored securely in cloud infrastructure. We implement industry-standard encryption, access controls, and monitoring to protect your data. However, no method of electronic storage is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Data Sharing</h2>
            <p>We do not sell your personal information. We may share data with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Service Providers:</strong> Third-party services that help us operate the platform (cloud hosting, analytics).</li>
              <li><strong className="text-foreground">Legal Requirements:</strong> When required by law, regulation, or legal process.</li>
              <li><strong className="text-foreground">With Your Consent:</strong> When you explicitly share projects or maps via public links.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. You may also request a copy of your data or withdraw consent for data processing. To exercise these rights, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We may also use analytics cookies to understand usage patterns. You can manage cookie preferences in your browser settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on our website or sending you an email.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us at <span className="text-primary font-medium">privacy@dronie.app</span>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
