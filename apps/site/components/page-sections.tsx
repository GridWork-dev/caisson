// <PageSections> — the ONE server component that renders a PageSpec's ordered PageSection[]
// (renderer SPEC §3, glossary SPEC Task 2). A plain exhaustive `switch (section.kind)`; every arm
// composes an existing @caisson-sh/ui / site primitive (ADR-0099) — no plugin registry, no config
// loader, no per-section theming. The `never` default arm makes an unmapped `kind` a compile
// error, not a silent blank.
import { Fragment, type ReactNode } from "react";

import type { PageSection } from "@/lib/page-sections";

import { CodeHighlight } from "./code-highlight";

import {
  Button,
  Card,
  CodeBlock,
  Faq,
  FeatureGrid,
  Hero,
  Icon,
  Section,
  SkuMatrix,
  StatusChip,
} from "@/components";

function renderSection(section: PageSection, key: number): ReactNode {
  switch (section.kind) {
    case "hero": {
      const { kind: _kind, ...heroProps } = section;
      return <Hero key={key} {...heroProps} />;
    }

    case "section": {
      const { kind: _kind, ...sectionProps } = section;
      return <Section key={key} {...sectionProps} />;
    }

    case "featureGrid": {
      // Rest-destructure (not a fresh object literal) so the `header` group headed to
      // `<Section>` keeps its true optional-vs-absent shape under `exactOptionalPropertyTypes`.
      const { kind: _kind, cols, items, ...header } = section;
      return (
        <Section key={key} {...header}>
          <FeatureGrid cols={cols ?? 2}>
            {items.map((item) => (
              <Card key={item.title}>
                {item.icon && <Icon name={item.icon} aria-hidden />}
                <h3 className="cs-card-title">{item.title}</h3>
                <p className="cs-muted">{item.body}</p>
              </Card>
            ))}
          </FeatureGrid>
        </Section>
      );
    }

    case "controlMap": {
      const { kind: _kind, items, ...header } = section;
      return (
        <Section key={key} {...header}>
          {items.map((item) => (
            <Card key={item.title}>
              {item.icon && <Icon name={item.icon} size="lg" aria-hidden />}
              {item.eyebrow && <p className="cs-footnote">{item.eyebrow}</p>}
              <h3 className="cs-card-title">{item.title}</h3>
              <p className="cs-muted">{item.body}</p>
              <CodeBlock
                code={item.code}
                frame
                {...(item.codeLabel !== undefined
                  ? { label: item.codeLabel }
                  : {})}
              />
              {item.clause && <p className="cs-footnote">{item.clause}</p>}
            </Card>
          ))}
        </Section>
      );
    }

    case "codeArtifact": {
      const { kind: _kind, notes, lang, code, ...codeBlockProps } = section;
      // A `lang` means the `code` is a plain string to highlight server-side (glossary + module
      // artifacts); without it the code is already a tinted/plain node and passes through.
      const codeNode = lang ? <CodeHighlight code={code} lang={lang} /> : code;
      return (
        <Section key={key}>
          <CodeBlock {...codeBlockProps} code={codeNode} frame />
          {notes && notes.length > 0 && (
            <ol
              className="cs-muted"
              style={{
                marginTop: "var(--cs-space-4)",
                paddingLeft: "var(--cs-space-6)",
                display: "grid",
                gap: "var(--cs-space-2)",
                // notes quote long identifiers (ED25519_SIGNATURE_BYTES/ED25519_PUBLIC_BYTES); without
                // a break opportunity the grid track sizes to them and the page scrolls sideways at 360px
                overflowWrap: "anywhere",
              }}
            >
              {notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ol>
          )}
        </Section>
      );
    }

    case "comparison": {
      const { kind: _kind, columns, rows, ...header } = section;
      return (
        <Section key={key} {...header}>
          <SkuMatrix columns={columns} rows={rows} />
        </Section>
      );
    }

    case "faq": {
      // Two rest-destructures of the same object split it into the Section-header group and the
      // Faq-props group, each preserving its fields' true optionality (see featureGrid above).
      const {
        kind: _kind1,
        items: _items,
        defaultOpenFirst: _defaultOpenFirst,
        ...header
      } = section;
      const {
        kind: _kind2,
        eyebrow: _eyebrow,
        title: _title,
        ...faqProps
      } = section;
      return (
        <Section key={key} {...header}>
          <Faq {...faqProps} />
        </Section>
      );
    }

    case "cta": {
      const { kind: _kind, primary, secondary, ...header } = section;
      return (
        <Section key={key} {...header}>
          <div className="cs-cta-row">
            <Button href={primary.href} variant="primary">
              {primary.label}
            </Button>
            {secondary && (
              <Button href={secondary.href} variant="ghost">
                {secondary.label}
              </Button>
            )}
          </div>
        </Section>
      );
    }

    case "stackCompat": {
      // The compatibility badge row (ADR-0263) — a flat <StatusChip> wrap, no new primitive.
      const { kind: _kind, items, ...header } = section;
      return (
        <Section key={key} {...header}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--cs-space-2)",
            }}
          >
            {items.map((item) => (
              <StatusChip
                key={item.label}
                label={item.label}
                tone={item.tone ?? "accent"}
                {...(item.icon !== undefined ? { icon: item.icon } : {})}
              />
            ))}
          </div>
        </Section>
      );
    }

    case "custom":
      return <Fragment key={key}>{section.node}</Fragment>;

    default: {
      // Exhaustiveness check (renderer SPEC §3): a `kind` added to the union without a matching
      // case above fails HERE at compile time — never a silent blank render.
      const exhaustive: never = section;
      throw new Error(
        `Unhandled PageSection kind: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

export interface PageSectionsProps {
  sections: readonly PageSection[];
}

export function PageSections({ sections }: PageSectionsProps) {
  return <>{sections.map((section, i) => renderSection(section, i))}</>;
}
