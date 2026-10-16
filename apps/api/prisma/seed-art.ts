/**
 * Generates flat SVG product illustrations and banners for the demo catalog,
 * so the store looks complete without any third-party images.
 * Each illustration is drawn on an 800×800 canvas centred on (400, 400).
 */

export type ArtKind =
  | 'phone' | 'laptop' | 'headphones' | 'earbuds' | 'watch' | 'speaker' | 'neckband' | 'powerbank' | 'charger' | 'cable'
  | 'tshirt' | 'polo' | 'panjabi' | 'kurti' | 'sneaker' | 'loafer' | 'sandal' | 'backpack' | 'tote' | 'sunglasses'
  | 'kettle' | 'blender' | 'ricecooker' | 'mug' | 'lamp' | 'lantern' | 'fan' | 'bedsheet' | 'serum' | 'sunscreen'
  | 'attar' | 'football' | 'yogamat' | 'bottle';

const INK = '#1d2230';

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    const out = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
    return Math.round(Math.max(0, Math.min(255, out)));
  };
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function screen(id: string, accent: string) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(accent, 0.35)}"/><stop offset="1" stop-color="${shade(accent, -0.35)}"/></linearGradient>`;
}

/** The drawing alone, no background. `c` = body colour, `a` = accent. */
export function illustration(kind: ArtKind, c: string, a: string, uid: string): string {
  const dark = shade(c, -0.35);
  const light = shade(c, 0.3);
  switch (kind) {
    case 'phone':
      return `<defs>${screen(`s${uid}`, a)}</defs>
        <rect x="270" y="110" width="260" height="560" rx="46" fill="${c}"/>
        <rect x="282" y="122" width="236" height="536" rx="36" fill="#0e1018"/>
        <rect x="292" y="134" width="216" height="512" rx="28" fill="url(#s${uid})"/>
        <rect x="372" y="146" width="56" height="14" rx="7" fill="#0e1018"/>
        ${[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((col) => `<rect x="${314 + col * 46}" y="${200 + r * 52}" width="32" height="32" rx="9" fill="#fff" opacity="0.28"/>`).join('')).join('')}
        <rect x="314" y="570" width="172" height="40" rx="20" fill="#fff" opacity="0.22"/>
        <rect x="528" y="230" width="6" height="70" rx="3" fill="${dark}"/>`;
    case 'laptop':
      return `<defs>${screen(`s${uid}`, a)}</defs>
        <rect x="170" y="180" width="460" height="310" rx="18" fill="${c}"/>
        <rect x="184" y="194" width="432" height="282" rx="8" fill="url(#s${uid})"/>
        <rect x="214" y="226" width="170" height="16" rx="8" fill="#fff" opacity="0.35"/>
        <rect x="214" y="256" width="250" height="12" rx="6" fill="#fff" opacity="0.2"/>
        <rect x="214" y="300" width="120" height="120" rx="14" fill="#fff" opacity="0.18"/>
        <rect x="350" y="300" width="120" height="120" rx="14" fill="#fff" opacity="0.18"/>
        <rect x="486" y="300" width="100" height="120" rx="14" fill="#fff" opacity="0.18"/>
        <path d="M120 498 H680 L652 566 Q648 574 638 574 H162 Q152 574 148 566 Z" fill="${light}"/>
        <rect x="340" y="498" width="120" height="10" rx="5" fill="${dark}" opacity="0.35"/>`;
    case 'headphones':
      return `<path d="M240 430 C230 210 570 210 560 430" stroke="${c}" stroke-width="36" fill="none" stroke-linecap="round"/>
        <rect x="186" y="380" width="120" height="190" rx="56" fill="${c}"/>
        <rect x="494" y="380" width="120" height="190" rx="56" fill="${c}"/>
        <rect x="268" y="402" width="44" height="146" rx="22" fill="${dark}"/>
        <rect x="488" y="402" width="44" height="146" rx="22" fill="${dark}"/>
        <circle cx="246" cy="475" r="18" fill="${a}"/>`;
    case 'earbuds':
      return `<rect x="240" y="380" width="320" height="230" rx="112" fill="${c}"/>
        <path d="M244 470 H556" stroke="${dark}" stroke-width="6" opacity="0.25"/>
        <circle cx="400" cy="560" r="9" fill="${a}"/>
        <ellipse cx="320" cy="250" rx="52" ry="56" fill="${c}"/><rect x="306" y="262" width="30" height="110" rx="15" fill="${c}"/>
        <ellipse cx="320" cy="244" rx="22" ry="24" fill="${dark}" opacity="0.5"/>
        <ellipse cx="480" cy="250" rx="52" ry="56" fill="${c}"/><rect x="464" y="262" width="30" height="110" rx="15" fill="${c}"/>
        <ellipse cx="480" cy="244" rx="22" ry="24" fill="${dark}" opacity="0.5"/>`;
    case 'watch':
      return `<defs>${screen(`s${uid}`, a)}</defs>
        <rect x="334" y="100" width="132" height="220" rx="32" fill="${c}"/>
        <rect x="334" y="480" width="132" height="220" rx="32" fill="${c}"/>
        ${[0, 1, 2, 3].map((i) => `<circle cx="400" cy="${560 + i * 30}" r="6" fill="${dark}"/>`).join('')}
        <rect x="286" y="262" width="228" height="276" rx="64" fill="#15171f"/>
        <rect x="302" y="278" width="196" height="244" rx="52" fill="url(#s${uid})"/>
        <text x="400" y="410" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#fff">10:09</text>
        <rect x="350" y="440" width="100" height="10" rx="5" fill="#fff" opacity="0.5"/>
        <rect x="512" y="350" width="16" height="56" rx="6" fill="#15171f"/>`;
    case 'speaker':
      return `<rect x="180" y="300" width="440" height="270" rx="135" fill="${c}"/>
        <rect x="222" y="334" width="356" height="202" rx="101" fill="${dark}" opacity="0.28"/>
        ${Array.from({ length: 6 }, (_, r) => Array.from({ length: 14 }, (_, col) => `<circle cx="${262 + col * 21}" cy="${372 + r * 25}" r="4" fill="${dark}" opacity="0.55"/>`).join('')).join('')}
        <rect x="360" y="548" width="80" height="12" rx="6" fill="${a}"/>
        <path d="M600 360 q70 75 0 150" stroke="${dark}" stroke-width="16" fill="none" stroke-linecap="round"/>`;
    case 'neckband':
      return `<path d="M220 300 Q400 640 580 300" stroke="${c}" stroke-width="40" fill="none" stroke-linecap="round"/>
        <rect x="190" y="280" width="64" height="150" rx="32" fill="${dark}"/>
        <rect x="546" y="280" width="64" height="150" rx="32" fill="${dark}"/>
        <path d="M222 280 Q200 220 250 190" stroke="${INK}" stroke-width="8" fill="none"/>
        <path d="M578 280 Q600 220 550 190" stroke="${INK}" stroke-width="8" fill="none"/>
        <circle cx="250" cy="180" r="26" fill="${c}"/><circle cx="550" cy="180" r="26" fill="${c}"/>
        <circle cx="222" cy="330" r="8" fill="${a}"/>`;
    case 'powerbank':
      return `<rect x="276" y="150" width="248" height="490" rx="38" fill="${c}"/>
        <rect x="296" y="170" width="208" height="450" rx="26" fill="${light}" opacity="0.25"/>
        ${[0, 1, 2, 3].map((i) => `<circle cx="${352 + i * 32}" cy="210" r="9" fill="${i < 3 ? a : dark}"/>`).join('')}
        <path d="M410 300 L350 420 H400 L380 520 L460 380 H410 L440 300 Z" fill="${a}"/>
        <rect x="340" y="600" width="44" height="14" rx="6" fill="${dark}"/><rect x="416" y="600" width="44" height="14" rx="6" fill="${dark}"/>`;
    case 'charger':
      return `<rect x="344" y="200" width="26" height="100" rx="8" fill="#aeb4c0"/><rect x="430" y="200" width="26" height="100" rx="8" fill="#aeb4c0"/>
        <rect x="290" y="290" width="220" height="240" rx="38" fill="${c}"/>
        <rect x="370" y="490" width="60" height="18" rx="8" fill="${dark}"/>
        <text x="400" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="800" fill="${a}">65W</text>
        <path d="M400 530 V600 Q400 650 460 650 H600" stroke="${dark}" stroke-width="16" fill="none" stroke-linecap="round"/>`;
    case 'cable':
      return `<path d="M200 300 C200 180 420 180 420 300 C420 420 600 420 600 300 C600 180 360 160 330 360 C300 560 560 600 600 560" stroke="${c}" stroke-width="22" fill="none" stroke-linecap="round"/>
        <rect x="170" y="290" width="60" height="110" rx="14" fill="${dark}"/><rect x="185" y="400" width="30" height="40" rx="6" fill="#aeb4c0"/>
        <rect x="586" y="520" width="110" height="60" rx="14" fill="${dark}" transform="rotate(-30 640 550)"/>`;
    case 'tshirt':
    case 'polo':
      return `<path d="M300 170 L236 192 L148 292 L216 356 L262 312 L262 640 Q262 652 274 652 H526 Q538 652 538 640 L538 312 L584 356 L652 292 L564 192 L500 170 Q400 236 300 170 Z" fill="${c}"/>
        <path d="M300 170 Q400 236 500 170" stroke="${dark}" stroke-width="12" fill="none" opacity="0.5"/>
        ${
          kind === 'polo'
            ? `<path d="M330 176 L400 236 L470 176 L440 168 L400 204 L360 168 Z" fill="${dark}" opacity="0.35"/><rect x="390" y="230" width="20" height="90" rx="6" fill="${dark}" opacity="0.25"/><circle cx="400" cy="256" r="6" fill="#fff"/><circle cx="400" cy="290" r="6" fill="#fff"/><rect x="460" y="300" width="40" height="30" rx="6" fill="${a}"/>`
            : `<circle cx="400" cy="400" r="70" fill="${a}" opacity="0.9"/><path d="M350 410 h100 M370 380 h60" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`
        }`;
    case 'panjabi':
      return `<path d="M312 130 L250 152 L168 282 L232 334 L272 292 L272 704 Q272 714 282 714 H518 Q528 714 528 704 L528 292 L568 334 L632 282 L550 152 L488 130 L452 130 Q400 150 348 130 Z" fill="${c}"/>
        <path d="M348 130 Q400 150 452 130 L452 150 Q400 172 348 150 Z" fill="${a}"/>
        <rect x="392" y="150" width="16" height="200" rx="6" fill="${a}" opacity="0.85"/>
        ${[0, 1, 2, 3].map((i) => `<circle cx="400" cy="${184 + i * 42}" r="7" fill="${dark}"/>`).join('')}
        <path d="M290 690 H510" stroke="${a}" stroke-width="10" opacity="0.7"/>`;
    case 'kurti':
      return `<path d="M322 132 L262 158 L190 296 L246 334 L282 300 L246 690 Q244 702 256 702 H544 Q556 702 554 690 L518 300 L554 334 L610 296 L538 158 L478 132 Q400 196 322 132 Z" fill="${c}"/>
        <path d="M322 132 Q400 196 478 132" stroke="${a}" stroke-width="12" fill="none"/>
        ${[0, 1, 2].map((r) => [0, 1, 2].map((col) => `<circle cx="${330 + col * 70}" cy="${360 + r * 100}" r="20" fill="${a}" opacity="0.8"/><circle cx="${330 + col * 70}" cy="${360 + r * 100}" r="8" fill="#fff" opacity="0.8"/>`).join('')).join('')}
        <path d="M254 660 H546" stroke="${a}" stroke-width="12"/>`;
    case 'sneaker':
      return `<path d="M140 540 Q150 430 250 410 L350 392 Q410 372 444 432 L520 478 Q650 488 668 548 L668 580 H140 Z" fill="${c}"/>
        <rect x="128" y="568" width="552" height="46" rx="20" fill="#f4f4f4" stroke="${dark}" stroke-width="4" opacity="0.95"/>
        <path d="M250 520 Q400 460 560 520" stroke="${a}" stroke-width="22" fill="none" stroke-linecap="round"/>
        ${[0, 1, 2, 3].map((i) => `<path d="M${330 + i * 30} ${410 + i * 8} l40 22" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`).join('')}
        <path d="M150 512 Q170 470 230 470" stroke="${dark}" stroke-width="6" fill="none" opacity="0.4"/>`;
    case 'loafer':
      return `<path d="M150 560 Q150 470 240 450 L470 430 Q560 430 640 500 Q676 534 660 572 H150 Z" fill="${c}"/>
        <rect x="140" y="562" width="536" height="34" rx="14" fill="${dark}"/>
        <path d="M380 452 Q470 430 540 470 L520 500 Q460 474 392 486 Z" fill="${dark}" opacity="0.5"/>
        <rect x="420" y="462" width="70" height="16" rx="6" fill="${a}"/>`;
    case 'sandal':
      return `<path d="M150 560 Q170 520 260 516 H600 Q660 520 660 556 Q660 590 600 594 H210 Q150 594 150 560 Z" fill="${dark}"/>
        <path d="M260 524 Q330 400 420 400 Q520 400 560 524" stroke="${c}" stroke-width="44" fill="none"/>
        <path d="M200 540 Q240 470 300 470" stroke="${c}" stroke-width="30" fill="none" stroke-linecap="round"/>
        <rect x="390" y="388" width="60" height="30" rx="8" fill="${a}"/>`;
    case 'backpack':
      return `<path d="M330 200 Q330 140 400 140 Q470 140 470 200" stroke="${dark}" stroke-width="22" fill="none"/>
        <rect x="236" y="190" width="328" height="460" rx="96" fill="${c}"/>
        <rect x="286" y="410" width="228" height="190" rx="44" fill="${dark}" opacity="0.45"/>
        <path d="M300 440 H500" stroke="${a}" stroke-width="10" stroke-linecap="round"/>
        <rect x="370" y="250" width="60" height="16" rx="8" fill="${a}"/>`;
    case 'tote':
      return `<path d="M300 330 V250 Q400 170 500 250 V330" stroke="${dark}" stroke-width="22" fill="none"/>
        <path d="M210 330 H590 L630 640 Q632 660 612 660 H188 Q168 660 170 640 Z" fill="${c}"/>
        <path d="M210 330 H590 L580 420 Q400 470 220 420 Z" fill="${dark}" opacity="0.3"/>
        <rect x="378" y="420" width="44" height="34" rx="8" fill="${a}"/>`;
    case 'sunglasses':
      return `<defs><linearGradient id="g${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(a, -0.1)}"/><stop offset="1" stop-color="#11131a"/></linearGradient></defs>
        <path d="M130 360 H670" stroke="${c}" stroke-width="18" stroke-linecap="round"/>
        <path d="M160 350 H370 Q380 350 376 372 L360 470 Q350 520 290 520 H230 Q170 520 162 470 L150 372 Q146 350 160 350 Z" fill="url(#g${uid})" stroke="${c}" stroke-width="14"/>
        <path d="M430 350 H640 Q654 350 650 372 L638 470 Q630 520 570 520 H510 Q450 520 440 470 L424 372 Q420 350 430 350 Z" fill="url(#g${uid})" stroke="${c}" stroke-width="14"/>
        <path d="M376 372 Q400 350 424 372" stroke="${c}" stroke-width="14" fill="none"/>
        <path d="M190 380 L250 380" stroke="#fff" stroke-width="10" opacity="0.4" stroke-linecap="round"/>`;
    case 'kettle':
      return `<defs><linearGradient id="g${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa3b2"/><stop offset="0.5" stop-color="#eef1f5"/><stop offset="1" stop-color="#8d96a6"/></linearGradient></defs>
        <path d="M280 300 Q262 600 300 624 H500 Q538 600 520 300 Z" fill="url(#g${uid})"/>
        <path d="M300 300 Q400 250 500 300 Z" fill="${c}"/><rect x="380" y="250" width="40" height="30" rx="10" fill="${c}"/>
        <path d="M520 330 Q616 350 606 500 Q600 580 520 584" stroke="${c}" stroke-width="34" fill="none" stroke-linecap="round"/>
        <path d="M282 362 L196 300 L214 286 L290 330 Z" fill="#9aa3b2"/>
        <rect x="250" y="620" width="300" height="44" rx="14" fill="${c}"/><circle cx="400" cy="642" r="8" fill="${a}"/>`;
    case 'blender':
      return `<path d="M318 210 H482 L466 520 H334 Z" fill="#e3edf7" stroke="#a9bccf" stroke-width="6"/>
        <path d="M330 380 H470 L466 520 H334 Z" fill="${a}" opacity="0.7"/>
        <rect x="304" y="186" width="192" height="34" rx="12" fill="${INK}"/>
        <path d="M300 520 H500 L522 664 H278 Z" fill="${c}"/>
        <circle cx="400" cy="596" r="26" fill="${dark}"/><circle cx="400" cy="596" r="10" fill="${a}"/>
        <path d="M482 260 Q540 270 530 340 Q524 390 474 400" stroke="#a9bccf" stroke-width="16" fill="none"/>`;
    case 'ricecooker':
      return `<rect x="220" y="340" width="360" height="290" rx="84" fill="${c}"/>
        <path d="M232 360 Q400 220 568 360 Z" fill="${light}"/>
        <rect x="370" y="250" width="60" height="26" rx="10" fill="${dark}"/>
        <rect x="320" y="470" width="160" height="80" rx="20" fill="${dark}" opacity="0.8"/>
        <circle cx="360" cy="510" r="10" fill="${a}"/><circle cx="440" cy="510" r="10" fill="#7ee08a"/>
        <rect x="190" y="400" width="40" height="22" rx="10" fill="${dark}"/><rect x="570" y="400" width="40" height="22" rx="10" fill="${dark}"/>`;
    case 'mug':
      return `<path d="M500 360 q96 0 96 84 q0 84 -96 84" stroke="${c}" stroke-width="34" fill="none"/>
        <rect x="260" y="300" width="250" height="300" rx="34" fill="${c}"/>
        <rect x="260" y="300" width="250" height="40" rx="20" fill="${dark}" opacity="0.35"/>
        <path d="M330 450 h110" stroke="${a}" stroke-width="18" stroke-linecap="round"/>
        <path d="M330 240 q20 -30 0 -60 M385 240 q20 -30 0 -60 M440 240 q20 -30 0 -60" stroke="#9aa3b2" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.7"/>`;
    case 'lamp':
      return `<path d="M520 340 L640 590 H420 L470 330 Z" fill="#ffe27a" opacity="0.35"/>
        <ellipse cx="380" cy="640" rx="130" ry="26" fill="${c}"/>
        <path d="M380 636 L340 420 L470 270" stroke="${c}" stroke-width="24" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="340" cy="420" r="18" fill="${dark}"/>
        <path d="M430 222 L572 300 L530 368 L388 290 Z" fill="${c}"/>
        <path d="M530 368 L572 300" stroke="#ffe27a" stroke-width="12"/>`;
    case 'lantern':
      return `<path d="M340 200 Q400 130 460 200" stroke="${dark}" stroke-width="16" fill="none"/>
        <rect x="300" y="200" width="200" height="50" rx="16" fill="${c}"/>
        <rect x="316" y="250" width="168" height="300" rx="24" fill="#fff6c8"/>
        <rect x="340" y="280" width="120" height="240" rx="18" fill="#ffe27a"/>
        ${[0, 1, 2].map((i) => `<rect x="${340 + i * 44}" y="250" width="12" height="300" fill="${c}" opacity="0.6"/>`).join('')}
        <rect x="290" y="550" width="220" height="70" rx="20" fill="${c}"/><circle cx="400" cy="585" r="10" fill="${a}"/>`;
    case 'fan':
      return `<rect x="330" y="610" width="140" height="40" rx="16" fill="${c}"/>
        <rect x="388" y="460" width="24" height="160" rx="10" fill="${dark}"/>
        <circle cx="400" cy="340" r="190" fill="none" stroke="${c}" stroke-width="14"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M400 340 L${400 + 190 * Math.cos((i * Math.PI) / 4)} ${340 + 190 * Math.sin((i * Math.PI) / 4)}" stroke="${c}" stroke-width="4" opacity="0.5"/>`).join('')}
        ${[0, 1, 2].map((i) => `<ellipse cx="400" cy="250" rx="46" ry="92" fill="${a}" opacity="0.85" transform="rotate(${i * 120} 400 340)"/>`).join('')}
        <circle cx="400" cy="340" r="34" fill="${dark}"/>`;
    case 'bedsheet':
      return `${[0, 1, 2].map((i) => {
        const y = 470 - i * 110;
        const col = i === 1 ? a : c;
        return `<rect x="${190 + i * 14}" y="${y}" width="${420 - i * 28}" height="110" rx="20" fill="${col}"/><rect x="${190 + i * 14}" y="${y}" width="${420 - i * 28}" height="22" rx="11" fill="#000" opacity="0.08"/>${[0, 1, 2, 3, 4].map((k) => `<circle cx="${240 + i * 14 + k * 75}" cy="${y + 65}" r="14" fill="#fff" opacity="0.55"/>`).join('')}`;
      }).join('')}`;
    case 'serum':
      return `<rect x="372" y="150" width="56" height="100" rx="28" fill="${INK}"/>
        <rect x="352" y="236" width="96" height="90" rx="14" fill="${INK}"/>
        <rect x="320" y="318" width="160" height="320" rx="30" fill="${c}" opacity="0.92"/>
        <rect x="340" y="420" width="120" height="130" rx="10" fill="#fff"/>
        <text x="400" y="480" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="${a}">VIT C</text>
        <text x="400" y="516" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="${INK}">30 ml</text>`;
    case 'sunscreen':
      return `<path d="M318 170 H482 L462 560 Q460 580 440 580 H360 Q340 580 338 560 Z" fill="${c}"/>
        <rect x="330" y="560" width="140" height="80" rx="20" fill="${a}"/>
        <rect x="336" y="150" width="128" height="30" rx="8" fill="${dark}" opacity="0.4"/>
        <text x="400" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="800" fill="${a}">SPF</text>
        <text x="400" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="800" fill="${a}">50</text>`;
    case 'attar':
      return `<rect x="370" y="200" width="60" height="70" rx="10" fill="#d4af37"/>
        <path d="M378 140 Q400 100 422 140 L430 200 H370 Z" fill="#d4af37"/>
        <rect x="380" y="266" width="40" height="40" fill="${c}" opacity="0.7"/>
        <path d="M400 300 C250 320 250 600 400 610 C550 600 550 320 400 300 Z" fill="${c}" opacity="0.85"/>
        <path d="M330 450 Q400 400 470 450 Q400 500 330 450 Z" fill="#d4af37" opacity="0.9"/>
        <path d="M340 380 Q350 360 370 352" stroke="#fff" stroke-width="10" fill="none" opacity="0.5" stroke-linecap="round"/>`;
    case 'football':
      return `<circle cx="400" cy="400" r="220" fill="#fafafa" stroke="${INK}" stroke-width="8"/>
        <path d="M400 330 L466 378 L441 456 L359 456 L334 378 Z" fill="${INK}"/>
        <path d="M400 330 V200 M466 378 L586 340 M441 456 L520 560 M359 456 L280 560 M334 378 L214 340" stroke="${INK}" stroke-width="8"/>
        <path d="M400 182 L440 200 L430 230 L370 230 L360 200 Z" fill="${INK}"/>
        <path d="M606 330 L612 400 L590 380 Z M194 330 L188 400 L210 380 Z" fill="${INK}"/>
        <path d="M500 590 L540 560 L560 580 Z M300 590 L260 560 L240 580 Z" fill="${INK}"/>
        <circle cx="400" cy="400" r="220" fill="none" stroke="${a}" stroke-width="10" opacity="0.6"/>`;
    case 'yogamat':
      return `<rect x="180" y="330" width="440" height="180" rx="90" fill="${c}"/>
        <ellipse cx="610" cy="420" rx="56" ry="90" fill="${dark}"/>
        <path d="M610 420 m-36 0 a36 60 0 1 0 72 0 a28 48 0 1 0 -56 0 a20 34 0 1 0 40 0" stroke="${c}" stroke-width="8" fill="none"/>
        <rect x="290" y="330" width="30" height="180" fill="${a}" opacity="0.8"/><rect x="470" y="330" width="30" height="180" fill="${a}" opacity="0.8"/>
        <path d="M120 560 H680" stroke="${c}" stroke-width="30" stroke-linecap="round" opacity="0.6"/>`;
    case 'bottle':
      return `<rect x="350" y="120" width="100" height="70" rx="22" fill="${INK}"/>
        <rect x="364" y="180" width="72" height="30" fill="${dark}"/>
        <rect x="320" y="200" width="160" height="460" rx="60" fill="${c}"/>
        <rect x="320" y="300" width="160" height="40" fill="${dark}" opacity="0.35"/>
        <rect x="350" y="380" width="22" height="200" rx="11" fill="#fff" opacity="0.35"/>
        <circle cx="400" cy="480" r="30" fill="${a}"/>`;
  }
}

export function productSvg(kind: ArtKind, body: string, accent: string, bg: string, uid: string): string {
  const bg2 = shade(bg, -0.08);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs><radialGradient id="bg${uid}" cx="0.5" cy="0.4" r="0.75"><stop offset="0" stop-color="${shade(bg, 0.45)}"/><stop offset="1" stop-color="${bg2}"/></radialGradient></defs>
  <rect width="800" height="800" fill="url(#bg${uid})"/>
  <ellipse cx="400" cy="700" rx="230" ry="26" fill="#000" opacity="0.08"/>
  ${illustration(kind, body, accent, uid)}
</svg>`;
}

