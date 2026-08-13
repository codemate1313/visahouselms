import { useId, useMemo } from "react";

interface ExaminerAvatarSvgProps {
  gender?: "female" | "male" | string;
  viseme?: number;
  isPlaying?: boolean;
}

/* Facial proportions, in viewBox units, shared by both examiners. The previous
   artwork placed a round head and dot eyes wherever they looked balanced, which
   is exactly what read as a cartoon: a real head is about 1.4x taller than it
   is wide, the eye line sits at its vertical midpoint, and the mouth sits a
   third of the way from the nose base to the chin. Everything below is derived
   from those rules rather than eyeballed.

   The key light is fixed at the upper left. Every shadow and highlight commits
   to it, because a face lit evenly from both sides has no volume - that
   symmetry was most of what made the old avatar look flat. */
const EYE_Y = 166;
const EYE_L_X = 174;
const EYE_R_X = 226;
const MOUTH_X = 200;
const MOUTH_Y = 212;

interface MouthShape {
  /** Half-width of the lip line - how far the corners sit from centre. */
  halfWidth: number;
  /** Half-height of the opening between the lips. 0 closes the mouth. */
  open: number;
  /** Extra forward pucker, used by the rounded U/W shape. */
  pucker: number;
}

/** Mouth geometry per viseme id, matching avatar_service's viseme ids:
    0 rest, 1 A/O, 2 E/I, 3 U/W, 4 M/P/B, 5 L/N/T/D. */
function mouthShape(viseme: number): MouthShape {
  switch (viseme) {
    case 1: return { halfWidth: 14, open: 9.5, pucker: 0 };
    case 2: return { halfWidth: 19, open: 4.5, pucker: 0 };
    case 3: return { halfWidth: 9, open: 6.5, pucker: 2.5 };
    case 4: return { halfWidth: 17, open: 0, pucker: 0 };
    case 5: return { halfWidth: 17, open: 3.2, pucker: 0 };
    default: return { halfWidth: 17.5, open: 0.5, pucker: 0 };
  }
}

interface Traits {
  prefix: string;
  /** Face silhouette - the jaw is the main male/female difference. */
  face: string;
  /** Hair behind the head (empty for the short male cut) and the fringe. */
  hairBack: string;
  hairFront: string;
  /** Sideburns / hair over the ears, drawn after the face. */
  hairSides: string;
  hairTop: string;
  hairMid: string;
  hairLow: string;
  browLeft: string;
  browRight: string;
  browOpacity: number;
  skinTop: string;
  skinMid: string;
  skinLow: string;
  shadow: string;
  neckShade: string;
  irisInner: string;
  irisMid: string;
  irisOuter: string;
  lashWidth: number;
  lipTop: string;
  lipBottom: string;
  lipLine: string;
  /** Lip fullness multiplier - the female portrait carries a fuller lower lip. */
  lipFullness: number;
  blush: number;
  stubble: boolean;
  /** Long hair covers the ears, so only the short cut draws them. */
  ears: boolean;
  collar: string;
  tie: string;
  suitTop: string;
  suitLow: string;
  rim: string;
}

