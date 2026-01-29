# REST API Plan

## 1. Resources

### Core Resources
- **flashcards** → `public.flashcards` table
- **tags** → `public.tags` table
- **ai-generation** → `public.ai_generation_sessions` table
- **srs** → `public.srs_state` and `public.srs_reviews` tables
- **metrics** → `public.acceptance_metrics` table
- **profiles** → `public.profiles` table

### Resource Relationships
- Flashcards belong to users (profiles)
- Tags belong to users and can be associated with multiple flashcards (many-to-many)
- AI generation sessions belong to users and produce flashcards
- SRS state has 1:1 relationship with active flashcards
- SRS reviews track history for flashcards

## 2. Endpoints

### 2.1 Authentication

Authentication is handled by Supabase Auth (OAuth providers). All API endpoints require a valid JWT token in the `Authorization` header.

**Header Format:**
```
Authorization: Bearer <jwt_token>
```

All endpoints return `401 Unauthorized` if token is missing or invalid.

---

### 2.2 AI Generation

#### Generate Flashcards from Text

**Endpoint:** `POST /api/ai-generation`

**Description:** Generates flashcards from source text using AI. Creates a generation session and returns draft flashcards. Synchronous operation with rate limiting.

**Request Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "source_text": "string (300-10000 chars)",
  "requested_card_count": "number (optional, default: auto)",
  "acknowledged_data_warning": "boolean (required, must be true)"
}
```

**Validation Rules:**
- `source_text`: 300-10000 characters (enforced by DB constraint)
- `acknowledged_data_warning`: must be `true` (user confirmed NDA/sensitive data warning)
- Daily limit: user cannot have generated more than 50 AI cards today (00:00-23:59 UTC)

**Success Response (201 Created):**
```json
{
  "session": {
    "id": "uuid",
    "status": "completed",
    "source_text": "string",
    "source_text_chars": "number",
    "requested_card_count": "number | null",
    "generated_card_count": "number",
    "created_at": "ISO8601 timestamp",
    "completed_at": "ISO8601 timestamp"
  },
  "flashcards": [
    {
      "id": "uuid",
      "question": "string (max 100 chars)",
      "answer": "string (max 300 chars)",
      "status": "draft",
      "source": "generated",
      "generation_session_id": "uuid",
      "suggested_tags": ["string"],
      "created_at": "ISO8601 timestamp"
    }
  ],
  "daily_limit": {
    "used": "number",
    "total": 50,
    "remaining": "number"
  }
}
```

**Error Responses:**

**400 Bad Request** - Validation error:
```json
{
  "error": "validation_error",
  "message": "Source text must be between 300 and 10000 characters",
  "details": {
    "field": "source_text",
    "current_length": "number"
  }
}
```

**429 Too Many Requests** - Daily limit exceeded:
```json
{
  "error": "rate_limit_exceeded",
  "message": "Daily AI generation limit reached (50 cards per day)",
  "details": {
    "used": 50,
    "total": 50,
    "reset_at": "ISO8601 timestamp (next midnight UTC)"
  }
}
```

**500 Internal Server Error** - AI generation failed:
```json
{
  "error": "generation_failed",
  "message": "Failed to generate flashcards. Please try again.",
  "session_id": "uuid"
}
```

---

#### Get Generation Session

**Endpoint:** `GET /api/ai-generation/:sessionId`

**Description:** Retrieves details of a specific AI generation session, including all generated flashcards.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `sessionId` (uuid, required): ID of the generation session

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "completed | processing | failed | created",
  "source_text": "string",
  "source_text_chars": "number",
  "requested_card_count": "number | null",
  "generated_card_count": "number | null",
  "error_message": "string | null",
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp",
  "completed_at": "ISO8601 timestamp | null",
  "flashcards": [
    {
      "id": "uuid",
      "question": "string",
      "answer": "string",
      "status": "draft | active | rejected",
      "created_at": "ISO8601 timestamp"
    }
  ]
}
```

**Error Responses:**

**404 Not Found** - Session not found or doesn't belong to user:
```json
{
  "error": "not_found",
  "message": "Generation session not found"
}
```

---

#### List Generation Sessions

**Endpoint:** `GET /api/ai-generation`

**Description:** Lists user's AI generation sessions with pagination.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**Query Parameters:**
- `limit` (number, optional, default: 20, max: 100): Number of sessions per page
- `cursor` (string, optional): Pagination cursor from previous response
- `status` (enum, optional): Filter by status (`created`, `processing`, `completed`, `failed`)

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "completed",
      "source_text_chars": "number",
      "generated_card_count": "number",
      "created_at": "ISO8601 timestamp",
      "completed_at": "ISO8601 timestamp | null"
    }
  ],
  "pagination": {
    "next_cursor": "string | null",
    "has_more": "boolean"
  }
}
```

---

### 2.3 Flashcards

#### Overview: Flashcard Creation Methods

Flashcards can be created in two ways, each with different endpoints and workflows:

**1. AI-Generated Flashcards (via `POST /api/ai-generation`):**
- Created automatically by AI from source text
- Multiple cards created in one request
- Cards have `source='generated'` and `generation_session_id` set
- All cards start as `status='draft'`
- Count towards daily AI limit (50 cards/day)
- User reviews and activates/rejects each card individually or in bulk
- Tracked in acceptance metrics

**2. Manual Flashcards (via `POST /api/flashcards`):**
- Created one at a time by user
- Card has `source='manual'` and `generation_session_id=null`
- Starts as `status='draft'` by default (or `status='active'` if `auto_activate=true`)
- No daily limit
- Not tracked in acceptance metrics

**Common Workflow After Creation:**
Both types of flashcards follow the same workflow after initial creation:
- Draft cards can be edited via `PATCH /api/flashcards/:id`
- Draft cards can be activated via `POST /api/flashcards/:id/activate` or `POST /api/flashcards/bulk-activate`
- Draft cards can be rejected via `POST /api/flashcards/:id/reject` or `POST /api/flashcards/bulk-reject`
- Active cards participate in SRS learning sessions
- Active cards can be edited, but status changes are not allowed

---

#### List Flashcards

**Endpoint:** `GET /api/flashcards`

**Description:** Lists user's flashcards with filtering, search, and pagination. Supports full-text search and tag filtering.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**Query Parameters:**
- `limit` (number, optional, default: 20, max: 100): Number of cards per page
- `cursor` (string, optional): Pagination cursor (format: `{updated_at}_{id}`)
- `status` (enum, optional): Filter by status (`draft`, `active`, `rejected`)
- `source` (enum, optional): Filter by source (`generated`, `manual`)
- `search` (string, optional, min: 3 chars): Full-text search in question and answer (case-insensitive)
- `tag_ids` (string, optional): Comma-separated tag UUIDs (AND logic)
- `generation_session_id` (uuid, optional): Filter by generation session

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "question": "string",
      "answer": "string",
      "status": "draft | active | rejected",
      "source": "generated | manual",
      "generation_session_id": "uuid | null",
      "first_activated_at": "ISO8601 timestamp | null",
      "created_at": "ISO8601 timestamp",
      "updated_at": "ISO8601 timestamp",
      "tags": [
        {
          "id": "uuid",
          "name": "string"
        }
      ],
      "srs_state": {
        "due_at": "ISO8601 timestamp",
        "interval_days": "number",
        "repetitions": "number"
      } | null
    }
  ],
  "pagination": {
    "next_cursor": "string | null",
    "has_more": "boolean"
  },
  "total_count": "number (only when no filters applied)"
}
```

**Error Responses:**

**400 Bad Request** - Invalid query parameters:
```json
{
  "error": "validation_error",
  "message": "Search query must be at least 3 characters",
  "details": {
    "field": "search",
    "min_length": 3
  }
}
```

---

#### Get Single Flashcard

**Endpoint:** `GET /api/flashcards/:id`

