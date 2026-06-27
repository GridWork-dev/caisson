import Link from "next/link";
import type { Metadata } from "next";

import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "Local-first AI — your data never leaves the device",
  description:
    "The free AGPL flank: a compute seam, a default-deny privacy gate, on-device vector search with sqlite-vec, an offline license, and a local card store. Run it air-gapped.",
};

const GITHUB_URL = "https://github.com/GridWork-dev/caisson";

const PIECES = [
  {
    glyph: "▣",
    label: "Compute seam",
    body: "One interface over local and hosted inference. Local is the default you ship with; hosting is an opt-in you make on purpose, not a default you discover in a network log.",
  },
  {
    glyph: "▤",
    label: "Privacy gate",
    body: "A policy boundary every payload crosses before it can leave the process. Default-deny by host — nothing egresses unless you allowed that destination, in writing.",
  },
  {
    glyph: "▥",
    label: "On-device vector search",
    body: "Embeddings indexed with sqlite-vec ANN and queried on disk. Semantic recall with zero round-trips to a vector cloud, and nothing to leak from one.",
  },
  {
    glyph: "▦",
    label: "Offline license",
    body: "License verification that works air-gapped — signature-checked on the device, no phone-home, no remote kill switch. The software keeps running when the network does not.",
  },
  {
    glyph: "▧",
    label: "Local store (cs-cards)",
    body: "A local-first card store. State lives on the device and syncs on your terms, not a vendor's. Own the data at rest, not a copy of it on someone else's disk.",
  },
];

export default function LocalFirstPage() {
  return (
    <>
      {/* ===== Hero ===== */}
      <section className="cs-section cs-section--flush">
        <div className="cs-container">
          <span className="cs-eyebrow">Local-first AI · Free · AGPL</span>
          <h1
            style={{
              fontSize: "var(--cs-text-display)",
              lineHeight: "var(--cs-leading-tight)",
              letterSpacing: "var(--cs-tracking-tighter)",
              fontWeight: "var(--cs-weight-semibold)",
              margin: "var(--cs-space-5) 0 var(--cs-space-4)",
              maxWidth: "16ch",
            }}
          >
            Your data never leaves the device.
          </h1>
          <p className="cs-lede" style={{ maxWidth: "64ch" }}>
            Inference, embeddings, search, and licensing that run on the machine
            in front of you. Sovereignty is the default, not a setting you
            harden into later. The egress is zero because there is no outbound
            call to make.
          </p>
          <div
            style={{
              display: "flex",
              gap: "var(--cs-space-3)",
              marginTop: "var(--cs-space-8)",
              flexWrap: "wrap",
            }}
          >
            <Link href="/docs/local-first" className="cs-btn cs-btn--primary">
              Read the docs
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="cs-btn cs-btn--ghost"
            >
              <span aria-hidden="true">★</span> Star on GitHub
            </a>
          </div>

          {/* Evidence over adjectives: where the compute actually runs, not a promise about it. */}
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-12)", maxWidth: "60ch" }}
            aria-label="Example: the compute seam reports local-only operation with no egress"
          >
            {`$ caisson where-compute
seam      local          # swappable; hosted is opt-in
embed     sqlite-vec     # ANN index on disk
license   offline        # verifies air-gapped, no phone-home
egress    none           # 0 outbound connections`}
          </pre>
        </div>
      </section>

      {/* ===== The pieces ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">What&apos;s in the flank</span>
          <h2 className="cs-section-title">Five pieces, all on the device.</h2>
          <p className="cs-lede">
            Each one is built to do its job without a network. Compose them, or
            take a single module — the data path never widens past the disk.
          </p>
          <div
            className="cs-grid cs-grid--3"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {PIECES.map((p) => (
              <article key={p.label} className="cs-card">
                <div className="cs-status">
                  <span className="glyph" aria-hidden="true">
                    {p.glyph}
                  </span>
                  {p.label}
                </div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== On-device vector search evidence ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">On-device vector search</span>
          <h2 className="cs-section-title">
            Semantic recall that never round-trips.
          </h2>
          <p className="cs-lede">
            sqlite-vec holds the ANN index next to your rows. A query is a
            statement against a local file — no API key, no vector vendor, no
            embeddings shipped off the box to be indexed by someone else.
          </p>
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-8)", maxWidth: "62ch" }}
            aria-label="Example: an approximate-nearest-neighbour query running against a local sqlite-vec index"
          >
            {`-- ANN over the local store; nothing leaves the process
SELECT id, distance
FROM   cs_cards
WHERE  embedding MATCH :query_vec
ORDER  BY distance
LIMIT  8;
-- index on disk · 0 outbound connections`}
          </pre>
        </div>
      </section>

      {/* ===== AGPL open-core note ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">Open core · AGPL-3.0</span>
          <h2 className="cs-section-title">
            The free edge of Caisson. Source-open, yours to run.
          </h2>
          <p className="cs-lede">
            Local-first is the open flank. The compute seam, privacy gate,
            on-device search, offline license, and local store ship under
            AGPL-3.0 — read it, fork it, run it air-gapped. The premium editions
            carry commercial terms; this flank stays free, on purpose.
          </p>
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-8)", maxWidth: "60ch" }}
            aria-label="The local-first package license metadata"
          >
            {`package   @caisson/local-first
license   AGPL-3.0-only
source    github.com/GridWork-dev/caisson
terms     free · forever · network use carries source obligations`}
          </pre>
          <div
            style={{
              display: "flex",
              gap: "var(--cs-space-3)",
              marginTop: "var(--cs-space-8)",
              flexWrap: "wrap",
            }}
          >
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="cs-btn cs-btn--ghost"
            >
              <span aria-hidden="true">★</span> Star on GitHub
            </a>
            <Link href="/docs/local-first" className="cs-btn cs-btn--ghost">
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Waitlist ===== */}
      <section className="cs-section" id="waitlist">
        <div className="cs-container">
          <span className="cs-eyebrow">Early access</span>
          <h2 className="cs-section-title">Run it before anyone else.</h2>
          <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
            Join the early-access list. We&apos;ll reach out as the local-first
            flank opens.
          </p>
          <WaitlistForm source="local-first" />
        </div>
      </section>
    </>
  );
}
