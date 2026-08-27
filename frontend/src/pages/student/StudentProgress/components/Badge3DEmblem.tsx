interface Badge3DEmblemProps {
  code: string;
  earned: boolean;
}

export function Badge3DEmblem({ code, earned }: Badge3DEmblemProps) {
  const idPrefix = `b3d-${code}-${earned ? "e" : "l"}`;

  // If locked, render an ultra-sleek brushed titanium / obsidian padlock crest
  if (!earned) {
    return (
      <div className="badge-3d-emblem is-locked" aria-hidden="true">
        <svg viewBox="0 0 80 80" className="badge-3d-svg" fill="none">
          <defs>
            <linearGradient id={`${idPrefix}-lock-base`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3f3f46" />
              <stop offset="50%" stopColor="#27272a" />
              <stop offset="100%" stopColor="#18181b" />
            </linearGradient>
            <linearGradient id={`${idPrefix}-lock-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#71717a" />
              <stop offset="100%" stopColor="#3f3f46" />
            </linearGradient>
            <linearGradient id={`${idPrefix}-lock-sheen`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Base Octagon / Shield */}
          <polygon
            points="40,6 64,16 74,40 64,64 40,74 16,64 6,40 16,16"
            fill={`url(#${idPrefix}-lock-base)`}
            stroke={`url(#${idPrefix}-lock-rim)`}
            strokeWidth="1.5"
          />
          {/* Top Sheen Highlight */}
          <polygon
            points="40,8 62,18 71,40 40,40 9,40 18,18"
            fill={`url(#${idPrefix}-lock-sheen)`}
          />
          {/* Inner Dashed Ring */}
          <circle cx="40" cy="40" r="22" stroke="#52525b" strokeWidth="1.2" strokeDasharray="3 3" />
          {/* Padlock Icon */}
          <rect x="31" y="38" width="18" height="15" rx="3.5" fill="#71717a" stroke="#a1a1aa" strokeWidth="1" />
          <path d="M34 38 V32 C34 28.5 36.5 26 40 26 C43.5 26 46 28.5 46 32 V38" stroke="#a1a1aa" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="40" cy="45" r="1.8" fill="#18181b" />
          <path d="M40 47 V50" stroke="#18181b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // Individual earned badge 3D renders
  switch (code) {
    case "first_step":
      // 3D Emerald Starburst / Rocket Medal
      return (
        <div className="badge-3d-emblem is-earned is-emerald" aria-hidden="true">
          <div className="badge-glow-aura emerald" />
          <svg viewBox="0 0 80 80" className="badge-3d-svg" fill="none">
            <defs>
              <linearGradient id={`${idPrefix}-em-base`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#059669" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
              <linearGradient id={`${idPrefix}-em-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a7f3d0" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id={`${idPrefix}-gold-icon`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            {/* Outer Starburst Bevel */}
            <polygon
              points="40,4 49,15 64,10 66,25 78,32 72,46 78,60 64,66 60,80 46,74 34,78 28,66 14,62 18,48 8,36 20,26 18,12 32,15"
              fill={`url(#${idPrefix}-em-base)`}
              stroke={`url(#${idPrefix}-em-rim)`}
              strokeWidth="1.2"
            />
            {/* Inner Shield */}
            <circle cx="40" cy="40" r="23" fill="#065f46" stroke="#6ee7b7" strokeWidth="1.5" />
            <circle cx="40" cy="40" r="20" fill="none" stroke="#a7f3d0" strokeWidth="0.8" strokeDasharray="3 2" />
            {/* 3D Launch Rocket */}
            <path
              d="M40 22 C43 27 47 34 46 44 L40 41 L34 44 C33 34 37 27 40 22 Z"
              fill={`url(#${idPrefix}-gold-icon)`}
              stroke="#fef08a"
              strokeWidth="0.8"
            />
            <path d="M34 38 L28 44 L34 43 Z" fill="#f87171" stroke="#fca5a5" strokeWidth="0.6" />
            <path d="M46 38 L52 44 L46 43 Z" fill="#f87171" stroke="#fca5a5" strokeWidth="0.6" />
            <circle cx="40" cy="32" r="2.5" fill="#38bdf8" stroke="#fff" strokeWidth="0.8" />
            {/* Exhaust Flame */}
            <path d="M38 44 Q40 54 40 56 Q40 54 42 44 Z" fill="#ef4444" />
            <path d="M39 44 Q40 50 40 52 Q40 50 41 44 Z" fill="#fbbf24" />
          </svg>
        </div>
      );

    case "independent_user":
      // 3D Sapphire Winged Shield
      return (
        <div className="badge-3d-emblem is-earned is-sapphire" aria-hidden="true">
          <div className="badge-glow-aura sapphire" />
          <svg viewBox="0 0 80 80" className="badge-3d-svg" fill="none">
            <defs>
              <linearGradient id={`${idPrefix}-bl-base`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
              <linearGradient id={`${idPrefix}-bl-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#bfdbfe" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
            {/* Wing Flairs */}
            <path d="M12 36 C18 24 30 20 40 22 C34 28 32 38 34 48 C24 48 16 44 12 36 Z" fill="#1e40af" opacity="0.6" />
            <path d="M68 36 C62 24 50 20 40 22 C46 28 48 38 46 48 C56 48 64 44 68 36 Z" fill="#1e40af" opacity="0.6" />
            {/* Main Knight Shield */}
            <path
              d="M40 10 L62 18 C62 44 52 58 40 70 C28 58 18 44 18 18 Z"
              fill={`url(#${idPrefix}-bl-base)`}
              stroke={`url(#${idPrefix}-bl-rim)`}
              strokeWidth="2"
            />
            {/* Inner Sheen */}
            <path d="M40 12 L60 19 C58 38 52 50 40 60 Z" fill="#ffffff" opacity="0.15" />
            {/* 3D Compass Rose */}
            <circle cx="40" cy="38" r="14" fill="#1e3a8a" stroke="#93c5fd" strokeWidth="1.2" />
            <polygon points="40,26 43,36 52,38 43,40 40,50 37,40 28,38 37,36" fill="#fbbf24" stroke="#fef08a" strokeWidth="0.8" />
            <circle cx="40" cy="38" r="2.5" fill="#ef4444" stroke="#fff" strokeWidth="0.6" />
          </svg>
        </div>
      );

    case "advanced_communicator":
      // 3D Amethyst Faceted Diamond Crest
      return (
        <div className="badge-3d-emblem is-earned is-amethyst" aria-hidden="true">
          <div className="badge-glow-aura amethyst" />
          <svg viewBox="0 0 80 80" className="badge-3d-svg" fill="none">
            <defs>
              <linearGradient id={`${idPrefix}-pu-base`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="50%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#4c1d95" />
              </linearGradient>
              <linearGradient id={`${idPrefix}-gem-sheen`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Hexagon Crest Backing */}
            <polygon
              points="40,6 68,22 68,58 40,74 12,58 12,22"
              fill={`url(#${idPrefix}-pu-base)`}
              stroke="#e9d5ff"
              strokeWidth="1.8"
            />
            {/* Faceted Diamond Crystal */}
            <polygon points="40,16 60,28 40,62" fill="#a855f7" stroke="#e9d5ff" strokeWidth="0.8" />
            <polygon points="40,16 20,28 40,62" fill="#7e22ce" stroke="#e9d5ff" strokeWidth="0.8" />
            <polygon points="40,16 50,28 30,28" fill="#c084fc" stroke="#f3e8ff" strokeWidth="0.8" />
            <polygon points="40,16 60,28 50,28" fill="#d8b4fe" />
            <polygon points="40,16 20,28 30,28" fill="#6b21a8" />
            <polygon points="30,28 50,28 40,62" fill="#9333ea" />
            {/* Sparkle Glint */}
            <path d="M40 18 Q40 26 48 26 Q40 26 40 34 Q40 26 32 26 Q40 26 40 18 Z" fill="#ffffff" />
          </svg>
        </div>
      );

    case "mastery":
      // 3D Imperial Gold Crown / Trophy
      return (
        <div className="badge-3d-emblem is-earned is-gold" aria-hidden="true">
          <div className="badge-glow-aura gold" />
          <svg viewBox="0 0 80 80" className="badge-3d-svg" fill="none">
            <defs>
              <linearGradient id={`${idPrefix}-gold-base`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="40%" stopColor="#f59e0b" />
                <stop offset="80%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
              <linearGradient id={`${idPrefix}-gold-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            {/* Royal Laurel Medallion */}
            <circle cx="40" cy="40" r="32" fill={`url(#${idPrefix}-gold-base)`} stroke={`url(#${idPrefix}-gold-rim)`} strokeWidth="2" />
            <circle cx="40" cy="40" r="26" fill="#78350f" stroke="#fde68a" strokeWidth="1.2" />
            <circle cx="40" cy="40" r="23" fill="none" stroke="#fbbf24" strokeWidth="0.8" strokeDasharray="3 3" />
            {/* 3D Imperial Crown */}
            <path
              d="M24 48 L26 30 L34 40 L40 24 L46 40 L54 30 L56 48 Z"
              fill={`url(#${idPrefix}-gold-base)`}
              stroke="#fef08a"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <rect x="24" y="46" width="32" height="5" rx="2.5" fill="#f59e0b" stroke="#fef08a" strokeWidth="0.8" />
            {/* Jewels */}
            <circle cx="40" cy="24" r="2.2" fill="#ef4444" stroke="#fff" strokeWidth="0.6" />
            <circle cx="26" cy="30" r="1.8" fill="#3b82f6" stroke="#fff" strokeWidth="0.5" />
            <circle cx="54" cy="30" r="1.8" fill="#10b981" stroke="#fff" strokeWidth="0.5" />
            <circle cx="40" cy="48" r="1.5" fill="#ef4444" />
          </svg>
        </div>
      );

    case "four_skills":
      // 3D Quad-Orb Elemental Matrix
      return (
        <div className="badge-3d-emblem is-earned is-quad" aria-hidden="true">
          <div className="badge-glow-aura quad" />
          <svg viewBox="0 0 80 80" className="badge-3d-svg" fill="none">
            <circle cx="40" cy="40" r="32" fill="#18181b" stroke="#38bdf8" strokeWidth="2" />
            {/* 4 Connected Spheres */}
            <circle cx="28" cy="28" r="9" fill="#10b981" stroke="#a7f3d0" strokeWidth="1.2" />
            <circle cx="52" cy="28" r="9" fill="#3b82f6" stroke="#bfdbfe" strokeWidth="1.2" />
            <circle cx="52" cy="52" r="9" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.2" />
            <circle cx="28" cy="52" r="9" fill="#ec4899" stroke="#fbcfe8" strokeWidth="1.2" />
            {/* Connectors */}
            <line x1="28" y1="28" x2="52" y2="28" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />
            <line x1="52" y1="28" x2="52" y2="52" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />
            <line x1="52" y1="52" x2="28" y2="52" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />
            <line x1="28" y1="52" x2="28" y2="28" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />
            {/* Central Core */}
            <circle cx="40" cy="40" r="6" fill="#ffffff" stroke="#38bdf8" strokeWidth="1.2" />
          </svg>
        </div>
      );

    case "perfect_accuracy":
      // 3D Golden Bullseye Target
      return (
        <div className="badge-3d-emblem is-earned is-target" aria-hidden="true">
          <div className="badge-glow-aura target" />
          <svg viewBox="0 0 80 80" className="badge-3d-svg" fill="none">
            <circle cx="40" cy="40" r="32" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="2" />
            <circle cx="40" cy="40" r="25" fill="#f87171" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="40" cy="40" r="18" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="40" cy="40" r="11" fill="#b91c1c" stroke="#fef08a" strokeWidth="1.5" />
            <circle cx="40" cy="40" r="4.5" fill="#fbbf24" stroke="#ffffff" strokeWidth="0.8" />
            {/* Crossed Gold Arrows */}
            <line x1="14" y1="40" x2="66" y2="40" stroke="#fef08a" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="40" y1="14" x2="40" y2="66" stroke="#fef08a" strokeWidth="1.5" strokeDasharray="3 3" />
          </svg>
        </div>
      );

    case "committed_learner":
      // 3D Fiery Phoenix Flame of Endurance
      return (
        <div className="badge-3d-emblem is-earned is-flame" aria-hidden="true">
          <div className="badge-glow-aura flame" />
          <svg viewBox="0 0 80 80" className="badge-3d-svg" fill="none">
            <circle cx="40" cy="40" r="32" fill="#7c2d12" stroke="#fdba74" strokeWidth="2" />
            <circle cx="40" cy="40" r="25" fill="#c2410c" stroke="#ffedd5" strokeWidth="1.2" />
            {/* Multi-layered 3D Fire Flame */}
            <path
              d="M40 16 C48 26 56 36 50 50 C46 58 34 58 30 50 C24 38 34 26 40 16 Z"
              fill="#ea580c"
              stroke="#fed7aa"
              strokeWidth="1"
            />
            <path
              d="M40 26 C45 33 50 40 46 50 C43 56 37 56 34 50 C30 42 36 33 40 26 Z"
              fill="#f59e0b"
            />
            <path
              d="M40 36 C43 40 46 44 44 50 C42 54 38 54 36 50 C34 45 38 40 40 36 Z"
              fill="#fef08a"
            />
          </svg>
        </div>
      );

    default:
      // Generic 3D Medal
      return (
        <div className="badge-3d-emblem is-earned is-emerald" aria-hidden="true">
          <div className="badge-glow-aura emerald" />
          <svg viewBox="0 0 80 80" className="badge-3d-svg" fill="none">
            <circle cx="40" cy="40" r="32" fill="#047857" stroke="#6ee7b7" strokeWidth="2" />
            <polygon points="40,20 45,32 58,34 48,43 51,56 40,49 29,56 32,43 22,34 35,32" fill="#fbbf24" stroke="#fef08a" strokeWidth="1" />
          </svg>
        </div>
      );
  }
}
