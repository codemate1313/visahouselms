import { Icon } from "../icons";
import { SegmentedControl } from "../ui";

interface ChartViewToggleProps {
  chartLabel?: string;
  onChange: (showTable: boolean) => void;
  showTable: boolean;
  tableLabel?: string;
}

export function ChartViewToggle({
  chartLabel = "Chart view",
  onChange,
  showTable,
  tableLabel = "Table view",
}: ChartViewToggleProps) {
  return (
    <SegmentedControl
      ariaLabel="Chart display"
      iconOnly
      onChange={(value) => onChange(value === "table")}
      options={[
        {
          ariaLabel: chartLabel,
          icon: <Icon name="analytics" />,
          label: chartLabel,
          title: chartLabel,
          value: "chart",
        },
        {
          ariaLabel: tableLabel,
          icon: <Icon name="spreadsheet" />,
          label: tableLabel,
          title: tableLabel,
          value: "table",
        },
      ]}
      size="sm"
      value={showTable ? "table" : "chart"}
    />
  );
}
