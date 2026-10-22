import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ImageComponent } from '../../shared/components/image.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

@Component({
  selector: 'app-room-details',
  imports: [RouterLink, ImageComponent, MoneyPipe],
  template: `
    @if (room(); as r) {
      <header class="page-head">
        <h1>{{ r.name }}</h1>
        <p>{{ r.hotel.name }} · {{ r.destination.name }} · {{ r.hotel.address }}</p>
      </header>
      <div class="layout">
        <div class="panel media">
          <app-image [src]="selectedImage() ?? r.images[0]?.image_url" [alt]="r.name" [width]="800"
            [height]="480" [priority]="true" />
        </div>
        <aside class="panel summary">
          <p class="price big">{{ r.price_per_night | money }} <small>per night</small></p>
          <p class="meta">Sleeps {{ r.capacity }}</p>
          <p class="chips">
            @for (a of r.amenities; track a) { <span class="badge">{{ a }}</span> }
          </p>
          <a class="btn" [routerLink]="['/checkout', r.id]"
            [queryParams]="{ check_in: checkIn(), check_out: checkOut(), guests: guests() }">
            Book this room
          </a>
        </aside>
      </div>

      <!-- Non-critical content is deferred until it scrolls into view. -->
      @defer (on viewport) {
        <h2 class="section">Gallery</h2>
        <div class="gallery">
          @for (img of r.images; track img.id) {
            <button type="button" (click)="selectedImage.set(img.image_url)">
              <app-image [src]="img.image_url" [alt]="r.name" [width]="160" [height]="100" />
            </button>
          } @empty {
            <p class="meta">No additional photos.</p>
          }
        </div>
      } @placeholder {
        <div style="min-height: 140px">Gallery</div>
      } @loading {
        <p class="state">Loading gallery…</p>
      }
    } @else if (failed()) {
      <p class="state panel">Room not found.</p>
    } @else {
      <p class="state">Loading…</p>
    }
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr); gap: 1.25rem; align-items: start; }
    @media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
    .media { padding: .5rem; }
    .media ::ng-deep img { width: 100%; height: auto; border-radius: 10px; display: block; }
    .summary { display: flex; flex-direction: column; gap: .75rem; }
    .summary p { margin: 0; }
    .big { font-size: 1.6rem; }
    .meta { color: var(--muted); }
    .chips { display: flex; flex-wrap: wrap; gap: .4rem; }
    .section { margin: 2rem 0 .85rem; }
    .gallery { display: flex; flex-wrap: wrap; gap: .6rem; }
    .gallery button { border: 1px solid var(--border); border-radius: 10px; padding: 0; background: none; cursor: pointer; overflow: hidden; }
    .gallery button:hover:not(:disabled) { background: none; border-color: var(--gold); }
    .gallery ::ng-deep img { display: block; }
  `,
})
export class RoomDetailsComponent {
  // Bound from the route (:id) and query string via withComponentInputBinding.
  readonly id = input.required<string>();
  readonly check_in = input<string>();
  readonly check_out = input<string>();
  readonly guestsParam = input<string>(undefined, { alias: 'guests' });

  private readonly api = inject(ApiService);
  protected readonly selectedImage = signal<string | null>(null);
  protected readonly failed = signal(false);

  protected readonly room = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        this.api.room(Number(id)).pipe(
          catchError(() => {
            this.failed.set(true);
            return of(null);
          }),
        ),
      ),
    ),
  );

  protected readonly checkIn = computed(() => this.check_in() ?? '');
  protected readonly checkOut = computed(() => this.check_out() ?? '');
  protected readonly guests = computed(() => this.guestsParam() ?? '2');
}
