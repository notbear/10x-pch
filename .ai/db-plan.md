# FlashcardsAI — plan schematu bazy danych (PostgreSQL / Supabase)

## 1. Lista tabel z ich kolumnami, typami danych i ograniczeniami

### Rozszerzenia / typy pomocnicze
- **Wymagane rozszerzenia**:
  - `pgcrypto` (dla `gen_random_uuid()`)
- **Typy ENUM**:
  - `flashcard_status`: `draft`, `active`, `rejected`
  - `flashcard_source`: `generated`, `manual`
  - `ai_generation_status`: `created`, `processing`, `completed`, `failed`

---

### `public.profiles`
1:1 z `auth.users` (Supabase Auth). Punkt odniesienia dla `user_id` w tabelach domenowych.

- **`id`**: `uuid` PRIMARY KEY, FK → `auth.users(id)` ON DELETE CASCADE
- **`created_at`**: `timestamptz` NOT NULL DEFAULT `now()`
- **`updated_at`**: `timestamptz` NOT NULL DEFAULT `now()`
- **(opcjonalnie)** `display_name`: `text` NULL

Ograniczenia:
- `id` jest jednocześnie PK i FK do `auth.users`.

---

### `public.starter_tags`
Globalna lista „tagów startowych” (kopiowanych do `tags` przy tworzeniu użytkownika).

- **`id`**: `bigint` GENERATED ALWAYS AS IDENTITY PRIMARY KEY
- **`name`**: `text` NOT NULL
- **`name_normalized`**: `text` GENERATED ALWAYS AS (`lower(regexp_replace(trim(name), '\s+', ' ', 'g'))`) STORED
- **`sort_order`**: `int` NOT NULL DEFAULT 0
- **`created_at`**: `timestamptz` NOT NULL DEFAULT `now()`

Ograniczenia:
- CHECK: `char_length(trim(name)) > 0`
- UNIQUE: (`name_normalized`)

---

### `public.tags`
Tagi per użytkownik (unikalne case-insensitive + z normalizacją spacji).

- **`id`**: `uuid` PRIMARY KEY DEFAULT `gen_random_uuid()`
- **`user_id`**: `uuid` NOT NULL, FK → `public.profiles(id)` ON DELETE CASCADE
- **`name`**: `text` NOT NULL
- **`name_normalized`**: `text` GENERATED ALWAYS AS (`lower(regexp_replace(trim(name), '\s+', ' ', 'g'))`) STORED
- **`created_at`**: `timestamptz` NOT NULL DEFAULT `now()`
- **`updated_at`**: `timestamptz` NOT NULL DEFAULT `now()`

Ograniczenia:
- CHECK: `char_length(trim(name)) > 0`
- UNIQUE: (`user_id`, `name_normalized`)

Uwagi:
- W MVP nie trzymamy `usage_count`; popularność/usage jest liczona dynamicznie z `flashcard_tags`.

---

### `public.ai_generation_sessions`
Sesje generowania AI (logi + przechowywany `source_text` bez retencji/deduplikacji w MVP).

- **`id`**: `uuid` PRIMARY KEY DEFAULT `gen_random_uuid()`
- **`user_id`**: `uuid` NOT NULL, FK → `public.profiles(id)` ON DELETE CASCADE
- **`status`**: `ai_generation_status` NOT NULL DEFAULT `created`
- **`source_text`**: `text` NOT NULL
- **`source_text_chars`**: `int` GENERATED ALWAYS AS (`char_length(source_text)`) STORED
- **`requested_card_count`**: `int` NULL
- **`generated_card_count`**: `int` NULL
- **`error_message`**: `text` NULL
- **`created_at`**: `timestamptz` NOT NULL DEFAULT `now()`
- **`updated_at`**: `timestamptz` NOT NULL DEFAULT `now()`
- **`completed_at`**: `timestamptz` NULL

Ograniczenia:
- CHECK (opcjonalnie na etapie migracji): `source_text_chars BETWEEN 300 AND 10000` (zgodnie z PRD; można też walidować w API).

---

### `public.flashcards`
Jedna tabela fiszek (MVP), z polami `status`, `source` i powiązaniem z sesją generowania.

