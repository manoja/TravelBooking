import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { HotelReviewWithSummary } from '../../core/models/api.models';

@Component({
  selector: 'app-hotel-review-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (reviewData(); as data) {
      <div class="review-summary-container">
        <h2 class="section-title">Guest Reviews</h2>

        <!-- Summary Stats -->
        <div class="summary-stats">
          <div class="rating-box">
            <div class="average-rating">
              <span class="rating-number">{{ data.summary.average_rating }}</span>
              <div class="stars">
                @for (i of [1, 2, 3, 4, 5]; track i) {
                  <span class="star" [class.filled]="i <= Math.round(data.summary.average_rating)">★</span>
                }
              </div>
              <p class="review-count">Based on {{ data.summary.total_reviews }} reviews</p>
            </div>
          </div>

          <!-- Category Ratings -->
          <div class="category-ratings">
            @if (data.summary.average_cleanliness !== null) {
              <div class="rating-item">
                <span class="label">Cleanliness</span>
                <span class="value">{{ data.summary.average_cleanliness }}</span>
              </div>
            }
            @if (data.summary.average_service !== null) {
              <div class="rating-item">
                <span class="label">Service</span>
                <span class="value">{{ data.summary.average_service }}</span>
              </div>
            }
            @if (data.summary.average_location !== null) {
              <div class="rating-item">
                <span class="label">Location</span>
                <span class="value">{{ data.summary.average_location }}</span>
              </div>
            }
            @if (data.summary.average_value !== null) {
              <div class="rating-item">
                <span class="label">Value</span>
                <span class="value">{{ data.summary.average_value }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Rating Distribution -->
        <div class="rating-distribution">
          @for (rating of [5, 4, 3, 2, 1]; track rating) {
            <div class="distribution-row">
              <span class="rating-label">{{ rating }} ★</span>
              <div class="bar-container">
                <div 
                  class="bar"
                  [style.width.%]="(data.summary.rating_distribution[rating] / data.summary.total_reviews * 100) || 0"
                ></div>
              </div>
              <span class="count">{{ data.summary.rating_distribution[rating] }}</span>
            </div>
          }
        </div>

        <!-- Individual Reviews -->
        <div class="reviews-section">
          <h3 class="subsection-title">Recent Reviews</h3>
          @if (data.reviews.length > 0) {
            <div class="reviews-list">
              @for (review of data.reviews; track review.id) {
                <div class="review-card">
                  <div class="review-header">
                    <div class="review-rating">
                      @for (i of [1, 2, 3, 4, 5]; track i) {
                        <span class="star" [class.filled]="i <= review.rating">★</span>
                      }
                    </div>
                    <span class="review-date">{{ review.created_at | date: 'MMM d, yyyy' }}</span>
                  </div>

                  @if (review.title) {
                    <h4 class="review-title">{{ review.title }}</h4>
                  }

                  @if (review.review_text) {
                    <p class="review-text">{{ review.review_text }}</p>
                  }

                  <!-- Category Ratings in Review -->
                  @if (review.cleanliness_rating || review.service_rating || review.location_rating || review.value_rating) {
                    <div class="review-details">
                      @if (review.cleanliness_rating) {
                        <span class="detail-badge">Cleanliness: {{ review.cleanliness_rating }}/5</span>
                      }
                      @if (review.service_rating) {
                        <span class="detail-badge">Service: {{ review.service_rating }}/5</span>
                      }
                      @if (review.location_rating) {
                        <span class="detail-badge">Location: {{ review.location_rating }}/5</span>
                      }
                      @if (review.value_rating) {
                        <span class="detail-badge">Value: {{ review.value_rating }}/5</span>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          } @else {
            <p class="no-reviews">No reviews yet. Be the first to review!</p>
          }
        </div>
      </div>
    } @else if (failed()) {
      <p class="error-state">Could not load reviews.</p>
    }
  `,
  styles: `
    .review-summary-container {
      margin-top: 3rem;
      padding: 1.5rem;
      background: var(--bg-secondary, #f9f9f9);
      border-radius: 12px;
    }

    .section-title {
      font-size: 1.5rem;
      margin: 0 0 1.5rem 0;
      font-weight: 600;
    }

    .summary-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2rem;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }
    }

    .rating-box {
      padding: 1.5rem;
      background: white;
      border-radius: 10px;
      border: 1px solid var(--border, #ddd);
    }

    .average-rating {
      text-align: center;
    }

    .rating-number {
      font-size: 3rem;
      font-weight: 700;
      color: var(--primary, #1e40af);
      display: block;
      margin-bottom: 0.5rem;
    }

    .stars {
      display: flex;
      justify-content: center;
      gap: 0.25rem;
      margin-bottom: 0.5rem;
    }

    .star {
      font-size: 1.5rem;
      color: #ddd;
      
      &.filled {
        color: var(--gold, #fbbf24);
      }
    }

    .review-count {
      color: var(--muted, #666);
      font-size: 0.9rem;
      margin: 0;
    }

    .category-ratings {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.5rem;
      background: white;
      border-radius: 10px;
      border: 1px solid var(--border, #ddd);
    }

    .rating-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border, #eee);

      &:last-child {
        border-bottom: none;
      }
    }

    .label {
      font-weight: 500;
      color: var(--text, #333);
    }

    .value {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--primary, #1e40af);
    }

    .rating-distribution {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: white;
      border-radius: 10px;
      border: 1px solid var(--border, #ddd);
    }

    .distribution-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .rating-label {
      min-width: 50px;
      font-weight: 500;
      text-align: right;
    }

    .bar-container {
      flex: 1;
      height: 8px;
      background: #eee;
      border-radius: 4px;
      overflow: hidden;
    }

    .bar {
      height: 100%;
      background: var(--gold, #fbbf24);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .count {
      min-width: 50px;
      text-align: right;
      color: var(--muted, #666);
    }

    .reviews-section {
      margin-top: 2rem;
    }

    .subsection-title {
      font-size: 1.2rem;
      margin: 0 0 1rem 0;
      font-weight: 600;
    }

    .reviews-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .review-card {
      padding: 1.5rem;
      background: white;
      border: 1px solid var(--border, #ddd);
      border-radius: 10px;
    }

    .review-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;

      @media (max-width: 640px) {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }

    .review-rating {
      display: flex;
      gap: 0.25rem;
    }

    .review-date {
      color: var(--muted, #666);
      font-size: 0.9rem;
    }

    .review-title {
      margin: 0 0 0.75rem 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text, #333);
    }

    .review-text {
      color: var(--text, #333);
      margin: 0 0 1rem 0;
      line-height: 1.5;
    }

    .review-details {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .detail-badge {
      background: var(--bg-tertiary, #f0f0f0);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      color: var(--text, #333);
    }

    .no-reviews {
      text-align: center;
      color: var(--muted, #666);
      padding: 2rem 1rem;
    }

    .error-state {
      color: var(--error, #dc2626);
      padding: 1rem;
      text-align: center;
    }
  `
})
export class HotelReviewSummaryComponent {
  readonly hotelId = input.required<number>();

  private readonly api = inject(ApiService);
  protected readonly failed = signal(false);
  protected readonly Math = Math;

  protected readonly reviewData = toSignal(
    toObservable(this.hotelId).pipe(
      switchMap((id) =>
        this.api.getHotelReviews(id, 10, 0).pipe(
          catchError(() => {
            this.failed.set(true);
            return of(null);
          }),
        ),
      ),
    ),
  );
}
