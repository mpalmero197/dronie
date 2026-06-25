import GuideLayout from "./GuideLayout";

export default function Part107LaancGuide() {
  return (
    <GuideLayout
      path="/guides/part-107-laanc"
      title="Part 107 & LAANC: A Working Pilot's Checklist (2026) | Dronie"
      description="The U.S. commercial drone rules in plain English. Part 107 limits, the waivers that actually matter, U.S. airspace classes, and how to file LAANC authorization before a job."
      h1="Part 107 & LAANC: a working pilot's checklist"
      kicker="Regulations · 13 min read"
    >
      <p>
        If you're flying a drone for money in the United States, you're flying under FAA Part 107. This guide is
        the working-pilot version of the rules — the limits you actually run into, the airspace decisions you
        make on every job, and the LAANC workflow that gets you authorized in minutes instead of weeks.
      </p>
      <p>
        This is plain-language reference, not legal advice. The authoritative source is{" "}
        <a href="https://www.faa.gov/uas" rel="noopener noreferrer">faa.gov/uas</a>; rules change.
      </p>

      <h2>What Part 107 covers</h2>
      <p>
        Part 107 is the FAA rule for commercial operation of small (under 55 lb / 25 kg) unmanned aircraft. You
        need it the moment you're flying for any business purpose — paid mapping, marketing video, real-estate
        photos, internal work for your employer, even uncompensated promotion of a business. Recreational flight
        is covered separately under 49 USC 44809.
      </p>

      <h3>The certificate</h3>
      <ul>
        <li>Pass the FAA Knowledge Test ("Part 107"). 60 questions, 70% to pass.</li>
        <li>Get a Remote Pilot Certificate from the FAA — that's your license.</li>
        <li>Recurrent training online every 24 months.</li>
      </ul>

      <h2>The operational limits — and the waivers</h2>
      <p>
        Memorize these. They're the ones that hit a job most often:
      </p>
      <table>
        <thead>
          <tr><th>Limit</th><th>Rule</th><th>Waiver available?</th></tr>
        </thead>
        <tbody>
          <tr><td>Maximum altitude</td><td>400 ft AGL (or 400 ft above a structure within 400 ft horizontal)</td><td>Yes (107.51)</td></tr>
          <tr><td>Visual line of sight</td><td>Pilot or visual observer must see the aircraft</td><td>Yes (BVLOS waiver — hard)</td></tr>
          <tr><td>Daylight or civil twilight</td><td>Allowed at night with anti-collision lighting visible 3 mi</td><td>Already allowed since 2021 rule update</td></tr>
          <tr><td>Over people</td><td>Allowed only for Category 1–4 aircraft per the Operations Over People rule</td><td>Built into the rule via categories</td></tr>
          <tr><td>Over moving vehicles</td><td>Restricted; full rule depends on category</td><td>Yes</td></tr>
          <tr><td>From a moving vehicle</td><td>Only in sparsely populated areas</td><td>Yes</td></tr>
          <tr><td>Multiple aircraft simultaneously</td><td>One pilot, one aircraft</td><td>Yes (swarm waiver — case by case)</td></tr>
          <tr><td>Max groundspeed</td><td>100 mph</td><td>Yes</td></tr>
          <tr><td>In controlled airspace</td><td>Requires ATC authorization (usually LAANC)</td><td>LAANC or DroneZone authorization</td></tr>
        </tbody>
      </table>

      <h2>Airspace classes — the only ones you'll see</h2>
      <ul>
        <li><strong>Class G (uncontrolled).</strong> Most rural land. Fly up to 400 ft AGL without prior authorization.</li>
        <li><strong>Class E (controlled, normally above 1,200 ft AGL).</strong> Most of the U.S. above the surface. Drones at ≤ 400 ft AGL almost never touch it.</li>
        <li><strong>Class E to the surface.</strong> Common around small airports without towers. Requires LAANC.</li>
        <li><strong>Class D.</strong> Towered airports. Requires LAANC.</li>
        <li><strong>Class C.</strong> Mid-size airports. Requires LAANC.</li>
        <li><strong>Class B.</strong> Major hub airports (JFK, ATL, LAX). LAANC available in many segments; some require DroneZone.</li>
      </ul>
      <p>
        Plus the special-use airspace you'll bump into: <strong>Prohibited</strong> (P-areas) — never enter;{" "}
        <strong>Restricted</strong> (R-areas) — call ATC if active; <strong>MOAs</strong> (military operations) —
        not strictly prohibited but exercise caution; <strong>National Security UAS Flight Restrictions</strong>{" "}
        — fixed no-fly zones around prisons, DOE sites, military bases.
      </p>

      <h2>LAANC: the practical workflow</h2>
      <p>
        LAANC (Low Altitude Authorization and Notification Capability) is the FAA's near-instant authorization
        system for controlled airspace. It checks your proposed flight against a published UAS Facility Map (UASFM)
        that says, per grid cell, the maximum altitude ATC has pre-approved drones to operate at.
      </p>
      <h3>How a LAANC request works</h3>
      <ol>
        <li>Open a LAANC-approved app (Dronie, AirMap legacy, Aloft, Avision, Skyward, etc.).</li>
        <li>Draw your flight area and proposed max altitude.</li>
        <li>The app checks the area against the UASFM grid for the facility.</li>
        <li>
          If your altitude is ≤ the grid cell ceiling → <strong>auto-approval in seconds.</strong>
        </li>
        <li>
          If you exceed the grid cell ceiling → a <em>Further Coordination</em> request goes to the ATC facility.
          Manual review can take days; expect a partial or denied response.
        </li>
        <li>Receive the authorization number. Carry it (digital is fine) during the flight.</li>
      </ol>

      <h3>What LAANC is not</h3>
      <ul>
        <li>It is <strong>not</strong> a waiver. You still operate inside Part 107.</li>
        <li>It does <strong>not</strong> cover prohibited or restricted airspace.</li>
        <li>It is <strong>not</strong> available outside the U.S. NAS — for international operations, check the host country's CAA.</li>
      </ul>

      <h2>A pre-flight checklist that keeps you legal</h2>
      <ol>
        <li>Confirm Remote Pilot Certificate is current.</li>
        <li>Confirm the aircraft is registered (FAA registration number visible on airframe).</li>
        <li>Confirm Remote ID compliance — broadcast module or Standard Remote ID built-in.</li>
        <li>Pull a sectional or in-app airspace view; identify class and any TFRs.</li>
        <li>File LAANC if any portion of the flight enters controlled airspace.</li>
        <li>Brief the visual observer; verify radio comms if used.</li>
        <li>Pre-flight the aircraft per manufacturer checklist.</li>
        <li>Check NOTAMs and TFRs (presidential movement, wildfire, sporting events).</li>
        <li>Log the flight in your operations log.</li>
      </ol>

      <h2>Remote ID — the rule everyone forgets</h2>
      <p>
        Since March 16, 2024, almost every drone you fly under Part 107 must broadcast Remote ID. Either your
        aircraft has Standard Remote ID built in (most modern DJI, Autel, Skydio) or you bolt on a broadcast
        module. Flying without it in a non-FRIA area is a violation, full stop.
      </p>

      <h2>If something goes wrong</h2>
      <ul>
        <li>
          <strong>Accident reporting (107.9).</strong> Within 10 days, if there's serious injury, loss of
          consciousness, or property damage &gt; $500 (excluding the drone).
        </li>
        <li>
          <strong>Lost link.</strong> The aircraft's failsafe should RTH. Document the event.
        </li>
        <li>
          <strong>Flyaway.</strong> Notify ATC if airspace is affected; file an accident report if applicable.
        </li>
      </ul>

      <p>
        Pair this with the <a href="/guides/drone-photogrammetry">photogrammetry guide</a> and the{" "}
        <a href="/guides/gsd-ground-sample-distance">GSD math guide</a> to plan a mission that's both compliant
        and dialed for the deliverable.
      </p>
    </GuideLayout>
  );
}