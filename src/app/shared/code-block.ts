import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const KEYWORDS = new Set([
  'import', 'from', 'export', 'class', 'extends', 'implements', 'constructor',
  'const', 'let', 'var', 'function', 'return', 'new', 'this', 'super',
  'if', 'else', 'for', 'of', 'in', 'while', 'switch', 'case', 'break',
  'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof',
  'public', 'private', 'protected', 'readonly', 'static', 'abstract', 'get', 'set',
  'interface', 'type', 'enum', 'true', 'false', 'null', 'undefined', 'void',
  'string', 'number', 'boolean', 'never', 'unknown', 'any', 'as',
]);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Tiny regex tokenizer — enough to make TypeScript snippets readable
 * without pulling in a full highlighter dependency.
 */
function highlight(src: string): string {
  const token =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:[^`\\]|\\.)*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|(\b\d[\d_]*(?:\.\d+)?\b)|(@?\b[A-Za-z_$][\w$]*\b)|([^\s])/g;

  let out = '';
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = token.exec(src))) {
    out += escapeHtml(src.slice(last, m.index));
    last = m.index + m[0].length;
    const [whole, comment, str, num, ident] = m;
    if (comment) out += `<span class="tk-c">${escapeHtml(comment)}</span>`;
    else if (str) out += `<span class="tk-s">${escapeHtml(str)}</span>`;
    else if (num) out += `<span class="tk-n">${whole}</span>`;
    else if (ident) {
      if (ident.startsWith('@')) out += `<span class="tk-d">${ident}</span>`;
      else if (KEYWORDS.has(ident)) out += `<span class="tk-k">${ident}</span>`;
      else if (/^[A-Z]/.test(ident)) out += `<span class="tk-t">${ident}</span>`;
      else if (src[last] === '(') out += `<span class="tk-f">${ident}</span>`;
      else out += ident;
    } else out += escapeHtml(whole);
  }
  return out + escapeHtml(src.slice(last));
}

@Component({
  selector: 'app-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="code">
      <figcaption>
        <span class="lights"><i></i><i></i><i></i></span>
        <span class="fname">{{ title() }}</span>
        <button type="button" (click)="copy()">{{ copied ? 'copied ✓' : 'copy' }}</button>
      </figcaption>
      <pre><code [innerHTML]="html()"></code></pre>
    </figure>
  `,
  styles: `
    .code {
      margin: 22px 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #0d0e13;
      overflow: hidden;
    }
    figcaption {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 14px;
      border-bottom: 1px solid var(--line-soft);
      background: var(--panel);
    }
    .lights {
      display: inline-flex;
      gap: 5px;
      i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--line);
      }
      i:nth-child(1) { background: color-mix(in srgb, var(--axis-x) 55%, var(--line)); }
      i:nth-child(2) { background: color-mix(in srgb, var(--axis-y) 45%, var(--line)); }
      i:nth-child(3) { background: color-mix(in srgb, var(--axis-z) 50%, var(--line)); }
    }
    .fname {
      flex: 1;
      font-family: var(--font-mono);
      font-size: 11px;
      letter-spacing: 0.08em;
      color: var(--ink-faint);
    }
    button {
      border: none;
      background: none;
      color: var(--ink-faint);
      font-family: var(--font-mono);
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      padding: 2px 6px;
      &:hover { color: var(--acc); }
    }
    pre {
      margin: 0;
      padding: 16px 18px;
      overflow-x: auto;
      font-size: 12.8px;
      line-height: 1.7;
      code { font-family: var(--font-mono); }
    }
    :host ::ng-deep {
      .tk-c { color: #586147; font-style: italic; }
      .tk-s { color: #ffd28a; }
      .tk-n { color: #f7926d; }
      .tk-k { color: #d7ff3e; }
      .tk-t { color: #7fd0ff; }
      .tk-f { color: #c5a3ff; }
      .tk-d { color: #ff8c9f; }
    }
  `,
})
export class CodeBlock {
  readonly code = input.required<string>();
  readonly title = input('snippet.ts');

  protected readonly html = computed(() => highlight(this.code().trim()));
  protected copied = false;

  protected copy(): void {
    navigator.clipboard.writeText(this.code().trim());
    this.copied = true;
    setTimeout(() => (this.copied = false), 1500);
  }
}
