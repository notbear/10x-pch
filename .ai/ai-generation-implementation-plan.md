# Plan wdrożenia API: POST /api/ai-generation

## 1. Przegląd punktu końcowego

Endpoint `POST /api/ai-generation` generuje fiszki z dostarczonego tekstu źródłowego przy użyciu AI (OpenRouter). Operacja jest synchroniczna: tworzy sesję generowania, wywołuje model LLM, zapisuje fiszki w bazie i zwraca je jako drafty. Użytkownik musi potwierdzić ostrzeżenie o danych wrażliwych (NDA). Obowiązuje limit dzienny: maksymalnie 50 fiszek AI na użytkownika w przedziale 00:00–23:59 UTC.

**Cel:** Umożliwienie użytkownikom masowego tworzenia fiszek z długiego tekstu (np. dokumentacji, notatek) bez ręcznego przepisywania.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** POST
- **Struktura URL:** `/api/ai-generation`
- **Parametry:**
  - **Wymagane:**
    - `source_text` (string): tekst źródłowy, 300–10000 znaków
    - `acknowledged_data_warning` (boolean): musi być `true` (potwierdzenie ostrzeżenia NDA)
  - **Opcjonalne:**
    - `requested_card_count` (number | null): sugerowana liczba fiszek; `null` = auto
- **Request Body:**
```json
{
  "source_text": "string (300-10000 chars)",
  "requested_card_count": "number | null (optional)",
  "acknowledged_data_warning": true
}
```
- **Nagłówki:**
  - `Authorization: Bearer <jwt_token>` (wymagane)
  - `Content-Type: application/json`

---

## 3. Wykorzystywane typy

### Command (wejście)
- **`GenerateFlashcardsCommand`** (już w `src/types.ts`):
  - `source_text`: string
  - `requested_card_count?`: number | null
  - `acknowledged_data_warning`: boolean

### DTO (wyjście)
- **`GenerateFlashcardsResponse`** (już w `src/types.ts`):
  - `session`: Pick<GenerationSessionRow, id | status | source_text | source_text_chars | requested_card_count | generated_card_count | created_at | completed_at>
  - `flashcards`: GeneratedFlashcardDTO[]
  - `daily_limit`: DailyLimitDTO

- **`GeneratedFlashcardDTO`**:
  - `id`, `question`, `answer`, `status`, `source`, `generation_session_id`, `created_at`
  - `suggested_tags`: string[]

- **`DailyLimitDTO`**:
  - `used`, `total`, `remaining`

### Schemat Zod (walidacja)
Nowy schemat w pliku walidacji (np. `src/lib/validation/ai-generation.schema.ts`):
```typescript
// generateFlashcardsRequestSchema
// - source_text: z.string().min(300).max(10000)
// - requested_card_count: z.number().int().positive().max(100).optional().nullable()
// - acknowledged_data_warning: z.literal(true)
```

---

## 4. Szczegóły odpowiedzi

### 201 Created (sukces)
```json
{
  "session": {
    "id": "uuid",
    "status": "completed",
    "source_text": "string",
    "source_text_chars": number,
    "requested_card_count": number | null,
    "generated_card_count": number,
    "created_at": "ISO8601",
    "completed_at": "ISO8601"
  },
  "flashcards": [
    {
      "id": "uuid",
      "question": "string",
      "answer": "string",
      "status": "draft",
      "source": "generated",
      "generation_session_id": "uuid",
      "suggested_tags": ["string"],
      "created_at": "ISO8601"
    }
  ],
  "daily_limit": {
    "used": number,
    "total": 50,
    "remaining": number
  }
}
```

### Kody błędów
| Kod | Typ błędu           | Opis                                                                   |
| --- | ------------------- | ---------------------------------------------------------------------- |
| 400 | validation_error    | Nieprawidłowa długość source_text lub acknowledged_data_warning ≠ true |
| 401 | unauthorized        | Brak lub nieprawidłowy token JWT                                       |
| 429 | rate_limit_exceeded | Przekroczony limit dzienny (50 fiszek)                                 |
| 500 | generation_failed   | Błąd AI / OpenRouter; sesja zapisana ze statusem `failed`              |

---

## 5. Przepływ danych

