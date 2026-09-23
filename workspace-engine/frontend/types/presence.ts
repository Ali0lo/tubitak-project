export interface UserPresence {
  clientId: number | string;
  userId: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: {
    blockId: string;
    offset: number;
  } | null;
  lastActive: number;
}
