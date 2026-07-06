// Registers every composition this project renders (ADR-0263). One pilot composition today —
// fan-out to the other module/edition media slots is a follow-up once this validates the
// pipeline, brand fidelity, and file-size posture.
import { Composition } from "remotion";

import { AuditWormDemo } from "./AuditWormDemo";

const FPS = 30;
const DURATION_SECONDS = 36;

export function RemotionRoot() {
  return (
    <Composition
      id="AuditWormDemo"
      component={AuditWormDemo}
      durationInFrames={FPS * DURATION_SECONDS}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
}
