/**
 * Exemplar posture worksheet: FTC Endorsement Guides (16 CFR Part 255) -- material connection
 * disclosure. GENERIC illustration of the worksheet shape (`exemption-worksheet.ts`), not a real
 * counsel-reviewed determination -- left unsigned on purpose (see `signOff` below). Shaped for an
 * AI copywriting assistant that drafts influencer/affiliate marketing copy.
 *
 * NOT LEGAL ADVICE (see `NOT_LEGAL_ADVICE`, enforced by the schema itself, not by this comment).
 */
import {
  NOT_LEGAL_ADVICE,
  defineExemptionWorksheet,
} from "./exemption-worksheet.ts";

export const ftcEndorsementDisclosureWorksheet = defineExemptionWorksheet({
  id: "ftc-endorsement-disclosure",
  title: "FTC Endorsement Guides -- material connection disclosure",
  exemption:
    "16 CFR Part 255 (FTC Endorsement Guides): an endorsement is exempt from being a deceptive " +
    "practice only when any material connection between endorser and seller -- and the basis for " +
    "any performance/results claim -- is clearly disclosed to the consumer.",
  jurisdiction: "US -- FTC",
  disclaimer: NOT_LEGAL_ADVICE,
  rules: [
    {
      legalTestElement:
        "A material connection between endorser and seller that a consumer would not reasonably " +
        "expect must be disclosed (16 CFR 255.5).",
      outputRule:
        "Any AI-drafted endorsement or affiliate copy MUST include an unambiguous disclosure " +
        "string (e.g. '#ad' or 'I earn a commission on this link') adjacent to the first mention " +
        "of the product or link; refuse to generate the copy if the caller has not supplied a " +
        "material-connection context to disclose.",
      enforcement: "automated-guardrail",
      note: "Implemented as a hard precondition on the copy-generation call, not a post-hoc filter.",
    },
    {
      legalTestElement:
        "The disclosure must be clear and conspicuous -- not buried in a bio/footer and not " +
        "hashtag-only in a way courts and FTC guidance have found insufficient.",
      outputRule:
        "The disclosure string MUST appear in the same sentence as, or the sentence immediately " +
        "adjacent to, the endorsement; reject any draft that places it only in a link-in-bio " +
        "reference or a trailing hashtag block detached from the claim.",
      enforcement: "automated-guardrail",
    },
    {
      legalTestElement:
        "Endorsements may not imply results are typical unless typical results are what most " +
        "consumers achieve, or the ad also discloses the generally expected results.",
      outputRule:
        "Any output containing a numeric or outcome claim (e.g. 'lose 10 lbs', 'save $500') MUST " +
        "co-occur with either a substantiation citation or a generic-results caveat string; block " +
        "generation when neither is present.",
      enforcement: "human-review",
      note: "Substantiation adequacy is a judgment call a guardrail regex can flag but not resolve.",
    },
    {
      legalTestElement:
        "The endorser must, at the time of the endorsement, hold the opinion or have had the " +
        "experience being conveyed -- no fabricated testimonials.",
      outputRule:
        "The generator MUST NOT produce a first-person testimonial or experience claim on behalf " +
        "of a persona unless the caller supplies a verified-experience flag for that persona; a " +
        "missing flag is a hard block, not a soft warning.",
      enforcement: "automated-guardrail",
    },
  ],
  // Intentionally unsigned: this is a generic illustration of the worksheet shape, not an actual
  // reviewed determination. A real worksheet gets a `signOff` once named counsel reviews it.
});
