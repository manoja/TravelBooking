import { Component, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { Reservation } from '../../core/models/api.models';
import { ApiService } from '../../core/services/api.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [CommonModule, MoneyPipe, RouterLink],
  template: `
    @if (reservation(); as res) {
      <section class="success-container">
        <div class="success-header">
          <div class="luggage-icon">🧳</div>
          <h1>All done, you're going to {{ res.room.destination_name }}!</h1>
        </div>

        <section class="panel details-panel">
          <div class="details-grid">
            <div class="detail-item">
              <div class="detail-icon">📅</div>
              <div class="detail-content">
                <p class="label">Dates</p>
                <p class="value">{{ formatDate(res.check_in) }} - {{ formatDate(res.check_out) }}</p>
              </div>
            </div>

            <div class="detail-item">
              <div class="detail-icon">📍</div>
              <div class="detail-content">
                <p class="label">Location</p>
                <p class="value">{{ res.room.hotel_name }}, {{ res.room.destination_name }}</p>
              </div>
            </div>

            <div class="detail-item">
              <div class="detail-icon">🔑</div>
              <div class="detail-content">
                <p class="label">Check-in</p>
                <p class="value">After 2PM</p>
              </div>
            </div>

            <div class="detail-item">
              <div class="detail-icon">🚪</div>
              <div class="detail-content">
                <p class="label">Check-out</p>
                <p class="value">11AM</p>
              </div>
            </div>
          </div>
        </section>

        <div class="booking-info-container">
          <div class="booking-left">
            <section class="panel">
              <h3>Booking Details</h3>
              <div class="info-row">
                <span class="label">Amount paid (USD)</span>
                <span class="value">{{ res.total_amount | money }}</span>
              </div>
              <div class="info-row">
                <span class="label">Reservation code</span>
                <span class="value code">{{ res.confirmation_number }}</span>
              </div>
              <div class="info-row">
                <span class="label">Room Type</span>
                <span class="value">{{ res.room.name }}</span>
              </div>
              <div class="info-row">
                <span class="label">Guests</span>
                <span class="value">{{ res.guests }} guest{{ res.guests !== 1 ? 's' : '' }}</span>
              </div>
              <div class="info-row">
                <span class="label">Status</span>
                <span class="value badge" [class]="'badge ' + res.status">{{ res.status }}</span>
              </div>
            </section>
          </div>

          <div class="booking-right">
            <section class="panel">
              <h3>{{ res.room.hotel_name }}</h3>
              
              <div class="room-image">
                <div class="placeholder-image">🏨</div>
              </div>

              <div class="room-details">
                <p class="room-name">{{ res.room.name }}</p>
                <p class="room-location">
                  Hotel room in {{ res.room.destination_name }}
                </p>
                <p class="room-rating">★ 4.84 (125 reviews)</p>
              </div>
            </section>
          </div>
        </div>

        <section class="panel next-steps">
          <h3>Next Steps</h3>
          <ul>
            <li>A confirmation email has been sent to your registered email address.</li>
            <li>Keep your reservation code handy for check-in.</li>
            <li>For any changes, contact the hotel directly or manage your booking in your account.</li>
            <li>You can cancel free of charge until {{ getCancellationDate(res.check_in) }}.</li>
          </ul>
        </section>

        <div class="action-buttons">
          <a routerLink="/reservations" class="btn primary">View my reservations</a>
          <a routerLink="/destinations" class="btn secondary">Continue browsing</a>
        </div>
      </section>
    } @else {
      <p class="state">Loading…</p>
    }
  `,
  styles: `
    .success-container {
      max-width: 1000px;
      margin: 0 auto;
    }

    .success-header {
      text-align: center;
      margin-bottom: 2rem;

      .luggage-icon {
        font-size: 5rem;
        margin-bottom: 1rem;
        animation: float 3s ease-in-out infinite;
      }

      h1 {
        font-size: 2.2rem;
        color: var(--navy);
        margin: 0;
      }
    }

    @keyframes float {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-10px);
      }
    }

    .details-panel {
      margin-bottom: 2rem;
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }

    .detail-item {
      display: flex;
      gap: 1rem;

      .detail-icon {
        font-size: 2rem;
        flex-shrink: 0;
      }

      .detail-content {
        flex: 1;

        .label {
          margin: 0;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .value {
          margin: 0.3rem 0 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--navy);
        }
      }
    }

    .booking-info-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2rem;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .booking-left,
    .booking-right {
      .panel {
        height: 100%;
      }
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border);

      &:last-child {
        border-bottom: none;
      }

      .label {
        color: var(--muted);
        font-size: 0.9rem;
      }

      .value {
        font-weight: 600;
        color: var(--navy);

        &.code {
          font-family: 'Courier New', monospace;
          background: #f5f5f5;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        &.badge {
          display: inline-block;
          padding: 0.3rem 0.75rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: capitalize;
          background: #ecfdf3;
          color: var(--success);

          &.confirmed,
          &.completed,
          &.paid {
            background: #ecfdf3;
            color: var(--success);
          }

          &.pending {
            background: #fff6e0;
            color: #8a6a12;
          }
        }
      }
    }

    .room-image {
      width: 100%;
      height: 180px;
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

    .room-details {
      margin-top: 1rem;

      .room-name {
        margin: 0;
        font-weight: 600;
        color: var(--navy);
        font-size: 1rem;
      }

      .room-location {
        margin: 0.5rem 0 0;
        font-size: 0.9rem;
        color: var(--muted);
      }

      .room-rating {
        margin: 0.5rem 0 0;
        font-size: 0.9rem;
        color: var(--muted);
      }
    }

    .next-steps {
      margin-bottom: 2rem;

      h3 {
        margin-top: 0;
      }

      ul {
        margin: 1rem 0;
        padding-left: 1.5rem;
        line-height: 1.8;

        li {
          margin-bottom: 0.75rem;
          color: var(--text);
        }
      }
    }

    .action-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 2rem;

      @media (max-width: 640px) {
        flex-direction: column;
      }
    }

    .btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 1rem;
      transition: all 0.2s;

      &.primary {
        background: var(--brand);
        color: #fff;

        &:hover {
          background: var(--brand-dark);
        }
      }

      &.secondary {
        background: #f0f0f0;
        color: var(--brand);
        border: 1px solid var(--border);

        &:hover {
          background: #f9fafb;
          border-color: var(--brand);
        }
      }
    }

    .state {
      text-align: center;
      color: var(--muted);
      padding: 2.5rem 1rem;
    }
  `,
})
export class PaymentSuccessComponent {
  readonly reservationId = input.required<string>();

  private readonly api = inject(ApiService);

  protected readonly reservation = toSignal(
    toObservable(this.reservationId).pipe(
      switchMap((id) => this.api.reservation(Number(id)).pipe(catchError(() => of(null)))),
    ),
  );

  protected formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  protected getCancellationDate(checkInDate: string): string {
    const date = new Date(checkInDate);
    // Subtract 1 day from check-in date for cancellation deadline
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
