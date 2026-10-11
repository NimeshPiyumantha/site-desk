/** Generates the illustrative demo pictures (SVG) so the demo works fully offline. */
import fs from "node:fs";
import path from "node:path";

const out = path.join(process.cwd(), "public", "demo");
fs.mkdirSync(out, { recursive: true });

const W = 1200;
const H = 800;
const svg = (body: string, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`;
const sky = (id: string, top: string, bottom: string) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`;
const wave = (y: number, amp: number, color: string, opacity = 1) => {
  let d = `M0 ${y}`;
  for (let x = 0; x <= W; x += 100) d += ` Q ${x + 50} ${(x / 100) % 2 === 0 ? y - amp : y + amp} ${x + 100} ${y}`;
  return `<path d="${d} L ${W} ${H} L 0 ${H} Z" fill="${color}" opacity="${opacity}"/>`;
};
const hills = (points: Array<[number, number]>, color: string, opacity = 1) => `<path d="M0 ${H} ${points.map(([x, y]) => `L ${x} ${y}`).join(" ")} L ${W} ${H} Z" fill="${color}" opacity="${opacity}"/>`;
const sun = (cx: number, cy: number, r: number, color: string) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
const clouds = (y: number) => `<g fill="#fff" opacity=".75"><ellipse cx="220" cy="${y}" rx="90" ry="22"/><ellipse cx="280" cy="${y - 14}" rx="60" ry="22"/><ellipse cx="900" cy="${y + 30}" rx="110" ry="24"/><ellipse cx="960" cy="${y + 14}" rx="64" ry="22"/></g>`;
const palm = (x: number, y: number, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#1f3b2f"><path d="M0 0 C 10 -80 18 -160 8 -240 L 18 -240 C 30 -160 22 -80 14 0 Z"/><path d="M12 -240 C -40 -270 -90 -250 -120 -210 C -70 -240 -30 -240 12 -232Z"/><path d="M12 -240 C 60 -280 110 -260 140 -220 C 90 -246 50 -246 12 -232Z"/><path d="M12 -240 C -20 -300 -70 -310 -100 -300 C -50 -290 -20 -270 12 -236Z"/><path d="M12 -240 C 40 -310 90 -320 120 -300 C 70 -296 40 -276 12 -236Z"/></g>`;
const boat = (x: number, y: number) => `<g transform="translate(${x} ${y})"><path d="M-30 0 L30 0 L22 10 L-22 10 Z" fill="#fff"/><path d="M0 -2 L0 -56 L26 -6 Z" fill="#fff"/></g>`;

const images: Record<string, string> = {
  "hero-coast.svg": svg(
    `<rect width="${W}" height="${H}" fill="url(#s)"/>${clouds(150)}${sun(960, 200, 70, "#fff4d6")}
     ${hills([[0, 430], [180, 380], [420, 410], [640, 360], [820, 400], [1200, 420]], "#7b8fa6", 0.7)}
     ${wave(470, 6, "#2f7fb5")}${wave(560, 8, "#2a6f9f", 0.9)}${wave(660, 10, "#1f5e88", 0.9)}
     ${boat(380, 520)}${boat(620, 600)}
     <path d="M760 ${H} L 820 520 L 1000 470 L 1200 440 L 1200 ${H} Z" fill="#f2efe8"/><g fill="#fff"><rect x="860" y="470" width="70" height="60"/><rect x="950" y="440" width="80" height="80"/><rect x="1050" y="420" width="70" height="90"/></g><g fill="#2f6fb6"><path d="M950 440 a40 40 0 0 1 80 0Z"/></g><g fill="#d94f86" opacity=".85"><circle cx="1130" cy="560" r="26"/><circle cx="1160" cy="590" r="22"/><circle cx="880" cy="590" r="18"/></g>`,
    sky("s", "#9fd0f0", "#e6f4fb"),
  ),
  "coast.svg": svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sun(250, 180, 60, "#fff1c9")}${hills([[0, 380], [300, 300], [520, 360], [700, 330], [1200, 360]], "#5f8f6a")}${wave(420, 6, "#3db4c4")}${wave(520, 8, "#2a9db0", 0.9)}${wave(640, 10, "#f1e3c3")}${palm(150, 680, 1.1)}${boat(700, 480)}`, sky("s", "#8fd3f4", "#e8f7fc")),
  "city.svg": svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sun(900, 220, 80, "#ffd99a")}<g fill="#c98f5b">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${i * 140}" y="${380 - (i % 3) * 60}" width="120" height="${420 + (i % 3) * 60}"/>`).join("")}</g><g fill="#e8c08d"><circle cx="600" cy="300" r="70"/><rect x="530" y="300" width="140" height="200"/></g><g fill="#fff" opacity=".6">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${i * 140 + 20}" y="${440 - (i % 3) * 60}" width="20" height="30"/><rect x="${i * 140 + 70}" y="${440 - (i % 3) * 60}" width="20" height="30"/>`).join("")}</g>${wave(660, 6, "#4e7fa0")}`, sky("s", "#f6c38b", "#fbe7cf")),
  "nature.svg": svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${clouds(140)}${hills([[0, 420], [200, 200], [380, 360], [600, 160], [820, 340], [1000, 220], [1200, 380]], "#8fa7c0")}${hills([[0, 500], [300, 380], [600, 470], [900, 390], [1200, 480]], "#2f6b46")}<g fill="#1f4d33">${Array.from({ length: 18 }, (_, i) => `<path d="M${i * 70 + 20} 640 l30 -110 l30 110z"/>`).join("")}</g>${wave(660, 4, "#4f9fb8")}`, sky("s", "#a8d8f0", "#eaf6fb")),
  "beach.svg": svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sun(600, 300, 110, "#ffd27a")}${wave(420, 6, "#2f8fc0")}${wave(520, 8, "#287bb0", 0.9)}${wave(620, 10, "#f3dfb4")}${palm(160, 700)}${palm(1040, 720, 0.9)}<g><rect x="520" y="640" width="160" height="10" fill="#e05a47"/><path d="M600 560 L 680 640 L 520 640Z" fill="#f08c5a"/></g>`, sky("s", "#ffb980", "#ffe6c7")),
  "villa.svg": svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sun(950, 180, 60, "#fff4d6")}<rect x="200" y="300" width="800" height="300" fill="#f7f1e7"/><path d="M160 310 L 600 160 L 1040 310Z" fill="#b5653f"/><g fill="#5b7c8f"><rect x="280" y="380" width="120" height="140"/><rect x="540" y="380" width="120" height="220"/><rect x="800" y="380" width="120" height="140"/></g><rect x="0" y="600" width="${W}" height="200" fill="#56b6c9"/>${palm(1100, 620, 0.9)}${palm(90, 620, 0.8)}`, sky("s", "#9ad0ec", "#e5f4fb")),
  "team.svg": svg(`<rect width="${W}" height="${H}" fill="#f3efe6"/><g fill="#0f5c55" opacity=".9"><circle cx="400" cy="330" r="80"/><rect x="300" y="420" width="200" height="260" rx="90"/><circle cx="800" cy="330" r="80"/><rect x="700" y="420" width="200" height="260" rx="90"/></g><g fill="#d8a25b"><circle cx="600" cy="300" r="90"/><rect x="490" y="400" width="220" height="300" rx="100"/></g>`),
  "hero-hills.svg": svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sun(880, 220, 70, "#fff6dc")}${clouds(260)}${hills([[0, 360], [200, 260], [450, 330], [700, 240], [950, 320], [1200, 260]], "#9fb6a3", 0.8)}${hills([[0, 470], [250, 380], [520, 440], [800, 370], [1200, 450]], "#5d8f5f")}${hills([[0, 600], [300, 500], [600, 560], [900, 490], [1200, 560]], "#3d7344")}<g stroke="#2d5c33" stroke-width="10" fill="none" opacity=".6">${Array.from({ length: 7 }, (_, i) => `<path d="M0 ${620 + i * 30} Q 600 ${560 + i * 30} 1200 ${620 + i * 30}"/>`).join("")}</g>`, sky("s", "#c9dce6", "#f2f5ef")),
  "tea.svg": svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${hills([[0, 300], [400, 220], [800, 300], [1200, 240]], "#8eb48a")}${hills([[0, 420], [400, 340], [800, 420], [1200, 360]], "#5e9a5a")}<g stroke="#3f7a3c" stroke-width="16" fill="none">${Array.from({ length: 9 }, (_, i) => `<path d="M0 ${460 + i * 40} Q 600 ${400 + i * 40} 1200 ${460 + i * 40}"/>`).join("")}</g><rect x="820" y="330" width="160" height="90" fill="#f4efe4"/><path d="M800 335 L 900 280 L 1000 335Z" fill="#a4553a"/>`, sky("s", "#d6e7ee", "#f4f7f0")),
  "train.svg": svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${hills([[0, 360], [300, 250], [600, 330], [900, 240], [1200, 330]], "#6f9f74")}<g fill="#c9b79c">${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 140} 800 L ${i * 140} 560 A 70 70 0 0 1 ${i * 140 + 140} 560 L ${i * 140 + 140} 800 L ${i * 140 + 110} 800 L ${i * 140 + 110} 580 A 40 40 0 0 0 ${i * 140 + 30} 580 L ${i * 140 + 30} 800Z"/>`).join("")}</g><rect x="0" y="470" width="${W}" height="20" fill="#7a6a55"/><g><rect x="250" y="400" width="200" height="70" rx="10" fill="#1d4f91"/><rect x="460" y="400" width="200" height="70" rx="10" fill="#1d4f91"/><rect x="670" y="400" width="200" height="70" rx="10" fill="#1d4f91"/></g><g fill="#cfe3ff">${[270, 330, 390, 480, 540, 600, 690, 750, 810].map((x) => `<rect x="${x}" y="415" width="40" height="25"/>`).join("")}</g>`, sky("s", "#bcdcef", "#eef6f8")),
  "surf.svg": svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sun(300, 200, 70, "#fff0c2")}<path d="M0 520 C 200 360 420 340 560 440 C 650 500 720 470 760 420 C 700 560 400 600 0 640Z" fill="#2c8fbf"/>${wave(560, 10, "#1f77a8")}${wave(660, 10, "#f0dcb0")}<g transform="translate(700 520) rotate(-20)"><ellipse rx="70" ry="12" fill="#ff7a45"/></g>${palm(1050, 700)}`, sky("s", "#8fd0f2", "#e9f7fd")),
};

for (const [name, content] of Object.entries(images)) fs.writeFileSync(path.join(out, name), content);
console.log(`Wrote ${Object.keys(images).length} demo pictures to public/demo`);
