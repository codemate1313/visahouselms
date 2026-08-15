interface PodiumCrest3DProps {
  rank: 1 | 2 | 3;
  isEmpty?: boolean;
}

export function PodiumCrest3D({ rank, isEmpty = false }: PodiumCrest3DProps) {
  if (isEmpty) {
    return (
      <div className={`podium-crest-3d rank-${rank} is-empty`} aria-hidden="true">
        <svg viewBox="0 0 140 120" className="crest-svg" fill="none">
          {/* Holographic dashed outline wings */}
          <path
            d="M25 65 C12 45 20 28 38 25 C34 38 38 52 48 58"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="3 3"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M115 65 C128 45 120 28 102 25 C106 38 102 52 92 58"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="3 3"
            strokeLinecap="round"
            opacity="0.4"
          />
          {/* Dashed Hexagon */}
          <polygon
            points="70,25 98,42 98,78 70,95 42,78 42,42"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 4"
            fill="rgba(255,255,255,0.03)"
          />
          <circle cx="70" cy="60" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="70" y="66" textAnchor="middle" fontSize="18" fontWeight="800" fill="currentColor" opacity="0.6">
            {rank}
          </text>
        </svg>
      </div>
    );
  }

  if (rank === 1) {
    return (
      <div className="podium-crest-3d rank-1" aria-label="1st Place Gold Crest">
        <div className="crest-glow-aura gold" />
        
        {/* Floating 3D Royal Crown */}
        <div className="crown-container">
          <svg viewBox="0 0 48 32" className="crown-svg" fill="none">
            <defs>
              <linearGradient id="crownGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF2A3" />
                <stop offset="35%" stopColor="#F59E0B" />
                <stop offset="70%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#92400E" />
              </linearGradient>
              <linearGradient id="crownSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <filter id="crownGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#F59E0B" floodOpacity="0.6" />
              </filter>
            </defs>
            <g filter="url(#crownGlow)">
              {/* Crown Base & Peaks */}
              <path
                d="M6 26 L10 10 L20 20 L24 6 L28 20 L38 10 L42 26 Z"
                fill="url(#crownGold)"
                stroke="#FDE68A"
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <path
                d="M6 26 L10 10 L20 20 L24 6 L28 20 L38 10 L42 26 Z"
                fill="url(#crownSheen)"
                opacity="0.5"
              />
              <rect x="6" y="24" width="36" height="4" rx="2" fill="url(#crownGold)" stroke="#FDE68A" strokeWidth="0.8" />
              {/* Crown Jewels */}
              <circle cx="24" cy="6" r="2.5" fill="#EF4444" stroke="#FFF" strokeWidth="0.8" />
              <circle cx="10" cy="10" r="2" fill="#3B82F6" stroke="#FFF" strokeWidth="0.7" />
              <circle cx="38" cy="10" r="2" fill="#10B981" stroke="#FFF" strokeWidth="0.7" />
              <circle cx="24" cy="26" r="1.5" fill="#EF4444" />
              <circle cx="15" cy="26" r="1.2" fill="#3B82F6" />
              <circle cx="33" cy="26" r="1.2" fill="#10B981" />
            </g>
          </svg>
        </div>

        {/* 3D Winged Gold Crest */}
        <svg viewBox="0 0 150 130" className="crest-svg" fill="none">
          <defs>
            {/* Gold Wing Gradients */}
            <linearGradient id="goldWingL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="40%" stopColor="#F59E0B" />
              <stop offset="80%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#78350F" />
            </linearGradient>
            <linearGradient id="goldWingR" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="40%" stopColor="#F59E0B" />
              <stop offset="80%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#78350F" />
            </linearGradient>
            {/* Hexagon Bevel */}
            <linearGradient id="goldHexOuter" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFBEB" />
              <stop offset="30%" stopColor="#FBBF24" />
              <stop offset="70%" stopColor="#B45309" />
              <stop offset="100%" stopColor="#451A03" />
            </linearGradient>
            <linearGradient id="goldHexInner" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FEF3C7" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#92400E" />
            </linearGradient>
            {/* 3D Star facets */}
            <linearGradient id="starFacet1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#FDE047" />
            </linearGradient>
            <linearGradient id="starFacet2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#A16207" />
            </linearGradient>
            <filter id="goldDropShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#78350F" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Left Wing Feathers */}
          <g filter="url(#goldDropShadow)">
            <path d="M42 62 C22 42 12 24 6 12 C18 20 28 32 38 48 Z" fill="url(#goldWingL)" />
            <path d="M46 70 C28 54 18 38 12 28 C24 34 34 46 42 58 Z" fill="url(#goldWingL)" />
            <path d="M50 78 C36 68 28 54 22 44 C32 50 40 60 48 70 Z" fill="url(#goldWingL)" opacity="0.9" />
          </g>

          {/* Right Wing Feathers */}
          <g filter="url(#goldDropShadow)">
            <path d="M108 62 C128 42 138 24 144 12 C132 20 122 32 112 48 Z" fill="url(#goldWingR)" />
            <path d="M104 70 C122 54 132 38 138 28 C126 34 116 46 108 58 Z" fill="url(#goldWingR)" />
            <path d="M100 78 C114 68 122 54 128 44 C118 50 110 60 102 70 Z" fill="url(#goldWingR)" opacity="0.9" />
          </g>

          {/* Hexagonal Outer Frame */}
          <polygon
            points="75,22 108,41 108,79 75,98 42,79 42,41"
            fill="url(#goldHexOuter)"
            filter="url(#goldDropShadow)"
          />
          {/* Hexagonal Inner Core */}
          <polygon
            points="75,27 103,43 103,77 75,93 47,77 47,43"
            fill="url(#goldHexInner)"
            stroke="#FFFBEB"
            strokeWidth="1.2"
          />

          {/* Central 3D Multi-Faceted Star */}
          <g transform="translate(75, 60)">
            {/* Top point */}
            <polygon points="0,0 0,-24 5,-7" fill="url(#starFacet1)" />
            <polygon points="0,0 0,-24 -5,-7" fill="url(#starFacet2)" />
            {/* Right point */}
            <polygon points="0,0 23,-7 7,-2" fill="url(#starFacet1)" />
            <polygon points="0,0 23,-7 9,5" fill="url(#starFacet2)" />
            {/* Bottom Right point */}
            <polygon points="0,0 14,19 7,7" fill="url(#starFacet1)" />
            <polygon points="0,0 14,19 0,9" fill="url(#starFacet2)" />
            {/* Bottom Left point */}
            <polygon points="0,0 -14,19 0,9" fill="url(#starFacet1)" />
            <polygon points="0,0 -14,19 -7,7" fill="url(#starFacet2)" />
            {/* Left point */}
            <polygon points="0,0 -23,-7 -9,5" fill="url(#starFacet1)" />
            <polygon points="0,0 -23,-7 -7,-2" fill="url(#starFacet2)" />
            {/* Center Gem / Ring */}
            <circle cx="0" cy="0" r="4.5" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1" />
          </g>
        </svg>
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div className="podium-crest-3d rank-2" aria-label="2nd Place Silver Crest">
        <div className="crest-glow-aura silver" />
        <svg viewBox="0 0 140 120" className="crest-svg" fill="none">
          <defs>
            <linearGradient id="silverWingL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="40%" stopColor="#CBD5E1" />
              <stop offset="80%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="silverWingR" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="40%" stopColor="#CBD5E1" />
              <stop offset="80%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="silverHexOuter" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#94A3B8" />
              <stop offset="70%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
            <linearGradient id="silverHexInner" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F1F5F9" />
              <stop offset="50%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="silverStar1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>
            <linearGradient id="silverStar2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            <filter id="silverDropShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#334155" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Left Wing */}
          <g filter="url(#silverDropShadow)">
            <path d="M38 58 C20 40 10 24 4 14 C14 20 24 30 34 44 Z" fill="url(#silverWingL)" />
            <path d="M42 66 C26 52 16 38 10 28 C20 34 30 44 38 54 Z" fill="url(#silverWingL)" />
            <path d="M46 72 C34 62 26 50 20 42 C28 46 36 54 44 64 Z" fill="url(#silverWingL)" opacity="0.9" />
          </g>

          {/* Right Wing */}
          <g filter="url(#silverDropShadow)">
            <path d="M102 58 C120 40 130 24 136 14 C126 20 116 30 106 44 Z" fill="url(#silverWingR)" />
            <path d="M98 66 C114 52 124 38 130 28 C120 34 110 44 102 54 Z" fill="url(#silverWingR)" />
            <path d="M94 72 C106 62 114 50 120 42 C112 46 104 54 96 64 Z" fill="url(#silverWingR)" opacity="0.9" />
          </g>

          {/* Hexagonal Outer Frame */}
          <polygon
            points="70,22 100,39 100,75 70,92 40,75 40,39"
            fill="url(#silverHexOuter)"
            filter="url(#silverDropShadow)"
          />
          {/* Hexagonal Inner Core */}
          <polygon
            points="70,26 96,41 96,73 70,88 44,73 44,41"
            fill="url(#silverHexInner)"
            stroke="#FFFFFF"
            strokeWidth="1.2"
          />

          {/* 3D Star */}
          <g transform="translate(70, 57)">
            <polygon points="0,0 0,-21 4,-6" fill="url(#silverStar1)" />
            <polygon points="0,0 0,-21 -4,-6" fill="url(#silverStar2)" />
            <polygon points="0,0 20,-6 6,-2" fill="url(#silverStar1)" />
            <polygon points="0,0 20,-6 8,4" fill="url(#silverStar2)" />
            <polygon points="0,0 12,17 6,6" fill="url(#silverStar1)" />
            <polygon points="0,0 12,17 0,8" fill="url(#silverStar2)" />
            <polygon points="0,0 -12,17 0,8" fill="url(#silverStar1)" />
            <polygon points="0,0 -12,17 -6,6" fill="url(#silverStar2)" />
            <polygon points="0,0 -20,-6 -8,4" fill="url(#silverStar1)" />
            <polygon points="0,0 -20,-6 -6,-2" fill="url(#silverStar2)" />
            <circle cx="0" cy="0" r="4" fill="#FFFFFF" stroke="#64748B" strokeWidth="0.8" />
          </g>
        </svg>
      </div>
    );
  }

  // Rank 3 (Bronze)
  return (
    <div className="podium-crest-3d rank-3" aria-label="3rd Place Bronze Crest">
      <div className="crest-glow-aura bronze" />
      <svg viewBox="0 0 140 120" className="crest-svg" fill="none">
        <defs>
          <linearGradient id="bronzeWingL" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FED7AA" />
            <stop offset="40%" stopColor="#F97316" />
            <stop offset="80%" stopColor="#C2410C" />
            <stop offset="100%" stopColor="#431407" />
          </linearGradient>
          <linearGradient id="bronzeWingR" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FED7AA" />
            <stop offset="40%" stopColor="#F97316" />
            <stop offset="80%" stopColor="#C2410C" />
            <stop offset="100%" stopColor="#431407" />
          </linearGradient>
          <linearGradient id="bronzeHexOuter" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFEDD5" />
            <stop offset="35%" stopColor="#EA580C" />
            <stop offset="70%" stopColor="#9A3412" />
            <stop offset="100%" stopColor="#431407" />
          </linearGradient>
          <linearGradient id="bronzeHexInner" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FED7AA" />
            <stop offset="50%" stopColor="#C2410C" />
            <stop offset="100%" stopColor="#7C2D12" />
          </linearGradient>
          <linearGradient id="bronzeStar1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#FDBA74" />
          </linearGradient>
          <linearGradient id="bronzeStar2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#7C2D12" />
          </linearGradient>
          <filter id="bronzeDropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#431407" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Left Wing */}
        <g filter="url(#bronzeDropShadow)">
          <path d="M38 58 C20 40 10 24 4 14 C14 20 24 30 34 44 Z" fill="url(#bronzeWingL)" />
          <path d="M42 66 C26 52 16 38 10 28 C20 34 30 44 38 54 Z" fill="url(#bronzeWingL)" />
          <path d="M46 72 C34 62 26 50 20 42 C28 46 36 54 44 64 Z" fill="url(#bronzeWingL)" opacity="0.9" />
        </g>

        {/* Right Wing */}
        <g filter="url(#bronzeDropShadow)">
          <path d="M102 58 C120 40 130 24 136 14 C126 20 116 30 106 44 Z" fill="url(#bronzeWingR)" />
          <path d="M98 66 C114 52 124 38 130 28 C120 34 110 44 102 54 Z" fill="url(#bronzeWingR)" />
          <path d="M94 72 C106 62 114 50 120 42 C112 46 104 54 96 64 Z" fill="url(#bronzeWingR)" opacity="0.9" />
        </g>

        {/* Hexagonal Frame */}
        <polygon
          points="70,22 100,39 100,75 70,92 40,75 40,39"
          fill="url(#bronzeHexOuter)"
          filter="url(#bronzeDropShadow)"
        />
        <polygon
          points="70,26 96,41 96,73 70,88 44,73 44,41"
          fill="url(#bronzeHexInner)"
          stroke="#FFEDD5"
          strokeWidth="1.2"
        />

        {/* 3D Star */}
        <g transform="translate(70, 57)">
          <polygon points="0,0 0,-21 4,-6" fill="url(#bronzeStar1)" />
          <polygon points="0,0 0,-21 -4,-6" fill="url(#bronzeStar2)" />
          <polygon points="0,0 20,-6 6,-2" fill="url(#bronzeStar1)" />
          <polygon points="0,0 20,-6 8,4" fill="url(#bronzeStar2)" />
          <polygon points="0,0 12,17 6,6" fill="url(#bronzeStar1)" />
          <polygon points="0,0 12,17 0,8" fill="url(#bronzeStar2)" />
          <polygon points="0,0 -12,17 0,8" fill="url(#bronzeStar1)" />
          <polygon points="0,0 -12,17 -6,6" fill="url(#bronzeStar2)" />
          <polygon points="0,0 -20,-6 -8,4" fill="url(#bronzeStar1)" />
          <polygon points="0,0 -20,-6 -6,-2" fill="url(#bronzeStar2)" />
          <circle cx="0" cy="0" r="4" fill="#FFEDD5" stroke="#9A3412" strokeWidth="0.8" />
        </g>
      </svg>
    </div>
  );
}
