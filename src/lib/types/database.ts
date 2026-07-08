export type UserRole = "super_admin" | "community_owner" | "member";
export type MembershipStatus = "active" | "pending" | "cancelled" | "expired";
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "trialing";
export type EventType = "meeting" | "deadline" | "announcement" | "other";
export type MeetingStatus = "scheduled" | "live" | "ended";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  accent_color: string;
  owner_id: string;
  is_active: boolean;
  stripe_price_id: string | null;
  monthly_price_cents: number;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  community_id: string;
  role: UserRole;
  status: MembershipStatus;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  community?: Community;
  profile?: Profile;
}

export interface Invite {
  id: string;
  community_id: string;
  token: string;
  created_by: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  community?: Community | null;
}

export interface ForumThread {
  id: string;
  community_id: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_featured: boolean;
  reply_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_id: string;
  content: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface Course {
  id: string;
  community_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_provider: string;
  video_id: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookPage {
  pageNumber: number;
  content: string;
}

export interface BookTOCItem {
  title: string;
  pageNumber: number;
}

export interface Book {
  id: string;
  community_id: string;
  title: string;
  author: string | null;
  description: string | null;
  cover_url: string | null;
  pdf_storage_path: string | null;
  content_json: BookPage[] | null;
  total_pages: number;
  table_of_contents: BookTOCItem[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
  reading_progress?: ReadingProgress;
}

export interface ReadingProgress {
  id: string;
  user_id: string;
  book_id: string;
  current_page: number;
  progress_percent: number;
  updated_at: string;
}

export interface ReadingBookmark {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number;
  label: string | null;
  created_at: string;
}

export interface Meeting {
  id: string;
  community_id: string;
  host_id: string;
  title: string;
  description: string | null;
  livekit_room: string;
  active_book_id: string | null;
  status: MeetingStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  host?: Profile;
  active_book?: Book;
}

export interface MeetingChatMessage {
  id: string;
  meeting_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Pick<Profile, "id" | "full_name">;
}

export interface CalendarEvent {
  id: string;
  community_id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string | null;
  meeting_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ReaderSettings {
  fontSize: number;
  fontFamily: "serif" | "sans";
  theme: "light" | "sepia";
}