const FEMALE: Traits = {
  prefix: "fx",
  face: "M 200 85 C 168 85 143 108 141 152 C 140 178 146 198 156 216 C 166 236 182 247 200 247 C 218 247 234 236 244 216 C 254 198 260 178 259 152 C 257 108 232 85 200 85 Z",
  hairBack: "M 200 70 C 150 70 124 108 128 156 C 131 198 121 242 113 298 C 128 308 149 301 155 277 C 147 229 147 186 153 152 L 247 152 C 253 186 253 229 245 277 C 251 301 272 308 287 298 C 279 242 269 198 272 156 C 276 108 250 70 200 70 Z",
  /* Swept across from a part above the left brow, so the hairline is a diagonal
     rather than the symmetrical arc that read as a helmet. */
  hairFront: "M 138 158 C 132 106 160 82 200 82 C 240 82 268 106 262 158 C 258 128 247 114 231 108 C 218 103 204 107 194 116 C 183 126 167 134 155 139 C 147 143 141 150 138 158 Z",
  hairSides: "M 139 150 C 134 176 136 196 142 210 C 138 190 138 168 141 150 Z M 261 150 C 266 176 264 196 258 210 C 262 190 262 168 259 150 Z",
  hairTop: "#39332f",
  hairMid: "#1d1a18",
  hairLow: "#0c0b0a",
  browLeft: "M 159 152 C 167 144 184 143.5 191 150.5 C 184 147.5 168 148.5 159 154.5 Z",
  browRight: "M 241 153.5 C 233 145.5 216 145 209 152 C 216 149 232 150 241 156 Z",
  browOpacity: 0.82,
  skinTop: "#f6d8c5",
  skinMid: "#eec3ab",
  skinLow: "#dba887",
  shadow: "#8a4f28",
  neckShade: "#a86f52",
  irisInner: "#8a6540",
  irisMid: "#5b3f26",
  irisOuter: "#2b1c10",
  lashWidth: 2.6,
  lipTop: "#bf6b70",
  lipBottom: "#d0797f",
  lipLine: "#8d4048",
  lipFullness: 1.1,
  blush: 0.16,
  stubble: false,
  ears: false,
  collar: "#eef2f7",
  tie: "#b91c2b",
  suitTop: "#25304a",
  suitLow: "#0c1220",
  rim: "#a5b4fc",
};

const MALE: Traits = {
  prefix: "mx",
  face: "M 200 83 C 166 83 139 106 137 152 C 136 180 142 201 152 219 C 163 240 180 250 200 250 C 220 250 237 240 248 219 C 258 201 264 180 263 152 C 261 106 234 83 200 83 Z",
  hairBack: "",
  /* Short executive cut with a slightly receded temple on the lit side. */
  hairFront: "M 136 152 C 132 100 162 78 200 78 C 238 78 268 100 264 152 C 259 118 248 104 228 99 C 210 94 186 100 168 112 C 155 121 141 138 136 152 Z",
  hairSides: "M 137 148 C 133 168 135 184 140 196 C 137 180 137 162 139 148 Z M 263 148 C 267 168 265 184 260 196 C 263 180 263 162 261 148 Z",
  hairTop: "#453f3a",
  hairMid: "#282421",
  hairLow: "#141210",
  browLeft: "M 156 150.5 C 165 140.5 186 141 193 148.5 C 186 144.5 167 144 156 155 Z",
  browRight: "M 244 152 C 235 142 214 142.5 207 150 C 214 146 233 145.5 244 156.5 Z",
  browOpacity: 0.9,
  skinTop: "#eecdb1",
  skinMid: "#e0b492",
  skinLow: "#c8926c",
  shadow: "#7a441f",
  neckShade: "#95603e",
  irisInner: "#6b8fb3",
  irisMid: "#3c5f85",
  irisOuter: "#1c3049",
  lashWidth: 2.1,
  lipTop: "#b47f6d",
  lipBottom: "#c08d7b",
  lipLine: "#8a5340",
  lipFullness: 0.85,
  blush: 0.09,
  stubble: true,
  ears: true,
  collar: "#f4f7fa",
  tie: "#b91c2b",
  suitTop: "#1c2537",
  suitLow: "#080d17",
  rim: "#93c5fd",
};

