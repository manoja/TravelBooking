import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { Room, RoomSearchFilters } from '../../core/models/api.models';
import { ApiService } from '../../core/services/api.service';
import { errorMessage } from '../../core/interceptors/error.interceptor';
import type { WorkerRequest, WorkerResponse } from './room-search.worker';

const PAGE_SIZE = 20;

export const DEFAULT_FILTERS: RoomSearchFilters = {
  destination_id: null,
  check_in: '',
  check_out: '',
  guests: 2,
  min_price: null,
  max_price: null,
  amenities: [],
  sort_by: 'price_asc',
};

@Injectable()
export class RoomSearchStore {
  private readonly api = inject(ApiService);

  // Search form + filter state
  readonly filters = signal<RoomSearchFilters>({ ...DEFAULT_FILTERS });
  readonly text = signal('');

  // Results state
  readonly rooms = signal<Room[]>([]);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly ranking = signal<Map<number, number> | null>(null);

  readonly validationError = computed(() => {
    const f = this.filters();
    if (f.check_in && f.check_out && f.check_out <= f.check_in) {
      return 'Check-out must be after check-in.';
    }
    if ((f.check_in && !f.check_out) || (!f.check_in && f.check_out)) {
      return 'Enter both check-in and check-out dates.';
    }
    if (f.min_price !== null && f.max_price !== null && f.min_price > f.max_price) {
      return 'Minimum price cannot exceed maximum price.';
    }
    if (f.guests < 1 || f.guests > 20) return 'Guests must be between 1 and 20.';
    return null;
  });

  readonly hasMore = computed(() => this.page() < this.totalPages());

  // Rooms shown to the user; the worker's ranking applies only while a text query is active.
  readonly visibleRooms = computed(() => {
    const ranking = this.ranking();
    const rooms = this.rooms();
    if (!this.text().trim() || !ranking) return rooms;
    return rooms
      .filter((r) => ranking.has(r.id))
      .sort((a, b) => (ranking.get(b.id) ?? 0) - (ranking.get(a.id) ?? 0));
  });

  private worker: Worker | null = null;
  private requestId = 0;

  constructor() {
    // switchMap cancels the in-flight HTTP request whenever filters or the page change.
    toObservable(
      computed(() => ({ filters: this.filters(), page: this.page(), err: this.validationError() })),
    )
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(({ filters, page, err }) => {
          if (err) {
            this.loading.set(false);
            return EMPTY;
          }
          return this.api.searchRooms(filters, page, PAGE_SIZE).pipe(
            tap((res) => {
              this.rooms.update((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
              this.total.set(res.total);
              this.totalPages.set(res.total_pages);
              this.loading.set(false);
            }),
            catchError((e) => {
              this.error.set(errorMessage(e));
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe();

    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./room-search.worker', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (data.requestId !== this.requestId) return;
        this.ranking.set(new Map(data.ranked.map((r) => [r.id, r.score])));
      };
    }

    effect(() => {
      const rooms = this.rooms();
      const text = this.text();
      const f = this.filters();
      if (!this.worker || !text.trim()) {
        this.ranking.set(null);
        return;
      }
      const msg: WorkerRequest = {
        requestId: ++this.requestId,
        rooms,
        text,
        wantedAmenities: f.amenities,
        guests: f.guests,
        maxPrice: f.max_price,
      };
      this.worker.postMessage(msg);
    });
  }

  update(patch: Partial<RoomSearchFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
    this.page.set(1);
  }

  reset(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.text.set('');
    this.page.set(1);
  }

  loadMore(): void {
    if (this.hasMore() && !this.loading()) this.page.update((p) => p + 1);
  }

  destroy(): void {
    this.worker?.terminate();
  }
}
