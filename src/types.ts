import type { Enums, Tables } from "./db/database.types";

// =============================================================================
// BASE DATABASE TYPES (aliases for readability)
// =============================================================================

type AcceptanceMetricsRow = Tables<"acceptance_metrics">;
type FlashcardRow = Tables<"flashcards">;
type GenerationSessionRow = Tables<"ai_generation_sessions">;
type ProfileRow = Tables<"profiles">;
type SRSReviewRow = Tables<"srs_reviews">;
type SRSStateRow = Tables<"srs_state">;
type TagRow = Tables<"tags">;

// =============================================================================
// SHARED TYPES
// =============================================================================

/**
 * Pagination information for list responses.
 */
export interface PaginationDTO {
  next_cursor: string | null;
  has_more: boolean;
}

/**
 * Standard error response format.
 */
export interface ErrorDTO {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Validation error details.
 */
export interface ValidationErrorDetailsDTO {
  field: string;
  [key: string]: unknown;
}

// =============================================================================
// TAG TYPES
// =============================================================================

/**
 * Tag list item (minimal representation).
 */
export type TagListItemDTO = Pick<TagRow, "id" | "name">;

/**
 * Full tag DTO with usage count (usage is derived from flashcard_tags + flashcards).
 */
export type TagDTO = Pick<TagRow, "id" | "name" | "created_at" | "updated_at"> & {
  usage_count: number;
};

/**
 * Tag with recent flashcards (for single tag view).
 */
export interface TagWithRecentFlashcardsDTO extends TagDTO {
  recent_flashcards: Pick<FlashcardRow, "id" | "question">[];
}

/**
 * Tags list response.
 */
export interface TagsListDTO {
  data: TagDTO[];
  total_count: number;
}

/**
 * Create tag command.
 */
export interface CreateTagCommand {
  name: string;
}

/**
 * Update tag command.
 */
export interface UpdateTagCommand {
  name: string;
}

// =============================================================================
// SRS TYPES
// =============================================================================

/**
 * Full SRS state for a flashcard.
 */
export type SRSStateDTO = SRSStateRow;

/**
 * Summary SRS state (for list views).
 */
export type SRSStateSummaryDTO = Pick<SRSStateDTO, "due_at" | "interval_days" | "repetitions">;

/**
 * Detailed SRS state (for single flashcard view).
 */
export type SRSStateDetailsDTO = Pick<
  SRSStateDTO,
  "due_at" | "interval_days" | "ease_factor" | "repetitions" | "lapses" | "last_reviewed_at"
>;

/**
 * Flashcard due for review (includes full content for study session).
 */
export interface DueFlashcardDTO extends Pick<FlashcardRow, "id" | "question" | "answer"> {
  tags: TagListItemDTO[];
  srs_state: SRSStateSummaryDTO;
}

/**
 * Due flashcards response.
 */
export interface DueFlashcardsResponse {
  data: DueFlashcardDTO[];
  session_info: {
    total_due: number;
    returned: number;
    remaining: number;
  };
}

/**
 * Submit review command.
 */
export interface SubmitReviewCommand {
  flashcard_id: FlashcardRow["id"];
  grade: 1 | 2 | 3 | 4;
  reviewed_at?: string;
}

/**
 * Submit review response.
 */
export interface SubmitReviewResponse {
  review_id: SRSReviewRow["id"];
  flashcard_id: FlashcardRow["id"];
  grade: SRSReviewRow["grade"];
  reviewed_at: SRSReviewRow["reviewed_at"];
  srs_state: Pick<SRSStateDTO, "due_at" | "interval_days" | "ease_factor" | "repetitions" | "lapses">;
  next_review_in_days: number;
}

/**
 * SRS statistics (aggregated from flashcards, srs_state, and srs_reviews).
 */
export interface SRSStatsDTO {
  summary: {
    total_active_cards: number;
    cards_due_today: number;
    cards_reviewed_today: number;
    cards_reviewed_period: number;
  };
  grade_distribution: {
    "1": number;
    "2": number;
    "3": number;
    "4": number;
  };
  streak: {
    current_days: number;
    longest_days: number;
  };
  upcoming_reviews: {
    date: string;
    count: number;
  }[];
}

// =============================================================================
// FLASHCARD TYPES
// =============================================================================

type FlashcardCoreDTO = Pick<
  FlashcardRow,
  | "id"
  | "question"
  | "answer"
  | "status"
  | "source"
  | "generation_session_id"
  | "first_activated_at"
  | "created_at"
  | "updated_at"
>;

/**
 * Full flashcard DTO with relations.
 */
export interface FlashcardDTO extends FlashcardCoreDTO {
  counted_in_metrics: FlashcardRow["counted_in_metrics"];
  tags: TagListItemDTO[];
  srs_state: SRSStateDetailsDTO | null;
}

/**
 * Flashcard list item (for list views).
 */
export interface FlashcardListItemDTO extends FlashcardCoreDTO {
  tags: TagListItemDTO[];
  srs_state: SRSStateSummaryDTO | null;
}

/**
 * Paginated flashcards response.
 */
export interface PaginatedFlashcardsDTO {
  data: FlashcardListItemDTO[];
  pagination: PaginationDTO;
  total_count?: number;
}

/**
 * Create manual flashcard command (single card).
 */
export interface CreateManualFlashcardCommand {
  question: string;
  answer: string;
  tag_ids?: TagRow["id"][];
  auto_activate?: boolean;
}

/**
 * Create manual flashcards command (batch).
 */
export interface CreateManualFlashcardsCommand {
  flashcards: CreateManualFlashcardCommand[];
}

/**
 * Created flashcard response item.
 */
export interface CreatedFlashcardDTO
  extends Pick<
    FlashcardRow,
    "id" | "question" | "answer" | "status" | "source" | "generation_session_id" | "created_at" | "updated_at"
  > {
  tags: TagListItemDTO[];
  srs_state: Pick<SRSStateDTO, "due_at" | "interval_days" | "ease_factor" | "repetitions" | "lapses"> | null;
}

/**
 * Failed flashcard creation item.
 */
export interface FailedFlashcardCreationDTO {
  index: number;
  question: string;
  error: string;
  message: string;
}

/**
 * Create manual flashcards response.
 */
export interface CreateManualFlashcardsResponse {
  created: CreatedFlashcardDTO[];
  failed: FailedFlashcardCreationDTO[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

/**
 * Update flashcard command.
 */
export interface UpdateFlashcardCommand {
  question?: string;
  answer?: string;
  tag_ids?: TagRow["id"][];
}

/**
 * Update flashcard response.
 */
export interface UpdateFlashcardResponse {
  id: FlashcardRow["id"];
  question: FlashcardRow["question"];
  answer: FlashcardRow["answer"];
  status: Enums<"flashcard_status">;
  source: Enums<"flashcard_source">;
  updated_at: FlashcardRow["updated_at"];
  tags: TagListItemDTO[];
}

/**
 * Activate flashcard command.
 */
export interface ActivateFlashcardCommand {
  initial_due_at?: string;
}

/**
 * Activate flashcard response.
 */
export interface ActivateFlashcardResponse {
  id: FlashcardRow["id"];
  status: "active";
  first_activated_at: NonNullable<FlashcardRow["first_activated_at"]>;
  srs_state: Pick<SRSStateDTO, "due_at" | "interval_days" | "ease_factor" | "repetitions" | "lapses">;
}

/**
 * Reject flashcard response.
 */
export interface RejectFlashcardResponse {
  id: FlashcardRow["id"];
  status: "rejected";
  updated_at: FlashcardRow["updated_at"];
}

/**
 * Bulk activate command.
 */
export interface BulkActivateCommand {
  flashcard_ids: FlashcardRow["id"][];
  initial_due_at?: string;
}

/**
 * Bulk activate response.
 */
export interface BulkActivateResponse {
  activated: {
    id: FlashcardRow["id"];
    status: "active";
  }[];
  failed: {
    id: FlashcardRow["id"];
    error: string;
  }[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

/**
 * Bulk reject command.
 */
export interface BulkRejectCommand {
  flashcard_ids: FlashcardRow["id"][];
}

/**
 * Bulk reject response.
 */
export interface BulkRejectResponse {
  rejected: {
    id: FlashcardRow["id"];
    status: "rejected";
  }[];
  failed: {
    id: FlashcardRow["id"];
    error: string;
  }[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

// =============================================================================
// AI GENERATION TYPES
// =============================================================================

/**
 * Generate flashcards command.
 */
export interface GenerateFlashcardsCommand {
  source_text: GenerationSessionRow["source_text"];
  requested_card_count?: GenerationSessionRow["requested_card_count"];
  acknowledged_data_warning: boolean;
}

/**
 * Generated flashcard DTO (draft with suggested tags).
 */
export type GeneratedFlashcardDTO = Pick<
  FlashcardRow,
  "id" | "question" | "answer" | "status" | "source" | "generation_session_id" | "created_at"
> & {
  // Suggested tags are derived from AI output, not stored on flashcards.
  suggested_tags: string[];
  status: "draft";
  source: "generated";
};

/**
 * Daily limit information.
 */
export interface DailyLimitDTO {
  used: number;
  total: number;
  remaining: number;
}

/**
 * Generation session DTO (full, including flashcards).
 */
export interface GenerationSessionDTO
  extends Pick<
    GenerationSessionRow,
    | "id"
    | "status"
    | "source_text"
    | "source_text_chars"
    | "requested_card_count"
    | "generated_card_count"
    | "error_message"
    | "created_at"
    | "updated_at"
    | "completed_at"
  > {
  flashcards: Pick<FlashcardRow, "id" | "question" | "answer" | "status" | "created_at">[];
}

/**
 * Generate flashcards response.
 */
export interface GenerateFlashcardsResponse {
  session: Pick<
    GenerationSessionRow,
    | "id"
    | "status"
    | "source_text"
    | "source_text_chars"
    | "requested_card_count"
    | "generated_card_count"
    | "created_at"
    | "completed_at"
  >;
  flashcards: GeneratedFlashcardDTO[];
  daily_limit: DailyLimitDTO;
}

/**
 * Generation session list item.
 */
export type GenerationSessionListItemDTO = Pick<
  GenerationSessionRow,
  "id" | "status" | "source_text_chars" | "generated_card_count" | "created_at" | "completed_at"
>;

/**
 * Paginated generation sessions response.
 */
export interface PaginatedGenerationSessionsDTO {
  data: GenerationSessionListItemDTO[];
  pagination: PaginationDTO;
}

// =============================================================================
// METRICS TYPES
// =============================================================================

/**
 * Acceptance metrics DTO (rates derived from acceptance_metrics row).
 */
export interface AcceptanceMetricsDTO extends AcceptanceMetricsRow {
  acceptance_rate: number;
  rejection_rate: number;
}

/**
 * Recalculate metrics response.
 */
export interface RecalculateMetricsResponse extends AcceptanceMetricsDTO {
  recalculation_time_ms: number;
}

// =============================================================================
// PROFILE TYPES
// =============================================================================

/**
 * Profile statistics (aggregated from flashcards, tags, and AI generation).
 */
export interface ProfileStatsDTO {
  total_flashcards: number;
  active_flashcards: number;
  draft_flashcards: number;
  total_tags: number;
  ai_cards_today: number;
  ai_limit_remaining: number;
}

/**
 * Profile DTO.
 */
export interface ProfileDTO extends ProfileRow {
  stats: ProfileStatsDTO;
}

/**
 * Update profile command.
 */
export interface UpdateProfileCommand {
  display_name?: string;
}

/**
 * Update profile response.
 */
export interface UpdateProfileResponse {
  id: ProfileRow["id"];
  display_name: ProfileRow["display_name"];
  updated_at: ProfileRow["updated_at"];
}
