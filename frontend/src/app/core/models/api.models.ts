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