- **`id`**: `uuid` PRIMARY KEY DEFAULT `gen_random_uuid()`
- **`user_id`**: `uuid` NOT NULL, FK → `public.profiles(id)` ON DELETE CASCADE
- **`question`**: `text` NOT NULL
- **`answer`**: `text` NOT NULL
- **`status`**: `flashcard_status` NOT NULL DEFAULT `draft`
- **`source`**: `flashcard_source` NOT NULL DEFAULT `manual`
- **`generation_session_id`**: `uuid` NULL, FK → `public.ai_generation_sessions(id)` ON DELETE SET NULL
- **`first_activated_at`**: `timestamptz` NULL
- **`counted_in_metrics`**: `boolean` NOT NULL DEFAULT `false`
- **`created_at`**: `timestamptz` NOT NULL DEFAULT `now()`
- **`updated_at`**: `timestamptz` NOT NULL DEFAULT `now()`

Ograniczenia:
- CHECK: `char_length(question) <= 100`
- CHECK: `char_length(answer) <= 300`
- CHECK (spójność source/session): `generation_session_id IS NULL OR source = 'generated'`
- **Niezmienność `source`**: egzekwowana triggerem (patrz „Uwagi”).
- **Pierwsza aktywacja tylko raz**: `first_activated_at` ustawiane tylko raz (trigger).

Uwagi:
- Każda nowa fiszka startuje jako `draft`.
- Fiszki manualne domyślnie mają `source='manual'`.
- SRS widzi tylko `status='active'`.

---

### `public.flashcard_tags`
Tabela łącząca many-to-many: fiszki ↔ tagi. Tagowanie draftów jest dozwolone.

- **`flashcard_id`**: `uuid` NOT NULL, FK → `public.flashcards(id)` ON DELETE CASCADE
- **`tag_id`**: `uuid` NOT NULL, FK → `public.tags(id)` ON DELETE CASCADE
- **`created_at`**: `timestamptz` NOT NULL DEFAULT `now()`

Ograniczenia:
- PRIMARY KEY: (`flashcard_id`, `tag_id`)

Uwagi:
- Spójność „ten sam użytkownik” jest wymuszana przez RLS (i opcjonalnie można dodać trigger walidujący, że `flashcards.user_id == tags.user_id`).

---

### `public.srs_state`
Stan SRS per fiszka (1:1). Dokładny zestaw pól może być dostosowany do wybranej biblioteki SRS.

- **`flashcard_id`**: `uuid` PRIMARY KEY, FK → `public.flashcards(id)` ON DELETE CASCADE
- **`due_at`**: `timestamptz` NOT NULL
- **`interval_days`**: `int` NOT NULL DEFAULT 1
- **`ease_factor`**: `real` NOT NULL DEFAULT 2.5
- **`repetitions`**: `int` NOT NULL DEFAULT 0
- **`lapses`**: `int` NOT NULL DEFAULT 0
- **`last_reviewed_at`**: `timestamptz` NULL
- **`created_at`**: `timestamptz` NOT NULL DEFAULT `now()`
- **`updated_at`**: `timestamptz` NOT NULL DEFAULT `now()`

Ograniczenia:
- CHECK: `interval_days >= 0`
- CHECK: `ease_factor >= 1.0`

---

### `public.srs_reviews`
Historia ocen w SRS (1:N per fiszka). Skala oceny 1–4 (zgodnie z PRD).

- **`id`**: `bigint` GENERATED ALWAYS AS IDENTITY PRIMARY KEY
- **`flashcard_id`**: `uuid` NOT NULL, FK → `public.flashcards(id)` ON DELETE CASCADE
- **`reviewed_at`**: `timestamptz` NOT NULL DEFAULT `now()`
- **`grade`**: `smallint` NOT NULL  -- 1..4
- **`due_before_review`**: `timestamptz` NULL
- **`due_after_review`**: `timestamptz` NULL
- **`created_at`**: `timestamptz` NOT NULL DEFAULT `now()`

Ograniczenia:
- CHECK: `grade BETWEEN 1 AND 4`

---

### `public.acceptance_metrics`
Globalne metryki akceptacji (przelicza backend na service role). Brak historii zmian statusu w MVP.

