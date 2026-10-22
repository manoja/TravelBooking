import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { Reservation } from '../../core/models/api.models';
import { errorMessage } from '../../core/interceptors/error.interceptor';
import { ApiService } from '../../core/services/api.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, MoneyPipe],
  template: `
    <header class="page-head">
      <a href="javascript:history.back()" class="back-link">← Back</a>
      <h1>Confirm and Pay</h1>
    </header>

    @if (reservation(); as res) {
      <section class="payment-container">
        <div class="payment-left">
          <section class="panel block">
            <h2>Your trip</h2>
            <div class="trip-details">
              <div class="detail-group">
                <label>Dates</label>
                <p>{{ formatDate(res.check_in) }} - {{ formatDate(res.check_out) }}</p>
                <a href="javascript:void(0)" class="edit-link">✎</a>
              </div>
              <div class="detail-group">
                <label>Guests</label>
                <p>{{ res.guests }} guest{{ res.guests !== 1 ? 's' : '' }}</p>
                <a href="javascript:void(0)" class="edit-link">✎</a>
              </div>
            </div>
          </section>

          <section class="panel block">
            <h2>Pay with</h2>
            <div class="payment-methods">
              <button
                type="button"
                [class.active]="selectedMethod() === 'card'"
                (click)="selectedMethod.set('card')"
                class="method-btn"
              >
                Credit Card
              </button>
              <button
                type="button"
                [class.active]="selectedMethod() === 'paypal'"
                (click)="selectedMethod.set('paypal')"
                class="method-btn"
              >
                PayPal
              </button>
              <button
                type="button"
                [class.active]="selectedMethod() === 'google'"
                (click)="selectedMethod.set('google')"
                class="method-btn"
              >
                Google Pay
              </button>
            </div>

            @if (selectedMethod() === 'card') {
              <div class="card-form">
                <input
                  type="text"
                  placeholder="Card number"
                  class="full-width"
                  [(ngModel)]="cardNumber"
                />
                <input
                  type="text"
                  placeholder="Card holder"
                  class="full-width"
                  [(ngModel)]="cardHolder"
                />
                <div class="card-row">
                  <input
                    type="text"
                    placeholder="Expiration date"
                    [(ngModel)]="expiryDate"
                  />
                  <input
                    type="text"
                    placeholder="CVV"
                    [(ngModel)]="cvv"
                  />
                </div>
                <label class="checkbox">
                  <input type="checkbox" [(ngModel)]="saveCard" />
                  Save my card for future reservation
                </label>
              </div>
            }
          </section>

          <p class="disclaimer">
            By selecting the button below, I agree to the
            <a href="#" target="_blank">Property Rules</a>,
            <a href="#" target="_blank">Terms and Conditions</a>,
            <a href="#" target="_blank">Privacy Policy</a>
            and <a href="#" target="_blank">COVID-19 Safety Requirements</a>.
          </p>

          <button
            type="button"
            (click)="processPayment()"
            [disabled]="busy()"
            class="primary-btn"
          >
            {{ busy() ? 'Processing...' : 'Confirm and pay' }}
          </button>

          @if (error()) {
            <p class="alert" role="alert">{{ error() }}</p>
          }
        </div>

        <div class="payment-right">
          <section class="panel block">
            <h3>{{ res.room.hotel_name }}</h3>
            <p class="room-name">{{ res.room.name }}</p>
            
            <div class="room-image">
              <div class="placeholder-image">🏨</div>
            </div>

            <div class="room-info">
              <p class="destination">
                Hotel room in {{ res.room.destination_name }}
              </p>
              <p class="rating">★ 4.84 (125 reviews)</p>
            </div>
          </section>

          <section class="panel block">
            <h3>Price details</h3>
            <div class="price-row">
              <span>{{ res.nights }} night{{ res.nights !== 1 ? 's' : '' }} × Rate</span>
              <span>{{ res.total_amount | money }}</span>
            </div>
            <div class="price-row">
              <span>Service fee</span>
              <span class="fee">$12</span>
            </div>
            <hr />
            <div class="price-row total">
              <span>Total (USD)</span>
              <span>{{ res.total_amount | money }}</span>
            </div>
            <p class="cancellation">
              Free cancellation until 3:00 PM on July 15, 2022.
              <a href="#">More info</a>
            </p>
          </section>
        </div>
      </section>
    } @else {
      <p class="state">Loading…</p>
    }
  `,
  styles: `
    .back-link {
      display: inline-block;
      margin-bottom: 1rem;
      color: var(--brand);
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }

    .payment-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2rem;

      @media (max-width: 1024px) {
        grid-template-columns: 1fr;
      }
    }

    .payment-left,
    .payment-right {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .block {
      margin-bottom: 0;
    }

    .block h2,
    .block h3 {
      margin-top: 0;
    }

    .trip-details {
      display: grid;
      gap: 1rem;
    }

    .detail-group {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border);

      label {
        font-weight: 600;
        font-size: 0.85rem;
        color: var(--muted);
      }

      p {
        margin: 0;
        font-weight: 500;
      }

      .edit-link {
        color: var(--brand);
        text-decoration: none;
        font-weight: 600;
        cursor: pointer;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .payment-methods {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .method-btn {
      padding: 0.75rem;
      border: 2px solid var(--border);
      background: #fff;
      color: var(--text);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: var(--brand);
        background: #f9fafb;
      }

      &.active {
        border-color: var(--brand);
        background: #eff4ff;
        color: var(--brand);
        font-weight: 600;
      }
    }

    .card-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;

      input.full-width {
        width: 100%;
      }

      .card-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;

        input {
          width: 100%;
        }
      }

      .checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 400;
        cursor: pointer;

        input {
          width: auto;
          cursor: pointer;
        }
      }
    }

    .disclaimer {
      font-size: 0.85rem;
      color: var(--muted);
      line-height: 1.6;

      a {
        color: var(--brand);
      }
    }

    .primary-btn {
      width: 100%;
      padding: 0.75rem;
      font-size: 1rem;
      font-weight: 600;
    }

    .room-image {
      width: 100%;
      height: 200px;
      background: #f0f0f0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 1rem 0;
    }

    .placeholder-image {
      font-size: 4rem;
    }

    .room-name {
      font-weight: 600;
      color: var(--navy);
      margin: 0.5rem 0;
    }

    .room-info {
      margin-top: 1rem;

      .destination {
        margin: 0.5rem 0;
        font-size: 0.9rem;
        color: var(--muted);
      }

      .rating {
        margin: 0.5rem 0;
        font-size: 0.9rem;
        color: var(--muted);
      }
    }

    .price-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      font-size: 0.95rem;

      &.total {
        font-weight: 700;
        font-size: 1rem;
        color: var(--navy);
        padding-top: 1rem;
      }

      .fee {
        color: var(--muted);
      }
    }

    hr {
      margin: 1rem 0;
      border: none;
      border-top: 1px solid var(--border);
    }

    .cancellation {
      font-size: 0.85rem;
      color: var(--muted);
      margin: 1rem 0 0;

      a {
        color: var(--brand);
      }
    }
  `,
})
export class PaymentComponent {
  readonly reservationId = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly reservation = toSignal(
    toObservable(this.reservationId).pipe(
      switchMap((id) => this.api.reservation(Number(id)).pipe(catchError(() => of(null)))),
    ),
  );

  protected readonly selectedMethod = signal<'card' | 'paypal' | 'google'>('card');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected cardNumber = '';
  protected cardHolder = '';
  protected expiryDate = '';
  protected cvv = '';
  protected saveCard = false;

  protected formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  protected processPayment(): void {
    const res = this.reservation();
    if (!res) return;

    if (this.selectedMethod() === 'card' && (!this.cardNumber || !this.cardHolder)) {
      this.error.set('Please fill in all card details.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    this.api.payDummy(res.id, 'success').subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/payment-success', res.id]);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.busy.set(false);
      },
    });
  }
}
