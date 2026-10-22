import { ScrollingModule } from '@angular/cdk/scrolling';
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SavedSearch, SortBy } from '../../core/models/api.models';
import { ApiService } from '../../core/services/api.service';
import { errorMessage } from '../../core/interceptors/error.interceptor';
import { ImageComponent } from '../../shared/components/image.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { RoomSearchStore } from './room-search.store';

const AMENITIES = ['wifi', 'pool', 'parking', 'breakfast', 'gym', 'spa'];

@Component({
  selector: 'app-room-search',
  imports: [FormsModule, RouterLink, ScrollingModule, ImageComponent, MoneyPipe],
  providers: [RoomSearchStore],
  template: `
    <header class="page-head">
      <h1>Find a room</h1>
      <p>Filter by destination, dates, guests and price.</p>
    </header>
    <form class="filters panel" (submit)="$event.preventDefault()">
      <label>Destination
        <select [ngModel]="s.filters().destination_id" name="dest"
          (ngModelChange)="s.update({ destination_id: $event })">
          <option [ngValue]="null">Any</option>
          @for (d of destinations()?.items ?? []; track d.id) {
            <option [ngValue]="d.id">{{ d.name }}</option>
          }
        </select>
      </label>
      <label>Check-in
        <input type="date" name="ci" [ngModel]="s.filters().check_in"
          (ngModelChange)="s.update({ check_in: $event })" />
      </label>
      <label>Check-out
        <input type="date" name="co" [ngModel]="s.filters().check_out"
          (ngModelChange)="s.update({ check_out: $event })" />
      </label>
      <label>Guests
        <input type="number" min="1" max="20" name="g" [ngModel]="s.filters().guests"
          (ngModelChange)="s.update({ guests: $event })" />
      </label>
      <label>Min price
        <input type="text" inputmode="decimal" autocomplete="off" placeholder="e.g. 50" name="min" [ngModel]="s.filters().min_price"
          (ngModelChange)="s.update({ min_price: toPrice($event) })" />
      </label>
      <label>Max price
        <input type="text" inputmode="decimal" autocomplete="off" placeholder="e.g. 300" name="max" [ngModel]="s.filters().max_price"
          (ngModelChange)="s.update({ max_price: toPrice($event) })" />
      </label>
      <label>Sort
        <select name="sort" [ngModel]="s.filters().sort_by"
          (ngModelChange)="s.update({ sort_by: $event })">
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="capacity_desc">Capacity</option>
        </select>
      </label>
      <label>Refine results
        <input type="search" name="text" placeholder="e.g. sea view suite" [ngModel]="s.text()"
          (ngModelChange)="s.text.set($event)" />
      </label>
      <fieldset>
        <legend>Amenities</legend>
        @for (a of amenityOptions; track a) {
          <label class="chk">
            <input type="checkbox" [checked]="s.filters().amenities.includes(a)"
              (change)="toggleAmenity(a)" /> {{ a }}
          </label>
        }
      </fieldset>
    </form>

    @if (s.validationError(); as v) { <p class="alert" role="alert">{{ v }}</p> }
    @if (s.error(); as e) { <p class="alert" role="alert">{{ e }}</p> }

    <div class="bar panel">
      <strong class="count">{{ s.total() }} rooms found</strong>
      <button type="button" class="outline" (click)="clearFilters()">Clear filters</button>
      @if (auth.isAuthenticated()) {
        <button type="button" (click)="save()" [disabled]="!!s.validationError()">Save search</button>
        {{ saveMsg() }}
        <label>Saved searches
          <select #sel (change)="applySaved(sel.value)">
            <option value="">Load a saved search…</option>
            @for (x of saved(); track x.id) {
              <option [value]="x.id">
                {{ x.check_in || 'any date' }} → {{ x.check_out || 'any date' }} · {{ x.guests }} guest(s)
              </option>
            }
          </select>
        </label>
      }
    </div>

    <cdk-virtual-scroll-viewport itemSize="136" class="viewport"
      (scrolledIndexChange)="onScroll($event)">
      <a *cdkVirtualFor="let r of s.visibleRooms(); trackBy: trackId" class="card hover-lift"
        [routerLink]="['/rooms', r.id]" [queryParams]="params()">
        <app-image [src]="r.images[0]?.image_url" [alt]="r.name" [width]="160" [height]="120" />
        <div>
          <h3>{{ r.name }}</h3>
          <p class="sub">{{ r.hotel.name }} · {{ r.destination.name }}</p>
          <p class="sub">Sleeps {{ r.capacity }} · {{ r.amenities.join(', ') }}</p>
        </div>
        <strong class="price">{{ r.price_per_night | money }}<small>/night</small></strong>
      </a>
    </cdk-virtual-scroll-viewport>
    @if (s.loading()) { <p class="state">Loading…</p> }
    @if (!s.loading() && s.visibleRooms().length === 0 && !s.validationError()) {
      <p class="state panel">No rooms match your search.</p>
    }
  `,
  styles: `
    .filters { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: .85rem; margin-bottom: 1rem; }
    .filters label { display: flex; flex-direction: column; font-size: .8rem; font-weight: 600; color: var(--navy); gap: .3rem; }
    .filters label input, .filters label select { font-weight: 400; border-color: var(--border); min-height: 2.4rem; }
    .chk { flex-direction: row !important; display: inline-flex !important; margin-right: .75rem; font-weight: 400 !important; text-transform: capitalize; align-items: center; }
    fieldset { grid-column: 1 / -1; border: 1px solid var(--border); border-radius: 10px; }
    legend { font-size: .8rem; font-weight: 600; color: var(--navy); padding: 0 .4rem; }
    .viewport { height: 560px; background: #fff; border: 1px solid var(--border); border-radius: 14px; }
    .card { display: grid; grid-template-columns: 170px 1fr auto; gap: 1rem; align-items: center;
      height: 136px; padding: 8px 16px 8px 8px; box-sizing: border-box; text-decoration: none; color: inherit;
      border-bottom: 1px solid var(--border); }
    .card ::ng-deep img { border-radius: 10px; object-fit: cover; }
    h3, p { margin: .15rem 0; }
    .sub { color: var(--muted); font-size: .88rem; }
    .price { font-size: 1.15rem; }
    .bar { display: flex; flex-wrap: wrap; gap: .75rem 1rem; align-items: center; margin: 0 0 1rem; padding: .75rem 1.25rem; }
    .bar label { display: flex; flex-direction: row; align-items: center; gap: .5rem; font-size: .85rem; font-weight: 600; color: var(--navy); }
    .count { color: var(--navy); }
  `,
})
export class RoomSearchComponent implements OnInit, OnDestroy {
  protected readonly s = inject(RoomSearchStore);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly destinations = toSignal(this.api.destinations());
  protected readonly amenityOptions = AMENITIES;
  protected readonly saveMsg = signal('');
  protected readonly saved = signal<SavedSearch[]>([]);

