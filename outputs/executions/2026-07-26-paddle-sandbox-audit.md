---
updated: 2026-07-26
status: evidence
grounds:
  - tools/paddle-catalog-recreate.ts
  - tools/paddle-catalog-recreate.test.ts
---

# Paddle sandbox catalog audit — 2026-07-26

- **Observed:** 2026-07-26T17:47:44Z
- **Command:** `env PADDLE_ENV=sandbox bun tools/paddle-catalog-recreate.ts --audit`
- **Contract:** authenticated GET-only pagination across products and prices; no Paddle object was
  created, edited, archived, or deleted.
- **Boundary adjustment under test:** accept Paddle's live `image_url: null` response while keeping
  every unrelated product field strict.
- **Semantics:** Task 2's marker-classification contract only. EXPECTED means the object has a
  unique marker present in the locked plan; this receipt does not certify status, ownership,
  amounts, currency, cadence, or other catalog attributes.
- **Exit:** non-zero because drift exists; classification completed.

| Classification               | Count |
| ---------------------------- | ----: |
| EXPECTED                     |   101 |
| UNKNOWN MARKER               |     3 |
| UNMARKED (pre-script/manual) |   113 |
| DUPLICATE MARKER             |     0 |
| MISSING                      |     0 |

## Itemized drift

The following 116 objects are the complete non-expected marker-classification set returned by the
audit. This receipt records provider state only; it does not choose or authorize cleanup.

