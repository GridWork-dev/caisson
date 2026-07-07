---
"@caisson/local-store": minor
---

Add an optional embeddable search surface at the `@caisson/local-store/ui` subpath. It pairs a
controlled query box with a ranked results table, distinguishing "type to search" from "no matches"
so a blank query never reads as an empty store. Your app runs the retrieval and hands the hits in —
the surface opens no tenant database and calls no embedder. Presentational and server-render safe;
composes the `@caisson/ui` kit. Importing the package root stays React-free.
