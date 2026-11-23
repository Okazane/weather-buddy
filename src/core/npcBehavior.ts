export type NpcActionId =
  | 'reading_book'
  | 'petting_cat'
  | 'petting_puppy'
  | 'scrolling_phone'
  | 'listening_music';

export const ALL_NPC_ACTIONS: NpcActionId[] = [
  'reading_book',
  'petting_cat',
  'petting_puppy',
  'scrolling_phone',
  'listening_music',
];

export const NPC_ROTATION_INTERVAL_MS = 5 * 60 * 1000;

export const NPC_STAND_DURATION_MS = 8500;

export const NPC_ACTION_META: Record<
  NpcActionId,
  { id: NpcActionId; labelVi: string }
> = {
  reading_book: { id: 'reading_book', labelVi: 'Đọc sách' },
  petting_cat: { id: 'petting_cat', labelVi: 'Chơi với mèo' },
  petting_puppy: { id: 'petting_puppy', labelVi: 'Chơi với cún' },
  scrolling_phone: { id: 'scrolling_phone', labelVi: 'Xem điện thoại' },
  listening_music: { id: 'listening_music', labelVi: 'Nghe nhạc' },
};

export function pickNextRandomNpcAction(
  current?: NpcActionId | null,
  rng: () => number = Math.random
): NpcActionId {
  const candidates =
    current && ALL_NPC_ACTIONS.includes(current)
      ? ALL_NPC_ACTIONS.filter((action) => action !== current)
      : ALL_NPC_ACTIONS;

  const raw = rng();
  const clamped = Number.isFinite(raw)
    ? Math.min(0.999999999, Math.max(0, raw))
    : 0;
  const idx = Math.floor(clamped * candidates.length);
  return candidates[idx] ?? ALL_NPC_ACTIONS[0];
}
