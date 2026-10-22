import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { Reservation } from '../../core/models/api.models';
import { errorMessage } from '../../core/interceptors/error.interceptor';
import { ApiService } from '../../core/services/api.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, MoneyPipe, RouterLink],
  template: `
    <header class="page-head">
      <h1>Checkout</h1>
      <p>Review your stay and complete the reservation.</p>
    </header>
    @if (room(); as r) {
      <section class="panel block">
        <h2>{{ r.name }} — {{ r.hotel.name }}</h2>
        <div class="row">
          <label class="field">Check-in <input type="date" [ngModel]="checkIn()" (ngModelChange)="checkIn.set($event)" /></label>
          <label class="field">Check-out <input type="date" [ngModel]="checkOut()" (ngModelChange)="checkOut.set($event)" /></label>
          <label class="field">Guests <input type="number" min="1" [max]="r.capacity" [ngModel]="guests()"
            (ngModelChange)="guests.set($event)" /></label>
        </div>

        <!-- Estimate only; the server computes the authoritative total including taxes and fees. -->
        <p class="estimate">Estimate: {{ nights() }} night(s) × {{ r.price_per_night | money }} =
          <strong>{{ estimate() | money }}</strong> <span class="note">(taxes/fees added by the server)</span></p>
        @if (validation(); as v) { <p class="alert" role="alert">{{ v }}</p> }
      </section>

      @if (!reservation()) {
        <button type="button" (click)="reserve()" [disabled]="!!validation() || busy()">
          Reserve room
        </button>
      } @else {
        <section class="panel block">
          <h3>Reservation {{ reservation()!.confirmation_number }}</h3>
          <p>Status: <span class="badge" [class]="'badge ' + reservation()!.status">{{ reservation()!.status }}</span>
            · Total <strong>{{ reservation()!.total_amount | money }}</strong></p>
          @if (reservation()!.status === 'pending') {
            <p class="note"><em>Development-only dummy payment. No real charge is made.</em></p>
            <a class="btn" [routerLink]="['/payment', reservation()!.id]">Proceed to payment</a>
          } @else {
            <a class="btn" routerLink="/reservations">View my reservations</a>
          }
        </section>
      }
      @if (message()) { <p class="alert ok">{{ message() }}</p> }
      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }
    } @else {
      <p class="state">Loading…</p>
    }
  `,
  styles: `
    .block { margin-bottom: 1rem; }
    .block h2, .block h3 { margin-top: 0; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem; }
    .estimate { margin: 1rem 0 0; }
    .note { color: var(--muted); font-size: .85rem; }
    button { margin-right: .5rem; }
  `,
})
export class CheckoutComponent {
  readonly id = input.required<string>();
  readonly check_in = input<string>('');
  readonly check_out = input<string>('');
  readonly guestsParam = input<string>('2', { alias: 'guests' });

  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly room = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => this.api.room(Number(id)).pipe(catchError(() => of(null)))),
    ),
  );

  protected readonly checkIn = signal('');
  protected readonly checkOut = signal('');
  protected readonly guests = signal(2);
  protected readonly reservation = signal<Reservation | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  protected readonly nights = computed(() => {
    const ms = Date.parse(this.checkOut()) - Date.parse(this.checkIn());
    return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 86_400_000) : 0;
  });
  protected readonly estimate = computed(() => this.nights() * Number(this.room()?.price_per_night ?? 0));
  protected readonly validation = computed(() => {
    if (!this.checkIn() || !this.checkOut()) return 'Choose your dates.';
    if (this.nights() < 1) return 'Check-out must be after check-in.';
    const cap = this.room()?.capacity ?? 0;
    if (this.guests() < 1 || this.guests() > cap) return `Guests must be between 1 and ${cap}.`;
    return null;
  });

  constructor() {
    queueMicrotask(() => {
      this.checkIn.set(this.check_in());
      this.checkOut.set(this.check_out());
      this.guests.set(Number(this.guestsParam()) || 2);
    });
  }

  protected reserve(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api
      .createReservation({
        room_id: Number(this.id()),
        check_in: this.checkIn(),
        check_out: this.checkOut(),
        guests: this.guests(),
      })
      .subscribe({
        next: (r) => {
          this.reservation.set(r);
          this.busy.set(false);
        },
        error: (e) => {
          this.error.set(errorMessage(e));
          this.busy.set(false);
        },
      });
  }

}
