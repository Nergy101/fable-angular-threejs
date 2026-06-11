import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SketchfabService } from '../core/sketchfab/sketchfab.service';
import {
  SKETCHFAB_CATEGORIES,
  SketchfabModel,
  SketchfabSort,
} from '../core/sketchfab/sketchfab.types';

@Component({
  selector: 'app-explorer',
  imports: [RouterLink],
  templateUrl: './explorer.html',
  styleUrl: './explorer.scss',
})
export class Explorer {
  private readonly api = inject(SketchfabService);

  protected readonly categories = SKETCHFAB_CATEGORIES;

  protected readonly q = signal('');
  protected readonly category = signal('');
  protected readonly sort = signal<SketchfabSort>('-likeCount');
  protected readonly staffPicked = signal(false);
  protected readonly animated = signal(false);

  protected readonly results = signal<SketchfabModel[]>([]);
  protected readonly nextUrl = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal('');
  protected readonly hasToken = computed(() => !!this.api.token());

  private searchTimer?: ReturnType<typeof setTimeout>;
  private requestSeq = 0;

  constructor() {
    this.runSearch();
  }

  protected onQuery(value: string): void {
    this.q.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.runSearch(), 350);
  }

  protected setCategory(slug: string): void {
    this.category.set(this.category() === slug ? '' : slug);
    this.runSearch();
  }

  protected setSort(sort: string): void {
    this.sort.set(sort as SketchfabSort);
    this.runSearch();
  }

  protected toggleStaffPicked(): void {
    this.staffPicked.set(!this.staffPicked());
    this.runSearch();
  }

  protected toggleAnimated(): void {
    this.animated.set(!this.animated());
    this.runSearch();
  }

  protected async runSearch(): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await this.api.search({
        q: this.q() || undefined,
        categories: this.category() || undefined,
        sort: this.sort(),
        staffpicked: this.staffPicked(),
        animated: this.animated(),
      });
      if (seq !== this.requestSeq) return; // a newer search superseded this one
      this.results.set(res.results);
      this.nextUrl.set(res.next);
    } catch (err) {
      if (seq !== this.requestSeq) return;
      this.error.set(err instanceof Error ? err.message : 'Search failed');
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const url = this.nextUrl();
    if (!url || this.loadingMore()) return;
    this.loadingMore.set(true);
    try {
      const res = await this.api.fetchPage(url);
      this.results.update((list) => [...list, ...res.results]);
      this.nextUrl.set(res.next);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load more');
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected thumb(model: SketchfabModel): string {
    const images = [...(model.thumbnails?.images ?? [])].sort((a, b) => b.width - a.width);
    // pick the smallest image that is still ≥ 480px wide
    const fit = images.filter((i) => i.width >= 480).pop();
    return (fit ?? images[0])?.url ?? '';
  }

  protected fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n ?? 0);
  }
}
