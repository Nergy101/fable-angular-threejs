import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LESSONS, lessonBySlug } from './lesson-data';
import { Lesson01Stage } from './lessons/lesson-01-stage';
import { Lesson02Meshes } from './lessons/lesson-02-meshes';
import { Lesson03SceneGraph } from './lessons/lesson-03-scene-graph';
import { Lesson04Lights } from './lessons/lesson-04-lights';
import { Lesson05Cameras } from './lessons/lesson-05-cameras';
import { Lesson06Loop } from './lessons/lesson-06-loop';
import { Lesson07Raycasting } from './lessons/lesson-07-raycasting';
import { Lesson08Gltf } from './lessons/lesson-08-gltf';

@Component({
  selector: 'app-lesson-page',
  imports: [
    RouterLink,
    Lesson01Stage,
    Lesson02Meshes,
    Lesson03SceneGraph,
    Lesson04Lights,
    Lesson05Cameras,
    Lesson06Loop,
    Lesson07Raycasting,
    Lesson08Gltf,
  ],
  template: `
    @if (lesson(); as l) {
      <div class="page wrap">
        <header class="head" [class]="'ax-' + l.axis">
          <p class="kicker">
            <span class="tick">▸</span> Lesson {{ l.num }} / 08 · ~{{ l.minutes }} min
          </p>
          <h1>{{ l.title }}</h1>
          <p class="sub">{{ l.subtitle }}</p>
        </header>

        @switch (l.slug) {
          @case ('the-stage') { <app-lesson-01 /> }
          @case ('meshes') { <app-lesson-02 /> }
          @case ('scene-graph') { <app-lesson-03 /> }
          @case ('light-and-shadow') { <app-lesson-04 /> }
          @case ('cameras') { <app-lesson-05 /> }
          @case ('render-loop') { <app-lesson-06 /> }
          @case ('raycasting') { <app-lesson-07 /> }
          @case ('gltf') { <app-lesson-08 /> }
        }

        <nav class="pager">
          @if (prev(); as p) {
            <a [routerLink]="['/learn', p.slug]" class="pg pg-prev">
              <span class="pg-dir">← Previous</span>
              <span class="pg-title">{{ p.num }} · {{ p.title }}</span>
            </a>
          } @else {
            <span></span>
          }
          @if (next(); as n) {
            <a [routerLink]="['/learn', n.slug]" class="pg pg-next">
              <span class="pg-dir">Next →</span>
              <span class="pg-title">{{ n.num }} · {{ n.title }}</span>
            </a>
          } @else {
            <a routerLink="/explorer" class="pg pg-next">
              <span class="pg-dir">Graduate →</span>
              <span class="pg-title">Open the Model Explorer</span>
            </a>
          }
        </nav>
      </div>
    } @else {
      <div class="page wrap">
        <h1>Lesson not found</h1>
        <p><a routerLink="/learn">Back to the curriculum</a></p>
      </div>
    }
  `,
  styles: `
    .wrap {
      padding: 56px 64px 80px;
      max-width: 900px;
    }
    .head {
      padding-bottom: 28px;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--line);
      position: relative;

      &::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: -1px;
        width: 72px;
        height: 2px;
      }
      &.ax-x::after { background: var(--axis-x); }
      &.ax-y::after { background: var(--axis-y); }
      &.ax-z::after { background: var(--axis-z); }

      h1 {
        font-size: clamp(34px, 4.5vw, 52px);
        text-transform: uppercase;
        margin: 12px 0 10px;
      }
      .sub {
        color: var(--ink-dim);
        font-size: 16px;
        margin: 0;
        max-width: 600px;
      }
    }
    .pager {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 64px;
      padding-top: 28px;
      border-top: 1px solid var(--line);
    }
    .pg {
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-decoration: none;
      padding: 14px 18px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      min-width: 200px;
      transition: border-color 0.18s ease, background 0.18s ease;

      &:hover {
        border-color: var(--acc);
        background: var(--bg-raise);
        .pg-title { color: var(--acc); }
      }
    }
    .pg-next { text-align: right; margin-left: auto; }
    .pg-dir {
      font-family: var(--font-mono);
      font-size: 10.5px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .pg-title {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 15px;
      transition: color 0.18s ease;
    }
    @media (max-width: 720px) {
      .wrap { padding: 36px 22px 60px; }
    }
  `,
})
export class LessonPage {
  /** Bound from the :slug route param via withComponentInputBinding. */
  readonly slug = input.required<string>();

  protected readonly lesson = computed(() => lessonBySlug(this.slug()));
  protected readonly prev = computed(() => {
    const i = LESSONS.findIndex((l) => l.slug === this.slug());
    return i > 0 ? LESSONS[i - 1] : undefined;
  });
  protected readonly next = computed(() => {
    const i = LESSONS.findIndex((l) => l.slug === this.slug());
    return i >= 0 && i < LESSONS.length - 1 ? LESSONS[i + 1] : undefined;
  });
}
