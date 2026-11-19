export type GuestCategory =
  | 'famille_marie'
  | 'famille_mariee'
  | 'amis_marie'
  | 'amis_mariee'
  | 'collegues'
  | 'autres';

export type InvitationStatus = 'pending' | 'sent';

export type RsvpStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'to_relaunch';

export type AlbumCategory =
  | 'preparatifs'
  | 'ceremonie'
  | 'maries'
  | 'famille'
  | 'cocktail'
  | 'reception'
  | 'diner'
  | 'soiree';

export interface WeddingSettings {
  id: string;
  bride_first_name: string;
  groom_first_name: string;
  wedding_date: string | null;
  venue_name: string;
  venue_address: string;
  venue_maps_url: string;
  venue_description: string;
  love_quote: string;
  invitation_message: string;
  dress_code: string;
  dress_code_colors: string[];
  gift_message: string;
  rsvp_deadline: string | null;
  sms_verification_enabled: boolean;
  gallery_enabled: boolean;
  gallery_private_link_token: string | null;
  couple_photo_url: string;
  venue_photo_url: string;
  conclusion_photo_url: string;
}

export interface Guest {
  id: string;
  last_name: string;
  first_name: string;
  phone: string;
  phone_raw: string | null;
  category: GuestCategory;
  allowed_persons: number;
  invitation_status: InvitationStatus;
  created_at: string;
  updated_at: string;
}

export interface Rsvp {
  id: string;
  guest_id: string;
  status: RsvpStatus;
  attending: boolean | null;
  number_of_participants: number;
  companions_names: string[];
  requested_song: string | null;
  message_to_couple: string | null;
  confirmed_at: string | null;
  updated_at: string;
  phone_verified: boolean;
}

export interface Ticket {
  id: string;
  guest_id: string;
  rsvp_id: string | null;
  ticket_number: string;
  qr_token: string;
  qr_version?: 2;
  bride_first_name: string;
  groom_first_name: string;
  wedding_date: string | null;
  venue_name: string;
  guest_full_name: string;
  guest_first_name?: string;
  guest_last_name?: string;
  allowed_persons: number;
  pdf_url: string | null;
  png_url: string | null;
  created_at: string;
}

export interface TicketScan {
  id: string;
  ticket_id: string;
  scanned_at: string;
  scanned_by: string | null;
  notes: string | null;
}

export interface PhotoAlbum {
  id: string;
  title: string;
  category: AlbumCategory;
  description: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  album_id: string;
  storage_path: string;
  thumbnail_url: string;
  full_url: string;
  caption: string;
  display_order: number;
  created_at: string;
}

export interface RsvpLookupResult {
  guest_id: string;
  first_name: string;
  last_name: string;
  allowed_persons: number;
  rsvp_id: string | null;
  status: RsvpStatus | null;
  attending: boolean | null;
  number_of_participants: number | null;
  companions_names: string[] | null;
  requested_song: string | null;
  message_to_couple: string | null;
}

export interface WeddingStats {
  total_guests: number;
  invitations_sent: number;
  confirmed: number;
  declined: number;
  pending: number;
  total_expected_participants: number;
  companions: number;
}

export const CATEGORY_LABELS: Record<GuestCategory, string> = {
  famille_marie: "Famille du marié",
  famille_mariee: "Famille de la mariée",
  amis_marie: "Amis du marié",
  amis_mariee: "Amis de la mariée",
  collegues: 'Collègues',
  autres: 'Autres invités',
};

export const ALBUM_CATEGORY_LABELS: Record<AlbumCategory, string> = {
  preparatifs: 'Préparatifs',
  ceremonie: 'Cérémonie',
  maries: 'Photos des mariés',
  famille: 'Photos de famille',
  cocktail: 'Cocktail',
  reception: 'Réception',
  diner: 'Dîner',
  soiree: 'Soirée dansante',
};