**Description:** Retrieves a single flashcard with full details including tags and SRS state.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `id` (uuid, required): Flashcard ID

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "question": "string",
  "answer": "string",
  "status": "draft | active | rejected",
  "source": "generated | manual",
  "generation_session_id": "uuid | null",
  "first_activated_at": "ISO8601 timestamp | null",
  "counted_in_metrics": "boolean",
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp",
  "tags": [
    {
      "id": "uuid",
      "name": "string"
    }
  ],
  "srs_state": {
    "due_at": "ISO8601 timestamp",
    "interval_days": "number",
    "ease_factor": "number",
    "repetitions": "number",
    "lapses": "number",
    "last_reviewed_at": "ISO8601 timestamp | null"
  } | null
}
```

**Error Responses:**

**404 Not Found** - Flashcard not found or doesn't belong to user:
```json
{
  "error": "not_found",
  "message": "Flashcard not found"
}
```

---

#### Create Manual Flashcards

**Endpoint:** `POST /api/flashcards`

**Description:** Creates one or more flashcards manually (not AI-generated). Cards are created with `status='draft'` and `source='manual'`. This endpoint is used only for manual flashcard creation. AI-generated flashcards are created automatically via the AI generation endpoint.

**Request Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "flashcards": [
    {
      "question": "string (max 100 chars, required)",
      "answer": "string (max 300 chars, required)",
      "tag_ids": ["uuid"], // optional array of tag IDs
      "auto_activate": "boolean (optional, default: false)" // if true, immediately activates this card
    }
  ]
}
```

**Validation Rules:**
- `flashcards`: required, non-empty array, max 50 cards per request
- `question`: required for each card, max 100 characters
- `answer`: required for each card, max 300 characters
- `tag_ids`: optional for each card, all tags must belong to the user
- `auto_activate`: optional for each card, if true, card is created with `status='active'` and SRS state is initialized

**Success Response (201 Created):**
```json
{
  "created": [
    {
      "id": "uuid",
      "question": "string",
      "answer": "string",
      "status": "draft | active",
      "source": "manual",
      "generation_session_id": null,
      "created_at": "ISO8601 timestamp",
      "updated_at": "ISO8601 timestamp",
      "tags": [
        {
          "id": "uuid",
          "name": "string"
        }
      ],
      "srs_state": {
        "due_at": "ISO8601 timestamp",
        "interval_days": 1,
        "ease_factor": 2.5,
        "repetitions": 0,
        "lapses": 0
      } | null // only present if auto_activate=true
    }
  ],
  "failed": [
    {
      "index": "number", // index in the request array
      "question": "string", // the question that failed
      "error": "validation_error",
      "message": "Question exceeds maximum length of 100 characters"
    }
  ],
  "summary": {
    "total": "number",
    "succeeded": "number",
    "failed": "number"
  }
}
```

**Error Responses:**

**400 Bad Request** - Request validation error:
```json
{
  "error": "validation_error",
  "message": "Flashcards array is required and must contain at least one card",
  "details": {
    "field": "flashcards"
  }
}
```

**400 Bad Request** - Too many cards:
```json
{
  "error": "validation_error",
  "message": "Maximum 50 flashcards can be created at once",
  "details": {
    "max_count": 50,
    "provided_count": "number"
  }
}
```

**Partial Success Handling:**
- If some cards fail validation, the endpoint returns 201 with both `created` and `failed` arrays
- Successfully created cards are returned in `created` array
- Failed cards are returned in `failed` array with error details
- Client can retry failed cards individually

---

#### Update Flashcard

**Endpoint:** `PATCH /api/flashcards/:id`

**Description:** Updates flashcard content and tags. Can be used for draft verification or editing active cards.

**Request Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**URL Parameters:**
- `id` (uuid, required): Flashcard ID

**Request Body:**
```json
{
  "question": "string (max 100 chars, optional)",
  "answer": "string (max 300 chars, optional)",
  "tag_ids": ["uuid"] // optional, replaces all tags
}
```

**Validation Rules:**
- `question`: if provided, max 100 characters
- `answer`: if provided, max 300 characters
- `tag_ids`: if provided, all tags must belong to the user
- Cannot change `source`, `status`, or `generation_session_id` via this endpoint

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "question": "string",
  "answer": "string",
  "status": "draft | active | rejected",
  "source": "generated | manual",
  "updated_at": "ISO8601 timestamp",
  "tags": [
    {
      "id": "uuid",
      "name": "string"
    }
  ]
}
```

**Error Responses:**

**400 Bad Request** - Validation error
**404 Not Found** - Flashcard not found or doesn't belong to user

---

#### Activate Flashcard

**Endpoint:** `POST /api/flashcards/:id/activate`

**Description:** Activates a draft flashcard, making it available for SRS learning. Creates SRS state if transitioning from draft to active. Sets `first_activated_at` on first activation.

**Request Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**URL Parameters:**
- `id` (uuid, required): Flashcard ID

**Request Body:**
```json
{
  "initial_due_at": "ISO8601 timestamp (optional, defaults to now)"
}
```

**Business Logic:**
- Changes `status` from `draft` to `active`
- Sets `first_activated_at` if null (immutable after first set)
- Creates `srs_state` record with initial values if not exists
- For AI-generated cards: updates `counted_in_metrics` flag and acceptance metrics

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "active",
  "first_activated_at": "ISO8601 timestamp",
  "srs_state": {
    "due_at": "ISO8601 timestamp",
    "interval_days": 1,
    "ease_factor": 2.5,
    "repetitions": 0,
    "lapses": 0
  }
}
```

**Error Responses:**

**400 Bad Request** - Invalid state transition:
```json
{
  "error": "invalid_state",
  "message": "Flashcard is already active",
  "current_status": "active"
}
```

**404 Not Found** - Flashcard not found or doesn't belong to user

---

#### Reject Flashcard

**Endpoint:** `POST /api/flashcards/:id/reject`

**Description:** Rejects a draft flashcard, excluding it from SRS learning. For AI-generated cards, updates acceptance metrics.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `id` (uuid, required): Flashcard ID

**Business Logic:**
- Changes `status` from `draft` to `rejected`
- For AI-generated cards: updates `counted_in_metrics` flag and acceptance metrics
- Does not delete the card (retained for audit)

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "rejected",
  "updated_at": "ISO8601 timestamp"
}
```

**Error Responses:**

**400 Bad Request** - Invalid state transition:
```json
{
  "error": "invalid_state",
  "message": "Can only reject draft flashcards",
  "current_status": "active"
}
```

**404 Not Found** - Flashcard not found or doesn't belong to user

---

#### Bulk Activate Flashcards

**Endpoint:** `POST /api/flashcards/bulk-activate`

**Description:** Activates multiple draft flashcards at once. Useful for batch approval during draft verification.

**Request Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "flashcard_ids": ["uuid"],
  "initial_due_at": "ISO8601 timestamp (optional, defaults to now)"
}
```

**Validation Rules:**
- `flashcard_ids`: required, non-empty array, max 100 IDs
- All flashcards must belong to the user
- All flashcards must have `status='draft'`

**Success Response (200 OK):**
```json
{
  "activated": [
    {
      "id": "uuid",
      "status": "active"
    }
  ],
  "failed": [
    {
      "id": "uuid",
      "error": "already_active | not_found"
    }
  ],
  "summary": {
    "total": "number",
    "succeeded": "number",
    "failed": "number"
  }
}
```

**Error Responses:**

**400 Bad Request** - Validation error:
```json
{
  "error": "validation_error",
  "message": "Maximum 100 flashcards can be activated at once",
  "details": {
    "max_count": 100,
    "provided_count": "number"
  }
}
```

---

#### Bulk Reject Flashcards

**Endpoint:** `POST /api/flashcards/bulk-reject`

**Description:** Rejects multiple draft flashcards at once. Useful for batch rejection during draft verification.

