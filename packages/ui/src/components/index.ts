// Component kit barrel (ADR-0099). Consumers import from `@caisson-sh/ui/components`; set
// `transpilePackages: ["@caisson-sh/ui"]` in next.config so the raw .tsx + co-located .css transpile.
// Kit-first rule: new reusable UI lands HERE, never inlined on a screen.
export { Button } from "./button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./button";
export { Section } from "./section";
export type { SectionProps, SectionBand } from "./section";
export { Hero } from "./hero";
export type { HeroProps } from "./hero";
export { Card } from "./card";
export type { CardProps } from "./card";
export { Faq } from "./faq";
export type { FaqItem, FaqProps } from "./faq";
export { FeatureGrid } from "./feature-grid";
export type { FeatureGridProps } from "./feature-grid";
export { Terminal } from "./terminal";
export type { TerminalProps } from "./terminal";
export { CodeBlock } from "./code-block";
export type { CodeBlockProps } from "./code-block";
export { StatusChip } from "./status-chip";
export type { StatusChipProps, StatusChipTone } from "./status-chip";
export { CredentialStrip } from "./credential-strip";
export type { CredentialStripProps } from "./credential-strip";
export { BundleCard } from "./bundle-card";
export type { BundleCardProps } from "./bundle-card";
export { SkuMatrix } from "./sku-matrix";
export type { SkuMatrixProps, SkuMatrixRow } from "./sku-matrix";
export { Icon, registerIcons } from "./icon";
export type {
  IconGlyph,
  IconName,
  IconProps,
  RegisteredIconName,
} from "./icon";
export { Reveal } from "./reveal";
export type { RevealProps } from "./reveal";
export { ThemeToggle } from "./theme-toggle";
export type { ThemeToggleProps } from "./theme-toggle";
export { THEME_STORAGE_KEY, themeInitScript } from "./theme-init";
// Dashboard primitives (the buyer-dashboard data-app surface).
export { AppShell } from "./app-shell";
export type {
  AppShellNavItem,
  AppShellNavItemRenderProps,
  AppShellProps,
} from "./app-shell";
export { DataTable } from "./data-table";
export type {
  DataTableColumn,
  DataTableProps,
  DataTableSort,
  DataTableValue,
} from "./data-table";
export { Pagination, paginationRange } from "./pagination";
export type { PaginationProps } from "./pagination";
export { Dialog } from "./dialog";
export type { DialogProps } from "./dialog";
export { ConfirmDialog } from "./confirm-dialog";
export type { ConfirmDialogProps } from "./confirm-dialog";
export { Toast, ToastRegion } from "./toast";
export type { ToastProps, ToastRegionProps, ToastTone } from "./toast";
export { Select } from "./select";
export type { SelectOption, SelectProps } from "./select";
export { CopyField } from "./copy-field";
export type { CopyFieldProps } from "./copy-field";
export { DetailList } from "./detail-list";
export type { DetailItem, DetailListProps } from "./detail-list";
export { MetricStat } from "./metric-stat";
export type { MetricStatProps, MetricStatTone } from "./metric-stat";
export { MoneyCell, formatMoneyCellValue } from "./money-cell";
export type { MoneyCellProps, MoneyCellUnit } from "./money-cell";
export { LedgerList, LedgerRow, formatLedgerTimestamp } from "./ledger-list";
export type {
  LedgerEntry,
  LedgerListProps,
  LedgerRowProps,
} from "./ledger-list";
export { StatusPill } from "./status-pill";
export type { EntitlementStatus, StatusPillProps } from "./status-pill";
export { EmptyState } from "./empty-state";
export type { EmptyStateProps } from "./empty-state";
export { ErrorState } from "./error-state";
export type { ErrorStateProps } from "./error-state";
export { LoadingState } from "./loading-state";
export type { LoadingStateProps, LoadingStateVariant } from "./loading-state";
export { FormField } from "./form-field";
export type { FormFieldProps } from "./form-field";
export { MobileBuyBar } from "./mobile-buy-bar";
export type { MobileBuyBarProps } from "./mobile-buy-bar";
// Interactive primitives (ADR-0291).
export { Badge } from "./badge";
export type { BadgeProps, BadgeSize, BadgeTone } from "./badge";
export { Checkbox } from "./checkbox";
export type { CheckboxProps } from "./checkbox";
export { Radio } from "./radio";
export type { RadioProps } from "./radio";
export { Switch } from "./switch";
export type { SwitchProps } from "./switch";
export { Accordion } from "./accordion";
export type { AccordionItem, AccordionProps } from "./accordion";
export { Tabs } from "./tabs";
export type { TabItem, TabsProps } from "./tabs";