interface BannerInput {
  title: string;
  subtitle: string;
  cta: string;
  from: string;
  to: string;
  art: { kind: ArtKind; body: string; accent: string; x: number; y: number; scale: number }[];
  uid: string;
  badge?: string;
}

export function bannerSvg(b: BannerInput): string {
  const art = b.art
    .map((a, i) => `<g transform="translate(${a.x} ${a.y}) scale(${a.scale}) translate(-400 -400)">${illustration(a.kind, a.body, a.accent, `${b.uid}${i}`)}</g>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 560" width="1600" height="560">
  <defs><linearGradient id="bn${b.uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b.from}"/><stop offset="1" stop-color="${b.to}"/></linearGradient></defs>
  <rect width="1600" height="560" fill="url(#bn${b.uid})"/>
  <circle cx="1240" cy="280" r="260" fill="#fff" opacity="0.08"/>
  <circle cx="1460" cy="80" r="120" fill="#fff" opacity="0.06"/>
  ${b.badge ? `<rect x="110" y="110" width="${b.badge.length * 15 + 48}" height="44" rx="22" fill="#fff" opacity="0.18"/><text x="134" y="140" font-family="Hind Siliguri, Noto Sans Bengali, Arial, sans-serif" font-size="22" font-weight="700" fill="#fff" letter-spacing="1">${b.badge}</text>` : ''}
  <text x="110" y="250" font-family="Hind Siliguri, Noto Sans Bengali, Arial, sans-serif" font-size="${b.title.length > 18 ? 66 : 78}" font-weight="800" fill="#fff">${b.title}</text>
  <text x="112" y="315" font-family="Hind Siliguri, Noto Sans Bengali, Arial, sans-serif" font-size="32" fill="#fff" opacity="0.92">${b.subtitle}</text>
  <rect x="110" y="365" width="${b.cta.length * 17 + 64}" height="64" rx="32" fill="#fff"/>
  <text x="${110 + (b.cta.length * 17 + 64) / 2}" y="406" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${b.to}">${b.cta}</text>
  ${art}
</svg>`;
}

export function stripSvg(title: string, subtitle: string, from: string, to: string, kind: ArtKind, body: string, accent: string, uid: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 260" width="800" height="260">
  <defs><linearGradient id="st${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="800" height="260" fill="url(#st${uid})"/>
  <text x="48" y="118" font-family="Hind Siliguri, Noto Sans Bengali, Arial, sans-serif" font-size="44" font-weight="800" fill="#fff">${title}</text>
  <text x="50" y="166" font-family="Hind Siliguri, Noto Sans Bengali, Arial, sans-serif" font-size="22" fill="#fff" opacity="0.92">${subtitle}</text>
  <g transform="translate(650 130) scale(0.32) translate(-400 -400)">${illustration(kind, body, accent, `x${uid}`)}</g>
</svg>`;
}

export function categorySvg(kind: ArtKind, body: string, accent: string, bg: string, uid: string) {
  return productSvg(kind, body, accent, bg, `c${uid}`);
}
