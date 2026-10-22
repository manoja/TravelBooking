/// <reference lib="webworker" />
// Client-side refinement of an already server-filtered page of rooms: free-text match and
// relevance ranking. Availability/price filtering is authoritative on the server, not here.
import type { Room } from '../../core/models/api.models';

export interface WorkerRequest {
  requestId: number;
  rooms: Room[];
  text: string;
  wantedAmenities: string[];
  guests: number;
  maxPrice: number | null;
}

export interface WorkerResponse {
  requestId: number;
  ranked: { id: number; score: number }[];
}

addEventListener('message', ({ data }: MessageEvent<WorkerRequest>) => {
  const terms = data.text.toLowerCase().split(/\s+/).filter(Boolean);
  const wanted = new Set(data.wantedAmenities.map((a) => a.toLowerCase()));
  const ranked: WorkerResponse['ranked'] = [];

  for (const room of data.rooms) {
    const haystack = `${room.name} ${room.hotel.name} ${room.hotel.address ?? ''} ${room.destination.name} ${room.amenities.join(' ')}`.toLowerCase();
    if (terms.some((t) => !haystack.includes(t))) continue;

    const price = Number(room.price_per_night);
    let score = 0;
    for (const t of terms) score += room.name.toLowerCase().includes(t) ? 3 : 1;
    const have = new Set(room.amenities.map((a) => a.toLowerCase()));
    for (const a of wanted) if (have.has(a)) score += 2;
    // Prefer rooms that fit the party without much wasted capacity.
    score -= Math.max(0, room.capacity - data.guests) * 0.5;
    if (data.maxPrice) score += Math.max(0, 1 - price / data.maxPrice);
    ranked.push({ id: room.id, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  postMessage({ requestId: data.requestId, ranked } satisfies WorkerResponse);
});
