import { Component, inject, signal } from '@angular/core';
import { Reservation, Page, SavedSearch } from '../../core/models/api.models';
import { errorMessage } from '../../core/interceptors/error.interceptor';
import { ApiService } from '../../core/services/api.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { RouterLink } from '@angular/router';
import { HotelReviewFormComponent } from '../../shared/components/hotel-review-form.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reservations',
  imports: [CommonModule, MoneyPipe, RouterLink, HotelReviewFormComponent, ModalComponent],
  template: `
    <header class="page-head">
      <h1>My reservations</h1>
      <p>Track your bookings and re-run your saved searches.</p>
    </header>
    @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
    @for (r of reservations()?.items ?? []; track r.id) {
      <article class="panel res">
        <div class="info">
          <h3>{{ r.room.hotel_name }} — {{ r.room.name }}</h3>
          <p class="meta">{{ r.confirmation_number }} · {{ r.check_in }} → {{ r.check_out }} ({{ r.nights }} nights)</p>
        </div>
        <div class="side">
          <span class="price">{{ r.total_amount | money }}</span>
          <span class="badge" [class]="'badge ' + r.status">{{ r.status }}</span>
          @if (r.status === 'pending' || r.status === 'confirmed') {
            <button type="button" class="outline" (click)="cancel(r)">Cancel</button>
          }
          @if (r.status === 'confirmed') {
            <button type="button" class="outline" (click)="openReviewModal(r)">Write Review</button>
          }
        </div>
      </article>
    } @empty {
      <p class="state panel">No reservations yet.</p>
    }
    @if (reservations(); as p) {
      <nav class="pager" aria-label="Reservations pagination">
        <button type="button" class="outline" [disabled]="p.page <= 1" (click)="load(p.page - 1)">Previous</button>
        <span>Page {{ p.page }} / {{ p.total_pages || 1 }}</span>
        <button type="button" class="outline" [disabled]="p.page >= p.total_pages" (click)="load(p.page + 1)">Next</button>
      </nav>
    }

    <h2 class="section">Saved searches</h2>
    @for (s of saved()?.items ?? []; track s.id) {
      <div class="panel saved">
        <span>Destination {{ s.destination_id ?? 'any' }} · {{ s.guests }} guest(s)</span>
        <span class="actions">
          <a class="btn" routerLink="/rooms" [queryParams]="runParams(s)">Run</a>
          <button type="button" class="outline" (click)="removeSaved(s)">Delete</button>
        </span>
      </div>
    } @empty {
      <p class="state panel">No saved searches.</p>
    }

    <!-- Review Modal -->
    <app-modal 
      [isOpen]="showReviewModal()" 
      [title]="'Write a Review'"
      (onClose)="closeReviewModal()"
    >
      @if (selectedReservation()) {
        <app-hotel-review-form 
          [hotelId]="selectedReservation()!.room.hotel_id"
          (onCancel)="closeReviewModal()"
        />
      }
    </app-modal>
  `,
  styles: `
    .res, .saved { display: flex; justify-content: space-between; align-items: center; gap: 1rem;
      flex-wrap: wrap; margin-bottom: .85rem; }
    h3 { margin: 0 0 .2rem; }
    .meta { margin: 0; color: var(--muted); font-size: .9rem; }
    .side, .actions { display: flex; align-items: center; gap: .75rem; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 1rem; margin: 1rem 0; color: var(--muted); }
    .section { margin: 2rem 0 .85rem; }
  `,
})
export class ReservationsComponent {
  private readonly api = inject(ApiService);
  protected readonly reservations = signal<Page<Reservation> | null>(null);
  protected readonly saved = signal<Page<SavedSearch> | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly showReviewModal = signal(false);
  protected readonly selectedReservation = signal<Reservation | null>(null);

  constructor() {
    this.load(1);
    this.api.savedSearches().subscribe((p) => this.saved.set(p));
  }

  protected load(page: number): void {
    this.api.myReservations(page).subscribe({
      next: (p) => this.reservations.set(p),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  protected cancel(r: Reservation): void {
    if (!confirm('Cancel this reservation?')) return;
    this.api.cancelReservation(r.id).subscribe({
      next: () => this.load(this.reservations()?.page ?? 1),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  protected openReviewModal(reservation: Reservation): void {
    this.selectedReservation.set(reservation);
    this.showReviewModal.set(true);
  }

  protected closeReviewModal(): void {
    this.showReviewModal.set(false);
    this.selectedReservation.set(null);
    this.load(this.reservations()?.page ?? 1);
  }

  protected runParams(s: SavedSearch): Record<string, string | number | string[] | null> {
    const f = s.filters as {
      min_price?: number | null;
      max_price?: number | null;
      amenities?: string[];
      sort_by?: string;
    };
    return {
      destination_id: s.destination_id,
      check_in: s.check_in,
      check_out: s.check_out,
      guests: s.guests,
      min_price: f.min_price ?? null,
      max_price: f.max_price ?? null,
      amenities: f.amenities?.length ? f.amenities : null,
      sort_by: f.sort_by ?? null,
    };
  }

  protected removeSaved(s: SavedSearch): void {
    this.api.deleteSavedSearch(s.id).subscribe(() =>
      this.api.savedSearches().subscribe((p) => this.saved.set(p)),
    );
  }
}