```
[Klient] --POST /api/ai-generation--> [Astro API Route]
                                            |
                                            v
                                    [Middleware: locals.supabase]
                                            |
                                            v
                                    [1. Walidacja JWT → user_id]
                                            |
                                            v
                                    [2. Walidacja body (Zod)]
                                            |
                                            v
                                    [3. Sprawdzenie limit dzienny]
                                            |
                                            v
                                    [4. aiGenerationService.generate()]
                                            |
                    +-----------------------+-----------------------+
                    |                       |                       |
                    v                       v                       v
            [INSERT ai_generation_sessions]  [OpenRouter API]  [INSERT flashcards]
                    |                       |                       |
                    |                       v                       |
                    |               [Parsowanie odpowiedzi]          |
                    |               [Walidacja Q/A <= 100/300]     |
                    |                       |                       |
                    +-----------------------+-----------------------+
                                            |
                                            v
                                    [UPDATE ai_generation_sessions
                                     status=completed, generated_card_count,
                                     completed_at]
                                            |
                                            v
                                    [Zwrot 201 + response]
```

### Interakcje z bazą
1. **Odczyt:** liczba fiszek `source='generated'` dla `user_id` z `created_at >= dziś 00:00 UTC` (indeks `flashcards_user_created_generated_idx`).
2. **Zapis:** INSERT `ai_generation_sessions` (status `processing`), INSERT `flashcards`, INSERT `tags` (jeśli brak), INSERT `flashcard_tags`, UPDATE `ai_generation_sessions` (status `completed`/`failed`).

### Interakcje zewnętrzne
- **OpenRouter API:** POST do endpointu chat/completions z promptem generującym fiszki. Klucz API w zmiennej środowiskowej. Timeout 30 s, retry z exponential backoff.

---

## 6. Względy bezpieczeństwa

### Uwierzytelnianie
- JWT z nagłówka `Authorization: Bearer <token>`.
- Użycie `context.locals.supabase.auth.getUser()` z tokenem z requestu (lub przekazanie tokena do Supabase client).
- Brak tokena lub nieprawidłowy token → **401 Unauthorized**.

### Autoryzacja
- Wszystkie operacje DB przez RLS (`user_id = auth.uid()`).
- `user_id` pochodzi wyłącznie z JWT, nigdy z body.

### Walidacja danych
- `source_text`: 300–10000 znaków (Zod + DB CHECK).
- `acknowledged_data_warning`: musi być `true`.
- `requested_card_count`: opcjonalne, int dodatnie, max 100.
- Parsowane fiszki z AI: `question` ≤ 100, `answer` ≤ 300 (przycinanie lub odrzucenie).

### Ochrona danych
- Nie logować `source_text`, tokenów, haseł.
- Komunikacja tylko przez HTTPS.
- Klucz OpenRouter wyłącznie po stronie serwera (zmienne środowiskowe).

### Rate limiting
- Limit dzienny: 50 fiszek AI na użytkownika (00:00–23:59 UTC).
- Przekroczenie → **429 Too Many Requests** z `reset_at` (następna północ UTC).

---

## 7. Obsługa błędów

| Scenariusz                       | Kod | Body                                                                                   | Akcja                                                |
| -------------------------------- | --- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Brak/invalid JWT                 | 401 | `{ error: "unauthorized", message: "Authentication required" }`                        | Brak zapisu                                          |
| source_text poza zakresem        | 400 | `{ error: "validation_error", message: "...", details: { field, current_length } }`    | Brak zapisu                                          |
| acknowledged_data_warning ≠ true | 400 | `{ error: "validation_error", message: "..." }`                                        | Brak zapisu                                          |
| Limit dzienny przekroczony       | 429 | `{ error: "rate_limit_exceeded", message: "...", details: { used, total, reset_at } }` | Brak zapisu                                          |
| Błąd OpenRouter / parsowania     | 500 | `{ error: "generation_failed", message: "...", session_id }`                           | Sesja zapisana ze statusem `failed`, `error_message` |
| Błąd DB (np. constraint)         | 500 | `{ error: "internal_error", message: "..." }`                                          | Rollback, logowanie                                  |

