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
            <p className="mt-2">Dronie is a product of <strong className="text-foreground">Halcyon Systems Group</strong> ("the Company", "we", "us", or "our"). All references to Dronie in these Terms include Halcyon Systems Group as the operating entity behind the Service.</p>
            <p className="mt-2">These Terms constitute a legally binding agreement between you (whether an individual, sole proprietor, business entity, or government agency) and Halcyon Systems Group. If you are accepting these Terms on behalf of a company or other legal entity, you represent and warrant that you have full authority to bind that entity to these Terms, and the words "you" and "your" shall refer to that entity. If you do not have such authority, you must not accept these Terms or use the Service.</p>
            <p className="mt-2">You must be at least eighteen (18) years of age and legally able to form a binding contract under the laws of your jurisdiction to use the Service. The Service is not directed to children under 13 (or 16 in the EEA/UK), and we do not knowingly collect personal information from such children.</p>
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
            <p className="mt-2">You represent and warrant that (a) you own or have all necessary rights, licenses, consents, releases, and permissions to upload and process the content you submit to the Service; (b) the content does not and will not infringe, misappropriate, or violate any third party's intellectual property, privacy, publicity, contractual, or other rights, nor any applicable law or regulation; (c) you have obtained any required consents from individuals depicted, property owners, and any data subjects whose personal data may be present in your imagery; and (d) the imagery was captured in compliance with all applicable aviation, privacy, trespass, surveillance, export-control, and airspace regulations.</p>
            <p className="mt-2">You grant Halcyon Systems Group a worldwide, royalty-free, non-exclusive license to host, copy, transmit, transcode, process, cache, back up, and display your content solely as required to operate, secure, and improve the Service, to enforce these Terms, and to comply with legal obligations. We will not sell your content or use it for advertising. Aggregated, de-identified, or statistical data derived from Service usage may be used by us for analytics, benchmarking, and product improvement.</p>
            <p className="mt-2">You are solely responsible for maintaining your own backups of any content you submit. We may, but are not obligated to, retain backups for our operational purposes.</p>
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
              <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive source code from the Service, except to the extent such restriction is prohibited by applicable law.</li>
              <li>Use the Service to develop a competing product, train machine-learning models on our outputs, or scrape, crawl, or systematically extract data from the Service.</li>
              <li>Interfere with, disrupt, overload, or impair the Service, our infrastructure, or any other user's access.</li>
              <li>Misrepresent your identity, affiliation, certifications, insurance status, or operating authority.</li>
              <li>Use the Service to surveil, harass, stalk, or harm any individual, or to capture imagery in violation of any "no-fly" zone, restricted airspace, TFR, or property owner's rights.</li>
              <li>Export, re-export, or transfer any data, technology, or output from the Service in violation of U.S. or other applicable export-control or sanctions laws.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Service Availability</h2>
            <p>We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable for maintenance, updates, or circumstances beyond our control. We are not liable for any loss resulting from service interruptions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Payment & Billing</h2>
            <p>Certain features of the Service require a paid subscription. Fees are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law. We reserve the right to change pricing with 30 days' notice.</p>
            <p className="mt-2">All fees are stated exclusive of taxes, duties, and similar government assessments, which are your responsibility. You authorize us and our payment processor (Stripe) to charge your designated payment method for all amounts owed. If a charge fails, we may suspend or terminate your access until payment is received. Disputed charges must be raised in writing within thirty (30) days of the charge date or are deemed accepted.</p>
            <p className="mt-2">Marketplace transactions between clients and pilots are facilitated by the Service but the underlying contract is solely between the client and the pilot or organization. We are not a party to that contract, do not act as an escrow or fiduciary, and accept no liability for non-performance, refunds, chargebacks, or disputes arising from those transactions, except as required by applicable consumer-protection law.</p>
            <p className="mt-2"><strong className="text-foreground">Marketplace connection fee &amp; on-platform payments.</strong> By posting a job, accepting a quote, or otherwise engaging another user introduced through Dronie's marketplace, both parties agree that: (a) all payment for work first introduced through the Service must be processed through Dronie using Stripe; (b) the client (the party purchasing the work) shall pay a non-refundable platform connection fee equal to one percent (1%) of the pilot's quoted price (subject to a minimum of US$0.50), in addition to the pilot's full asking price, on every booking; (c) the pilot receives one hundred percent (100%) of their quoted price, paid out via Stripe Connect on Stripe's standard payout schedule; (d) the client and pilot will not solicit, agree to, or accept payment for the same or substantially similar work outside the Service for a period of twelve (12) months following first introduction (the "non-circumvention period"); and (e) any attempt to circumvent the connection fee, including off-platform payment, deliberate cancellation followed by direct booking, or use of an alternative platform to consummate work first introduced on Dronie, constitutes a material breach of these Terms. In the event of breach, the breaching party shall pay Dronie liquidated damages equal to the greater of US$250 or fifteen percent (15%) of the off-platform contract value, plus reasonable collection costs and attorneys' fees. Dronie may also suspend or terminate accounts found to be circumventing the marketplace.</p>
            <p className="mt-2"><strong className="text-foreground">Tax responsibility.</strong> Dronie is not the merchant of record for marketplace transactions other than its own platform fees and subscriptions. Pilots are independent contractors solely responsible for collecting, reporting, and remitting any sales tax, VAT, GST, or income tax owed on their earnings. Clients are responsible for any use tax owed in their jurisdiction.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Dronie, its operators, employees, contractors, affiliates, and partners shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including loss of data, profits, equipment, or business opportunities arising from your use of the Service.</p>
            <p className="mt-2">Dronie operates as a listing and introduction platform between independent drone pilots, organizations, and clients. We do not employ pilots, do not operate aircraft, and do not independently verify every credential listed on the Service. The Service is provided "as is" and "as available" without warranties of any kind.</p>
            <p className="mt-2">You acknowledge that Dronie is <strong>not responsible</strong> for: (a) any pilot's or organization's conduct, performance, deliverables, equipment failure, accidents, injuries, property damage, regulatory violations, or insurance coverage; (b) any disputes between clients and pilots or organizations, including payment disputes, contract disputes, or quality disputes; (c) any losses, damages, or claims arising from work arranged through the Service; or (d) the accuracy of credentials, certifications, insurance status, or other information provided by users.</p>
            <p className="mt-2"><strong className="text-foreground">No warranty.</strong> To the maximum extent permitted by law, the Service and all outputs (including orthomosaics, point clouds, DSMs, contour lines, volumetric calculations, Gaussian splats, AI-generated insights, flight plans, and weather/airspace data) are provided "AS IS" and "AS AVAILABLE" without warranties of any kind, whether express, implied, statutory, or otherwise, including any warranty of merchantability, fitness for a particular purpose, title, non-infringement, accuracy, completeness, uninterrupted operation, error-free performance, or quiet enjoyment. Photogrammetric outputs are estimates and must be independently verified by a licensed professional before being relied upon for engineering, surveying, construction, legal, regulatory, safety-of-life, or financial decisions.</p>
            <p className="mt-2"><strong className="text-foreground">Cap on damages.</strong> To the maximum extent permitted by law, the aggregate liability of Halcyon Systems Group and its affiliates, officers, directors, employees, agents, and licensors arising out of or relating to the Service or these Terms, whether in contract, tort (including negligence), strict liability, or any other theory, shall not exceed the greater of (a) the total fees you paid to us for the Service in the twelve (12) months immediately preceding the event giving rise to the claim, or (b) one hundred U.S. dollars ($100). The limitations in this section apply even if any remedy fails of its essential purpose. Some jurisdictions do not allow the exclusion or limitation of certain damages; in such jurisdictions our liability is limited to the maximum extent permitted by law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8a. Pilot Certification & Compliance Responsibility</h2>
            <p>Pilots and organizations are <strong>solely responsible</strong> for obtaining, maintaining, and renewing all required certifications, licenses, registrations, and insurance, including but not limited to FAA Part 107, recurrent training, aircraft registration, Remote ID compliance, LAANC authorizations, and any local, state, or international permits.</p>
            <p className="mt-2">Dronie may surface certification expiration reminders and recertification confirmation flows as a convenience, but these are <strong>not</strong> a substitute for the pilot's or organization's own recordkeeping. Self-attested information is not verified by Dronie and is provided at the user's own risk.</p>
            <p className="mt-2">Operating without current certification or in violation of applicable regulations is strictly prohibited. Any consequences — including but not limited to fines, criminal charges, civil liability, loss of insurance coverage, or third-party damages — are borne entirely by the operator and never by Dronie.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8b. Indemnification</h2>
            <p>You agree to indemnify, defend, and hold harmless Dronie, its operators, employees, contractors, affiliates, and partners from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from or related to: (a) your use of the Service; (b) your operations as a pilot, organization, or client; (c) your violation of these Terms or any law; or (d) your infringement of any third-party rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8c. Privacy and Pilot Location</h2>
            <p>Pilot service-area pin locations displayed on the public pilot map may be intentionally shifted by approximately five miles in a random direction to protect the pilot's privacy, unless the pilot has opted out of location privacy. The exact location shown is therefore an approximation and should not be relied upon for any operational, legal, or safety purpose.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8d. Intellectual Property</h2>
            <p>The Service, including all software, designs, trademarks, logos, text, graphics, user interfaces, and all underlying technology, is owned by Halcyon Systems Group or its licensors and is protected by U.S. and international intellectual-property laws. Except for the limited rights expressly granted in these Terms, no rights are granted to you by implication, estoppel, or otherwise. You may not remove or alter any proprietary notices on any portion of the Service. "Dronie" and "Halcyon Systems Group" are trademarks of Halcyon Systems Group; you may not use them without our prior written consent.</p>
            <p className="mt-2"><strong className="text-foreground">Feedback.</strong> If you submit suggestions, feedback, or feature requests, you grant us a perpetual, irrevocable, royalty-free, worldwide license to use, modify, and exploit such feedback for any purpose without obligation or compensation.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8e. Third-Party Services</h2>
            <p>The Service integrates with or links to third-party services (including, without limitation, Supabase, Stripe, mapping providers, weather APIs, FAA LAANC providers, and AI-model providers). Your use of those services is governed by their own terms and privacy policies. We do not control and are not responsible for the availability, accuracy, content, or practices of any third-party service, and your use of them is at your own risk.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8f. DMCA &amp; Copyright Complaints</h2>
            <p>We respect intellectual-property rights and respond to valid notices under the U.S. Digital Millennium Copyright Act (DMCA). If you believe content on the Service infringes your copyright, send a written notice to our designated agent at <a href="mailto:mpalmero@dronieapp.com" className="text-primary font-medium hover:underline">mpalmero@dronieapp.com</a> containing the information required by 17 U.S.C. § 512(c)(3). We may remove or disable access to allegedly infringing content and terminate the accounts of repeat infringers in appropriate circumstances.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8g. Governing Law, Venue &amp; Dispute Resolution</h2>
            <p>These Terms are governed by and construed in accordance with the laws of the State of California, United States, without regard to its conflict-of-laws principles. Subject to the arbitration clause below, the state and federal courts located in San Francisco County, California shall have exclusive jurisdiction over any dispute, and you consent to personal jurisdiction in such courts and waive any objection based on inconvenient forum.</p>
            <p className="mt-2"><strong className="text-foreground">Binding arbitration; class-action waiver.</strong> Any dispute, claim, or controversy arising out of or relating to the Service or these Terms (each, a "Dispute") shall be resolved by final and binding individual arbitration administered by JAMS under its Streamlined Arbitration Rules then in effect, conducted in English in San Francisco, California (or remotely if the arbitrator agrees). The arbitrator, and not any federal, state, or local court, shall have exclusive authority to resolve any Dispute, including the scope or enforceability of this arbitration agreement. <strong>You and Halcyon Systems Group each waive the right to a trial by jury and the right to participate in any class, collective, consolidated, or representative action.</strong> Notwithstanding the foregoing, either party may bring an individual claim in small-claims court, and either party may seek injunctive relief in court to protect intellectual-property rights. If any portion of this section is found unenforceable, the remainder shall remain in effect, and the unenforceable portion shall be severed.</p>
            <p className="mt-2"><strong className="text-foreground">30-day opt-out.</strong> You may opt out of this arbitration agreement by sending written notice to <a href="mailto:mpalmero@dronieapp.com" className="text-primary font-medium hover:underline">mpalmero@dronieapp.com</a> within 30 days of first accepting these Terms, including your name, account email, and a clear statement that you opt out of arbitration.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8h. Force Majeure</h2>
            <p>Neither party shall be liable for any delay or failure to perform resulting from causes beyond its reasonable control, including acts of God, natural disasters, war, terrorism, civil unrest, government action, labor disputes, internet or utility failures, cyberattacks, pandemics, or third-party service outages.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8i. Severability, Waiver &amp; Assignment</h2>
            <p>If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid provision shall be modified to the minimum extent necessary to make it enforceable. No waiver of any term shall be deemed a further or continuing waiver of such term or any other term. You may not assign or transfer these Terms or any rights hereunder without our prior written consent; any attempted assignment in violation of this section is void. We may assign these Terms freely, including in connection with a merger, acquisition, reorganization, or sale of assets.</p>
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
            <p>For questions about these Terms, legal notices, DMCA complaints, or any other matter relating to the Service, contact Halcyon Systems Group at <a href="mailto:mpalmero@dronieapp.com" className="text-primary font-medium hover:underline">mpalmero@dronieapp.com</a>. This address is the sole official contact for the website and Service in all client-facing matters.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
