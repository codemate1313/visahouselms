/*
 * Shared dashboard UI primitives.
 *
 * Every primitive lives in its own folder with its own stylesheet
 * (`Button/Button.tsx` + `Button/Button.css`) and is re-exported here, so call
 * sites import from `@/components/ui` and never restate a control's markup or
 * styling.
 *
 * Theming: all brand-colored surfaces resolve through `var(--primary)`, which
 * each portal wrapper remaps — `.super-admin-portal` to its sidebar red and
 * `.institute-branded-portal` to the institute's own color. That is what keeps
 * buttons, focus rings and dropdowns matching the sidebar they sit next to.
 * Landing pages render outside those wrappers and are unaffected.
 */

export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { DashboardButton } from "./DashboardButton";
export type {
  DashboardAnchorButtonProps,
  DashboardActionButtonProps,
  DashboardButtonProps,
  DashboardRouterButtonProps,
} from "./DashboardButton";

export { DataTableCard } from "./DataTableCard";
export type { DataTableCardProps } from "./DataTableCard";

export { LinkButton } from "./LinkButton";
export type { LinkButtonProps } from "./LinkButton";

export { IconButton } from "./IconButton";
export type { IconButtonProps, IconButtonVariant, IconButtonSize } from "./IconButton";

export { ExportButtons } from "./ExportButtons";
export type { ExportButtonsProps } from "./ExportButtons";

export { SearchInput } from "./SearchInput";
export type { SearchInputProps } from "./SearchInput";

export { Input } from "./Input";
export type { InputProps } from "./Input";

export { Textarea } from "./Textarea";
export type { TextareaProps } from "./Textarea";

export { SearchableSelect } from "./SearchableSelect";
export type { SelectOption } from "./SearchableSelect";

export { Checkbox } from "./Checkbox";
export type { CheckboxProps, CheckboxSize } from "./Checkbox";

export { FilterBar } from "./FilterBar";
export type { FilterBarProps } from "./FilterBar";

export { Card } from "./Card";
export type { CardProps } from "./Card";

export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";


export { SegmentedControl } from "./SegmentedControl";
export type { SegmentedControlProps, SegmentedOption } from "./SegmentedControl";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeTone } from "./Badge";


export { PageHeader } from "./PageHeader";
export type { PageHeaderProps } from "./PageHeader";

export { RequiredMark } from "./RequiredMark";
export { RecordCards } from "./RecordCards";
export type { RecordCardsProps, RecordField } from "./RecordCards";
export { RangeSlider } from "./RangeSlider";
export type { RangeSliderProps } from "./RangeSlider";

export {
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
  StepperDescription,
  StepperSeparator,
} from "./Stepper";
export type { StepperProps, StepperItemProps, StepperTriggerProps } from "./Stepper";

export { renderRichText, RichTextContent, stripRichTextMarkers } from "./RichText/RichText";
export type { RichTextContentProps } from "./RichText/RichText";

export { RichTextEditor } from "./RichTextEditor/RichTextEditor";
export type { RichTextEditorProps } from "./RichTextEditor/RichTextEditor";
