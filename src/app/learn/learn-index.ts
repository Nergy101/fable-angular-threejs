import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LESSONS } from './lesson-data';

@Component({
  selector: 'app-learn-index',
  imports: [RouterLink],
  template: `
    <div class="page wrap">
      <p class="kicker"><span class="tick">▸</span> Curriculum</p>
      <h1>Eight lessons,<br />zero hand-waving.</h1>
      <p class="lede">
        Work top to bottom — each lesson builds on the last. Every demo is live: drag the
        sliders, break things, read the code that drives it.
      </p>

      <ol class="lesson-list">
        @for (lesson of lessons; track lesson.slug) {
          <li>
            <a [routerLink]="['/learn', lesson.slug]" class="row" [class]="'ax-' + lesson.axis">
              <span class="num">{{ lesson.num }}</span>
              <span class="body">
                <span class="title">{{ lesson.title }}</span>
                <span class="sub">{{ lesson.subtitle }}</span>
                <span class="concepts">
                  @for (c of lesson.concepts; track c) {
                    <code>{{ c }}</code>
                  }
                </span>
              </span>
              <span class="meta">~{{ lesson.minutes }} min</span>
              <span class="arrow">→</span>
            </a>
          </li>
        }
      </ol>
    </div>
  `,
  styles: `
    .wrap {
      padding: 64px;
      max-width: 980px;
    }
    h1 {
      font-size: clamp(36px, 4.5vw, 54px);
      text-transform: uppercase;
      margin: 14px 0 18px;
    }
    .lede {
      color: var(--ink-dim);
      max-width: 560px;
      margin-bottom: 44px;
    }
    .lesson-list {
      list-style: none;
      margin: 0;
      padding: 0;
      border-top: 1px solid var(--line);
    }
    .row {
      display: grid;
      grid-template-columns: 64px 1fr auto 40px;
      align-items: center;
      gap: 20px;
      padding: 24px 10px;
      border-bottom: 1px solid var(--line);
      text-decoration: none;
      transition: background 0.18s ease, padding-left 0.18s ease;

      &:hover {
        background: var(--bg-raise);
        padding-left: 18px;

        .arrow { color: var(--acc); transform: translateX(4px); }
        .title { color: var(--acc); }
      }
    }
    .num {
      font-family: var(--font-mono);
      font-size: 22px;
      font-weight: 600;
      color: var(--ink-faint);
    }
    .ax-x .num { color: color-mix(in srgb, var(--axis-x) 75%, var(--ink-faint)); }
    .ax-y .num { color: color-mix(in srgb, var(--axis-y) 75%, var(--ink-faint)); }
    .ax-z .num { color: color-mix(in srgb, var(--axis-z) 75%, var(--ink-faint)); }
    .body {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .title {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 700;
      transition: color 0.18s ease;
    }
    .sub {
      color: var(--ink-dim);
      font-size: 13.5px;
    }
    .concepts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 7px;

      code {
        font-size: 10.5px;
        color: var(--ink-faint);
        border: 1px solid var(--line-soft);
        background: transparent;
        border-radius: 4px;
        padding: 1px 7px;
        white-space: nowrap;
      }
    }
    .meta {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--ink-faint);
      white-space: nowrap;
    }
    .arrow {
      color: var(--ink-faint);
      font-size: 18px;
      transition: color 0.18s ease, transform 0.18s ease;
    }
    @media (max-width: 720px) {
      .wrap { padding: 36px 22px; }
      .row { grid-template-columns: 40px 1fr; }
      .meta, .arrow { display: none; }
    }
  `,
})
export class LearnIndex {
  protected readonly lessons = LESSONS;
}
