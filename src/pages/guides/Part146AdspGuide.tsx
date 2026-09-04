import GuideLayout from "./GuideLayout";

export default function Part146AdspGuide() {
  return (
    <GuideLayout
      path="/guides/part-146-automated-data-service-provider"
      title="Part 146 Automated Data Service Providers (ADSP) Explained | Dronie"
      description="What an Automated Data Service Provider is under 14 CFR Part 146, what strategic deconfliction and conformance monitoring actually do, and the records a provider and a BVLOS operator have to keep."
      h1="Automated Data Service Providers under Part 146"
      kicker="Regulations · 11 min read"
    >
      <p>
        Beyond visual line of sight (BVLOS) drone operations don't work if every operator has to phone every
        other operator. Part 146 is the FAA's framework for the companies that supply the automated data those
        operations depend on — traffic deconfliction, conformance monitoring, terrain and obstacle data,
        aeronautical information and weather. Those companies are called Automated Data Service Providers, or
        ADSPs.
      </p>
      <p>
        This is a plain-language explainer, not legal advice. Read the rule text at{" "}
        <a href="https://www.faa.gov/uas" rel="noopener noreferrer">faa.gov/uas</a> before you rely on any of it
        operationally.
      </p>

      <h2>What an ADSP actually is</h2>
      <p>
        An ADSP is a third party that supplies automated data to a drone operator, where that data is used to
        satisfy a regulatory requirement. The distinction matters: a weather app on your phone is a convenience,
        but a weather service that an operator relies on to legally launch a BVLOS flight is a regulated data
        service. The moment the data is load-bearing for compliance, the provider takes on obligations.
      </p>

      <h3>The service families</h3>
      <ul>
        <li>
          <strong>Strategic deconfliction.</strong> Before flight, operators publish their intended operating
          volume — an area, an altitude band and a time window. The service compares volumes and reports whether
          another declared operation overlaps, so conflicts are resolved on the ground rather than in the air.
        </li>
        <li>
          <strong>Conformance monitoring.</strong> During flight, the aircraft's position is compared against the
          declared volume. Any lateral, vertical or timing excursion is a non-conformance and must be logged, and
          in some architectures broadcast so other operators can react.
        </li>
        <li>
          <strong>Terrain and obstacle data.</strong> Elevation and obstruction data used to set safe altitudes,
          plan terrain-following missions and check clearance.
        </li>
        <li>
          <strong>Aeronautical data.</strong> Airspace classification, temporary flight restrictions, NOTAMs and
          the information behind an authorization decision.
        </li>
        <li>
          <strong>Weather data.</strong> Winds, gusts, visibility, temperature and precipitation, evaluated
          against the operator's declared limits.
        </li>
      </ul>

      <h2>What a provider has to be able to show</h2>
      <p>
        The obligations are less about the software and more about proving the software behaves as advertised.
        In practice a provider maintains six things:
      </p>
      <ol>
        <li>
          <strong>A declared service definition</strong> for each service: what it does, which data sources feed
          it, how often it updates, its coverage area, its measurable performance criteria, and — critically — its
          known limitations.
        </li>
        <li>
          <strong>A quality management system</strong>: written procedures with named owners, version numbers,
          effective dates and scheduled reviews covering how each service is produced and verified.
        </li>
        <li>
          <strong>Personnel records</strong>: who is accountable for each function, what training they have
          completed, and when their competency was last verified.
        </li>
        <li>
          <strong>Measured performance</strong>: continuous sampling of availability, latency, error rate and
          data currency, compared against the declared criteria — not marketing numbers, measured ones.
        </li>
        <li>
          <strong>A malfunction log</strong>: outages, degradations and erroneous data recorded with severity,
          number of affected users, root cause, corrective action, and whether the FAA and users were notified.
        </li>
        <li>
          <strong>Retained evidence</strong>: every service output stored with its inputs, its source and its
          data currency, so any past flight can be reconstructed during an investigation.
        </li>
      </ol>

      <h2>What an operator has to do</h2>
      <p>
        Using an ADSP does not transfer responsibility. The remote pilot in command still owns the flight. The
        operator's side of the arrangement is:
      </p>
      <ul>
        <li>Subscribe deliberately to each service, and acknowledge its published limitations in writing.</li>
        <li>Understand the failure modes — what happens when a service goes offline mid-flight, and what the
          fallback procedure is.</li>
        <li>Keep the evidence. If a service told you the volume was clear, keep the record that says so, with the
          timestamp and the data currency.</li>
        <li>Report non-conformances and erroneous data back to the provider so it enters the malfunction log.</li>
      </ul>

      <h2>Strategic deconfliction in practice</h2>
      <p>
        A deconfliction check takes four inputs: the operating area polygon, an altitude floor and ceiling in
        metres or feet AGL, a start and end time, and a lateral buffer. The service tests three dimensions
        against every other shared operation: does the area (plus buffer) intersect, do the altitude bands
        overlap, and do the time windows overlap? A conflict requires all three. If any one of them is separated,
        the operations are deconflicted.
      </p>
      <p>
        That structure is why the useful mitigations are always the same three moves: shift your time window,
        lower your ceiling below the other operation's floor, or shrink your area away from the boundary. A good
        service proposes those directly rather than just flagging red.
      </p>

      <h2>Conformance monitoring in practice</h2>
      <p>
        In flight, each telemetry sample is tested against the declared volume. Three deviation types matter:
      </p>
      <ul>
        <li><strong>Lateral</strong> — the aircraft is outside the declared area, measured as distance beyond the boundary.</li>
        <li><strong>Vertical</strong> — the aircraft is above the ceiling or below the floor of the declared band.</li>
        <li><strong>Temporal</strong> — the aircraft is airborne outside the declared time window.</li>
      </ul>
      <p>
        Each event is timestamped and located, and stays open until an operator resolves it with an explanation.
        The resolved log is the artefact an inspector actually reads.
      </p>

      <h2>How Dronie implements this</h2>
      <p>
        Dronie runs both sides. The Data Services workspace publishes each service with its sources, measured
        availability and limitations; runs strategic deconfliction against shared flight intents; pulls terrain
        relief, temporary flight restrictions and weather into one preflight advisory; monitors conformance
        against a published intent during flight; and retains every service call as exportable evidence. Provider
        obligations — quality documents, accountable personnel, measured performance and the malfunction log —
        are published in the same workspace rather than hidden in a filing cabinet.
      </p>
      <p>
        Part 107 still applies to every flight underneath all of this. If you are new to it, start with the{" "}
        <a href="/guides/part-107-laanc">Part 107 and LAANC checklist</a>.
      </p>
    </GuideLayout>
  );
}
