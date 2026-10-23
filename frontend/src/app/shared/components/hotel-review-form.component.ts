import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { HotelReviewCreate } from '../../core/models/api.models';

@Component({
  selector: 'app-hotel-review-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submitReview()">
      <h3>{{ isEditing() ? 'Edit Your Review' : 'Share Your Experience' }}</h3>

      <!-- Overall Rating -->
      <div class="form-group">
        <label>Rating</label>
        <div class="rating-input">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <button
              type="button"
              class="star-btn"
              [class.active]="form.get('rating')?.value >= i"
              (click)="setRating(i)"
              [attr.title]="i + ' star' + (i !== 1 ? 's' : '')"
            >
              ★
            </button>
          }
        </div>
        @if (form.get('rating')?.errors?.['required'] && form.get('rating')?.touched) {
          <span class="error">Rating is required</span>
        }
      </div>

      <!-- Title -->
      <div class="form-group">
        <label for="title">Review Title (optional)</label>
        <input
          id="title"
          type="text"
          formControlName="title"
          placeholder="e.g., Great location, outstanding service"
          maxlength="150"
        />
        <div class="char-count">{{ titleLength() }}/150</div>
        @if (form.get('title')?.errors?.['maxlength']) {
          <span class="error">Title must be 150 characters or less</span>
        }
      </div>

      <!-- Review Text -->
      <div class="form-group">
        <label for="review_text">Your Review (optional)</label>
        <textarea
          id="review_text"
          formControlName="review_text"
          rows="4"
          placeholder="Tell us about your stay. What did you like? What could be improved?"
          maxlength="5000"
        ></textarea>
        <div class="char-count">{{ reviewTextLength() }}/5000</div>
        @if (form.get('review_text')?.errors?.['maxlength']) {
          <span class="error">Review must be 5000 characters or less</span>
        }
      </div>

      <!-- Category Ratings Section -->
      <div class="categories-section">
        <h4>Rate specific aspects (optional)</h4>

        <div class="category-group">
          <label>Cleanliness</label>
          <div class="rating-stars">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <button
                type="button"
                class="star-btn small"
                [class.active]="form.get('cleanliness_rating')?.value >= i"
                (click)="setRating(i, 'cleanliness_rating')"
              >
                ★
              </button>
            }
          </div>
        </div>

        <div class="category-group">
          <label>Service</label>
          <div class="rating-stars">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <button
                type="button"
                class="star-btn small"
                [class.active]="form.get('service_rating')?.value >= i"
                (click)="setRating(i, 'service_rating')"
              >
                ★
              </button>
            }
          </div>
        </div>

        <div class="category-group">
          <label>Location</label>
          <div class="rating-stars">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <button
                type="button"
                class="star-btn small"
                [class.active]="form.get('location_rating')?.value >= i"
                (click)="setRating(i, 'location_rating')"
              >
                ★
              </button>
            }
          </div>
        </div>

        <div class="category-group">
          <label>Value for Money</label>
          <div class="rating-stars">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <button
                type="button"
                class="star-btn small"
                [class.active]="form.get('value_rating')?.value >= i"
                (click)="setRating(i, 'value_rating')"
              >
                ★
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Submit Button -->
      <div class="form-actions">
        <button
          type="submit"
          class="btn btn-primary"
          [disabled]="!form.valid || isLoading()"
        >
          {{ isLoading() ? 'Submitting...' : (isEditing() ? 'Update Review' : 'Submit Review') }}
        </button>
        <button type="button" class="btn btn-secondary" (click)="cancel()" [disabled]="isLoading()">
          Cancel
        </button>
      </div>

      @if (error()) {
        <div class="error-message">{{ error() }}</div>
      }
    </form>
  `,
  styles: `
    form {
      max-width: 600px;
      margin: 0;
    }

    h3 {
      margin: 0 0 1.5rem 0;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: var(--text, #333);
    }

    input[type="text"],
    textarea {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--border, #ddd);
      border-radius: 6px;
      font-family: inherit;
      font-size: 1rem;
      color: var(--text, #333);
      transition: border-color 0.2s;

      &:focus {
        outline: none;
        border-color: var(--primary, #1e40af);
        box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
      }

      &:disabled {
        background: var(--bg-tertiary, #f0f0f0);
        cursor: not-allowed;
      }
    }

    textarea {
      resize: vertical;
    }

    .char-count {
      font-size: 0.85rem;
      color: var(--muted, #999);
      margin-top: 0.25rem;
    }

    .rating-input {
      display: flex;
      gap: 0.5rem;
    }

    .star-btn {
      background: none;
      border: none;
      font-size: 2rem;
      color: var(--border, #ddd);
      cursor: pointer;
      padding: 0;
      transition: color 0.2s;

      &:hover,
      &.active {
        color: var(--gold, #fbbf24);
      }

      &.small {
        font-size: 1.5rem;
      }
    }

    .categories-section {
      background: var(--bg-secondary, #f9f9f9);
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    .categories-section h4 {
      margin: 0 0 1rem 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text, #333);
    }

    .category-group {
      margin-bottom: 1.25rem;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .category-group label {
      display: inline-block;
      margin: 0;
      margin-right: 1rem;
      font-size: 0.95rem;
    }

    .rating-stars {
      display: flex;
      gap: 0.25rem;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 1rem;

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-primary {
      background: var(--primary, #1e40af);
      color: white;

      &:hover:not(:disabled) {
        background: var(--primary-dark, #1e3a8a);
      }
    }

    .btn-secondary {
      background: var(--bg-secondary, #f0f0f0);
      color: var(--text, #333);

      &:hover:not(:disabled) {
        background: var(--border, #ddd);
      }
    }

    .error {
      display: block;
      color: var(--error, #dc2626);
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }

    .error-message {
      padding: 1rem;
      background: #fee;
      color: var(--error, #dc2626);
      border: 1px solid #fcc;
      border-radius: 6px;
      margin-top: 1rem;
    }
  `,
})
export class HotelReviewFormComponent {
  readonly hotelId = input.required<number>();
  readonly initialData = input<any>(null);
  readonly isEditing = input(false);
  readonly onCancel = output<void>();

  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly isLoading = signal(false);
  protected readonly error = signal('');

  protected form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      rating: [null, Validators.required],
      title: ['', [Validators.maxLength(150)]],
      review_text: ['', [Validators.maxLength(5000)]],
      cleanliness_rating: [null],
      service_rating: [null],
      location_rating: [null],
      value_rating: [null],
    });

    if (this.initialData()) {
      this.form.patchValue(this.initialData());
    }
  }

  protected titleLength(): number {
    return (this.form.get('title')?.value || '').length;
  }

  protected reviewTextLength(): number {
    return (this.form.get('review_text')?.value || '').length;
  }

  protected setRating(value: number, field: string = 'rating'): void {
    const current = this.form.get(field)?.value;
    // Toggle off if clicking the same rating
    this.form.get(field)?.setValue(current === value ? null : value);
  }

  protected submitReview(): void {
    if (!this.form.valid) {
      this.error.set('Please fill in the required fields');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    const reviewData: HotelReviewCreate = {
      rating: this.form.get('rating')?.value,
      title: this.form.get('title')?.value || undefined,
      review_text: this.form.get('review_text')?.value || undefined,
      cleanliness_rating: this.form.get('cleanliness_rating')?.value,
      service_rating: this.form.get('service_rating')?.value,
      location_rating: this.form.get('location_rating')?.value,
      value_rating: this.form.get('value_rating')?.value,
    };

    const request$ = this.isEditing()
      ? this.api.updateMyHotelReview(this.initialData().id, reviewData)
      : this.api.createHotelReview(this.hotelId(), reviewData);

    request$.subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.form.reset();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.detail || 'Failed to submit review. Please try again.');
      },
    });
  }

  protected cancel(): void {
    this.onCancel.emit();
  }
}