**Request Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "flashcard_ids": ["uuid"]
}
```

**Validation Rules:**
- `flashcard_ids`: required, non-empty array, max 100 IDs
- All flashcards must belong to the user
- All flashcards must have `status='draft'`

**Success Response (200 OK):**
```json
{
  "rejected": [
    {
      "id": "uuid",
      "status": "rejected"
    }
  ],
  "failed": [
    {
      "id": "uuid",
      "error": "not_draft | not_found"
    }
  ],
  "summary": {
    "total": "number",
    "succeeded": "number",
    "failed": "number"
  }
}
```

**Error Responses:**

**400 Bad Request** - Validation error (same as bulk-activate)

---

#### Delete Flashcard

**Endpoint:** `DELETE /api/flashcards/:id`

**Description:** Permanently deletes a flashcard. Cascades to delete SRS state, reviews, and tag associations.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `id` (uuid, required): Flashcard ID

**Success Response (204 No Content)**

No response body.

**Error Responses:**

**404 Not Found** - Flashcard not found or doesn't belong to user:
```json
{
  "error": "not_found",
  "message": "Flashcard not found"
}
```

---

### 2.4 Tags

#### List Tags

**Endpoint:** `GET /api/tags`

**Description:** Lists user's tags with usage counts and autocomplete support.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**Query Parameters:**
- `search` (string, optional): Prefix search for autocomplete (case-insensitive)
- `sort` (enum, optional, default: `usage`): Sort order (`usage`, `name`, `created`)
- `limit` (number, optional, default: 50, max: 100): Number of tags to return

**Business Logic:**
- Usage count is calculated dynamically from `flashcard_tags` table
- Only counts active flashcards (not drafts or rejected)

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "usage_count": "number",
      "created_at": "ISO8601 timestamp",
      "updated_at": "ISO8601 timestamp"
    }
  ],
  "total_count": "number"
}
```

---

#### Get Single Tag

**Endpoint:** `GET /api/tags/:id`

**Description:** Retrieves a single tag with usage details.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `id` (uuid, required): Tag ID

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "string",
  "usage_count": "number",
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp",
  "recent_flashcards": [
    {
      "id": "uuid",
      "question": "string"
    }
  ]
}
```

**Error Responses:**

**404 Not Found** - Tag not found or doesn't belong to user:
```json
{
  "error": "not_found",
  "message": "Tag not found"
}
```

---

#### Create Tag

**Endpoint:** `POST /api/tags`

**Description:** Creates a new tag for the user.

**Request Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "name": "string (required, non-empty after trim)"
}
```

**Validation Rules:**
- `name`: required, non-empty after trimming whitespace
- Uniqueness: case-insensitive with normalized whitespace per user (enforced by DB)

**Success Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "string",
  "usage_count": 0,
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp"
}
```

**Error Responses:**

**400 Bad Request** - Validation error:
```json
{
  "error": "validation_error",
  "message": "Tag name cannot be empty"
}
```

**409 Conflict** - Duplicate tag name:
```json
{
  "error": "duplicate_tag",
  "message": "A tag with this name already exists (case-insensitive)",
  "existing_tag": {
    "id": "uuid",
    "name": "string"
  }
}
```

---

#### Update Tag

**Endpoint:** `PATCH /api/tags/:id`

**Description:** Updates a tag's name.

**Request Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**URL Parameters:**
- `id` (uuid, required): Tag ID

**Request Body:**
```json
{
  "name": "string (required, non-empty after trim)"
}
```

**Validation Rules:**
- Same as create tag

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "string",
  "usage_count": "number",
  "updated_at": "ISO8601 timestamp"
}
```

**Error Responses:**

**400 Bad Request** - Validation error
**404 Not Found** - Tag not found or doesn't belong to user
**409 Conflict** - Duplicate tag name

---

#### Delete Tag

**Endpoint:** `DELETE /api/tags/:id`

**Description:** Deletes a tag. Cascades to remove all flashcard-tag associations.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**URL Parameters:**
- `id` (uuid, required): Tag ID

**Success Response (204 No Content)**

No response body.

**Error Responses:**

**404 Not Found** - Tag not found or doesn't belong to user:
```json
{
  "error": "not_found",
  "message": "Tag not found"
}
```

---

### 2.5 SRS (Spaced Repetition System)

#### Get Due Flashcards

**Endpoint:** `GET /api/srs/due`

**Description:** Retrieves flashcards due for review. Returns up to 30 cards per session. Excludes cards reviewed in the last 24 hours.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**Query Parameters:**
- `limit` (number, optional, default: 30, max: 30): Number of cards to retrieve
- `tag_ids` (string, optional): Comma-separated tag UUIDs to filter by

**Business Logic:**
- Only returns cards with `status='active'`
- Filters by `srs_state.due_at <= now()`
- Excludes cards with `last_reviewed_at > now() - 24 hours`
- Orders by `due_at ASC` (oldest due first)
- Includes full card content with Markdown/code block support

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "question": "string (Markdown formatted)",
      "answer": "string (Markdown formatted)",
      "tags": [
        {
          "id": "uuid",
          "name": "string"
        }
      ],
      "srs_state": {
        "due_at": "ISO8601 timestamp",
        "interval_days": "number",
        "repetitions": "number"
      }
    }
  ],
  "session_info": {
    "total_due": "number",
    "returned": "number",
    "remaining": "number"
  }
}
```

**Error Responses:**

None (returns empty array if no cards due)

---

#### Submit Review

**Endpoint:** `POST /api/srs/reviews`

**Description:** Submits a review grade for a flashcard. Updates SRS state and creates review history record.

**Request Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "flashcard_id": "uuid (required)",
  "grade": "number (required, 1-4)",
  "reviewed_at": "ISO8601 timestamp (optional, defaults to now)"
}
```

**Validation Rules:**
- `flashcard_id`: required, must belong to user, must have `status='active'`
- `grade`: required, must be 1, 2, 3, or 4 (1=again, 2=hard, 3=good, 4=easy)
- Flashcard must not have been reviewed in the last 24 hours

**Business Logic:**
- Calculates new SRS parameters based on grade using SRS algorithm
- Updates `srs_state` table (due_at, interval_days, ease_factor, repetitions, lapses, last_reviewed_at)
- Creates record in `srs_reviews` table with before/after due dates
- Returns updated SRS state

**Success Response (200 OK):**
```json
{
  "review_id": "bigint",
  "flashcard_id": "uuid",
  "grade": "number",
  "reviewed_at": "ISO8601 timestamp",
  "srs_state": {
    "due_at": "ISO8601 timestamp",
    "interval_days": "number",
    "ease_factor": "number",
    "repetitions": "number",
    "lapses": "number"
  },
  "next_review_in_days": "number"
}
```

**Error Responses:**

**400 Bad Request** - Validation error:
```json
{
  "error": "validation_error",
  "message": "Grade must be between 1 and 4",
  "details": {
    "field": "grade",
    "valid_values": [1, 2, 3, 4]
  }
}
```

**409 Conflict** - Review too soon:
```json
{
  "error": "review_too_soon",
  "message": "This card was reviewed less than 24 hours ago",
  "details": {
    "last_reviewed_at": "ISO8601 timestamp",
    "next_available_at": "ISO8601 timestamp"
  }
}
```

**404 Not Found** - Flashcard not found, doesn't belong to user, or not active

---

#### Get SRS Statistics

**Endpoint:** `GET /api/srs/stats`

**Description:** Retrieves user's SRS statistics and session summary.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**Query Parameters:**
- `period` (enum, optional, default: `today`): Time period (`today`, `week`, `month`, `all`)

**Success Response (200 OK):**
```json
{
  "summary": {
    "total_active_cards": "number",
    "cards_due_today": "number",
    "cards_reviewed_today": "number",
    "cards_reviewed_period": "number"
  },
  "grade_distribution": {
    "1": "number",
    "2": "number",
    "3": "number",
    "4": "number"
  },
  "streak": {
    "current_days": "number",
    "longest_days": "number"
  },
  "upcoming_reviews": [
    {
      "date": "ISO8601 date",
      "count": "number"
    }
  ]
}
```

---

### 2.6 Metrics

#### Get Acceptance Metrics

**Endpoint:** `GET /api/metrics/acceptance`

**Description:** Retrieves global acceptance rate metrics for AI-generated flashcards.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**Success Response (200 OK):**
```json
{
  "generated_total": "number",
  "generated_activated_total": "number",
  "generated_rejected_total": "number",
  "acceptance_rate": "number (percentage, 0-100)",
  "rejection_rate": "number (percentage, 0-100)",
  "last_recalculated_at": "ISO8601 timestamp"
}
```

**Business Logic:**
- `acceptance_rate = (generated_activated_total / generated_total) * 100`
- Each card counted only once (via `counted_in_metrics` flag)
- Only cards with `source='generated'` are included

---

#### Recalculate Acceptance Metrics

**Endpoint:** `POST /api/metrics/acceptance/recalculate`

