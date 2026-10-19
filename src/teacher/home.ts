// ホーム（はじめに見るページ）：写真と短い文で、何ができるかを伝え、すぐ試せるようにする。
// 写真は「ぱくたそ」のフリー素材（モデルを使用したイメージ写真）。公開リポジトリには入れず、公開URLにだけ置く。
import { esc } from "../ui/dom";
import { openStudentWindow } from "./app";

const photo = (name: string, alt: string, cls = "") =>
  `<img class="photo ${cls}" src="photos/${name}.jpg" alt="${esc(alt)}" onerror="this.classList.add('missing')">`;

export function renderHome(el: HTMLElement) {
  el.innerHTML = `
  <section class="home-hero">
    ${photo("classroom", "窓から光が差し込む小学校の教室", "hero-photo")}
    <div class="home-hero-text">
      <p class="eyebrow">教室用「やさしい日本語＋多言語」表示（デモ版）</p>
      <h1>先生のことばを、<br><span>やさしい日本語</span>と<span>母語</span>で、<br>クラスのみんなに。</h1>
      <p class="lead-text">話した指示を、やさしい日本語と2つのことばにして、教室の大きな画面に表示します。</p>
      <div class="row">
        <a class="btn sun big" href="#/use">▶ さっそく試す</a>
        <button class="btn big glass" id="homeStudent">📺 児童向けの画面を開く</button>
      </div>
      <p class="hero-msg" id="homeMsg"></p>
    </div>
  </section>

  <section class="home-sec">
    <h2 class="sec-title">こんなこと、ありませんか？</h2>
    <div class="trio">
      <article class="photo-card">${photo("teacher-board", "黒板の前で話す先生")}<div><h3>指示が、伝わっていない</h3><p>「3ページ、いや4ページ」「〜しないでね」。大事なところが伝わらず、ちがうことをしてしまう。</p></div></article>
      <article class="photo-card">${photo("first-grader", "ランドセルを背負った一年生")}<div><h3>漢字や、むずかしい言葉が読めない</h3><p>日本語を学びはじめた子は、ふりがなと、やさしい言いかえがあると分かります。</p></div></article>
      <article class="photo-card">${photo("teacher-globe", "地球儀を使って授業をする先生")}<div><h3>母語が、子どもによってちがう</h3><p>ポルトガル語、中国語…。母語で確かめられると、安心して授業に参加できます。</p></div></article>
    </div>
  </section>

  <section class="home-sec">
    <h2 class="sec-title">使い方は、3ステップ</h2>
    <ol class="steps3">
      <li><span class="num">1</span><span class="big-ico">🎤</span><h3>話す・えらぶ</h3><p>マイクで話すか、見本や定型文から選びます。</p></li>
      <li><span class="num">2</span><span class="big-ico">🔍</span><h3>たしかめる</h3><p>やさしい日本語と訳を、先生がたしかめます。大事な意味が消えていたら、知らせます。</p></li>
      <li><span class="num">3</span><span class="big-ico">📺</span><h3>子どもに見せる</h3><p>先生がOKしたものだけが、教室の大きな画面に出ます。</p></li>
    </ol>
    <div class="center"><a class="btn primary big" href="#/use">▶ 3ステップを試す</a></div>
  </section>

  <section class="home-sec">
    <h2 class="sec-title">このデモの、3つのとくちょう</h2>
    <div class="features">
      <article><span class="f-ico">🔍</span><h3>意味の取りこぼしを、見つける</h3><p>「〜しない」「3ページ」「〜したら」などが、やさしい日本語で消えていないかを自動で確かめます。見本の間違いは、すべて見つけました。</p><a href="#/results">検証結果を見る →</a></article>
      <article><span class="f-ico">📘</span><h3>教科のことばを、母語で覚える</h3><p>「三角形」「底辺」などの用語を、ふりがな・やさしい説明・母語の訳と一緒にカードで見せます。</p><a href="#/glossary">用語集を見る →</a></article>
      <article><span class="f-ico">✅</span><h3>先生がOKしたものだけ</h3><p>確認する前の内容は、子どもの画面に出ません。APIキーもサーバーも使わず、データを外に出しません。</p><a href="#/data">データの扱いを見る →</a></article>
    </div>
  </section>

  <section class="home-cta">
    ${photo("kids-sakura", "桜の下をスキップする一年生", "cta-photo")}
    <div>
      <h2>どの子も、授業に参加できる教室へ。</h2>
      <p>まずは見本の指示で、3ステップを試してみてください。約5分です。</p>
      <a class="btn sun big" href="#/use">▶ さっそく試す</a>
    </div>
  </section>

  <footer class="home-foot">
    <nav>
      <a href="#/use">使ってみる</a><a href="#/glossary">教科の用語集</a><a href="#/phrases">定型文</a>
      <a href="#/results">検証結果</a><a href="#/parts">本番での差し替えの考え方</a><a href="#/data">データの扱い</a>
    </nav>
    <p>写真はイメージです（モデルを使用しています）。写真素材：<a href="https://www.pakutaso.com/" target="_blank" rel="noopener">ぱくたそ</a>。学校名、児童の名前は使っていません。生成AIは使っていません（デモ用の見本と規則で動いています）。</p>
  </footer>`;

  el.querySelector<HTMLButtonElement>("#homeStudent")!.onclick = async () => {
    el.querySelector("#homeMsg")!.textContent = await openStudentWindow();
  };
}