- **`id`**: `smallint` PRIMARY KEY DEFAULT 1  -- pojedynczy rekord
- **`generated_total`**: `bigint` NOT NULL DEFAULT 0
- **`generated_activated_total`**: `bigint` NOT NULL DEFAULT 0
- **`generated_rejected_total`**: `bigint` NOT NULL DEFAULT 0
- **`last_recalculated_at`**: `timestamptz` NOT NULL DEFAULT `now()`

Ograniczenia:
- CHECK: `id = 1`

Uwagi:
- `generated_activated_total` powinno liczyć każdą fiszkę `source='generated'` tylko raz (w oparciu o `counted_in_metrics=true` oraz `first_activated_at`).

---

## 2. Relacje między tabelami

- **`auth.users` 1—1 `public.profiles`**
  - `profiles.id` → `auth.users.id` (ON DELETE CASCADE)

- **`public.profiles` 1—N `public.tags`**
  - `tags.user_id` → `profiles.id`

- **`public.profiles` 1—N `public.flashcards`**
  - `flashcards.user_id` → `profiles.id`

- **`public.profiles` 1—N `public.ai_generation_sessions`**
  - `ai_generation_sessions.user_id` → `profiles.id`

- **`public.ai_generation_sessions` 1—N `public.flashcards`**
  - `flashcards.generation_session_id` → `ai_generation_sessions.id` (ON DELETE SET NULL)

- **`public.flashcards` N—M `public.tags`** przez **`public.flashcard_tags`**
  - `flashcard_tags.flashcard_id` → `flashcards.id`
  - `flashcard_tags.tag_id` → `tags.id`

- **`public.flashcards` 1—1 `public.srs_state`**
  - `srs_state.flashcard_id` → `flashcards.id`

- **`public.flashcards` 1—N `public.srs_reviews`**
  - `srs_reviews.flashcard_id` → `flashcards.id`

---

## 3. Indeksy

### Indeksy wspierające listy i paginację (cursor-based)
- `flashcards_user_status_updated_idx`:
  - BTREE (`user_id`, `status`, `updated_at` DESC, `id` DESC)

### Indeksy wspierające limit dzienny AI (COUNT per użytkownik, 00:00–00:00 UTC)
- `flashcards_user_source_created_idx`:
  - BTREE (`user_id`, `source`, `created_at`)
- (opcjonalnie) częściowy indeks dla generated:
  - BTREE (`user_id`, `created_at`) WHERE `source = 'generated'`

### Indeksy wspierające powiązania i operacje masowe
- `flashcard_tags_tag_id_idx`: BTREE (`tag_id`)
- `flashcard_tags_flashcard_id_idx`: BTREE (`flashcard_id`)  *(technicznie PK już to zapewnia, ale osobny indeks bywa zbędny — do oceny w migracji)*

### Indeksy dla sesji generowania i wglądu w drafty
- `ai_sessions_user_created_idx`: BTREE (`user_id`, `created_at` DESC)
- `flashcards_generation_session_idx`: BTREE (`generation_session_id`)

### Indeksy dla tagów (unikalność i autouzupełnianie)
- `tags_user_name_normalized_uq`: UNIQUE (`user_id`, `name_normalized`)
- `tags_user_created_idx`: BTREE (`user_id`, `created_at` DESC)

### Indeksy dla SRS (dobór kart „due”)
- `srs_state_due_at_idx`: BTREE (`due_at`)
- `srs_reviews_flashcard_reviewed_idx`: BTREE (`flashcard_id`, `reviewed_at` DESC)

### Wyszukiwanie MVP (LIKE / ILIKE)
- MVP: filtrowanie po `user_id` + `status` + sort po `updated_at` wspiera indeks `flashcards_user_status_updated_idx`.
- (opcjonalnie, przyszłość) `pg_trgm` + GIN na `question` i `answer` dla szybkiego `ILIKE '%...%'`:
  - GIN (`question` gin_trgm_ops)
  - GIN (`answer` gin_trgm_ops)

---

## 4. Zasady PostgreSQL (RLS)

> Wszystkie tabele domenowe mają izolację per użytkownik przez RLS (w oparciu o `auth.uid()`), zgodnie z Supabase.

### `public.profiles`
- **RLS**: ENABLED
- **SELECT**: dozwolone gdy `id = auth.uid()`
- **UPDATE**: dozwolone gdy `id = auth.uid()`
- **INSERT/DELETE**: zwykle przez backend/trigger (standardowy flow Supabase: trigger po `auth.users`).

