// このデモのために描いた、オリジナルのイラスト（SVG）。外部の画像は使わない。
// 動きは CSS（style.css の .art-*）で付ける。

/** ロゴ：ふきだしの中の「あ」と、まわりの小さな地球 */
export const logoSvg = `
<svg viewBox="0 0 48 48" class="logo" aria-hidden="true">
  <path d="M8 6h32a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H22l-9 8v-8H8a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6z" fill="#2f80ed"/>
  <text x="24" y="29" text-anchor="middle" font-size="20" font-weight="700" fill="#fff" font-family="BIZ UDPGothic, sans-serif">あ</text>
  <circle cx="40" cy="9" r="7" fill="#ffc83d" stroke="#fff" stroke-width="2"/>
  <path d="M34 9h12M40 3c-3 3.5-3 8.5 0 12M40 3c3 3.5 3 8.5 0 12" stroke="#c98a00" stroke-width="1.2" fill="none"/>
</svg>`;

/** トップのイラスト：先生のことばが、やさしい日本語と2つのことばになって、子どもたちの画面に届く */
export const heroSvg = `
<svg viewBox="0 0 640 300" class="hero-art" role="img" aria-label="先生のことばが、やさしい日本語と母語になって、子どもたちの画面に届くイラスト">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3f1ff"/><stop offset="1" stop-color="#fff7e6"/></linearGradient>
  </defs>
  <rect x="0" y="0" width="640" height="300" rx="28" fill="url(#sky)"/>
  <circle cx="560" cy="58" r="26" fill="#ffd25e" class="art-sun"/>
  <g fill="#fff" opacity=".9" class="art-cloud"><ellipse cx="120" cy="52" rx="40" ry="14"/><ellipse cx="146" cy="44" rx="24" ry="14"/></g>
  <rect x="0" y="246" width="640" height="54" fill="#d9f2e3"/>

  <!-- 先生 -->
  <g class="art-teacher">
    <rect x="58" y="150" width="70" height="100" rx="30" fill="#2f80ed"/>
    <circle cx="93" cy="122" r="30" fill="#ffd9b8"/>
    <path d="M63 118c2-24 58-30 60 0-8-10-20-14-30-14s-22 4-30 14z" fill="#4a3426"/>
    <circle cx="83" cy="124" r="3.4" fill="#3a2a20"/><circle cx="103" cy="124" r="3.4" fill="#3a2a20"/>
    <path d="M84 136q9 8 18 0" stroke="#c0563f" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="110" y="168" width="44" height="10" rx="5" fill="#2f80ed" class="art-arm"/>
  </g>

  <!-- 先生のことば -->
  <g class="art-bubble art-b1">
    <rect x="138" y="70" width="128" height="50" rx="16" fill="#fff" stroke="#9fb3c8" stroke-width="2"/>
    <path d="M150 118l-8 16 20-14z" fill="#fff" stroke="#9fb3c8" stroke-width="2" stroke-linejoin="round"/>
    <text x="202" y="101" text-anchor="middle" font-size="17" fill="#3b4a5a" font-family="BIZ UDPGothic, sans-serif">48ページを…</text>
  </g>

  <!-- ことばの流れ -->
  <path d="M272 120 C 320 120, 330 160, 372 160" stroke="#ffc83d" stroke-width="6" fill="none" stroke-linecap="round" class="art-flow"/>
  <g class="art-spark"><path d="M300 92l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="#ffc83d"/></g>

  <!-- 子どもたちの画面 -->
  <g>
    <rect x="372" y="104" width="216" height="128" rx="14" fill="#13314f"/>
    <rect x="382" y="114" width="196" height="108" rx="8" fill="#fffef8"/>
    <rect x="392" y="124" width="176" height="30" rx="7" fill="#e7f5ee" stroke="#2f8a5f" stroke-width="2" class="art-line art-l1"/>
    <text x="480" y="145" text-anchor="middle" font-size="15" fill="#0d2f1f" font-family="BIZ UDPGothic, sans-serif" class="art-line art-l1">48ページを ひらいて</text>
    <rect x="392" y="160" width="84" height="24" rx="6" fill="#e8f0fa" class="art-line art-l2"/>
    <text x="434" y="177" text-anchor="middle" font-size="12" fill="#2b5f9e" class="art-line art-l2">página 48</text>
    <rect x="484" y="160" width="84" height="24" rx="6" fill="#e8f0fa" class="art-line art-l3"/>
    <text x="526" y="177" text-anchor="middle" font-size="12" fill="#2b5f9e" font-family="Microsoft YaHei, sans-serif" class="art-line art-l3">第48页</text>
    <rect x="392" y="190" width="176" height="22" rx="6" fill="#fff6dc" stroke="#e3b341" stroke-width="1.5" class="art-line art-l4"/>
    <text x="480" y="205" text-anchor="middle" font-size="11" fill="#6b4a00" font-family="BIZ UDPGothic, sans-serif" class="art-line art-l4">ようご カード：ページ</text>
    <rect x="466" y="232" width="28" height="14" fill="#13314f"/>
  </g>

  <!-- 子どもたち -->
  <g class="art-kid art-k1"><circle cx="420" cy="262" r="20" fill="#f5c79e"/><path d="M400 258c0-18 40-18 40 0-6-6-14-8-20-8s-14 2-20 8z" fill="#2b2b2b"/><circle cx="413" cy="263" r="2.6" fill="#333"/><circle cx="427" cy="263" r="2.6" fill="#333"/><path d="M414 272q6 5 12 0" stroke="#a24a34" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>
  <g class="art-kid art-k2"><circle cx="480" cy="266" r="20" fill="#8d5a3b"/><path d="M459 262c0-22 42-22 42 0-4-8-12-10-21-10s-17 2-21 10z" fill="#1d1d1d"/><circle cx="473" cy="267" r="2.6" fill="#1d1d1d"/><circle cx="487" cy="267" r="2.6" fill="#1d1d1d"/><path d="M474 276q6 5 12 0" stroke="#5a2a1a" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>
  <g class="art-kid art-k3"><circle cx="540" cy="262" r="20" fill="#ffe0c2"/><path d="M519 262c-2-24 44-26 42 0l-4-10c-8-4-26-4-34 0z" fill="#c9893a"/><circle cx="533" cy="263" r="2.6" fill="#333"/><circle cx="547" cy="263" r="2.6" fill="#333"/><path d="M534 272q6 5 12 0" stroke="#a24a34" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>
</svg>`;

