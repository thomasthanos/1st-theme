const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', '.github', 'assets');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// 1. Clean Discord-Themed Banner
const bannerSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 180" width="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1f22" />
      <stop offset="50%" stop-color="#2b2d31" />
      <stop offset="100%" stop-color="#313338" />
    </linearGradient>
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#5865F2" />
      <stop offset="100%" stop-color="#57F287" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="800" height="180" rx="14" fill="url(#bg)" stroke="#3f4248" stroke-width="1.5" />
  
  <g filter="url(#glow)">
    <text x="400" y="95" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" text-anchor="middle" letter-spacing="3" fill="url(#titleGrad)">1ST THEME</text>
  </g>
  <text x="400" y="132" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#949ba4" text-anchor="middle" letter-spacing="2">BETTERDISCORD THEMES &amp; PLUGINS COLLECTION</text>
</svg>`;

// 2. Divider
const dividerSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 20" width="100%">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#5865F2" stop-opacity="0" />
      <stop offset="50%" stop-color="#5865F2" stop-opacity="1" />
      <stop offset="100%" stop-color="#5865F2" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect x="0" y="9" width="800" height="2" fill="url(#grad)" rx="1" />
</svg>`;

// 3. Badges Helper
function createBadge(leftText, rightText, color) {
  const leftWidth = leftText.length * 7 + 18;
  const rightWidth = rightText.length * 7 + 18;
  const total = leftWidth + rightWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="24">
  <clipPath id="rc"><rect width="${total}" height="24" rx="4"/></clipPath>
  <g clip-path="url(#rc)">
    <rect width="${leftWidth}" height="24" fill="#2b2d31"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="24" fill="${color}"/>
  </g>
  <g fill="#fff" font-family="Verdana,sans-serif" font-size="11" font-weight="bold">
    <text x="${leftWidth/2}" y="16" text-anchor="middle">${leftText}</text>
    <text x="${leftWidth + rightWidth/2}" y="16" text-anchor="middle">${rightText}</text>
  </g>
</svg>`;
}

// 4. Footer
const footerSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 40" width="300">
  <text x="150" y="25" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#949ba4" text-anchor="middle">Engineered by Thomas Thanos</text>
</svg>`;

fs.writeFileSync(path.join(outDir, 'banner.svg'), bannerSVG);
fs.writeFileSync(path.join(outDir, 'divider.svg'), dividerSVG);
fs.writeFileSync(path.join(outDir, 'badge-bd.svg'), createBadge('platform', 'BetterDiscord', '#5865F2'));
fs.writeFileSync(path.join(outDir, 'badge-css.svg'), createBadge('styles', 'CSS3', '#264de4'));
fs.writeFileSync(path.join(outDir, 'badge-js.svg'), createBadge('plugins', 'JavaScript', '#f7df1e'));
fs.writeFileSync(path.join(outDir, 'badge-license.svg'), createBadge('license', 'Proprietary', '#ed4245'));
fs.writeFileSync(path.join(outDir, 'footer-author.svg'), footerSVG);

console.log('1st-theme SVGs generated successfully!');
