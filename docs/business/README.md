---
updated: 2026-07-12
status: live
owner: operator (business track)
---

# docs/business — the company surface

Business/legal/finance documents for **Caisson Software LLC** (ADR-0328 D3 home). Never
mirrored: the caisson-oss exporter copies only whitelisted `packages/*` + `scripts/mirror-assets/`
— `docs/` is not a copy source.

| Surface                 | File / folder                    | What it is                                                                                                                                                                                      |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity SOT (quick-read) | `caisson-software-llc.md`        | Entity record, EIN cheat sheet, OA brief summary, order of operations, advisor-workstream + first-sale-gate snapshot                                                                            |
| Master control map      | `caisson-internal-master-map.md` | The packet's own single source of truth (2026-07-11): verified records vs family intent, authority matrix, IP map, money map, §13 first-sale gate register. **Wins over summaries on conflict** |
| Legal documents         | `legal/` (README index)          | Counsel packet set (memorandum, lawyer packet, draft instruments, exhibit index) + formation PDFs                                                                                               |
| Finance documents       | `finance/` (README index)        | CPA coordination + bookkeeping packets, finance connector prompt                                                                                                                                |
| Packet builders         | `builders/`                      | Python scripts that render the counsel/CPA docx from the md sources                                                                                                                             |

Handling: the document sets are committed **verbatim** (operator lock 2026-07-12 — see the
folder READMEs' identity-details override note); `legal/`, `finance/`, and the master map are
prettier-ignored for byte-faithfulness. SSNs/account numbers stay banned everywhere.
