import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-games-index',
  imports: [RouterLink],
  template: `
    <div class="page wrap">
      <p class="kicker"><span class="tick">▸</span> Arcade · built with three.js</p>
      <h1>Games Explorer</h1>
      <p class="lede">
        Everything the curriculum teaches — render loops, input, collision, the scene graph —
        eventually wants to become a game. This shelf holds the Atelier's playable remakes,
        each one written with the same <code>ThreeDemo</code> base class as the lessons.
      </p>

      <div class="shelf">
        <a routerLink="/games/blobby-volley" class="cartridge">
          <div class="screen">
            <div class="court">
              <div class="net"></div>
              <div class="blob blob-l"><i></i><i></i></div>
              <div class="blob blob-r"><i></i><i></i></div>
              <div class="ball"></div>
              <div class="sand"></div>
            </div>
            <span class="play">▶ play</span>
          </div>
          <div class="label">
            <span class="year">est. 2000</span>
            <h2>Blobby Volley</h2>
            <p>
              The LAN-party legend, remade. Two gelatinous athletes, one beach, classic
              rules: only the server scores, three touches a side, first to 15.
            </p>
            <span class="tags">
              <code>1–2 players</code><code>keyboard</code><code>cpu opponent</code>
            </span>
          </div>
        </a>

        <a routerLink="/games/tiny-legend" class="cartridge">
          <div class="screen screen-legend">
            <div class="forest">
              <i class="tree t1"></i><i class="tree t2"></i><i class="tree t3"></i>
              <i class="tree t4"></i><i class="tree t5"></i>
              <div class="hero"><b></b></div>
              <div class="tri">
                <s></s><s></s><s></s>
              </div>
            </div>
            <span class="play">▶ play</span>
          </div>
          <div class="label">
            <span class="year">in the spirit of 1986</span>
            <h2>Tiny Legend</h2>
            <p>
              A fan-made miniature of the top-down classic, in genuine 16×16 pixel art on a
              256×176 screen. Four screens, a sword, octoroks — find the golden trishard.
            </p>
            <span class="tags">
              <code>1 player</code><code>keyboard</code><code>screen-scroll world</code>
            </span>
          </div>
        </a>

        <div class="cartridge soon">
          <div class="screen"><span class="qmark">?</span></div>
          <div class="label">
            <span class="year">someday</span>
            <h2>Insert cartridge</h2>
            <p>More remakes will land here as the curriculum grows.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .wrap {
      padding: 56px 64px 80px;
      max-width: 1100px;
    }
    h1 {
      font-size: clamp(34px, 4vw, 50px);
      text-transform: uppercase;
      margin: 12px 0 14px;
    }
    .lede {
      color: var(--ink-dim);
      max-width: 580px;
      margin-bottom: 44px;
    }
    .shelf {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 22px;
    }
    .cartridge {
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--panel);
      overflow: hidden;
      text-decoration: none;
      transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

      &:not(.soon):hover {
        transform: translateY(-4px);
        border-color: var(--acc);
        box-shadow: 0 16px 44px rgba(0, 0, 0, 0.5);

        .play { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        h2 { color: var(--acc); }
      }
    }
    .screen {
      position: relative;
      aspect-ratio: 16 / 9;
      background:
        radial-gradient(ellipse 90% 70% at 50% 0%, #16203a 0%, #0b0e16 70%);
      border-bottom: 1px solid var(--line);
      overflow: hidden;
    }
    /* --- tiny CSS diorama of the game --- */
    .court { position: absolute; inset: 0; }
    .sand {
      position: absolute;
      left: 0; right: 0; bottom: 0;
      height: 22%;
      background: linear-gradient(180deg, #c9b07e, #a98e60);
    }
    .net {
      position: absolute;
      left: 50%; bottom: 22%;
      width: 3px; height: 38%;
      transform: translateX(-50%);
      background:
        repeating-linear-gradient(0deg, rgba(233,235,241,.75) 0 2px, transparent 2px 7px);
      border-top: 3px solid #e9ebf1;
    }
    .blob {
      position: absolute;
      bottom: 22%;
      width: 64px; height: 56px;
      border-radius: 50% 50% 42% 42% / 62% 62% 38% 38%;
      animation: bounce 1.6s ease-in-out infinite;

      i {
        position: absolute;
        top: 13px;
        width: 13px; height: 13px;
        border-radius: 50%;
        background: #fff;
        &::after {
          content: '';
          position: absolute;
          top: 3.5px;
          width: 5.5px; height: 5.5px;
          border-radius: 50%;
          background: #0a0b0e;
        }
      }
    }
    .blob-l {
      left: 17%;
      background: linear-gradient(180deg, #ff7585, #d23b4c);
      i { &:nth-child(1) { right: 24px; &::after { right: 2px; } }
          &:nth-child(2) { right: 7px; &::after { right: 2px; } } }
    }
    .blob-r {
      right: 17%;
      background: linear-gradient(180deg, #6fb2ff, #2f6fd0);
      animation-delay: -0.8s;
      i { &:nth-child(1) { left: 7px; &::after { left: 2px; } }
          &:nth-child(2) { left: 24px; &::after { left: 2px; } } }
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0) scaleY(1); }
      35% { transform: translateY(-26px) scaleY(1.06); }
      50% { transform: translateY(-30px) scaleY(1.04); }
      90% { transform: translateY(0) scaleY(0.94); }
    }
    .ball {
      position: absolute;
      left: 38%; top: 18%;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: radial-gradient(circle at 32% 30%, #eaff7a, #b8d81f 70%);
      animation: lob 3.2s ease-in-out infinite alternate;
    }
    @keyframes lob {
      from { transform: translate(0, 0); }
      50%  { transform: translate(90px, -26px); }
      to   { transform: translate(180px, 14px); }
    }
    .play {
      position: absolute;
      left: 50%; top: 50%;
      transform: translate(-50%, -50%) scale(0.92);
      padding: 9px 22px;
      border-radius: 999px;
      background: var(--acc);
      color: var(--acc-ink);
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.08em;
      opacity: 0;
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    .label {
      padding: 18px 22px 22px;

      h2 {
        font-size: 21px;
        margin: 4px 0 8px;
        transition: color 0.18s ease;
      }
      p {
        color: var(--ink-dim);
        font-size: 13px;
        margin: 0 0 12px;
        line-height: 1.55;
      }
    }
    .year {
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;

      code {
        font-size: 10.5px;
        color: var(--ink-faint);
        border: 1px solid var(--line-soft);
        background: transparent;
        border-radius: 4px;
        padding: 1px 8px;
      }
    }
    /* --- tiny CSS diorama: the legend --- */
    .screen-legend {
      background: radial-gradient(ellipse 90% 80% at 50% 20%, #16301e 0%, #0a1410 75%);
    }
    .forest { position: absolute; inset: 0; }
    .tree {
      position: absolute;
      width: 0; height: 0;
      border-left: 13px solid transparent;
      border-right: 13px solid transparent;
      border-bottom: 34px solid #1f4424;

      &::after {
        content: '';
        position: absolute;
        left: -3px; top: 34px;
        width: 6px; height: 7px;
        background: #3a2c1e;
      }
      &.t1 { left: 8%; top: 16%; }
      &.t2 { left: 20%; top: 56%; transform: scale(0.85); }
      &.t3 { right: 12%; top: 12%; transform: scale(1.1); }
      &.t4 { right: 24%; top: 60%; transform: scale(0.8); }
      &.t5 { left: 44%; top: 8%; transform: scale(0.7); }
    }
    .hero {
      position: absolute;
      left: 30%; bottom: 26%;
      width: 22px; height: 26px;
      background: #45d07b;
      border-radius: 4px;
      animation: step 1.2s steps(2) infinite;

      b {
        position: absolute;
        top: -12px; left: 4px;
        width: 14px; height: 12px;
        background: #e8b88a;
        border-radius: 3px;

        &::after {
          content: '';
          position: absolute;
          top: -7px; left: 2px;
          width: 0; height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 8px solid #2f9e58;
        }
      }
    }
    @keyframes step {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    .tri {
      position: absolute;
      right: 26%; bottom: 30%;
      animation: glowy 2.4s ease-in-out infinite;

      s {
        position: absolute;
        width: 0; height: 0;
        border-left: 11px solid transparent;
        border-right: 11px solid transparent;
        border-bottom: 19px solid #ffd75e;

        &:nth-child(1) { left: -11px; top: -38px; }
        &:nth-child(2) { left: -23px; top: -19px; }
        &:nth-child(3) { left: 1px; top: -19px; }
      }
    }
    @keyframes glowy {
      0%, 100% { filter: drop-shadow(0 0 6px rgba(255, 215, 94, 0.8)); }
      50% { filter: drop-shadow(0 0 16px rgba(255, 215, 94, 1)); transform: translateY(-4px); }
    }

    .soon {
      opacity: 0.55;

      .screen { display: flex; align-items: center; justify-content: center; }
      .qmark {
        font-family: var(--font-display);
        font-size: 64px;
        font-weight: 800;
        color: var(--line);
      }
    }
    @media (max-width: 720px) {
      .wrap { padding: 36px 22px 60px; }
    }
  `,
})
export class GamesIndex {}
