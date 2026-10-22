export type Tone = 'success' | 'warn' | 'danger' | 'neutral';

const TONES: Record<string, Tone> = {
  confirmed: 'success',
  succeeded: 'success',
  pending: 'warn',
  cancelled: 'danger',
  expired: 'neutral',
  refunded: 'neutral',
};

export function statusTone(status: string): Tone {
  return TONES[status] ?? 'neutral';
}