### `public.tags`
- **RLS**: ENABLED
- **SELECT/INSERT/UPDATE/DELETE**: dozwolone gdy `user_id = auth.uid()`

### `public.ai_generation_sessions`
- **RLS**: ENABLED
- **SELECT/INSERT/UPDATE/DELETE**: dozwolone gdy `user_id = auth.uid()`

### `public.flashcards`
- **RLS**: ENABLED
- **SELECT/INSERT/UPDATE/DELETE**: dozwolone gdy `user_id = auth.uid()`

### `public.flashcard_tags`
- **RLS**: ENABLED
- **SELECT**: dozwolone gdy istnieje powiązana fiszka użytkownika:
  - `EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = flashcard_tags.flashcard_id AND f.user_id = auth.uid())`
- **INSERT/DELETE**: dozwolone gdy:
  - fiszka należy do użytkownika oraz tag należy do użytkownika (dodatkowy warunek):
  - `EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = flashcard_id AND f.user_id = auth.uid())`
  - `AND EXISTS (SELECT 1 FROM public.tags t WHERE t.id = tag_id AND t.user_id = auth.uid())`
- **UPDATE**: zwykle zbędne (łączenia nie edytujemy), można wyłączyć.

### `public.srs_state`
- **RLS**: ENABLED
- **SELECT/INSERT/UPDATE/DELETE**: dozwolone gdy powiązana fiszka należy do użytkownika:
  - `EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = srs_state.flashcard_id AND f.user_id = auth.uid())`

### `public.srs_reviews`
- **RLS**: ENABLED
- **SELECT/INSERT**: dozwolone gdy powiązana fiszka należy do użytkownika (jak wyżej)
- **UPDATE/DELETE**: opcjonalnie zabronione w MVP (historia powtórek jako append-only).

### `public.starter_tags`
- **RLS**: ENABLED (zalecane)
- **SELECT**: dozwolone dla wszystkich zalogowanych (`auth.role() = 'authenticated'`) lub publiczne tylko dla backendu (wg potrzeb UI).
- **INSERT/UPDATE/DELETE**: tylko service role (brak polityk dla `authenticated`).

### `public.acceptance_metrics`
- **RLS**: ENABLED
- **SELECT**: dozwolone dla wszystkich zalogowanych (UI odczyt metryk) *albo* tylko backend (jeśli UI nie potrzebuje).
- **INSERT/UPDATE/DELETE**: tylko service role (brak polityk dla `authenticated`).

---

## 5. Dodatkowe uwagi / decyzje projektowe

- **Automatyczne `updated_at`**: zalecany trigger `set_updated_at` dla tabel z kolumną `updated_at` (`profiles`, `tags`, `ai_generation_sessions`, `flashcards`, `srs_state`).
- **Tworzenie profilu + kopiowanie starter tagów**:
  - Standard Supabase: trigger na `auth.users` tworzy rekord w `public.profiles`.
  - Następnie (w tej samej funkcji lub osobnej) kopiowanie `starter_tags` → `tags` dla nowego `user_id`.
- **Niezmienność `flashcards.source`**: trigger blokujący zmianę `source` po INSERT (w MVP: `RAISE EXCEPTION` przy próbie UPDATE `source`).
- **`first_activated_at` tylko raz**:
  - trigger: jeśli `OLD.first_activated_at IS NOT NULL` i `NEW.first_activated_at != OLD.first_activated_at` → blokuj.
  - ustawienie `first_activated_at` wykonywać przy przejściu `status` na `active` (backend).
- **Metryki akceptacji**:
  - do statystyk liczymy kartę tylko raz: `source='generated'` i pierwsza aktywacja.
  - backend/service role ustawia `counted_in_metrics=true` i aktualizuje `acceptance_metrics`.
- **Wyszukiwanie MVP**:
  - `ILIKE` po `question` i `answer`, filtrowanie po `user_id` i `status IN ('draft','active')`.
  - filtr po tagach jako osobny warunek (JOIN przez `flashcard_tags`).
- **Usuwanie danych użytkownika**:
  - ON DELETE CASCADE z `profiles` usuwa wszystkie dane domenowe w MVP (akceptowalne wg notatek).
