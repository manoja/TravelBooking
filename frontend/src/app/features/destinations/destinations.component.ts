import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ImageComponent } from '../../shared/components/image.component';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-destinations',
  imports: [RouterLink, ImageComponent],
  template: `
    <header class="page-head">
      <h1>Destinations</h1>
      <p>Pick a destination to see the rooms available there.</p>
    </header>
    @if (data(); as d) {
      <div class="grid">
        @for (dest of d.items; track dest.id; let i = $index) {
          <a class="card hover-lift" routerLink="/rooms" [queryParams]="{ destination_id: dest.id }">
            <app-image [src]="dest.image_url" [alt]="dest.name" [width]="320" [height]="200"
              [priority]="i === 0" />
            <div class="body">
              <h3>{{ dest.name }}</h3>
              <p>{{ dest.description }}</p>
              <span class="cta">View rooms →</span>
            </div>
          </a>
        } @empty {
          <p class="state panel">No destinations available.</p>
        }
      </div>
    } @else {
      <p class="state">Loading…</p>
    }
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.25rem; }
    .card { display: flex; flex-direction: column; text-decoration: none; color: inherit; background: #fff;
      border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
      box-shadow: 0 1px 2px rgba(23, 44, 53, .04); }
    .card ::ng-deep img { width: 100%; height: 190px; object-fit: cover; display: block; }
    .body { padding: 1rem 1.1rem 1.2rem; }
    h3 { margin: 0 0 .3rem; }
    p { margin: 0 0 .75rem; color: var(--muted); font-size: .9rem; }
    .cta { color: var(--brand); font-weight: 600; font-size: .9rem; }
  `,
})
export class DestinationsComponent {
  protected readonly data = toSignal(inject(ApiService).destinations());
}