  // Price boxes are plain text; blank or non-numeric input means "no limit".
  protected toPrice(value: string | number | null): number | null {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const dest = q.get('destination_id');
    this.s.update({
      destination_id: dest ? Number(dest) : null,
      check_in: q.get('check_in') ?? '',
      check_out: q.get('check_out') ?? '',
      guests: q.get('guests') ? Number(q.get('guests')) : 2,
      min_price: q.get('min_price') ? Number(q.get('min_price')) : null,
      max_price: q.get('max_price') ? Number(q.get('max_price')) : null,
      amenities: q.getAll('amenities'),
      sort_by: (q.get('sort_by') as SortBy) ?? 'price_asc',
    });
  }

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) this.loadSaved();
    });
  }

  protected loadSaved(): void {
    this.api.savedSearches().subscribe((p) => this.saved.set(p.items));
  }

  protected applySaved(id: string): void {
    const item = this.saved().find((x) => x.id === Number(id));
    if (!item) return;
    const f = item.filters as {
      min_price?: number | null;
      max_price?: number | null;
      amenities?: string[];
      sort_by?: SortBy;
    };
    this.s.update({
      destination_id: item.destination_id,
      check_in: item.check_in ?? '',
      check_out: item.check_out ?? '',
      guests: item.guests,
      min_price: f.min_price ?? null,
      max_price: f.max_price ?? null,
      amenities: f.amenities ?? [],
      sort_by: f.sort_by ?? 'price_asc',
    });
  }

  ngOnDestroy(): void {
    this.s.destroy();
  }

  protected trackId = (_: number, r: { id: number }) => r.id;

  protected params() {
    const f = this.s.filters();
    return { check_in: f.check_in || null, check_out: f.check_out || null, guests: f.guests };
  }

  protected toggleAmenity(a: string): void {
    const cur = this.s.filters().amenities;
    this.s.update({ amenities: cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a] });
  }

  protected onScroll(index: number): void {
    if (index + 8 >= this.s.rooms().length) this.s.loadMore();
  }

  protected clearFilters(): void {
    this.s.reset();
    this.saveMsg.set('');
    void this.router.navigate([], { queryParams: {} });
  }

  protected save(): void {
    this.api.saveSearch(this.s.filters()).subscribe({
      next: () => {
        this.saveMsg.set('Saved.');
        this.loadSaved();
      },
      error: (e) => this.saveMsg.set(errorMessage(e)),
    });
  }
}
