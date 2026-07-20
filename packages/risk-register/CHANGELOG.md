# @caisson/risk-register

## 0.2.0

### Minor Changes

- fa79938: New risk register: score any risk by likelihood and impact, and the residual severity is always
  computed from that rating — there is no field for typing in a number by hand. An operator override
  is never a silent edit either: it is recorded as its own exception, with who asserted it, why, and
  when, on the tenant's write-once audit chain, so the original computed score stays recoverable even
  after an override is in force. Every entry can point at any framework module's controls, and a
  register can be exported as a treatment-plan summary. Not sold individually yet.

### Patch Changes

- Updated dependencies [ff2cc46]
  - @caisson/frameworks-pack@0.6.0
