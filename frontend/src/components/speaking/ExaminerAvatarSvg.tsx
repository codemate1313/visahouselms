import { useMemo } from "react";

interface ExaminerAvatarSvgProps {
  gender?: "female" | "male" | string;
  viseme?: number;
  isPlaying?: boolean;
}

export function ExaminerAvatarSvg({ gender = "female", viseme = 0, isPlaying = false }: ExaminerAvatarSvgProps) {
  const isFemale = gender.toLowerCase() !== "male";

  // Viseme mouth paths for Female Examiner (Center: X=200, Y=214)
  const femaleMouth = useMemo(() => {
    switch (viseme) {
      case 1: // Wide Open (A/O)
        return {
          lipOuter: "M 182 208 Q 200 200 218 208 Q 200 234 182 208 Z",
          cavity: "M 185 210 Q 200 204 215 210 Q 200 230 185 210 Z",
          teeth: "M 188 211 Q 200 207 212 211 L 210 216 Q 200 212 190 216 Z",
          lipColor: "#e11d2e",
        };
      case 2: // Smile Open (E/I)
        return {
          lipOuter: "M 178 210 Q 200 202 222 210 Q 200 226 178 210 Z",
          cavity: "M 181 212 Q 200 206 219 212 Q 200 223 181 212 Z",
          teeth: "M 183 213 Q 200 207 217 213 L 215 217 Q 200 212 185 217 Z",
          lipColor: "#e11d2e",
        };
      case 3: // Round Small (U/W)
        return {
          lipOuter: "M 190 208 Q 200 202 210 208 Q 200 226 190 208 Z",
          cavity: "M 192 210 Q 200 205 208 210 Q 200 223 192 210 Z",
          teeth: null,
          lipColor: "#d946ef",
        };
      case 4: // Lips Pressed (M/P/B)
        return {
          lipOuter: "M 182 213 Q 200 210 218 213 Q 200 217 182 213 Z",
          cavity: null,
          teeth: null,
          lipColor: "#e11d2e",
        };
      case 5: // Teeth Visible (L/N/T/D)
        return {
          lipOuter: "M 180 209 Q 200 203 220 209 Q 200 224 180 209 Z",
          cavity: "M 183 211 Q 200 206 217 211 Q 200 221 183 211 Z",
          teeth: "M 185 212 Q 200 207 215 212 L 213 217 Q 200 213 187 217 Z",
          lipColor: "#e11d2e",
        };
      default: // Rest (Closed)
        return {
          lipOuter: "M 182 213 Q 200 208 218 213 Q 200 220 182 213 Z",
          cavity: null,
          teeth: null,
          lipColor: "#e11d2e",
        };
    }
  }, [viseme]);

  // Viseme mouth paths for Male Examiner (Center: X=200, Y=213)
  const maleMouth = useMemo(() => {
    switch (viseme) {
      case 1: // Wide Open (A/O)
        return {
          lipOuter: "M 182 208 Q 200 202 218 208 Q 200 232 182 208 Z",
          cavity: "M 185 210 Q 200 205 215 210 Q 200 228 185 210 Z",
          teeth: "M 187 211 Q 200 207 213 211 L 211 215 Q 200 212 189 215 Z",
          lipColor: "#c06d5a",
        };
      case 2: // Smile Open (E/I)
        return {
          lipOuter: "M 180 210 Q 200 204 220 210 Q 200 224 180 210 Z",
          cavity: "M 183 212 Q 200 207 217 212 Q 200 221 183 212 Z",
          teeth: "M 185 213 Q 200 208 215 213 L 213 217 Q 200 213 187 217 Z",
          lipColor: "#c06d5a",
        };
      case 3: // Round Small (U/W)
        return {
          lipOuter: "M 190 208 Q 200 203 210 208 Q 200 224 190 208 Z",
          cavity: "M 192 210 Q 200 206 208 210 Q 200 222 192 210 Z",
          teeth: null,
          lipColor: "#b45309",
        };
      case 4: // Lips Pressed (M/P/B)
        return {
          lipOuter: "M 183 213 Q 200 211 217 213 Q 200 217 183 213 Z",
          cavity: null,
          teeth: null,
          lipColor: "#c06d5a",
        };
      case 5: // Teeth Visible (L/N/T/D)
        return {
          lipOuter: "M 181 209 Q 200 204 219 209 Q 200 223 181 209 Z",
          cavity: "M 184 211 Q 200 207 216 211 Q 200 220 184 211 Z",
          teeth: "M 186 212 Q 200 208 214 212 L 212 216 Q 200 213 188 216 Z",
          lipColor: "#c06d5a",
        };
      default: // Rest
        return {
          lipOuter: "M 183 212 Q 200 208 217 212 Q 200 219 183 212 Z",
          cavity: null,
          teeth: null,
          lipColor: "#c06d5a",
        };
    }
  }, [viseme]);

  if (isFemale) {
    const m = femaleMouth;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 400 400"
        width="100%"
        height="100%"
        className={`examiner-svg-stage ${isPlaying ? "is-speaking" : ""}`}
      >
        <defs>
          {/* Realistic High-End Studio Ambient Backdrop */}
          <radialGradient id="f_bg" cx="50%" cy="38%" r="68%">
            <stop offset="0%" stopColor="#2c3652" />
            <stop offset="45%" stopColor="#161c2e" />
            <stop offset="100%" stopColor="#080c16" />
          </radialGradient>
          <radialGradient id="f_studio_light" cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
          {/* Realistic Skin Tones */}
          <linearGradient id="f_skin" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffe6d9" />
            <stop offset="60%" stopColor="#f7d0bd" />
            <stop offset="100%" stopColor="#e5a489" />
          </linearGradient>
          <linearGradient id="f_skin_neck" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d89a7f" />
            <stop offset="100%" stopColor="#f5c7b3" />
          </linearGradient>
          {/* Rich Jet Black Hair */}
          <linearGradient id="f_hair" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="45%" stopColor="#18181b" />
            <stop offset="85%" stopColor="#09090b" />
            <stop offset="100%" stopColor="#040405" />
          </linearGradient>
          <linearGradient id="f_hair_shine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#52525b" stopOpacity="0" />
            <stop offset="50%" stopColor="#a1a1aa" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#52525b" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="f_suit" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="60%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#070a12" />
          </linearGradient>
          <radialGradient id="f_iris" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="60%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#0c4a6e" />
          </radialGradient>
          <filter id="f_glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Realistic Studio Stage Background */}
        <rect width="400" height="400" fill="url(#f_bg)" />
        <circle cx="200" cy="150" r="160" fill="url(#f_studio_light)" />

        {/* Studio Rim Light Halo */}
        <circle
          cx="200"
          cy="180"
          r="144"
          fill="none"
          stroke={isPlaying ? "#e11d2e" : "rgba(165, 180, 252, 0.2)"}
          strokeWidth={isPlaying ? "3.5" : "1.5"}
          filter={isPlaying ? "url(#f_glow)" : undefined}
          style={{ transition: "all 0.3s ease" }}
        />

        {/* Flowing Jet Black Hair (Back Layer) */}
        <path d="M 124 138 C 105 200 105 275 130 335 L 270 335 C 295 275 295 200 276 138 Z" fill="url(#f_hair)" />

        {/* Executive Suit & Collar */}
        <path d="M 70 400 C 70 300 132 278 200 278 C 268 278 330 300 330 400 Z" fill="url(#f_suit)" />
        {/* Lapel Fold Shadows */}
        <path d="M 140 310 L 200 375 L 175 400 Z" fill="#0f172a" opacity="0.45" />
        <path d="M 260 310 L 200 375 L 225 400 Z" fill="#0f172a" opacity="0.45" />
        {/* White V-Neck Silk Blouse */}
        <path d="M 170 278 L 200 348 L 230 278 Z" fill="#f8fafc" />
        <path d="M 191 348 L 200 400 L 209 348 Z" fill="#e11d2e" />

        {/* Neck with Jaw Contour Shadow */}
        <rect x="176" y="234" width="48" height="52" rx="10" fill="url(#f_skin_neck)" />
        <path d="M 176 234 C 190 244 210 244 224 234 Z" fill="#b87255" opacity="0.38" />

        {/* Natural Head Contour */}
        <ellipse cx="200" cy="170" rx="68" ry="84" fill="url(#f_skin)" />

        {/* Soft Natural Cheek Blush */}
        <ellipse cx="155" cy="180" rx="16" ry="10" fill="#f472b6" opacity="0.22" />
        <ellipse cx="245" cy="180" rx="16" ry="10" fill="#f472b6" opacity="0.22" />

        {/* Elegant Jet Black Front Hair Flow */}
        <path
          d="M 128 165 C 126 102 158 82 200 82 C 242 82 274 102 272 165 C 258 118 232 108 200 108 C 168 108 142 118 128 165 Z"
          fill="url(#f_hair)"
        />
        <path
          d="M 145 125 C 165 105 235 105 255 125 C 235 112 165 112 145 125 Z"
          fill="url(#f_hair_shine)"
        />

        {/* Dark Eyebrows */}
        <path d="M 152 141 Q 170 134 186 142" fill="none" stroke="#18181b" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M 214 142 Q 230 134 248 141" fill="none" stroke="#18181b" strokeWidth="3.2" strokeLinecap="round" />

        {/* Realistic Eyes with Iris Gradient & Eyelashes */}
        <g className="examiner-eye-group">
          {/* Eyelid Contour Shadow */}
          <ellipse cx="168" cy="157" rx="12" ry="8" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.5" />
          <circle cx="168" cy="157" r="5.5" fill="url(#f_iris)" />
          <circle cx="168" cy="157" r="2.8" fill="#090d16" />
          {/* Catchlight Speculars */}
          <circle cx="170.5" cy="154.5" r="1.8" fill="#ffffff" />
          <circle cx="166" cy="159" r="0.8" fill="#ffffff" opacity="0.8" />
          {/* Lash Line */}
          <path d="M 154 157 Q 168 149 181 157" fill="none" stroke="#1e1035" strokeWidth="2.2" strokeLinecap="round" />

          {/* Right Eye */}
          <ellipse cx="232" cy="157" rx="12" ry="8" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.5" />
          <circle cx="232" cy="157" r="5.5" fill="url(#f_iris)" />
          <circle cx="232" cy="157" r="2.8" fill="#090d16" />
          {/* Catchlight Speculars */}
          <circle cx="234.5" cy="154.5" r="1.8" fill="#ffffff" />
          <circle cx="230" cy="159" r="0.8" fill="#ffffff" opacity="0.8" />
          {/* Lash Line */}
          <path d="M 219 157 Q 232 149 245 157" fill="none" stroke="#1e1035" strokeWidth="2.2" strokeLinecap="round" />
        </g>

        {/* Sculpted Nose Bridge & Shading */}
        <path d="M 197 160 L 201 182 L 193 186 Q 200 189 207 186" fill="none" stroke="#d4805e" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="201" cy="180" rx="3" ry="5" fill="#ffffff" opacity="0.15" />

        {/* Dynamic Vector Mouth & Lip Gloss */}
        <g className="examiner-mouth-group">
          {m.cavity && <path d={m.cavity} fill="#4c0519" />}
          {m.teeth && <path d={m.teeth} fill="#ffffff" />}
          <path d={m.lipOuter} fill={m.lipColor} stroke="#9f1239" strokeWidth="1.2" />
        </g>

        {/* Studio Wireless Boom Headset */}
        <path d="M 132 166 C 116 176 116 220 166 222" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="168" cy="222" r="5.5" fill="#0f172a" stroke={isPlaying ? "#22c55e" : "#e11d2e"} strokeWidth="1.8" />
        <circle cx="168" cy="222" r="2" fill={isPlaying ? "#22c55e" : "#e11d2e"} />
      </svg>
    );
  }

  // Male Examiner SVG
  const m = maleMouth;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 400"
      width="100%"
      height="100%"
      className={`examiner-svg-stage ${isPlaying ? "is-speaking" : ""}`}
    >
      <defs>
        <radialGradient id="m_bg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="60%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <linearGradient id="m_skin" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fbe3d2" />
          <stop offset="60%" stopColor="#f2c5a9" />
          <stop offset="100%" stopColor="#d99873" />
        </linearGradient>
        <linearGradient id="m_skin_neck" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c5845e" />
          <stop offset="100%" stopColor="#ecc0a3" />
        </linearGradient>
        <linearGradient id="m_hair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#27272a" />
          <stop offset="50%" stopColor="#18181b" />
          <stop offset="100%" stopColor="#09090b" />
        </linearGradient>
        <linearGradient id="m_suit" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <radialGradient id="m_iris" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="60%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
        <filter id="m_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Stage Background */}
      <rect width="400" height="400" rx="24" fill="url(#m_bg)" />

      {/* Studio Halo Ring */}
      <circle
        cx="200"
        cy="180"
        r="144"
        fill="none"
        stroke={isPlaying ? "#38bdf8" : "rgba(148, 163, 184, 0.3)"}
        strokeWidth={isPlaying ? "3.5" : "1.5"}
        filter={isPlaying ? "url(#m_glow)" : undefined}
        style={{ transition: "all 0.3s ease" }}
      />

      {/* Shoulders & Executive Suit */}
      <path d="M 68 400 C 68 298 132 276 200 276 C 268 276 332 298 332 400 Z" fill="url(#m_suit)" />
      <path d="M 166 276 L 200 348 L 234 276 Z" fill="#ffffff" />
      <path d="M 193 348 L 200 400 L 207 348 Z" fill="#2563eb" />

      {/* Neck & Chin Shadow */}
      <rect x="174" y="230" width="52" height="56" rx="8" fill="url(#m_skin_neck)" />
      <path d="M 174 230 C 190 240 210 240 226 230 Z" fill="#b4724b" opacity="0.4" />

      {/* Head */}
      <ellipse cx="200" cy="168" rx="66" ry="82" fill="url(#m_skin)" />

      {/* Male Styled Hair */}
      <path
        d="M 128 156 C 128 88 158 78 200 78 C 242 78 272 88 272 156 C 260 104 235 90 200 90 C 165 90 140 104 128 156 Z"
        fill="url(#m_hair)"
      />

      {/* Eyebrows */}
      <path d="M 150 138 Q 170 132 186 138" fill="none" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 214 138 Q 230 132 250 138" fill="none" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />

      {/* Studio Glasses */}
      <rect x="146" y="144" width="42" height="26" rx="6" fill="none" stroke="#475569" strokeWidth="2.8" />
      <rect x="212" y="144" width="42" height="26" rx="6" fill="none" stroke="#475569" strokeWidth="2.8" />
      <line x1="188" y1="154" x2="212" y2="154" stroke="#475569" strokeWidth="2.8" />

      {/* Eyes behind lenses */}
      <circle cx="167" cy="157" r="5.5" fill="url(#m_iris)" />
      <circle cx="167" cy="157" r="2.8" fill="#090d16" />
      <circle cx="169" cy="154.5" r="1.6" fill="#ffffff" />

      <circle cx="233" cy="157" r="5.5" fill="url(#m_iris)" />
      <circle cx="233" cy="157" r="2.8" fill="#090d16" />
      <circle cx="235" cy="154.5" r="1.6" fill="#ffffff" />

      {/* Nose */}
      <path d="M 197 160 L 202 182 L 194 186" fill="none" stroke="#b4724b" strokeWidth="2.2" strokeLinecap="round" />

      {/* Dynamic Vector Mouth */}
      <g className="examiner-mouth-group">
        {m.cavity && <path d={m.cavity} fill="#3f0e08" />}
        {m.teeth && <path d={m.teeth} fill="#ffffff" />}
        <path d={m.lipOuter} fill={m.lipColor} stroke="#881337" strokeWidth="1.2" />
      </g>

      {/* Headset Mic */}
      <path d="M 132 166 C 116 176 116 220 166 222" fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
      <circle cx="168" cy="222" r="5.5" fill="#0f172a" stroke={isPlaying ? "#22c55e" : "#2563eb"} strokeWidth="1.8" />
      <circle cx="168" cy="222" r="2" fill={isPlaying ? "#22c55e" : "#2563eb"} />
    </svg>
  );
}

