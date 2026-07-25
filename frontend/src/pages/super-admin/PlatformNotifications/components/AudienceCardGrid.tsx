import { Icon } from "@/components/icons";
import { audienceCards } from "../PlatformNotifications.strings";

interface AudienceCardGridProps {
  selectedAudiences: string[];
  onToggle: (key: string) => void;
}

export function AudienceCardGrid({ selectedAudiences, onToggle }: AudienceCardGridProps) {
  return (
    <div className="pn-audience-grid">
      {audienceCards.map((card) => {
        const isSelected = selectedAudiences.includes(card.key);
        return (
          <div
            key={card.key}
            className={`pn-audience-card ${isSelected ? "is-selected" : ""}`}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={() => onToggle(card.key)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggle(card.key);
              }
            }}
          >
            <div className="pn-audience-icon-wrapper">
              <Icon name={card.iconName} />
            </div>
            <div className="pn-audience-info">
              <strong>{card.title}</strong>
              <span>{card.desc}</span>
            </div>
            <div className="pn-audience-checkbox">
              {isSelected && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