**Description:** Triggers manual recalculation of acceptance metrics. Requires service role or admin privileges.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**Business Logic:**
- Counts all flashcards with `source='generated'` and `counted_in_metrics=true`
- Groups by status: `active` (activated) vs `rejected`
- Updates `acceptance_metrics` table
- Sets `last_recalculated_at` to current timestamp

**Success Response (200 OK):**
```json
{
  "generated_total": "number",
  "generated_activated_total": "number",
  "generated_rejected_total": "number",
  "acceptance_rate": "number",
  "last_recalculated_at": "ISO8601 timestamp",
  "recalculation_time_ms": "number"
}
```

**Error Responses:**

**403 Forbidden** - Insufficient permissions:
```json
{
  "error": "forbidden",
  "message": "Only service role can trigger metric recalculation"
}
```

---

### 2.7 User Profile

#### Get User Profile

**Endpoint:** `GET /api/profile`

**Description:** Retrieves the authenticated user's profile information.

**Request Headers:**
- `Authorization: Bearer <token>` (required)

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "display_name": "string | null",
  "created_at": "ISO8601 timestamp",
  "updated_at": "ISO8601 timestamp",
  "stats": {
    "total_flashcards": "number",
    "active_flashcards": "number",
    "draft_flashcards": "number",
    "total_tags": "number",
    "ai_cards_today": "number",
    "ai_limit_remaining": "number"
  }
}
```

---

#### Update User Profile

**Endpoint:** `PATCH /api/profile`

**Description:** Updates the authenticated user's profile information.

**Request Headers:**
- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "display_name": "string (optional, max 100 chars)"
}
```

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "display_name": "string | null",
  "updated_at": "ISO8601 timestamp"
}
```

**Error Responses:**

**400 Bad Request** - Validation error:
```json
{
  "error": "validation_error",
  "message": "Display name exceeds maximum length of 100 characters"
}
```

---

## 3. Authentication and Authorization

### Authentication Mechanism

FlashcardsAI uses **Supabase Auth** with OAuth providers for authentication. The application does not implement custom authentication endpoints.

**Implementation Details:**

1. **OAuth Flow:**
   - User initiates login via Supabase Auth UI or SDK
   - Redirected to OAuth provider (GitHub, Google, etc.)
   - On successful authentication, Supabase issues JWT token
   - Client stores JWT and includes it in all API requests

2. **Token Format:**
   - JWT token issued by Supabase Auth
   - Contains user ID (`sub` claim) and role
   - Expires after configured duration (default: 1 hour)
   - Refresh tokens used for session renewal

3. **Token Validation:**
   - All API endpoints validate JWT signature using Supabase public key
   - Extract user ID from `sub` claim
   - Verify token expiration
   - Check token has not been revoked

4. **User Identification:**
   - User ID extracted from JWT `sub` claim
   - Mapped to `auth.uid()` in PostgreSQL
   - Used in RLS policies for data isolation

### Authorization Model

**Row Level Security (RLS):**

All data access is controlled by PostgreSQL RLS policies that enforce user isolation:

1. **User Data Isolation:**
   - Users can only access their own flashcards, tags, sessions, and reviews
   - Enforced by `user_id = auth.uid()` policies on all domain tables
   - Attempts to access other users' data return 404 (not 403) to prevent enumeration

2. **Read-Only Resources:**
   - `starter_tags`: readable by all authenticated users
   - `acceptance_metrics`: readable by all authenticated users
   - Write access restricted to service role

3. **Service Role:**
   - Backend operations requiring elevated privileges use service role
   - Examples: metric recalculation, user profile creation, starter tag management
   - Service role bypasses RLS policies

**Authorization Rules by Resource:**

| Resource           | Create       | Read     | Update       | Delete   |
| ------------------ | ------------ | -------- | ------------ | -------- |
| Flashcards         | Own only     | Own only | Own only     | Own only |
| Tags               | Own only     | Own only | Own only     | Own only |
| AI Sessions        | Own only     | Own only | Own only     | Own only |
| SRS State          | Own only     | Own only | Own only     | Own only |
| SRS Reviews        | Own only     | Own only | Never        | Never    |
| Profile            | Auto-created | Own only | Own only     | Never    |
| Starter Tags       | Never        | All      | Never        | Never    |
| Acceptance Metrics | Never        | All      | Service role | Never    |

**Error Responses:**

**401 Unauthorized** - Missing or invalid token:
```json
{
  "error": "unauthorized",
  "message": "Authentication required"
}
```

**403 Forbidden** - Insufficient permissions:
```json
{
  "error": "forbidden",
  "message": "You do not have permission to perform this action"
}
```

---

## 4. Validation and Business Logic

### 4.1 Validation Rules

#### Flashcard Validation

**Question Field:**
- **Type:** string
- **Required:** yes
- **Max Length:** 100 characters
- **Enforcement:** Database constraint + API validation
- **Error:** "Question exceeds maximum length of 100 characters"

**Answer Field:**
- **Type:** string
- **Required:** yes
- **Max Length:** 300 characters
- **Enforcement:** Database constraint + API validation
- **Error:** "Answer exceeds maximum length of 300 characters"

**Status Field:**
- **Type:** enum (`draft`, `active`, `rejected`)
- **Default:** `draft`
- **Immutability:** Cannot change directly via PATCH; use activate/reject endpoints
- **Business Rule:** Only `active` cards visible in SRS

**Source Field:**
- **Type:** enum (`generated`, `manual`)
- **Default:** `manual`
- **Immutability:** Cannot be changed after creation (enforced by trigger)
- **Error:** "Flashcard source field is immutable and cannot be changed"

**first_activated_at Field:**
- **Type:** timestamp
- **Immutability:** Set once when card first becomes active, cannot be changed
- **Business Rule:** Used for acceptance metrics to count each card only once
- **Enforcement:** Database trigger
- **Error:** "first_activated_at can only be set once and cannot be changed"

#### Tag Validation

**Name Field:**
- **Type:** string
- **Required:** yes
- **Validation:** Non-empty after trimming whitespace
- **Uniqueness:** Case-insensitive with normalized whitespace per user
- **Normalization:** `lower(regexp_replace(trim(name), '\s+', ' ', 'g'))`
- **Enforcement:** Database constraint + API validation
- **Error:** "Tag name cannot be empty" or "A tag with this name already exists"

#### AI Generation Validation

**source_text Field:**
- **Type:** string
- **Required:** yes
- **Min Length:** 300 characters
- **Max Length:** 10,000 characters
- **Enforcement:** Database constraint + API validation
- **Error:** "Source text must be between 300 and 10000 characters"

**acknowledged_data_warning Field:**
- **Type:** boolean
- **Required:** yes
- **Value:** must be `true`
- **Business Rule:** User must acknowledge NDA/sensitive data warning
- **Error:** "You must acknowledge the data warning before generating flashcards"

**Daily Limit:**
- **Limit:** 50 AI-generated cards per user per day (00:00-23:59 UTC)
- **Scope:** Applies only to card **creation** via `POST /api/ai-generation`, not activation
- **Calculation:** Count flashcards WHERE `user_id = ? AND source = 'generated' AND created_at >= today_start`
- **Index:** `flashcards_user_created_generated_idx`
- **Error:** "Daily AI generation limit reached (50 cards per day)"
- **Important:** 
  - Cards count towards limit immediately when created (as drafts)
  - Activating or rejecting drafts does NOT consume additional limit
  - Manual cards (`source='manual'`) do NOT count towards this limit
  - Limit resets at midnight UTC

#### SRS Validation

**Grade Field:**
- **Type:** integer
- **Required:** yes
- **Range:** 1-4 (1=again, 2=hard, 3=good, 4=easy)
- **Enforcement:** Database constraint + API validation
- **Error:** "Grade must be between 1 and 4"

**Review Frequency:**
- **Minimum Latency:** 24 hours between reviews of same card
- **Calculation:** `last_reviewed_at > now() - interval '24 hours'`
- **Error:** "This card was reviewed less than 24 hours ago"

**Session Size:**
- **Maximum:** 30 cards per session
- **Enforcement:** API limit on GET /api/srs/due
- **Business Rule:** Prevents overwhelming user with too many reviews

#### Search Validation

**Search Query:**
- **Type:** string
- **Min Length:** 3 characters
- **Case Sensitivity:** Case-insensitive (ILIKE in PostgreSQL)
- **Enforcement:** API validation
- **Error:** "Search query must be at least 3 characters"

### 4.2 Business Logic Implementation

#### AI Generation Flow (POST /api/ai-generation)

This flow creates multiple flashcards with `source='generated'` directly in the database as drafts.

**Step 1: Validation**
1. Validate JWT token and extract user_id
2. Validate source_text length (300-10000 chars)
3. Validate acknowledged_data_warning = true
4. Check daily limit: count AI cards created today < 50

**Step 2: Session Creation**
1. Create `ai_generation_sessions` record:
   - `user_id`: from JWT
   - `status`: 'processing'
   - `source_text`: from request
   - `requested_card_count`: from request or null

**Step 3: AI Generation**
1. Call OpenRouter API with source_text
2. Parse AI response into flashcards
3. Validate each card (question <= 100, answer <= 300)
4. Extract suggested tags from AI response

**Step 4: Flashcard Creation (Direct Database Insert)**
1. For each generated card, INSERT into `flashcards` table:
   - `user_id`: from JWT
   - `question`: from AI
   - `answer`: from AI
   - `status`: 'draft'
   - `source`: 'generated' (immutable)
   - `generation_session_id`: session.id
2. For each suggested tag:
   - Check if tag exists for user (by normalized name)
   - If not exists, create tag
   - Create association in `flashcard_tags`

**Step 5: Session Completion**
1. Update `ai_generation_sessions`:
   - `status`: 'completed' or 'failed'
   - `generated_card_count`: actual count
   - `completed_at`: now()
   - `error_message`: if failed

**Step 6: Response**
1. Return session with generated flashcards (all as drafts)
2. Include daily limit usage
3. Client can then use draft management endpoints to activate/reject cards

**Error Handling:**
- If AI call fails: set status='failed', store error_message
- If validation fails: rollback transaction, return 400
- If daily limit exceeded: return 429 before creating session

**Important Notes:**
- All AI-generated cards are created with `source='generated'` which is immutable
- Cards count towards daily limit immediately upon creation (not upon activation)
- Cards are not counted in acceptance metrics until activated or rejected

#### Manual Flashcard Creation Flow (POST /api/flashcards)

This flow creates one or more flashcards with `source='manual'`.

**Step 1: Request Validation**
1. Validate JWT token and extract user_id
2. Validate `flashcards` array is present and non-empty
3. Validate array length (max 50 cards per request)

**Step 2: Individual Card Validation**
1. For each flashcard in array:
   - Validate question (required, max 100 chars)
   - Validate answer (required, max 300 chars)
   - Validate tag_ids (if provided, all must belong to user)
   - Track validation errors with card index

**Step 3: Batch Flashcard Creation**
1. For each valid flashcard, INSERT into `flashcards` table:
   - `user_id`: from JWT
   - `question`: from request
   - `answer`: from request
   - `status`: 'draft' (or 'active' if auto_activate=true for this card)
   - `source`: 'manual' (immutable)
   - `generation_session_id`: null

**Step 4: Tag Association**
1. For each created flashcard with tag_ids:
   - Verify each tag belongs to user
   - Create associations in `flashcard_tags`

**Step 5: Auto-Activation (per card if requested)**
1. For each card where `auto_activate=true`:
   - Set `status='active'`
   - Set `first_activated_at=now()`
   - Create `srs_state` record with initial values

**Step 6: Response**
1. Return `created` array with successfully created flashcards
2. Return `failed` array with validation errors (index + error details)
3. Return `summary` with counts (total, succeeded, failed)
4. Include srs_state for auto-activated cards

**Error Handling:**
- **Partial Success:** Some cards succeed, some fail → return 201 with both arrays
- **Complete Failure:** All cards fail validation → return 400
- **Request Validation:** Invalid array or too many cards → return 400 before processing

**Transaction Strategy:**
- Use database transaction for each individual card creation
- If one card fails, it doesn't rollback others (partial success allowed)
- Alternative: All-or-nothing transaction (rollback all if any fails) - decide based on UX requirements

**Important Notes:**
- Manual cards have `source='manual'` which is immutable
- No daily limit for manual cards
- Manual cards are not tracked in acceptance metrics
- `auto_activate` parameter allows skipping draft review for trusted manual input
- Batch creation useful for importing flashcards from other sources

#### Draft Activation Flow

**Step 1: Validation**
1. Validate JWT token and extract user_id
2. Verify flashcard exists and belongs to user
3. Verify current status is 'draft'

**Step 2: Status Update**
1. Update `flashcards`:
   - `status`: 'draft' → 'active'
   - `first_activated_at`: now() (if null)

**Step 3: SRS State Creation**
1. Check if `srs_state` exists for flashcard_id
2. If not exists, create `srs_state`:
   - `flashcard_id`: from request
   - `due_at`: from request or now()
   - `interval_days`: 1
   - `ease_factor`: 2.5
   - `repetitions`: 0
   - `lapses`: 0

**Step 4: Metrics Update (for AI-generated cards)**
1. If `source = 'generated'` AND `counted_in_metrics = false`:
   - Set `counted_in_metrics = true`
   - Increment `acceptance_metrics.generated_activated_total`
   - Increment `acceptance_metrics.generated_total` (if first action on this card)

**Step 5: Response**
1. Return updated flashcard with srs_state

#### Draft Rejection Flow

**Step 1: Validation**
1. Validate JWT token and extract user_id
2. Verify flashcard exists and belongs to user
3. Verify current status is 'draft'

**Step 2: Status Update**
1. Update `flashcards`:
   - `status`: 'draft' → 'rejected'

**Step 3: Metrics Update (for AI-generated cards)**
1. If `source = 'generated'` AND `counted_in_metrics = false`:
   - Set `counted_in_metrics = true`
   - Increment `acceptance_metrics.generated_rejected_total`
   - Increment `acceptance_metrics.generated_total` (if first action on this card)

**Step 4: Response**
1. Return updated flashcard

**Note:** Rejected cards are retained (not deleted) for audit purposes.

#### SRS Review Flow

**Step 1: Validation**
1. Validate JWT token and extract user_id
2. Verify flashcard exists, belongs to user, and has status='active'
3. Verify grade is 1-4
4. Verify card not reviewed in last 24 hours

**Step 2: Get Current SRS State**
1. Fetch `srs_state` for flashcard_id
2. Store current due_at as due_before_review

**Step 3: Calculate New SRS Parameters**
1. Apply SRS algorithm based on grade:
   - **Grade 1 (Again):** Reset interval, decrease ease_factor, increment lapses
   - **Grade 2 (Hard):** Small interval increase, slight ease_factor decrease
   - **Grade 3 (Good):** Normal interval increase, maintain ease_factor
   - **Grade 4 (Easy):** Large interval increase, increase ease_factor
2. Calculate new due_at based on new interval_days
3. Increment repetitions (except for grade 1)

**Step 4: Update SRS State**
1. Update `srs_state`:
   - `due_at`: calculated value
   - `interval_days`: calculated value
   - `ease_factor`: calculated value
   - `repetitions`: incremented or reset
   - `lapses`: incremented if grade=1
   - `last_reviewed_at`: now()

**Step 5: Create Review Record**
1. Insert into `srs_reviews`:
   - `flashcard_id`: from request
   - `reviewed_at`: from request or now()
   - `grade`: from request
   - `due_before_review`: stored value
   - `due_after_review`: calculated due_at

**Step 6: Response**
1. Return review record with updated srs_state

**SRS Algorithm Details:**

The specific SRS algorithm implementation depends on the chosen library (to be decided). Common approach (SM-2 based):

- **Interval Calculation:**
  - Grade 1: interval = 1 day
  - Grade 2: interval = max(1, previous_interval * 1.2)
  - Grade 3: interval = previous_interval * ease_factor
  - Grade 4: interval = previous_interval * ease_factor * 1.3

- **Ease Factor Adjustment:**
  - Grade 1: ease_factor = max(1.3, ease_factor - 0.2)
  - Grade 2: ease_factor = max(1.3, ease_factor - 0.15)
  - Grade 3: ease_factor (unchanged)
  - Grade 4: ease_factor = ease_factor + 0.1

- **Constraints:**
  - ease_factor >= 1.0 (database constraint)
  - interval_days >= 0 (database constraint)
  - First review: interval = 1 day regardless of grade

#### Acceptance Metrics Calculation

Acceptance metrics track the quality of AI-generated flashcards by measuring how many are accepted (activated) vs rejected by users.

**Scope:**
- **Only AI-generated cards** (`source='generated'`) are tracked
- **Manual cards** (`source='manual'`) are completely excluded from metrics
- Cards created via `POST /api/ai-generation` are eligible for tracking
- Cards created via `POST /api/flashcards` are never tracked

**Triggered By:**
1. **Automatic (Incremental):** When AI-generated draft card is activated or rejected for the first time
2. **Manual (Full Recalculation):** Via `POST /api/metrics/acceptance/recalculate`

**Calculation Logic:**
1. Count all flashcards WHERE:
   - `source = 'generated'` (only AI cards)
   - `counted_in_metrics = true` (already processed)
2. Group by status:
   - `status = 'active'` → generated_activated_total
   - `status = 'rejected'` → generated_rejected_total
3. Sum both groups → generated_total
4. Calculate rates:
   - acceptance_rate = (generated_activated_total / generated_total) * 100
   - rejection_rate = (generated_rejected_total / generated_total) * 100

**Counting Rules:**
- Each AI-generated card counted **only once** (via `counted_in_metrics` flag)
- Flag set to `true` when card first transitions from `draft` to `active` or `rejected`
- Cards that remain in `draft` status indefinitely are **not counted**
- If user activates then later deletes card, it remains counted as "activated"
- Manual cards (`source='manual'`) are **never counted**, regardless of status

**Update Strategy:**
- **Incremental Update (Automatic):**
  - When `POST /api/flashcards/:id/activate` or `POST /api/flashcards/bulk-activate` is called:
    - If `source='generated'` AND `counted_in_metrics=false`:
      - Set `counted_in_metrics=true`
      - Increment `acceptance_metrics.generated_activated_total`
      - Increment `acceptance_metrics.generated_total`
  - When `POST /api/flashcards/:id/reject` or `POST /api/flashcards/bulk-reject` is called:
    - If `source='generated'` AND `counted_in_metrics=false`:
      - Set `counted_in_metrics=true`
      - Increment `acceptance_metrics.generated_rejected_total`
      - Increment `acceptance_metrics.generated_total`

- **Full Recalculation (Manual):**
  - Recount all cards WHERE `source='generated'` AND `counted_in_metrics=true`
  - Useful for fixing inconsistencies or after data migrations
  - Updates `last_recalculated_at` timestamp

**Example Scenario:**
1. User generates 10 AI cards via `POST /api/ai-generation`
   - All 10 cards: `source='generated'`, `status='draft'`, `counted_in_metrics=false`
   - Daily limit: used += 10
   - Acceptance metrics: no change yet
2. User activates 7 cards via `POST /api/flashcards/bulk-activate`
   - 7 cards: `status='active'`, `counted_in_metrics=true`
   - Acceptance metrics: generated_total=7, generated_activated_total=7
3. User rejects 2 cards via `POST /api/flashcards/bulk-reject`
   - 2 cards: `status='rejected'`, `counted_in_metrics=true`
   - Acceptance metrics: generated_total=9, generated_rejected_total=2
4. User leaves 1 card as draft forever
   - 1 card: `status='draft'`, `counted_in_metrics=false`
   - Acceptance metrics: no change (not counted)
5. Final acceptance rate: 7/9 = 77.8%

#### Tag Usage Count Calculation

**Calculation:**
- Dynamic count from `flashcard_tags` table
- Only counts active flashcards (not drafts or rejected)
- Query: `SELECT COUNT(*) FROM flashcard_tags ft JOIN flashcards f ON ft.flashcard_id = f.id WHERE ft.tag_id = ? AND f.status = 'active'`

**Performance:**
- Indexed via `flashcard_tags_tag_id_idx`
- Cached in API response for list operations
- Recalculated on each request (no stored count in MVP)

#### Search Implementation

**Full-Text Search (MVP):**
1. User provides search query (min 3 chars)
2. Query both question and answer fields using ILIKE:
   - `WHERE (question ILIKE '%query%' OR answer ILIKE '%query%')`
3. Case-insensitive matching
4. Uses index: `flashcards_user_status_updated_idx` for user/status filter
5. Full table scan for ILIKE (acceptable for MVP)

**Future Enhancement:**
- Add pg_trgm extension
- Create GIN indexes on question and answer
- Use `question % 'query' OR answer % 'query'` for similarity search

#### Pagination Strategy

**Cursor-Based Pagination:**
- Used for flashcard lists to ensure consistency during concurrent updates
- Cursor format: `{updated_at}_{id}` (e.g., "2026-01-28T10:30:00Z_550e8400-e29b-41d4-a716-446655440000")
- Supported by composite index: `flashcards_user_status_updated_idx`

**Query Pattern:**
```sql
SELECT * FROM flashcards
WHERE user_id = ?
  AND status = ?
  AND (updated_at, id) < (cursor_updated_at, cursor_id)
