import { audienceCards } from "../InstituteAnnouncements.strings";

interface AudienceCardGridProps {
  selectedAudiences: string[];
  onToggle: (key: string) => void;
}

export function AudienceCardGrid({ selectedAudiences, onToggle }: AudienceCardGridProps) {
  return (
    <div className="audience-cards-grid">
      {audienceCards.map((card) => {
        const isSelected = selectedAudiences.includes(card.key);
        return (
          <div
            key={card.key}
            className={`audience-checkbox-card ${isSelected ? "selected" : ""}`}
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
            <div className="audience-card-checkbox-custom">{isSelected && <span>✓</span>}</div>
            <div className="audience-card-body">
              <span className="audience-card-title">
                <span className="audience-card-icon">{card.icon}</span>
                {card.title}
              </span>
              <span className="audience-card-desc">{card.desc}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
