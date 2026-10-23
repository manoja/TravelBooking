export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface Destination {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_visible: boolean;
}

export interface Hotel {
  id: number;
  destination_id: number;
  name: string;
  address: string | null;
  description: string | null;
  is_visible: boolean;
}

export interface RoomImage {
  id: number;
  image_url: string;
  sort_order: number;
}

export interface Room {
  id: number;
  hotel_id: number;
  name: string;
  capacity: number;
  price_per_night: string;
  amenities: string[];
  is_active: boolean;
  images: RoomImage[];
  hotel: { id: number; name: string; address: string | null };
  destination: { id: number; name: string; slug: string };
}

export type SortBy = 'price_asc' | 'price_desc' | 'capacity_desc';

export interface RoomSearchFilters {
  destination_id: number | null;
  check_in: string;
  check_out: string;
  guests: number;
  min_price: number | null;
  max_price: number | null;
  amenities: string[];
  sort_by: SortBy;
}

export interface ReservationRoom {
  id: number;
  name: string;
  hotel_id: number;
  hotel_name: string;
  destination_name: string;
}

export interface Reservation {
  id: number;
  confirmation_number: string;
  room_id: number;
  room: ReservationRoom;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  total_amount: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | string;
  expires_at: string | null;
}

export interface Payment {
  id: number;
  reservation_id: number;
  amount: string;
  status: string;
  transaction_reference: string;
  reservation_status: string | null;
  notice: string;
}

export interface SavedSearch {
  id: number;
  destination_id: number | null;
  check_in: string | null;
  check_out: string | null;
  guests: number;
  filters: Record<string, unknown>;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin' | string;
}

export interface Dashboard {
  reservations_by_status: Record<string, number>;
  revenue: string;
  refunded_total: string;
  destinations_total: number;
  hotels_total: number;
  rooms_total: number;
  rooms_active: number;
  revenue_definition: string;
}

// Hotel Reviews
export interface HotelReviewCreate {
  rating: number;
  title?: string;
  review_text?: string;
  cleanliness_rating?: number;
  service_rating?: number;
  location_rating?: number;
  value_rating?: number;
}

export interface HotelReview {
  id: number;
  user_id: string;
  rating: number;
  title: string | null;
  review_text: string | null;
  cleanliness_rating: number | null;
  service_rating: number | null;
  location_rating: number | null;
  value_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface MyHotelReview extends HotelReview {
  reservation_id: number | null;
  status: 'pending' | 'published' | 'rejected';
}

export interface HotelReviewSummary {
  total_reviews: number;
  average_rating: number;
  average_cleanliness: number | null;
  average_service: number | null;
  average_location: number | null;
  average_value: number | null;
  rating_distribution: Record<number, number>;
}

export interface HotelReviewWithSummary {
  summary: HotelReviewSummary;
  reviews: HotelReview[];
}