ORDER BY updated_at DESC, id DESC
LIMIT ?
```

**Benefits:**
- Consistent results even when data changes
- No skipped or duplicate items
- Efficient with proper indexes

**Offset-Based Pagination:**
- Used for tags and other small, stable datasets
- Simpler implementation for resources with < 1000 items

### 4.3 Data Integrity Rules

#### Immutable Fields

**flashcards.source:**
- Set on creation, cannot be changed
- Enforced by trigger: `prevent_flashcard_source_change`
- Critical for metrics accuracy

**flashcards.first_activated_at:**
- Set once when card first becomes active
- Cannot be changed after being set
- Enforced by trigger: `prevent_first_activated_at_change`
- Critical for metrics accuracy

#### Cascading Deletes

**User Deletion:**
- Deleting user (auth.users) cascades to:
  - profiles → all user data deleted
  - tags → all user tags deleted
  - flashcards → all user flashcards deleted
  - ai_generation_sessions → all user sessions deleted
  - srs_state → all user SRS state deleted
  - srs_reviews → all user review history deleted

**Flashcard Deletion:**
- Deleting flashcard cascades to:
  - flashcard_tags → tag associations removed
  - srs_state → SRS state deleted
  - srs_reviews → review history deleted

**Tag Deletion:**
- Deleting tag cascades to:
  - flashcard_tags → tag associations removed
  - Flashcards themselves remain unchanged

**AI Session Deletion:**
- Deleting ai_generation_session:
  - Sets flashcards.generation_session_id to NULL (ON DELETE SET NULL)
  - Flashcards remain, but lose link to generation session

#### Automatic Timestamps

**updated_at:**
- Automatically updated on every UPDATE operation
- Enforced by trigger: `set_updated_at`
- Applied to: profiles, tags, ai_generation_sessions, flashcards, srs_state

**created_at:**
- Set once on INSERT, never changed
- Default: now()
- Applied to all tables

#### Referential Integrity

**Foreign Keys:**
- All user_id fields reference profiles(id) with ON DELETE CASCADE
- flashcards.generation_session_id references ai_generation_sessions(id) with ON DELETE SET NULL
- flashcard_tags references both flashcards(id) and tags(id) with ON DELETE CASCADE
- srs_state.flashcard_id references flashcards(id) with ON DELETE CASCADE
- srs_reviews.flashcard_id references flashcards(id) with ON DELETE CASCADE

**Consistency Checks:**
- flashcards: if generation_session_id is set, source must be 'generated'
- flashcard_tags: both flashcard and tag must belong to same user (enforced by RLS)

### 4.4 Error Handling Strategy

**Error Response Format:**
All errors follow consistent JSON structure:
```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {
    // Optional additional context
  }
}
```

**HTTP Status Codes:**
- **200 OK:** Successful GET, PATCH, POST (non-creation)
- **201 Created:** Successful POST (creation)
- **204 No Content:** Successful DELETE
- **400 Bad Request:** Validation error, invalid input
- **401 Unauthorized:** Missing or invalid authentication
- **403 Forbidden:** Insufficient permissions
- **404 Not Found:** Resource not found or doesn't belong to user
- **409 Conflict:** Duplicate resource, invalid state transition
- **429 Too Many Requests:** Rate limit exceeded
- **500 Internal Server Error:** Unexpected server error

**Error Codes:**
- `validation_error`: Input validation failed
- `unauthorized`: Authentication required or invalid
- `forbidden`: Insufficient permissions
- `not_found`: Resource not found
- `duplicate_tag`: Tag name already exists
- `invalid_state`: Invalid state transition
- `rate_limit_exceeded`: Daily AI limit exceeded
- `review_too_soon`: Card reviewed too recently
- `generation_failed`: AI generation failed

**Security Considerations:**
- Return 404 (not 403) for unauthorized resource access to prevent enumeration
- Don't expose internal error details in production
- Log detailed errors server-side for debugging
- Sanitize error messages to avoid leaking sensitive information

---

## 5. Implementation Notes

### 5.1 Technology Stack Integration

**Astro 5 API Routes:**
- API endpoints implemented as Astro API routes in `src/pages/api/`
- Each endpoint is a separate `.ts` file exporting HTTP method handlers
- Example: `src/pages/api/flashcards/index.ts` for GET/POST /api/flashcards

**Supabase Client:**
- Use `@supabase/supabase-js` for database operations
- Two client types:
  - **Client-side:** Uses user's JWT, respects RLS policies
  - **Service role:** Bypasses RLS, used for privileged operations
- Initialize in `src/db/supabase.client.ts`

**TypeScript Types:**
- Database types auto-generated from schema in `src/db/database.types.ts`
- Shared DTOs defined in `src/types.ts`
- Ensures type safety between frontend and backend

**OpenRouter Integration:**
- API calls made from backend only (never from browser)
- API key stored in environment variable
- Implement retry logic with exponential backoff
- Timeout: 30 seconds for synchronous generation

### 5.2 Performance Optimizations

**Database Indexes:**
All indexes defined in migration are critical for performance:
- `flashcards_user_status_updated_idx`: List/pagination queries
- `flashcards_user_created_generated_idx`: Daily limit checks
- `srs_state_due_at_idx`: Finding due cards
- `tags_user_name_normalized_uq`: Tag uniqueness and autocomplete

**Query Optimization:**
- Use prepared statements for all queries
- Limit result sets (max 100 items per request)
- Use cursor-based pagination for large datasets
- Avoid N+1 queries by using JOINs or batch fetching

**Caching Strategy (Future):**
- Cache tag lists (low write frequency)
- Cache acceptance metrics (updated infrequently)
- Cache user profile stats (invalidate on flashcard changes)
- Use Redis or similar for session data

**Connection Pooling:**
- Use Supabase's built-in connection pooling
- Configure appropriate pool size based on load

### 5.3 Security Best Practices

**Input Validation:**
- Validate all input at API boundary
- Use TypeScript types for compile-time validation
- Use Zod or similar for runtime validation
- Sanitize user input to prevent injection attacks

**Authentication:**
- Validate JWT on every request
- Extract user_id from JWT, never trust client-provided user_id
- Use short-lived tokens (1 hour) with refresh tokens
- Implement token revocation for logout

**Authorization:**
- Rely on RLS policies for data isolation
- Double-check user ownership in API layer for critical operations
- Use service role sparingly and only when necessary
- Audit all service role operations

**Rate Limiting:**
- Implement API rate limiting (e.g., 100 requests/minute per user)
- Special handling for AI generation (50 cards/day)
- Use IP-based rate limiting for unauthenticated endpoints

**Data Protection:**
- Never log sensitive data (passwords, tokens, source_text)
- Use HTTPS for all API communication
- Implement CORS properly (whitelist frontend domain)
- Sanitize error messages to avoid information leakage

### 5.4 Testing Strategy

**Unit Tests:**
- Test validation logic in isolation
- Test SRS algorithm calculations
- Test business logic functions
- Mock database and external API calls

**Integration Tests:**
- Test API endpoints end-to-end
- Use test database with known state
- Test RLS policies with different users
- Test error handling and edge cases

**Test Cases by Feature:**

**AI Generation:**
- Valid generation with 300-10000 chars
- Rejection of text < 300 chars
- Rejection of text > 10000 chars
- Daily limit enforcement (50 cards)
- Error handling for AI API failures
- Concurrent generation requests

**Draft Management:**
- Activate single draft
- Reject single draft
- Bulk activate (1-100 cards)
- Bulk reject (1-100 cards)
- Invalid state transitions
- Metrics update on activation/rejection

**SRS:**
- Review with each grade (1-4)
- 24-hour minimum latency enforcement
- Correct SRS parameter calculations
- Session size limit (30 cards)
- No duplicate cards in session

**Tags:**
- Create tag with unique name
- Duplicate tag rejection (case-insensitive)
- Tag deletion cascades to flashcard_tags
- Usage count calculation
- Autocomplete search

**Search:**
- Full-text search with 3+ chars
- Case-insensitive matching
- Search in question and answer
- Combined with tag filter

### 5.5 Monitoring and Observability

**Metrics to Track:**
- API response times (p50, p95, p99)
- Error rates by endpoint
- AI generation success/failure rate
- Daily active users
- Flashcards created per day (AI vs manual)
- Acceptance rate trend
- SRS review completion rate

**Logging:**
- Log all API requests (method, path, user_id, status, duration)
- Log AI generation attempts and outcomes
- Log authentication failures
- Log rate limit violations
- Use structured logging (JSON format)

**Alerting:**
- Alert on high error rate (>5% for 5 minutes)
- Alert on AI API failures
- Alert on database connection issues
- Alert on rate limit abuse

### 5.6 Future Enhancements

**API Versioning:**
- When breaking changes needed, version API (e.g., /api/v2/)
- Maintain backward compatibility for at least one version
- Document deprecation timeline

**Webhooks:**
- Allow users to subscribe to events (flashcard created, review completed)
- Useful for integrations with other tools

**Batch Operations:**
- Bulk update flashcards
- Bulk tag assignment/removal
- Import/export flashcards

**Advanced Search:**
- Implement pg_trgm for fuzzy search
- Add filters: date range, SRS difficulty, review history
- Saved searches

**Analytics API:**
- Detailed learning analytics
- Progress over time
- Retention curves
- Tag-based performance

**Collaboration:**
- Share flashcard sets with other users
- Public/private flashcard collections
- Collaborative editing

---

## 6. API Client Examples

### 6.1 Authentication

```typescript
// Login via Supabase Auth (handled by Supabase SDK)
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github'
});