### Logowanie błędów
- Brak dedykowanej tabeli `api_errors` w MVP.
- Błędy logowane po stronie serwera (np. `console.error` w formacie JSON).
- Przy błędzie AI: zapis `error_message` w `ai_generation_sessions`.
- Nie ujawniać wewnętrznych szczegółów w odpowiedzi 500.

---

## 8. Rozważania dotyczące wydajności

- **Timeout OpenRouter:** 30 s (zgodnie z api-plan).
- **Indeksy:** `flashcards_user_created_generated_idx` dla liczenia limit dzienny.
- **Transakcja:** Sesja + fiszki + tagi w jednej transakcji DB (all-or-nothing przy sukcesie).
- **Retry:** Exponential backoff dla OpenRouter (np. 1–2 retry).
- **Rozmiar payloadu:** Ograniczenie `source_text` do 10000 znaków ogranicza koszt wywołania LLM.

---

## 9. Etapy wdrożenia

### Krok 1: Walidacja i helpery auth
1. Utworzyć `src/lib/validation/ai-generation.schema.ts` ze schematem Zod dla body.
2. Utworzyć helper `src/lib/auth.ts` do wyciągania `user_id` z requestu (np. `getAuthenticatedUser(request)` używający `supabase.auth.getUser()` z tokenem z nagłówka).

### Krok 2: Serwis OpenRouter
1. Utworzyć `src/lib/services/openrouter.service.ts`.
2. Funkcja `generateFlashcardsFromText(sourceText: string, requestedCount?: number | null): Promise<{ question: string; answer: string; suggestedTags: string[] }[]>`.
3. Konfiguracja: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (np. z env).
4. Prompt: instrukcja zwracania JSON z tablicą fiszek (question, answer, suggested_tags).
5. Timeout 30 s, retry z exponential backoff.

### Krok 3: Serwis generowania AI
1. Utworzyć `src/lib/services/ai-generation.service.ts`.
2. Funkcja `generateFlashcards(userId: string, command: GenerateFlashcardsCommand): Promise<GenerateFlashcardsResponse>`.
3. Logika:
   - Sprawdzenie limit dzienny (COUNT z `flashcards` WHERE `user_id`, `source='generated'`, `created_at >= today UTC`).
   - INSERT sesji (status `processing`).
   - Wywołanie OpenRouter.
   - Parsowanie odpowiedzi, walidacja długości Q/A (przycinanie do 100/300 lub odrzucenie).
   - Dla każdej fiszki: INSERT `flashcards`, upsert tagów, INSERT `flashcard_tags`.
   - UPDATE sesji (status `completed`, `generated_card_count`, `completed_at`).
4. Obsługa błędów: przy wyjątku od OpenRouter → UPDATE sesji (status `failed`, `error_message`), rzucenie błędu dla 500.

### Krok 4: Endpoint Astro
1. Utworzyć `src/pages/api/ai-generation/index.ts` (lub `[...path].ts` jeśli routing inny).
2. `export const prerender = false`.
3. Handler `POST`:
   - Pobranie `user` przez auth helper → 401 jeśli brak.
   - Parsowanie body, walidacja Zod → 400 przy błędzie.
   - Sprawdzenie limit dzienny przed wywołaniem serwisu → 429.
   - Wywołanie `aiGenerationService.generate(user.id, parsedBody)`.
   - Zwrot 201 z `GenerateFlashcardsResponse`.
4. Try-catch: błędy serwisu → 500 z odpowiednim body.

### Krok 5: Integracja z Supabase
1. Upewnić się, że request przekazuje JWT do Supabase (np. `supabase.auth.getUser(token)` lub ustawienie sesji).
2. Użyć `context.locals.supabase` z middleware (backend rules).
3. Dla operacji DB używać klienta z `user_id` z JWT (RLS wymusi `auth.uid()`).

### Krok 6: Testy
1. Testy jednostkowe: walidacja Zod, logika limit dzienny.
2. Testy integracyjne: mock OpenRouter, pełny flow z testową bazą.
3. Testy E2E (opcjonalnie): wywołanie endpointu z tokenem.

### Krok 7: Dokumentacja i zmienne środowiskowe
1. Dodać do `.env.example`: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.
2. Zaktualizować README / dokumentację API o nowy endpoint.
