<conversation_summary>
<decisions>
Tagi są per użytkownik; tagi startowe są w osobnej tabeli i są kopiowane przy kreacji użytkownika.
Tagi ↔ fiszki: relacja many-to-many.
Fiszki są w jednej tabeli z polami: status = draft|active|rejected, source = generated|manual, oraz generation_session_id (uproszczone MVP).
Każda nowa fiszka startuje jako draft; nowa fiszka manualna ma domyślne source=manual.
Limit AI: 50 kart dziennie per użytkownik, liczony per wygenerowana karta (source=generated), w oknie 00:00–00:00 UTC; w MVP dopuszczalny jest prosty COUNT(*).
source_text sesji generowania jest przechowywany w MVP bez retencji i bez deduplikacji.
Metryki akceptacji są globalne; nie trzymamy historii zmian statusu.
Karta liczy się do metryk, jeśli source=generated i po raz pierwszy zmieniła status na active; aby liczyć tylko raz używamy flagi counted_in_metrics (domyślnie false).
Do wykrycia „pierwszej aktywacji” wystarczy pole first_activated_at ustawiane tylko raz.
Nauka (SRS) widzi tylko active.
source jest niezmienne.
Odrzucone (rejected) są zachowane w MVP; przywracanie statusu jest dopuszczalne, ale do statystyk liczymy tylko raz na fiszkę.
Tagi mogą być przypinane niezależnie od statusu fiszki (tagowanie draftów dozwolone).
Rezygnujemy z usage_count w tagach; popularność/usage jest wyliczalna z tabeli powiązań.
Wyszukiwanie w MVP: LIKE po question i answer, jedna ścieżka, filtrowanie po user_id i status (drafty i active).
Filtr po tagach jest osobnym filtrem (nie częścią wyszukiwania treści).
Paginacja list: cursor-based.
Cascade delete danych użytkownika jest akceptowalne w MVP.
Przeliczenie metryk i ustawianie counted_in_metrics wykonuje tylko backend na service role.
</decisions>
<matched_recommendations>
Tagi: unikalność per użytkownik case-insensitive przez indeks na (user_id, lower(name)) + normalizacja nazwy (trim/collapse spaces).
Many-to-many: tabela łącznikowa flashcard_tags z unikalnością (flashcard_id, tag_id) oraz indeksami po FK dla operacji masowych.
Jedna tabela flashcards z status i source oraz generation_session_id dla powiązania z sesją generowania AI.
Metryki „tylko raz”: pola first_activated_at + counted_in_metrics oraz logika ustawiania w procesie przeliczenia metryk (service role).
Wyszukiwanie LIKE: filtrowanie po (user_id, status) + indeks (user_id, status, updated_at) pod sort/paginację; opcjonalnie przyszły upgrade do pg_trgm.
Ranking tagów: liczony dynamicznie COUNT(*) po powiązaniach tylko dla status='active' (drafty nie wpływają).
RLS: wszystkie tabele domenowe mają user_id i polityki oparte o auth.uid(); metryki globalne i przeliczenia wykonuje backend na service role.
Paginacja: cursor-based po (updated_at desc, id desc) dla stabilności i wydajności.
</matched_recommendations>
<database_planning_summary>
Główne wymagania (DB):
Obsługa OAuth przez Supabase Auth i izolacja danych per użytkownik przez RLS.
Przechowywanie fiszek z Markdown/kodem: question (≤100 znaków), answer (≤300 znaków), status (draft|active|rejected), source (generated|manual).
Trwałe drafty do weryfikacji, operacje masowe (tagowanie, akceptacja/odrzucenie), edycja inline.
Sesje generowania AI z logami i przechowywanym source_text (bez retencji w MVP).
Limit AI 50/dzień UTC per użytkownik liczony per wygenerowana karta.
System tagów per użytkownik (w tym zasiew „starter tags” przy tworzeniu konta).
SRS: nauka tylko na active, z persystencją stanu/historii powtórek (zgodnie z „ok” dla zaproponowanego modelu).
Wyszukiwanie MVP: LIKE po question/answer dla draft i active, plus osobny filtr po tagach.
Paginacja cursor-based.
Kluczowe encje i relacje (proponowany kierunek schematu):
profiles (1:1 z auth.users, cascade delete) jako punkt odniesienia dla user_id.
starter_tags (globalne) → kopiowane do tags przy kreacji użytkownika.
tags (N) należą do użytkownika: tags.user_id -> profiles.id.
flashcards (N) należą do użytkownika: flashcards.user_id -> profiles.id; pola: status, source, generation_session_id, first_activated_at, counted_in_metrics, created_at, updated_at (opcjonalnie deleted_at).
flashcard_tags jako łącznik many-to-many: flashcard_id -> flashcards.id, tag_id -> tags.id, unikalność pary.
ai_generation_sessions (N) należą do użytkownika: przechowuje source_text, czasy/status generowania; relacja 1:N do flashcards przez generation_session_id.
srs_state (1:1 per fiszka) + srs_reviews (1:N per fiszka) do obsługi sesji nauki i podsumowań.
Bezpieczeństwo i skalowalność:
RLS na tabelach domenowych z warunkiem user_id = auth.uid() dla SELECT/INSERT/UPDATE/DELETE.
Operacje globalne (metryki akceptacji, przeliczenia i ustawianie counted_in_metrics) wykonywane wyłącznie przez backend z service role (bez ekspozycji globalnych zapisów przez RLS).
Indeksy bazowe dla wydajności: (user_id, status, updated_at) na flashcards, indeksy FK w flashcard_tags, unikalne indeksy na nazwach tagów per użytkownik.
LIKE z %...% może wymagać późniejszego pg_trgm, ale w MVP wystarczą indeksy pod filtrowanie/paginację.
Nierozstrzygnięte elementy funkcjonalne z PRD istotne dla DB:
Wybór biblioteki SRS (nie wpływa na fakt persystencji, ale może wpływać na dokładny zestaw pól w srs_state).
Lista „starter tags” (zawartość, język, format).
Dostawcy OAuth (nie zmienia schematu domenowego, ale wpływa na pola profilu jeśli potrzebne).
</database_planning_summary>
<unresolved_issues>
Dokładny zestaw pól w srs_state zależny od wybranej biblioteki/algorytmu SRS (wymaga doprecyzowania przy implementacji).
Konkretna struktura profilu użytkownika (profiles) poza id (np. display name) nie została ustalona, ale nie blokuje schematu MVP.
Docelowe indeksy pod LIKE (czy dodajemy od razu pg_trgm i na jakich kolumnach) pozostają decyzją implementacyjną przy pierwszych danych/metrykach wydajności.
</unresolved_issues>
</conversation_summary>