// Get current session
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Use token in API requests
const response = await fetch('/api/flashcards', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 6.2 Complete AI Generation Workflow

```typescript
// Step 1: Generate flashcards from text (creates drafts with source='generated')
const generateResponse = await fetch('/api/ai-generation', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    source_text: 'React hooks are functions that let you use state and other React features without writing a class. The most commonly used hooks are useState and useEffect.',
    acknowledged_data_warning: true
  })
});

const generateData = await generateResponse.json();
// generateData.session contains session info
// generateData.flashcards contains generated draft cards (all with source='generated')
// generateData.daily_limit shows remaining AI generations (e.g., used: 5, remaining: 45)

// Step 2: Review drafts and activate selected ones
const draftIds = generateData.flashcards
  .filter(card => /* user selected */)
  .map(card => card.id);

const activateResponse = await fetch('/api/flashcards/bulk-activate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    flashcard_ids: draftIds
  })
});

const activateData = await activateResponse.json();
// activateData.activated contains successfully activated cards
// activateData.summary shows succeeded/failed counts
// Acceptance metrics are automatically updated

// Step 3: Reject unwanted drafts
const rejectIds = generateData.flashcards
  .filter(card => /* user rejected */)
  .map(card => card.id);

const rejectResponse = await fetch('/api/flashcards/bulk-reject', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    flashcard_ids: rejectIds
  })
});

// Acceptance metrics are automatically updated
```

### 6.3 Create Manual Flashcards

```typescript
// Example 1: Create single flashcard as draft
const singleResponse = await fetch('/api/flashcards', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    flashcards: [
      {
        question: 'What is the purpose of useState hook?',
        answer: 'useState is a Hook that lets you add state to function components.',
        tag_ids: ['tag-uuid-1', 'tag-uuid-2']
      }
    ]
  })
});

const singleData = await singleResponse.json();
// singleData.created[0].source === 'manual'
// singleData.created[0].status === 'draft'
// singleData.summary.succeeded === 1
// Does NOT count towards daily AI limit
// Does NOT count in acceptance metrics

// Example 2: Create multiple flashcards at once
const batchResponse = await fetch('/api/flashcards', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    flashcards: [
      {
        question: 'What is useState?',
        answer: 'A Hook for adding state to function components.',
        tag_ids: ['react-uuid'],
        auto_activate: false // create as draft
      },
      {
        question: 'What is useEffect?',
        answer: 'A Hook for performing side effects in function components.',
        tag_ids: ['react-uuid'],
        auto_activate: true // immediately activate
      },
      {
        question: 'What is useContext?',
        answer: 'A Hook for consuming context values.',
        tag_ids: ['react-uuid', 'hooks-uuid']
      }
    ]
  })
});

const batchData = await batchResponse.json();
// batchData.created contains all successfully created cards
// batchData.created[0].status === 'draft'
// batchData.created[1].status === 'active' (auto-activated)
// batchData.created[1].srs_state is initialized
// batchData.created[2].status === 'draft'
// batchData.summary.total === 3
// batchData.summary.succeeded === 3
// batchData.summary.failed === 0

// Example 3: Partial success (some cards fail validation)
const partialResponse = await fetch('/api/flashcards', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    flashcards: [
      {
        question: 'Valid question',
        answer: 'Valid answer'
      },
      {
        question: 'This question is way too long and exceeds the maximum allowed length of 100 characters which will cause validation to fail',
        answer: 'Valid answer'
      },
      {
        question: 'Another valid question',
        answer: 'Another valid answer'
      }
    ]
  })
});

const partialData = await partialResponse.json();
// partialData.created contains 2 successfully created cards (index 0 and 2)
// partialData.failed contains 1 failed card:
// [
//   {
//     index: 1,
//     question: 'This question is way too long...',
//     error: 'validation_error',
//     message: 'Question exceeds maximum length of 100 characters'
//   }
// ]
// partialData.summary.total === 3
// partialData.summary.succeeded === 2
// partialData.summary.failed === 1

// Example 4: Import flashcards from external source
const importData = [
  { front: 'Q1', back: 'A1' },
  { front: 'Q2', back: 'A2' },
  // ... more cards from import
];

const importResponse = await fetch('/api/flashcards', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    flashcards: importData.map(card => ({
      question: card.front,
      answer: card.back,
      auto_activate: true // activate all imported cards
    }))
  })
});

const importResult = await importResponse.json();
// All imported cards are created and activated
// importResult.created contains all successfully imported cards
// importResult.failed contains any cards that failed validation
```

### 6.4 List Flashcards with Search

```typescript
const params = new URLSearchParams({
  status: 'active',
  search: 'react',
  limit: '20'
});

const response = await fetch(`/api/flashcards?${params}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
// data.data contains flashcards
// data.pagination.next_cursor for next page
```

### 6.5 Activate Draft Flashcard

```typescript
const response = await fetch(`/api/flashcards/${flashcardId}/activate`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    initial_due_at: new Date().toISOString()
  })
});

