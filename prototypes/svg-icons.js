// 案B：SVGの手描き風イラスト。各景品を viewBox 0 0 100 100 で描く
const S = 'stroke="#4a3040" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"';

const gem = (c, light) => `
  <path d="M18 40 L34 22 H66 L82 40 L50 84 Z" fill="${c}" fill-opacity=".85" ${S}/>
  <path d="M18 40 H82 M34 22 L42 40 L50 84 L58 40 L66 22 M42 40 L50 22 L58 40" fill="none" ${S} stroke-width="2"/>
  <path d="M38 28 L44 36" stroke="${light}" stroke-width="4" stroke-linecap="round"/>`;

export const SVG_ICONS = {
  candy: () => `
    <path d="M10 35 L28 45 L28 55 L10 65 Z M90 35 L72 45 L72 55 L90 65 Z" fill="#fff" ${S}/>
    <ellipse cx="50" cy="50" rx="24" ry="19" fill="#ff8fb1" ${S}/>
    <path d="M36 42 Q50 50 64 42" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  choco: () => `
    <rect x="12" y="30" width="76" height="40" rx="5" fill="#6b3f2a" ${S}/>
    <rect x="40" y="30" width="22" height="40" fill="#e8443a" ${S}/>
    <path d="M18 38 H34 M18 50 H34 M18 62 H34" stroke="#8a5a40" stroke-width="2.5"/>`,
  stick: () => `
    <rect x="8" y="42" width="84" height="16" rx="8" fill="#d9a066" ${S}/>
    <rect x="34" y="40" width="58" height="20" rx="9" fill="#5a3320" ${S}/>
    <path d="M44 44 L48 56 M58 44 L62 56 M72 44 L76 56" stroke="#ffb3cf" stroke-width="3" stroke-linecap="round"/>`,
  smallBox: () => `
    <rect x="16" y="24" width="68" height="62" rx="4" fill="#8fd3ff" ${S}/>
    <rect x="44" y="24" width="12" height="62" fill="#fff" ${S} stroke-width="2"/>
    <path d="M50 24 C38 8 26 16 40 24 M50 24 C62 8 74 16 60 24" fill="#fff" ${S}/>`,
  gemSmall: () => gem('#5fe3a1', '#ffffff'),
  gemLarge: () => gem('#c06bff', '#ffffff'),
  bear: () => `
    <circle cx="26" cy="24" r="12" fill="#c98a55" ${S}/><circle cx="74" cy="24" r="12" fill="#c98a55" ${S}/>
    <circle cx="50" cy="52" r="34" fill="#c98a55" ${S}/>
    <ellipse cx="50" cy="64" rx="15" ry="11" fill="#f3d7b5" ${S}/>
    <circle cx="38" cy="46" r="3.5" fill="#4a3040"/><circle cx="62" cy="46" r="3.5" fill="#4a3040"/>
    <ellipse cx="50" cy="60" rx="5" ry="3.5" fill="#4a3040"/>`,
  rabbit: () => `
    <ellipse cx="36" cy="22" rx="9" ry="20" fill="#fff" ${S}/><ellipse cx="64" cy="22" rx="9" ry="20" fill="#fff" ${S}/>
    <ellipse cx="36" cy="24" rx="4" ry="13" fill="#ffadc6"/><ellipse cx="64" cy="24" rx="4" ry="13" fill="#ffadc6"/>
    <circle cx="50" cy="60" r="30" fill="#fff" ${S}/>
    <circle cx="39" cy="56" r="3.5" fill="#4a3040"/><circle cx="61" cy="56" r="3.5" fill="#4a3040"/>
    <path d="M46 66 L50 70 L54 66" fill="none" ${S} stroke-width="2.5"/>
    <circle cx="32" cy="66" r="5" fill="#ffc7d8"/><circle cx="68" cy="66" r="5" fill="#ffc7d8"/>`,
  sportsCar: () => `
    <path d="M8 62 Q10 46 30 44 L42 32 H64 L76 44 Q92 46 92 62 Z" fill="#ffcf3a" ${S}/>
    <path d="M44 36 H62 L70 44 H38 Z" fill="#9fdcff" ${S} stroke-width="2.5"/>
    <circle cx="28" cy="64" r="10" fill="#333" ${S}/><circle cx="72" cy="64" r="10" fill="#333" ${S}/>
    <circle cx="28" cy="64" r="4" fill="#ddd"/><circle cx="72" cy="64" r="4" fill="#ddd"/>`,
  fireTruck: () => `
    <rect x="8" y="38" width="62" height="26" rx="3" fill="#e8382f" ${S}/>
    <path d="M70 64 V30 H84 L92 44 V64 Z" fill="#e8382f" ${S}/>
    <rect x="74" y="34" width="10" height="10" fill="#9fdcff" ${S} stroke-width="2"/>
    <path d="M12 32 H66 M12 26 H66 M18 26 V32 M28 26 V32 M38 26 V32 M48 26 V32 M58 26 V32" stroke="#4a3040" stroke-width="2.5"/>
    <circle cx="24" cy="66" r="9" fill="#333" ${S}/><circle cx="76" cy="66" r="9" fill="#333" ${S}/>`,
  trex: () => `
    <path d="M10 72 Q24 60 34 52 Q34 30 54 24 H78 Q90 26 88 40 Q86 48 74 48 H66 Q66 62 58 72 L60 86 H50 L48 76 L40 78 L40 88 H30 L32 74 Z" fill="#6cc46a" ${S}/>
    <circle cx="72" cy="33" r="3.5" fill="#4a3040"/>
    <path d="M60 52 L68 58" ${S}/>`,
  triceratops: () => `
    <ellipse cx="44" cy="58" rx="30" ry="20" fill="#7fa7e8" ${S}/>
    <path d="M62 36 Q78 20 90 34 Q94 48 80 58 Z" fill="#f59ac0" ${S}/>
    <ellipse cx="76" cy="54" rx="14" ry="11" fill="#7fa7e8" ${S}/>
    <path d="M76 42 L92 30 M70 42 L80 26 M88 56 L97 54" ${S}/>
    <circle cx="78" cy="51" r="3" fill="#4a3040"/>
    <path d="M26 74 V86 M58 74 V86" ${S} stroke-width="7"/>`,
  rubyRing: () => `
    <circle cx="50" cy="62" r="26" fill="none" stroke="#4a3040" stroke-width="11"/>
    <circle cx="50" cy="62" r="26" fill="none" stroke="#f2c14e" stroke-width="6"/>
    <path d="M30 26 L40 12 H60 L70 26 L50 46 Z" fill="#ff2050" ${S}/>
    <path d="M36 18 L42 24" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,
  sapphireRing: () => `
    <circle cx="50" cy="62" r="26" fill="none" stroke="#4a3040" stroke-width="11"/>
    <circle cx="50" cy="62" r="26" fill="none" stroke="#f2c14e" stroke-width="6"/>
    <path d="M30 26 L40 12 H60 L70 26 L50 46 Z" fill="#2a6bff" ${S}/>
    <path d="M36 18 L42 24" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,
  lollipop: () => `
    <rect x="46" y="58" width="8" height="38" rx="3" fill="#fff" ${S}/>
    <circle cx="50" cy="38" r="30" fill="#ffe3ee" ${S}/>
    <circle cx="50" cy="38" r="22" fill="#ff6f9f"/><circle cx="50" cy="38" r="16" fill="#fff"/>
    <circle cx="50" cy="38" r="11" fill="#8fd3ff"/><circle cx="50" cy="38" r="6" fill="#fff"/>
    <circle cx="50" cy="38" r="2.5" fill="#ffd36e"/>
    <path d="M30 22 Q36 16 44 14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  chocoBar: () => `
    <rect x="8" y="22" width="84" height="56" rx="4" fill="#5b3524" ${S}/>
    <path d="M8 41 H52 M8 60 H52 M23 22 V78 M38 22 V78" stroke="#7a4a35" stroke-width="2.5"/>
    <path d="M52 22 H92 V78 H52 L56 70 L50 62 L56 54 L50 46 L56 38 L50 30 Z" fill="#d6262e" ${S}/>
    <rect x="62" y="40" width="22" height="20" rx="3" fill="#ffe066" ${S} stroke-width="2"/>`,
};

export function svgIcon(kind, size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${SVG_ICONS[kind]()}</svg>`;
}
