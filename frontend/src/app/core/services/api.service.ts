import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Dashboard,
  Destination,
  HotelReviewCreate,
  HotelReviewWithSummary,
  MyHotelReview,
  Page,
  Payment,
  Reservation,
  Room,
  RoomSearchFilters,
  SavedSearch,
  UserProfile,
} from '../models/api.models';

type Query = Record<string, string | number | boolean | null | undefined | string[]>;
export type AdminResource = 'destinations' | 'hotels' | 'rooms';

function toParams(query: Query): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    params = params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;
  // Public destination data changes rarely, so it is cached; availability is never cached.
  private readonly destinationCache = new Map<string, Observable<Page<Destination>>>();

  me(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.base}/auth/me`);
  }

  destinations(page = 1, pageSize = 50, q = ''): Observable<Page<Destination>> {
    const key = `${page}|${pageSize}|${q}`;
    let cached = this.destinationCache.get(key);
    if (!cached) {
      cached = this.http
        .get<Page<Destination>>(`${this.base}/destinations`, {
          params: toParams({ page, page_size: pageSize, q }),
        })
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.destinationCache.set(key, cached);
    }
    return cached;
  }

  clearDestinationCache(): void {
    this.destinationCache.clear();
  }

  searchRooms(filters: RoomSearchFilters, page: number, pageSize: number): Observable<Page<Room>> {
    return this.http.get<Page<Room>>(`${this.base}/rooms/search`, {
      params: toParams({ ...filters, page, page_size: pageSize }),
    });
  }

  room(id: number): Observable<Room> {
    return this.http.get<Room>(`${this.base}/rooms/${id}`);
  }

  createReservation(body: {
    room_id: number;
    check_in: string;
    check_out: string;
    guests: number;
  }): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.base}/reservations`, body);
  }

  myReservations(page = 1, pageSize = 20): Observable<Page<Reservation>> {
    return this.http.get<Page<Reservation>>(`${this.base}/reservations/me`, {
      params: toParams({ page, page_size: pageSize }),
    });
  }

  reservation(id: number): Observable<Reservation> {
    return this.http.get<Reservation>(`${this.base}/reservations/${id}`);
  }

  cancelReservation(id: number): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.base}/reservations/${id}/cancel`, {});
  }

  payDummy(reservationId: number, outcome: 'success' | 'failure'): Observable<Payment> {
    return this.http.post<Payment>(
      `${this.base}/payments/dummy`,
      { reservation_id: reservationId, outcome },
      { headers: { 'Idempotency-Key': crypto.randomUUID().replace(/-/g, '') } },
    );
  }

  savedSearches(): Observable<Page<SavedSearch>> {
    return this.http.get<Page<SavedSearch>>(`${this.base}/saved-searches`);
  }

  saveSearch(filters: RoomSearchFilters): Observable<SavedSearch> {
    return this.http.post<SavedSearch>(`${this.base}/saved-searches`, {
      destination_id: filters.destination_id,
      check_in: filters.check_in || null,
      check_out: filters.check_out || null,
      guests: filters.guests,
      filters: {
        min_price: filters.min_price,
        max_price: filters.max_price,
        amenities: filters.amenities,
        sort_by: filters.sort_by,
      },
    });
  }

  deleteSavedSearch(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/saved-searches/${id}`);
  }

  runSavedSearch(id: number): Observable<Page<Room>> {
    return this.http.post<Page<Room>>(`${this.base}/saved-searches/${id}/run`, {});
  }

  adminList<T>(
    resource: AdminResource,
    options: { page?: number; pageSize?: number; q?: string; parentId?: number | null } = {},
  ): Observable<Page<T>> {
    const parentKey = resource === 'hotels' ? 'destination_id' : 'hotel_id';
    return this.http.get<Page<T>>(`${this.base}/admin/${resource}`, {
      params: toParams({
        page: options.page ?? 1,
        page_size: options.pageSize ?? 20,
        // The rooms endpoint has no text search, so q is only sent for destinations and hotels.
        q: resource === 'rooms' ? null : options.q,
        [parentKey]: resource === 'destinations' ? null : options.parentId,
      }),
    });
  }

  adminReservations(page = 1, status = ''): Observable<Page<Reservation>> {
    return this.http.get<Page<Reservation>>(`${this.base}/admin/reservations`, {
      params: toParams({ page, page_size: 20, status }),
    });
  }

  adminCreate<T>(resource: AdminResource, body: object): Observable<T> {
    return this.http
      .post<T>(`${this.base}/admin/${resource}`, body)
      .pipe(tap(() => this.clearDestinationCache()));
  }

  adminUpdate<T>(resource: AdminResource, id: number, body: object): Observable<T> {
    return this.http
      .patch<T>(`${this.base}/admin/${resource}/${id}`, body)
      .pipe(tap(() => this.clearDestinationCache()));
  }

  adminDelete(resource: AdminResource, id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/admin/${resource}/${id}`)
      .pipe(tap(() => this.clearDestinationCache()));
  }

  adminDashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.base}/admin/dashboard`);
  }

  // Hotel Reviews
  createHotelReview(hotelId: number, review: HotelReviewCreate): Observable<MyHotelReview> {
    return this.http.post<MyHotelReview>(`${this.base}/hotels/${hotelId}/reviews`, review);
  }

  getHotelReviews(
    hotelId: number,
    limit: number = 10,
    offset: number = 0,
  ): Observable<HotelReviewWithSummary> {
    return this.http.get<HotelReviewWithSummary>(`${this.base}/hotels/${hotelId}/reviews`, {
      params: toParams({ limit, offset }),
    });
  }

  getHotelReviewsSummary(hotelId: number): Observable<any> {
    return this.http.get<any>(`${this.base}/hotels/${hotelId}/reviews/summary`);
  }

  getMyHotelReview(hotelId: number): Observable<MyHotelReview | null> {
    return this.http.get<MyHotelReview | null>(`${this.base}/hotels/${hotelId}/my-review`);
  }

  updateMyHotelReview(reviewId: number, review: HotelReviewCreate): Observable<MyHotelReview> {
    return this.http.put<MyHotelReview>(`${this.base}/hotels/reviews/${reviewId}`, review);
  }

  deleteMyHotelReview(reviewId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/hotels/reviews/${reviewId}`);
  }
}
