import { Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { SketchfabService } from '../core/sketchfab/sketchfab.service';
import {
  SketchfabDownloadResponse,
  SketchfabModel,
} from '../core/sketchfab/sketchfab.types';

@Component({
  selector: 'app-model-detail',
  imports: [RouterLink],
  templateUrl: './model-detail.html',
  styleUrl: './model-detail.scss',
})
export class ModelDetail {
  /** Bound from the :uid route param. */
  readonly uid = input.required<string>();

  private readonly api = inject(SketchfabService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly model = signal<SketchfabModel | undefined>(undefined);
  protected readonly error = signal('');
  protected readonly downloads = signal<SketchfabDownloadResponse | undefined>(undefined);
  protected readonly downloadError = signal('');
  protected readonly fetchingLinks = signal(false);
  protected readonly tokenDraft = signal('');
  protected readonly hasToken = computed(() => !!this.api.token());

  protected readonly embedUrl = computed(() => {
    const m = this.model();
    if (!m) return undefined;
    const url = `${m.embedUrl}?autostart=1&ui_theme=dark&dnt=1`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    // input() isn't readable in the constructor body — defer to microtask
    queueMicrotask(() => this.load());
  }

  private async load(): Promise<void> {
    try {
      this.model.set(await this.api.getModel(this.uid()));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not load model');
    }
  }

  protected saveToken(): void {
    this.api.setToken(this.tokenDraft());
    this.tokenDraft.set('');
    this.downloadError.set('');
  }

  protected clearToken(): void {
    this.api.setToken('');
    this.downloads.set(undefined);
  }

  protected async fetchLinks(): Promise<void> {
    this.fetchingLinks.set(true);
    this.downloadError.set('');
    try {
      this.downloads.set(await this.api.getDownloadUrls(this.uid()));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'failed';
      this.downloadError.set(
        msg === 'BAD_TOKEN'
          ? 'Sketchfab rejected that token (401). Double-check it under Settings → Password & API.'
          : msg === 'NO_TOKEN'
            ? 'Set your API token first.'
            : msg,
      );
    } finally {
      this.fetchingLinks.set(false);
    }
  }

  protected mb(bytes?: number): string {
    return bytes ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : '?';
  }

  protected fmt(n: number | undefined): string {
    const v = n ?? 0;
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000) return (v / 1_000).toFixed(1) + 'k';
    return String(v);
  }
}