export function ExaminerAvatarSvg({ gender = "female", viseme = 0, isPlaying = false }: ExaminerAvatarSvgProps) {
  const t = gender.toLowerCase() === "male" ? MALE : FEMALE;
  // Gradient and clip ids must not collide when two examiners share a page.
  const rawId = useId();
  const uid = `${t.prefix}${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const ref = (name: string) => `url(#${uid}_${name})`;

  const mouth = useMemo(() => {
    const { halfWidth: hw, open, pucker } = mouthShape(viseme);
    const cx = MOUTH_X;
    const cy = MOUTH_Y;
    const corner = 1.2; // corners of the mouth ride slightly above the lip line
    const upperRise = 5.5 + pucker;
    const lowerDrop = (7 + pucker) * t.lipFullness;

    /* Opening between the lips. Even at rest it keeps a sliver of height so the
       lip line reads as a seam rather than a drawn stroke. */
    const cavity = [
      `M ${cx - hw} ${cy - corner}`,
      `Q ${cx} ${cy - corner - open * 1.5} ${cx + hw} ${cy - corner}`,
      `Q ${cx} ${cy - corner + open * 1.8} ${cx - hw} ${cy - corner} Z`,
    ].join(" ");

    /* Upper lip: cupid's bow at the top, the roof of the opening underneath. */
    const upper = [
      `M ${cx - hw - 1.5} ${cy - corner}`,
      `C ${cx - hw + 3} ${cy - upperRise} ${cx - 7} ${cy - upperRise - 0.5} ${cx - 3} ${cy - upperRise + 2.6}`,
      `L ${cx} ${cy - upperRise + 1}`,
      `L ${cx + 3} ${cy - upperRise + 2.6}`,
      `C ${cx + 7} ${cy - upperRise - 0.5} ${cx + hw - 3} ${cy - upperRise} ${cx + hw + 1.5} ${cy - corner}`,
      `L ${cx + hw} ${cy - corner}`,
      `Q ${cx} ${cy - corner - open * 1.5} ${cx - hw} ${cy - corner}`,
      "Z",
    ].join(" ");

    /* Lower lip: the floor of the opening, then the full outer curve. */
    const lower = [
      `M ${cx - hw} ${cy - corner}`,
      `Q ${cx} ${cy - corner + open * 1.8} ${cx + hw} ${cy - corner}`,
      `L ${cx + hw + 1.5} ${cy - corner}`,
      `C ${cx + hw - 2} ${cy + lowerDrop} ${cx + 6} ${cy + lowerDrop + 2.4} ${cx} ${cy + lowerDrop + 2.8}`,
      `C ${cx - 6} ${cy + lowerDrop + 2.4} ${cx - hw + 2} ${cy + lowerDrop} ${cx - hw - 1.5} ${cy - corner}`,
      "Z",
    ].join(" ");

    return { cavity, upper, lower, open, halfWidth: hw, lowerDrop };
  }, [viseme, t.lipFullness]);

  const showTeeth = mouth.open >= 3;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 400"
      width="100%"
      height="100%"
      className={`examiner-svg-stage ${isPlaying ? "is-speaking" : ""}`}
    >
      <defs>
        <radialGradient id={`${uid}_bg`} cx="50%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#2b3350" />
          <stop offset="48%" stopColor="#141a2b" />
          <stop offset="100%" stopColor="#070a12" />
        </radialGradient>
        <radialGradient id={`${uid}_keylight`} cx="30%" cy="20%" r="52%">
          <stop offset="0%" stopColor={isPlaying ? "#fecdd3" : "#c7d2fe"} stopOpacity={isPlaying ? 0.26 : 0.2} />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>

        {/* Skin runs light at the forehead and deepens under the jaw, the way a
            single soft key light above the subject actually falls. */}
        <linearGradient id={`${uid}_skin`} x1="14%" y1="0%" x2="86%" y2="100%">
          <stop offset="0%" stopColor={t.skinTop} />
          <stop offset="50%" stopColor={t.skinMid} />
          <stop offset="100%" stopColor={t.skinLow} />
        </linearGradient>
        <linearGradient id={`${uid}_neck`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={t.neckShade} />
          <stop offset="70%" stopColor={t.skinMid} />
          <stop offset="100%" stopColor={t.skinLow} />
        </linearGradient>
        <linearGradient id={`${uid}_hair`} x1="16%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor={t.hairTop} />
          <stop offset="40%" stopColor={t.hairMid} />
          <stop offset="100%" stopColor={t.hairLow} />
        </linearGradient>
        <linearGradient id={`${uid}_suit`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={t.suitTop} />
          <stop offset="100%" stopColor={t.suitLow} />
        </linearGradient>
        <radialGradient id={`${uid}_iris`} cx="46%" cy="42%" r="54%">
          <stop offset="0%" stopColor={t.irisInner} />
          <stop offset="50%" stopColor={t.irisMid} />
          <stop offset="86%" stopColor={t.irisOuter} />
          <stop offset="100%" stopColor="#0b0f16" />
        </radialGradient>
        <linearGradient id={`${uid}_sclera`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c8cfda" />
          <stop offset="44%" stopColor="#f6f8fc" />
          <stop offset="100%" stopColor="#dfe5ed" />
        </linearGradient>
        <linearGradient id={`${uid}_teeth`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e4e9f0" />
          <stop offset="100%" stopColor="#fafcff" />
        </linearGradient>
        <linearGradient id={`${uid}_lipTop`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={t.lipLine} />
          <stop offset="100%" stopColor={t.lipTop} />
        </linearGradient>
        <linearGradient id={`${uid}_lipBottom`} x1="20%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor={t.lipTop} />
          <stop offset="55%" stopColor={t.lipBottom} />
          <stop offset="100%" stopColor={t.lipLine} />
        </linearGradient>

        {/* Blur turns flat shapes into modelling: every shadow and highlight on
            the face is a blurred blob clipped back inside the silhouette. */}
        <filter id={`${uid}_soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={`${uid}_softer`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <filter id={`${uid}_glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feComposite in="SourceGraphic" in2="b" operator="over" />
        </filter>
        {/* Fine grain over the skin - photographs have it, flat vectors do not,
            and its absence is a large part of why the old face looked drawn. */}
        <filter id={`${uid}_grain`} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        {/* Stubble is grain, not a smear: noise tinted cool and masked to the
            beard area. */}
        <filter id={`${uid}_beard`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.16  0 0 0 0 0.19  0 0 0 0 0.27  0 0 0 -1.1 0.62"
          />
        </filter>

        <clipPath id={`${uid}_faceClip`}>
          <path d={t.face} />
        </clipPath>
        <clipPath id={`${uid}_beardClip`}>
          <path d="M 157 196 C 161 230 180 248 200 248 C 220 248 239 230 243 196 C 237 222 221 236 200 236 C 179 236 163 222 157 196 Z" />
        </clipPath>
        <clipPath id={`${uid}_eyeL`}>
          <path d="M 162 165.5 C 167 156.5 183 155.5 187 167 C 182.5 174 167 173.5 162 165.5 Z" />
        </clipPath>
        <clipPath id={`${uid}_eyeR`}>
          <path d="M 238 165.5 C 233 156.5 217 155.5 213 167 C 217.5 174 233 173.5 238 165.5 Z" />
        </clipPath>
        <clipPath id={`${uid}_mouthClip`}>
          <path d={mouth.cavity} />
        </clipPath>
        <radialGradient id={`${uid}_vig`} cx="50%" cy="44%" r="72%">
          <stop offset="58%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
        </radialGradient>
      </defs>

      {/* Studio backdrop */}
      <rect width="400" height="400" fill={ref("bg")} />
      <rect width="400" height="400" fill={ref("keylight")} />

      {/* The sitter is framed as a portrait crop: the head fills the frame the
          way a headshot does instead of floating in the middle of it. */}
      <g transform="translate(200 178) scale(1.2) translate(-200 -178)">
        {t.hairBack && <path d={t.hairBack} fill={ref("hair")} />}

        {/* Ears, tucked behind the jaw line and kept in shadow so they read as
            set back from the face rather than stuck onto it. */}
        {t.ears && (
          <g>
            <path d="M 142 174 C 134 172 132 183 136 193 C 139 200 144 203 146 200 Z" fill={ref("skin")} />
            <path d="M 258 174 C 266 172 268 183 264 193 C 261 200 256 203 254 200 Z" fill={ref("skin")} />
            <path d="M 142 174 C 134 172 132 183 136 193 C 139 200 144 203 146 200 Z" fill={t.shadow} opacity="0.28" />
            <path d="M 258 174 C 266 172 268 183 264 193 C 261 200 256 203 254 200 Z" fill={t.shadow} opacity="0.42" />
            <path d="M 141 180 C 137 183 137 190 140 194" fill="none" stroke={t.shadow} strokeWidth="1.4" strokeOpacity="0.5" strokeLinecap="round" />
            <path d="M 259 180 C 263 183 263 190 260 194" fill="none" stroke={t.shadow} strokeWidth="1.4" strokeOpacity="0.6" strokeLinecap="round" />
          </g>
        )}

        {/* Neck: narrower than the jaw, and drawn before the clothing so the
            collar closes over its base rather than the neck sitting on top of
            the shirt. Most of it stays in the shadow the chin casts, which is
            what seats a head on a body. */}
        <path d="M 183 210 L 217 210 C 218 242 221 260 228 272 L 228 308 L 172 308 L 172 272 C 179 260 182 242 183 210 Z" fill={ref("neck")} />
        <ellipse cx="200" cy="224" rx="30" ry="16" fill={t.shadow} opacity="0.6" filter={ref("soft")} />
        <ellipse cx="215" cy="248" rx="11" ry="24" fill={t.shadow} opacity="0.28" filter={ref("soft")} />

        {/* Shoulders, shirt, notch lapels and tie */}
        <path d="M 44 400 C 50 320 104 288 168 278 L 232 278 C 296 288 350 320 356 400 Z" fill={ref("suit")} />
        <path d="M 168 278 L 200 352 L 232 278 C 222 294 178 294 168 278 Z" fill={t.collar} />
        <path d="M 168 278 L 200 352 L 188 357 L 148 292 Z" fill="#000000" opacity="0.28" />
        <path d="M 232 278 L 200 352 L 212 357 L 252 292 Z" fill="#000000" opacity="0.36" />
        <path d="M 168 281 L 197 348" fill="none" stroke="#ffffff" strokeOpacity="0.09" strokeWidth="1.6" />
        <path d="M 192 350 L 208 350 L 211 400 L 189 400 Z" fill={t.tie} />
        {/* The chin casts onto the collar, which is what closes the gap between
            head and body. */}
        <ellipse cx="200" cy="286" rx="42" ry="12" fill="#000000" opacity="0.3" filter={ref("soft")} />

        {/* Face */}
        <path d={t.face} fill={ref("skin")} />

        {/* Facial modelling, clipped so no blur spills past the silhouette */}
        <g clipPath={ref("faceClip")}>
          <g filter={ref("soft")}>
            {/* Key light upper left: the right side of the face falls away hard,
                the left only softly. */}
            <ellipse cx="256" cy="176" rx="19" ry="56" fill={t.shadow} opacity="0.42" />
            <ellipse cx="145" cy="180" rx="14" ry="48" fill={t.shadow} opacity="0.16" />
            {/* Hollow under the cheekbones and the jaw's underside */}
            <ellipse cx="166" cy="200" rx="14" ry="10" fill={t.shadow} opacity="0.09" />
            <ellipse cx="234" cy="200" rx="15" ry="11" fill={t.shadow} opacity="0.17" />
            <ellipse cx="202" cy="244" rx="38" ry="12" fill={t.shadow} opacity="0.26" />
            {/* Brow ridge and the sockets it shades */}
            <ellipse cx="174" cy="159" rx="17" ry="7" fill={t.shadow} opacity="0.16" />
            <ellipse cx="226" cy="159" rx="17" ry="7" fill={t.shadow} opacity="0.22" />
            <ellipse cx="174" cy="179" rx="13" ry="5" fill={t.shadow} opacity="0.1" />
            <ellipse cx="226" cy="179" rx="13" ry="5" fill={t.shadow} opacity="0.13" />
            {/* Nose: one soft shadow down the shaded side, one under the tip.
                No outline, no highlight blob - that pairing was the snout. */}
            <ellipse cx="209" cy="184" rx="5" ry="20" fill={t.shadow} opacity="0.26" />
            <ellipse cx="203" cy="203" rx="12" ry="4" fill={t.shadow} opacity="0.26" />
            <ellipse cx="196" cy="180" rx="3.4" ry="17" fill="#ffffff" opacity="0.1" />
            {/* Nasolabial fold, stronger on the shaded side */}
            <ellipse cx="184" cy="206" rx="3.2" ry="7" fill={t.shadow} opacity="0.08" />
            <ellipse cx="216" cy="206" rx="3.4" ry="7.5" fill={t.shadow} opacity="0.13" />
            {/* Forehead, cheek and chin highlights, weighted to the lit side */}
            <ellipse cx="188" cy="128" rx="30" ry="17" fill="#ffffff" opacity="0.15" />
            <ellipse cx="170" cy="186" rx="16" ry="12" fill="#ffffff" opacity="0.13" />
            <ellipse cx="230" cy="188" rx="13" ry="10" fill="#ffffff" opacity="0.05" />
            <ellipse cx="198" cy="235" rx="10" ry="6" fill="#ffffff" opacity="0.1" />
            {/* Warmth across the cheeks and the tip of the nose */}
            <ellipse cx="168" cy="192" rx="17" ry="11" fill="#d96a63" opacity={t.blush} />
            <ellipse cx="232" cy="192" rx="17" ry="11" fill="#d96a63" opacity={t.blush * 0.8} />
            <ellipse cx="200" cy="196" rx="9" ry="6" fill="#d96a63" opacity={t.blush * 0.7} />
            {/* Shadow the hair casts onto the forehead */}
            <ellipse cx="196" cy="114" rx="58" ry="13" fill={t.shadow} opacity="0.32" />
          </g>

          {t.stubble && (
            <g clipPath={ref("beardClip")}>
              <rect x="140" y="180" width="120" height="80" fill="#3b4658" opacity="0.12" filter={ref("soft")} />
              <rect x="140" y="180" width="120" height="80" filter={ref("beard")} opacity="0.22" />
            </g>
          )}

          {/* Skin grain */}
          <rect
            x="130"
            y="78"
            width="140"
            height="180"
            filter={ref("grain")}
            opacity="0.075"
            style={{ mixBlendMode: "overlay" }}
          />
        </g>

        {/* Nostrils: small, soft, and set into the shadow under the tip. */}
        <ellipse cx="192.5" cy="199.5" rx="2.7" ry="1.7" fill="#61371c" opacity="0.5" transform="rotate(-16 192.5 199.5)" filter={ref("softer")} />
        <ellipse cx="207.5" cy="199.5" rx="2.7" ry="1.7" fill="#5a3018" opacity="0.62" transform="rotate(16 207.5 199.5)" filter={ref("softer")} />

        {/* Brows, blurred just enough to read as hair rather than ink */}
        <g filter={ref("softer")} opacity={t.browOpacity}>
          <path d={t.browLeft} fill={t.hairMid} />
          <path d={t.browRight} fill={t.hairMid} />
        </g>

        {/* Eyes. The blink animation scales this whole group, so lids, iris and
            lashes squash together the way a real eyelid closes. */}
        <g className="examiner-eye-group">
          {[{ cx: EYE_L_X, clip: "eyeL", left: true }, { cx: EYE_R_X, clip: "eyeR", left: false }].map((eye) => (
            <g key={eye.cx}>
              <g clipPath={ref(eye.clip)}>
                <rect x={eye.cx - 16} y={EYE_Y - 14} width="32" height="28" fill={ref("sclera")} />
                {/* Sclera is never evenly lit - the upper lid shades its top. */}
                <ellipse cx={eye.cx} cy={EYE_Y - 10.5} rx="16" ry="7.5" fill="#6f7a8c" opacity="0.55" filter={ref("softer")} />
                <circle cx={eye.cx} cy={EYE_Y} r="6.2" fill={ref("iris")} />
                {/* Limbal ring and the light bouncing off the iris floor */}
                <circle cx={eye.cx} cy={EYE_Y} r="6.2" fill="none" stroke="#10141c" strokeWidth="1" opacity="0.85" />
                <ellipse cx={eye.cx} cy={EYE_Y + 2.4} rx="3.6" ry="2.2" fill="#ffffff" opacity="0.14" />
                <circle cx={eye.cx} cy={EYE_Y} r="2.8" fill="#08090d" />
                <circle cx={eye.cx - 2.1} cy={EYE_Y - 2.3} r="1.7" fill="#ffffff" opacity="0.95" />
                <circle cx={eye.cx + 2.4} cy={EYE_Y + 1.9} r="0.8" fill="#ffffff" opacity="0.55" />
              </g>
              {/* Lash line, heaviest at the outer corner */}
              <path
                d={eye.left
                  ? "M 161.5 165 C 167 156 183.5 155 187.5 166.5"
                  : "M 238.5 165 C 233 156 216.5 155 212.5 166.5"}
                fill="none"
                stroke="#1b1410"
                strokeWidth={t.lashWidth}
                strokeLinecap="round"
                opacity="0.88"
              />
              {/* Lower lid catches a thin highlight */}
              <path
                d={eye.left
                  ? "M 163 168 C 168 173.5 181 174 186 168"
                  : "M 237 168 C 232 173.5 219 174 214 168"}
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.9"
                strokeOpacity="0.3"
                strokeLinecap="round"
              />
              {/* Lid crease */}
              <path
                d={eye.left
                  ? "M 161 158.5 C 168 150.5 184 150 190 157"
                  : "M 239 159 C 232 151 216 150.5 210 157.5"}
                fill="none"
                stroke={t.shadow}
                strokeWidth="1.2"
                strokeOpacity="0.32"
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>

        {/* Mouth */}
        <g className="examiner-mouth-group">
          <path d={mouth.cavity} fill="#3a0f16" />
          {showTeeth && (
            <g clipPath={ref("mouthClip")}>
              <rect
                x={MOUTH_X - mouth.halfWidth - 2}
                y={MOUTH_Y - mouth.open * 1.6 - 3}
                width={mouth.halfWidth * 2 + 4}
                height={mouth.open * 1.9 + 3}
                fill={ref("teeth")}
              />
              {/* Tongue and lower teeth only read at wider openings. */}
              {mouth.open >= 7 && (
                <>
                  <ellipse cx={MOUTH_X} cy={MOUTH_Y + mouth.open * 1.5} rx={mouth.halfWidth * 0.7} ry={mouth.open * 0.7} fill="#9c454e" />
                  <rect
                    x={MOUTH_X - mouth.halfWidth}
                    y={MOUTH_Y + mouth.open * 1.05}
                    width={mouth.halfWidth * 2}
                    height="2.8"
                    fill="#e6eaf0"
                    opacity="0.8"
                  />
                </>
              )}
              <ellipse cx={MOUTH_X} cy={MOUTH_Y - mouth.open * 1.5} rx={mouth.halfWidth} ry="2.2" fill="#26080d" opacity="0.6" />
            </g>
          )}
          <path d={mouth.upper} fill={ref("lipTop")} />
          <path d={mouth.lower} fill={ref("lipBottom")} />
          {/* Gloss on the lower lip, offset to the lit side */}
          <ellipse
            cx={MOUTH_X - 2}
            cy={MOUTH_Y + mouth.lowerDrop * 0.55}
            rx={mouth.halfWidth * 0.4}
            ry="1.8"
            fill="#ffffff"
            opacity="0.26"
            filter={ref("softer")}
          />
          {/* Corners sit in shadow, which is what stops lips reading as a sticker */}
          <ellipse cx={MOUTH_X - mouth.halfWidth} cy={MOUTH_Y - 1} rx="2.6" ry="2" fill="#5c2a1e" opacity="0.42" filter={ref("softer")} />
          <ellipse cx={MOUTH_X + mouth.halfWidth} cy={MOUTH_Y - 1} rx="2.6" ry="2" fill="#5c2a1e" opacity="0.5" filter={ref("softer")} />
        </g>

        {/* Fringe over the forehead, with a highlight following the sweep */}
        <path d={t.hairFront} fill={ref("hair")} />
        <path d={t.hairSides} fill={ref("hair")} />
        <path
          d="M 150 138 C 166 118 192 106 220 110"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.07"
          strokeWidth="4"
          strokeLinecap="round"
          filter={ref("softer")}
        />
        <path
          d="M 158 128 C 174 112 198 104 218 106"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.05"
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* Rim light down the shaded edge, separating the sitter from the backdrop */}
        <path
          d="M 259 128 C 268 156 266 198 250 224"
          fill="none"
          stroke={t.rim}
          strokeOpacity="0.3"
          strokeWidth="3"
          strokeLinecap="round"
          filter={ref("softer")}
        />
      </g>

      <rect width="400" height="400" fill={ref("vig")} />
    </svg>
  );
}