const data = await response.json();
// data.status === 'active'
// data.srs_state contains initial SRS parameters
```

### 6.6 Submit SRS Review

```typescript
const response = await fetch('/api/srs/reviews', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    flashcard_id: 'uuid',
    grade: 3 // 1=again, 2=hard, 3=good, 4=easy
  })
});

const data = await response.json();
// data.srs_state contains updated SRS parameters
// data.next_review_in_days shows when card is due again
```

### 6.7 Create Tag with Autocomplete

```typescript
// Autocomplete search
const searchParams = new URLSearchParams({
  search: 'reac',
  limit: '10'
});

const searchResponse = await fetch(`/api/tags?${searchParams}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const suggestions = await searchResponse.json();

// Create new tag if not found
const createResponse = await fetch('/api/tags', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'React Hooks'
  })
});

const newTag = await createResponse.json();
```

### 6.8 Get Due Cards for SRS Session

```typescript
const response = await fetch('/api/srs/due?limit=30', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
// data.data contains up to 30 due flashcards
// data.session_info.total_due shows total cards due
```

### 6.9 Bulk Operations

```typescript
// Bulk activate drafts
const response = await fetch('/api/flashcards/bulk-activate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    flashcard_ids: ['uuid1', 'uuid2', 'uuid3']
  })
});

const result = await response.json();
// result.summary shows succeeded/failed counts
// result.activated contains successful activations
// result.failed contains errors for failed activations
```

---

## 7. Appendix

### 7.1 Database Schema Reference

See `supabase/migrations/20260128015436_initial_schema.sql` for complete schema definition.

**Key Tables:**
- `profiles`: User profiles (1:1 with auth.users)
- `tags`: User-specific tags
- `starter_tags`: Global starter tags
- `flashcards`: Core flashcard storage
- `flashcard_tags`: Many-to-many junction table
- `ai_generation_sessions`: AI generation tracking
- `srs_state`: SRS algorithm state per card
- `srs_reviews`: Review history
- `acceptance_metrics`: Global metrics (single row)

### 7.2 Flashcard Source Types Comparison

| Aspect                    | AI-Generated (`source='generated'`)         | Manual (`source='manual'`)                    |
| ------------------------- | ------------------------------------------- | --------------------------------------------- |
| **Creation Endpoint**     | `POST /api/ai-generation`                   | `POST /api/flashcards`                        |
| **Batch Creation**        | Yes (multiple cards per request)            | No (one card per request)                     |
| **Initial Status**        | Always `draft`                              | `draft` (or `active` if `auto_activate=true`) |
| **Daily Limit**           | Yes (50 cards/day)                          | No limit                                      |
| **Counts Towards Limit**  | On creation                                 | Never                                         |
| **Acceptance Metrics**    | Yes (tracked when activated/rejected)       | No (never tracked)                            |
| **generation_session_id** | Set (links to AI session)                   | Always `null`                                 |
| **source Field**          | `'generated'` (immutable)                   | `'manual'` (immutable)                        |
| **Typical Use Case**      | Bulk import from text/documentation         | Individual card creation                      |
| **User Workflow**         | Generate → Review → Activate/Reject         | Create → Optionally activate                  |
| **counted_in_metrics**    | Set to `true` when first activated/rejected | Always `false`                                |

**Important Notes:**
- Both types follow the same workflow after creation (edit, activate, reject, SRS)
- The `source` field is **immutable** after creation (enforced by database trigger)
- Only difference is in creation method and whether they count towards limits/metrics

### 7.3 Enum Types

**flashcard_status:**
- `draft`: Newly created, not yet reviewed
- `active`: Approved, visible in SRS
- `rejected`: Dismissed, excluded from SRS

**flashcard_source:**
- `generated`: Created by AI via `POST /api/ai-generation`
- `manual`: Created by user via `POST /api/flashcards`

**ai_generation_status:**
- `created`: Session initialized
- `processing`: AI generating
- `completed`: Generation successful
- `failed`: Generation error

### 7.4 Rate Limits

**AI Generation:**
- 50 cards per user per day (00:00-23:59 UTC)
- Resets at midnight UTC

**API Requests (Recommended):**
- 100 requests per minute per user
- 1000 requests per hour per user
- Burst allowance: 20 requests

**SRS Reviews:**
- No explicit rate limit
- Natural limit: 30 cards per session
- 24-hour minimum between reviews of same card

### 7.5 Glossary

**SRS:** Spaced Repetition System - algorithm for optimal review scheduling

**Draft:** Flashcard status indicating card is not yet approved for learning

**Active:** Flashcard status indicating card is approved and included in SRS

**Rejected:** Flashcard status indicating card was dismissed by user

**Ease Factor:** SRS parameter controlling interval growth rate

**Interval:** Days until next review

**Lapse:** When user fails to recall a card (grade 1)

**Cursor:** Pagination token encoding position in result set

**RLS:** Row Level Security - PostgreSQL feature for data isolation

**JWT:** JSON Web Token - authentication token format

**OAuth:** Open Authorization - delegated authentication protocol

**Markdown:** Lightweight markup language for formatting

**OpenRouter:** API gateway for accessing multiple LLM providers