```text
UNKNOWN MARKER (3)
  price pri_01kye9597z46149qg5xfrqxybk status=active marker=oscal-spine product_id=pro_01kye9596gvz4c25pjj7hf4rz5 label="OSCAL spine module — perpetual license"
  price pri_01kye959a399018w0hmvbeem7h status=active marker=renew:oscal-spine product_id=pro_01kxvpjn0da0ryqb0z593ss0qj label="OSCAL spine — 12-month updates renewal"
  product pro_01kye9596gvz4c25pjj7hf4rz5 status=active marker=oscal-spine label="Caisson module — OSCAL spine"

UNMARKED (pre-script/manual) (113)
  price pri_01kwd76be2eq96kff5nqw236c0 status=archived marker=(none) product_id=pro_01kwd76b9py1f7z1f1y0zjmc49 label="Caisson Compliance Edition — one-time"
  price pri_01kwd76bp60acq51mftvpgr42k status=archived marker=(none) product_id=pro_01kwd76bjx0jgp5d497rm0w9ae label="Caisson Everything Bundle — one-time"
  price pri_01kwd76c1pgs2csxcj2n0y7vv0 status=archived marker=(none) product_id=pro_01kwd76bx7cqkay07n5va5a8b8 label="Caisson AI Production Kit — one-time"
  price pri_01kwd76cahy825m14334aqf209 status=archived marker=(none) product_id=pro_01kwd76c6yd5rw3yhc5hfjsax0 label="Caisson Local-first AI — one-time"
  price pri_01kwd76ck3w8myy4p4f1gj0dcy status=archived marker=(none) product_id=pro_01kwd76cg6skh29c316kje57zs label="Caisson Agentic-Dev — one-time"
  price pri_01kwd76cwytyyy4yhd9ch0m935 status=active marker=(none) product_id=pro_01kwd76cs8m93gjn7e71vat1pc label="Caisson Compliance Updates — yearly"
  price pri_01kwd76d64rz2ecm090pt4nq5q status=active marker=(none) product_id=pro_01kwd76d37xbdjcs2hg1r3zgs1 label="Caisson Developer — yearly"
  price pri_01kwj6m31fxw5vn532h5ft6780 status=archived marker=(none) product_id=pro_01kwj6m2xrt3mfn3g08fjeg46x label="Compliance core module - one-time perpetual"
  price pri_01kwj6m3cwez98t45jzwsqb250 status=active marker=(none) product_id=pro_01kwj6m3935a2z7m6nczk0fypa label="Field encryption module - one-time perpetual"
  price pri_01kwj6m3mjq4rpv7918rhfhrhw status=active marker=(none) product_id=pro_01kwj6m3hsf945xtq3gjvpqe4r label="Audit chain + WORM module - one-time perpetual"
  price pri_01kwj6m3x1cw1k54tcdhsc6pgj status=active marker=(none) product_id=pro_01kwj6m3scwhtxzk9xv81v3a3n label="Retention runner module - one-time perpetual"
  price pri_01kwj6m45zeqyxgad3f32x1b30 status=active marker=(none) product_id=pro_01kwj6m43373gm4zqfbyt7nrrv label="Token metering module - one-time perpetual"
  price pri_01kwj6m4d3npk8sszerx7fek7w status=active marker=(none) product_id=pro_01kwj6m4a9bqys4rdvwet68egp label="Eval harness module - one-time perpetual"
  price pri_01kwj6m4n105qe80fapw9sk5xc status=active marker=(none) product_id=pro_01kwj6m4j550a1jsdy9xz98zxx label="Guardrails module - one-time perpetual"
  price pri_01kwj6m4whyw1stbej2qk8q0bg status=active marker=(none) product_id=pro_01kwj6m4stre25z6n61xcmpkc8 label="Prompt registry module - one-time perpetual"
  price pri_01kwj6m55yagz7188qer0pa0cd status=archived marker=(none) product_id=pro_01kwj6m52j8s1qwz2ahxh58hm6 label="Agent-setup config bundles module - one-time perpetual"
  price pri_01kwj6m5da9ay3z85b6qwtjcpe status=active marker=(none) product_id=pro_01kwj6m5afpsmaehzph2jrbrdt label="Spend alerting module - one-time perpetual"
  price pri_01kwj6m5mzyn76b8jkknmjndb4 status=archived marker=(none) product_id=pro_01kwj6m5j39p4dq4kgb2b04zvj label="On-device inference module - one-time perpetual"
  price pri_01kwj6m5w3s4fmvseap7zmp5yf status=active marker=(none) product_id=pro_01kwj6m5s954dawsgc2p995ra6 label="Local vector store module - one-time perpetual"
  price pri_01kwj6m63qpt52489tq5a3v6q3 status=active marker=(none) product_id=pro_01kwj6m60vep5t1nqf47chtj35 label="Agent kernel module - one-time perpetual"
  price pri_01kwj6m6cbtsh6n5b1bxtb2j0k status=archived marker=(none) product_id=pro_01kwj6m68fgasq2zvqfp3vv1rh label="Dev-loop tooling module - one-time perpetual"
  price pri_01kwj71a53hycbspsfv8pck5vc status=active marker=(none) product_id=pro_01kwj71a1jd3bj7r2qx2q4na9c label="Caisson Agent runner module - one-time"
  price pri_01kwj71ae0g946ztm4sej7bq76 status=active marker=(none) product_id=pro_01kwj71a9xjyaq0kh9jte8q0qt label="Caisson Credit Pack 5000 - one-time"
  price pri_01kwvz6kzh4h43aec3r5rs5je4 status=archived marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the compliance updates window by 12 months."
  price pri_01kwvz6m46s5tj4k2a09kcaf9s status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the ai-kit updates window by 12 months."
  price pri_01kwvz6m791c1xb4wxbedzf9nt status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the local-ai updates window by 12 months."
  price pri_01kwvz6m9tr49rstw0x7s8nk5h status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the agent-dev updates window by 12 months."
  price pri_01kwvz6mcfzgjemqa72czdfkmq status=archived marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the bundle updates window by 12 months."
  price pri_01kwvz6mf22rqfrx6reh4b88sm status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the field-crypto updates window by 12 months."
  price pri_01kwvz6mhkreqepryq96s2wk7n status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the audit-worm updates window by 12 months."
  price pri_01kwvz6mm4wnr6b65m2fbq46h5 status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the ai-meter updates window by 12 months."
  price pri_01kwvz6mppg1y7prs0vqjpha8k status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the ai-evals updates window by 12 months."
  price pri_01kwvz6msc5c7ehctejscxebkx status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the guardrails updates window by 12 months."
  price pri_01kwvz6mwtsfbmeq39s524na24 status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the prompt-registry updates window by 12 months."
  price pri_01kwvz6mzmdxkkp180bd36t6xj status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the local-store updates window by 12 months."
  price pri_01kwvz6n3jyt5fhgt0hgdgcvv7 status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the agent-kernel updates window by 12 months."
  price pri_01kwvz6n738kz8n9aygb26jc6j status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the agent-runner updates window by 12 months."
  price pri_01kwvz6na9hp9gg1b0709exekp status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the alerting updates window by 12 months."
  price pri_01kwvz6nd2yv34z083cpxamkqy status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the retention-runner updates window by 12 months."
  price pri_01kwwqa0k69m965tx8hgsv904h status=active marker=(none) product_id=pro_01kwwqa0h72tgt36bbx958jdt4 label="Caisson Compliance evidence core module - one-time perpetual"
  price pri_01kwwqa0rkz3etv2yfd6c7jjad status=active marker=(none) product_id=pro_01kwwqa0pdc0ts463fxp5a3e8t label="Caisson Frameworks pack module - one-time perpetual"
  price pri_01kwwqa0y1hn63taahdh7y03vf status=active marker=(none) product_id=pro_01kwwqa0vrnmtjk1nr6wvmxt9m label="Caisson Evidence signing module - one-time perpetual"
  price pri_01kwwqa1413c33yfsrvjb4r34a status=active marker=(none) product_id=pro_01kwwqa11rnj4ctngy28h7r7d7 label="Caisson Credits engine module - one-time perpetual"
  price pri_01kwwqa1b33ycmh114440xc6re status=active marker=(none) product_id=pro_01kwwqa18egg8sfnsn3avb7z78 label="Caisson Local sync module - one-time perpetual"
  price pri_01kwwqa1gvkpj7g0jfna7h2qcr status=active marker=(none) product_id=pro_01kwwqa1etetxxh4wwx9tfh0b9 label="Caisson Local inference module - one-time perpetual"
  price pri_01kwwqa1p152hskczw7daszzgn status=active marker=(none) product_id=pro_01kwwqa1kwk00qtbnjp4dvc4hz label="Caisson Local privacy module - one-time perpetual"
  price pri_01kwwqa1v2gm7cr5g1rpzyk522 status=active marker=(none) product_id=pro_01kwwqa1s8jz1hj1qyca43sxva label="Caisson Tool execution module - one-time perpetual"
  price pri_01kwwqa20m42dmedx9mprk085k status=active marker=(none) product_id=pro_01kwwqa1yf5p3x2g6nyreht7j8 label="Caisson Org controls module - one-time perpetual"
  price pri_01kwwqa266p6smw4yaanxg1n5j status=active marker=(none) product_id=pro_01kwwqa245xvft0aesrzr3dy58 label="Caisson Billing orchestration module - one-time perpetual"
  price pri_01kwwqa2c799fpe1af76p75r7r status=active marker=(none) product_id=pro_01kwwqa2a23hrerakd5xxrgwtq label="Caisson UI Pro module - one-time perpetual"
  price pri_01kwwqa2hne35c1df5xe8p91z3 status=archived marker=(none) product_id=pro_01kwwqa2fk6y55qhjwpsh17qg2 label="Caisson Compliance Bundle - one-time perpetual"
  price pri_01kwwqa2rcxtn8pt3dr3jdnnf0 status=active marker=(none) product_id=pro_01kwwqa2mzwpzy1shzvdqdfkdf label="Caisson AI Production Bundle - one-time perpetual"
  price pri_01kwwqa2xp3jp1qww2j5ya0meh status=active marker=(none) product_id=pro_01kwwqa2vqk5t6wyzqxdwjaqg8 label="Caisson Local-first AI Bundle - one-time perpetual"
  price pri_01kwwqa332mweg8veaarkygbae status=active marker=(none) product_id=pro_01kwwqa30ywjqqvxvxtb5ppeeq label="Caisson Agentic-Dev Bundle - one-time perpetual"
  price pri_01kwwqa3872cs4c53w8qhhz31k status=active marker=(none) product_id=pro_01kwwqa36619mpxzafn9qycjfm label="Caisson Provenance Bundle - one-time perpetual"
  price pri_01kwwqa3dfp8k0v5k3bbg3pd5f status=archived marker=(none) product_id=pro_01kwwqa3batrbfvswq9f3dd1je label="Caisson Everything Bundle - one-time perpetual"
  price pri_01kwwqa4k2z4wx3b53nacbpd7w status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the provenance updates window by 12 months."
  price pri_01kwwqa4n21y7ah006yb9q07r1 status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the compliance-core updates window by 12 months."
  price pri_01kwwqa4qc77j5f1pn61811ent status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the frameworks-pack updates window by 12 months."
  price pri_01kwwqa4sfhdbp2rn09s1kpsae status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the signing-primitive updates window by 12 months."
  price pri_01kwwqa4vaa99c75mbydysxc2d status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the credits updates window by 12 months."
  price pri_01kwwqa4xgef5bzfws498q31y0 status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the local-sync updates window by 12 months."
  price pri_01kwwqa4zkwdfbxsefe7kveex2 status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the local-inference updates window by 12 months."
  price pri_01kwwqa51khjcn3y79m7dwhm3z status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the local-privacy updates window by 12 months."
  price pri_01kwwqa5434re4xvzpd0y77s35 status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the tool-exec updates window by 12 months."
  price pri_01kwwqa5634seyq4v05hmft4ws status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the org-controls updates window by 12 months."
  price pri_01kwwqa58355kq4t05rtk5v8qf status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the billing-orchestration updates window by 12 months."
  price pri_01kwwqa5a8z41s64x1fnfzqanj status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Extends the ui-pro updates window by 12 months."
  price pri_01kyeczreqq58ze5en0p3f0jkc status=active marker=(none) product_id=pro_01kwwqa2fk6y55qhjwpsh17qg2 label="Compliance bundle — perpetual license"
  price pri_01kyeczrjj0tzpwg7tv752e42s status=active marker=(none) product_id=pro_01kwwqa3batrbfvswq9f3dd1je label="Everything bundle — perpetual license"
  price pri_01kyeczrnp20006sebn9gzg5zb status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Compliance — 12-month updates renewal"
  price pri_01kyeczrrsq68b8wbx2atygs5a status=active marker=(none) product_id=pro_01kwvz6ktwkcj90gmtfrft8btr label="Everything — 12-month updates renewal"
  product pro_01kwd76b9py1f7z1f1y0zjmc49 status=archived marker=(none) label="Caisson Compliance Edition"
  product pro_01kwd76bjx0jgp5d497rm0w9ae status=archived marker=(none) label="Caisson Everything Bundle"
  product pro_01kwd76bx7cqkay07n5va5a8b8 status=archived marker=(none) label="Caisson AI Production Kit"
  product pro_01kwd76c6yd5rw3yhc5hfjsax0 status=archived marker=(none) label="Caisson Local-first AI"
  product pro_01kwd76cg6skh29c316kje57zs status=archived marker=(none) label="Caisson Agentic-Dev"
  product pro_01kwd76cs8m93gjn7e71vat1pc status=active marker=(none) label="Caisson Compliance Updates"
  product pro_01kwd76d37xbdjcs2hg1r3zgs1 status=active marker=(none) label="Caisson Developer"
  product pro_01kwj6m2xrt3mfn3g08fjeg46x status=archived marker=(none) label="Caisson Compliance core module"
  product pro_01kwj6m3935a2z7m6nczk0fypa status=active marker=(none) label="Caisson Field encryption module"
  product pro_01kwj6m3hsf945xtq3gjvpqe4r status=active marker=(none) label="Caisson Audit chain + WORM module"
  product pro_01kwj6m3scwhtxzk9xv81v3a3n status=active marker=(none) label="Caisson Retention runner module"
  product pro_01kwj6m43373gm4zqfbyt7nrrv status=active marker=(none) label="Caisson Token metering module"
  product pro_01kwj6m4a9bqys4rdvwet68egp status=active marker=(none) label="Caisson Eval harness module"
  product pro_01kwj6m4j550a1jsdy9xz98zxx status=active marker=(none) label="Caisson Guardrails module"
  product pro_01kwj6m4stre25z6n61xcmpkc8 status=active marker=(none) label="Caisson Prompt registry module"
  product pro_01kwj6m52j8s1qwz2ahxh58hm6 status=archived marker=(none) label="Caisson Agent-setup config bundles module"
  product pro_01kwj6m5afpsmaehzph2jrbrdt status=active marker=(none) label="Caisson Spend alerting module"
  product pro_01kwj6m5j39p4dq4kgb2b04zvj status=archived marker=(none) label="Caisson On-device inference module"
  product pro_01kwj6m5s954dawsgc2p995ra6 status=active marker=(none) label="Caisson Local vector store module"
  product pro_01kwj6m60vep5t1nqf47chtj35 status=active marker=(none) label="Caisson Agent kernel module"
  product pro_01kwj6m68fgasq2zvqfp3vv1rh status=archived marker=(none) label="Caisson Dev-loop tooling module"
  product pro_01kwj71a1jd3bj7r2qx2q4na9c status=active marker=(none) label="Caisson Agent runner module"
  product pro_01kwj71a9xjyaq0kh9jte8q0qt status=active marker=(none) label="Caisson Credit Pack 5000"
  product pro_01kwvz6ktwkcj90gmtfrft8btr status=active marker=(none) label="Updates Renewal"
  product pro_01kwwqa0h72tgt36bbx958jdt4 status=active marker=(none) label="Caisson Compliance evidence core module"
  product pro_01kwwqa0pdc0ts463fxp5a3e8t status=active marker=(none) label="Caisson Frameworks pack module"
  product pro_01kwwqa0vrnmtjk1nr6wvmxt9m status=active marker=(none) label="Caisson Evidence signing module"
  product pro_01kwwqa11rnj4ctngy28h7r7d7 status=active marker=(none) label="Caisson Credits engine module"
  product pro_01kwwqa18egg8sfnsn3avb7z78 status=active marker=(none) label="Caisson Local sync module"
  product pro_01kwwqa1etetxxh4wwx9tfh0b9 status=active marker=(none) label="Caisson Local inference module"
  product pro_01kwwqa1kwk00qtbnjp4dvc4hz status=active marker=(none) label="Caisson Local privacy module"
  product pro_01kwwqa1s8jz1hj1qyca43sxva status=active marker=(none) label="Caisson Tool execution module"
  product pro_01kwwqa1yf5p3x2g6nyreht7j8 status=active marker=(none) label="Caisson Org controls module"
  product pro_01kwwqa245xvft0aesrzr3dy58 status=active marker=(none) label="Caisson Billing orchestration module"
  product pro_01kwwqa2a23hrerakd5xxrgwtq status=active marker=(none) label="Caisson UI Pro module"
  product pro_01kwwqa2fk6y55qhjwpsh17qg2 status=active marker=(none) label="Caisson Compliance Bundle"
  product pro_01kwwqa2mzwpzy1shzvdqdfkdf status=active marker=(none) label="Caisson AI Production Bundle"
  product pro_01kwwqa2vqk5t6wyzqxdwjaqg8 status=active marker=(none) label="Caisson Local-first AI Bundle"
  product pro_01kwwqa30ywjqqvxvxtb5ppeeq status=active marker=(none) label="Caisson Agentic-Dev Bundle"
  product pro_01kwwqa36619mpxzafn9qycjfm status=active marker=(none) label="Caisson Provenance Bundle"
  product pro_01kwwqa3batrbfvswq9f3dd1je status=active marker=(none) label="Caisson Everything Bundle"

DUPLICATE MARKER (0)
  (none)

MISSING (0)
  (none)
```