/** 児童向けの画面の待ち受け：ふきだしがふわふわ浮かぶ */
export const waitingSvg = `
<svg viewBox="0 0 420 220" class="wait-art" aria-hidden="true">
  <g class="art-float f1"><rect x="40" y="40" width="120" height="56" rx="18" fill="#e7f5ee" stroke="#2f8a5f" stroke-width="3"/><text x="100" y="76" text-anchor="middle" font-size="24" fill="#1f6b48" font-family="UD Digi Kyokasho N-R, BIZ UDPGothic, sans-serif">あ</text></g>
  <g class="art-float f2"><rect x="170" y="20" width="110" height="56" rx="18" fill="#e8f0fa" stroke="#2f80ed" stroke-width="3"/><text x="225" y="56" text-anchor="middle" font-size="22" fill="#2b5f9e">Olá</text></g>
  <g class="art-float f3"><rect x="290" y="60" width="96" height="56" rx="18" fill="#fff6dc" stroke="#e3b341" stroke-width="3"/><text x="338" y="96" text-anchor="middle" font-size="22" fill="#8a6200" font-family="Microsoft YaHei, sans-serif">你好</text></g>
  <g class="art-dots"><circle cx="170" cy="170" r="10" fill="#9fb3c8"/><circle cx="210" cy="170" r="10" fill="#9fb3c8"/><circle cx="250" cy="170" r="10" fill="#9fb3c8"/></g>
</svg>`;
