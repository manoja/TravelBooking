import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';

// Fixed width/height prevent layout shift; NgOptimizedImage lazy-loads below-the-fold images.
@Component({
  selector: 'app-image',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src(); as s) {
      @if (!failed()) {
      <img
        [ngSrc]="s"
        [width]="width()"
        [height]="height()"
        [alt]="alt()"
        [priority]="priority()"
        [style.object-fit]="'cover'"
        (error)="failed.set(true)"
      />
      } @else {
        <div class="ph" [style.width.px]="width()" [style.height.px]="height()">Image unavailable</div>
      }
    } @else {
      <div class="ph" [style.width.px]="width()" [style.height.px]="height()">No image</div>
    }
  `,
  styles: `
    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      display: block;
    }
    .ph {
      max-width: 100%;
      display: grid;
      place-items: center;
      background: #e8edf3;
      color: #667;
      border-radius: 6px;
    }
  `,
})
export class ImageComponent {
  readonly failed = signal(false);

  constructor() {
    effect(() => {
      this.src();
      this.failed.set(false);
    });
  }
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  readonly width = input(320);
  readonly height = input(200);
  readonly priority = input(false);
}
