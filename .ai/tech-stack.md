# Specyfikacja stacku technologicznego (MVP) — FlashcardsAI

Poniżej znajduje się docelowy stack dla MVP

## Frontend (FE)

### Astro 5
- **Cel**: framework do budowy aplikacji webowej (SSR/SSG), szybkie strony i dobra wydajność startowa, możliwość dokładania “wysp” interaktywności.
- **Wspiera w PRD**: aplikacja webowa RWD, szybkie dostarczenie UI, separacja widoków (drafty, lista fiszek, sesja nauki).

### React 19
- **Cel**: interaktywne widoki i złożone stany UI (formularze, edycja inline, operacje masowe, sesja nauki).
- **Wspiera w PRD**: panel weryfikacji draftów, edycja treści i tagów, sesja nauki z obsługą klawiatury/myszy.

### TypeScript 5
- **Cel**: typowanie modeli danych (fiszki/tagi/sesje), bezpieczne kontrakty między FE/BE, mniejsza liczba regresji.
- **Wspiera w PRD**: walidacje limitów długości pól, spójność DTO dla API, stabilny rozwój funkcji.

### Tailwind CSS 4
- **Cel**: szybkie i spójne stylowanie UI, łatwe iteracje w MVP bez dłubania w CSS.
- **Wspiera w PRD**: RWD/mobile-first, czytelne stany (puste stany, błędy, disabled/spinner).

### Shadcn/UI
- **Cel**: gotowe, edytowalne komponenty UI (na bazie Radix) do szybkiego składania widoków.
- **Wspiera w PRD**: formularze, listy, dialogi potwierdzeń (np. usuwanie), toasty/komunikaty, komponenty dostępnościowe.

## Backend i baza danych (BE/DB)

### Supabase (Postgres + Auth + Storage + RLS)
- **Cel**:
  - **Postgres**: trwałe przechowywanie fiszek, tagów, logów generowania i metryk akceptacji.
  - **Auth (OAuth)**: logowanie wyłącznie przez OAuth oraz zarządzanie sesją użytkownika.
  - **RLS**: egzekwowanie dostępu do danych (izolacja per użytkownik) po stronie bazy.
- **Wspiera w PRD**: OAuth (US-001..003), CRUD fiszek i tagów, limity dzienne, logowanie sesji generowania i statusów kart, blokada dostępu do cudzych zasobów.

## Komunikacja z modelami (AI)

### OpenRouter.ai
- **Cel**: jednolity dostęp do modeli LLM (możliwość zmiany modeli bez przebudowy integracji), kontrola kosztu/jakości przez dobór modeli.
- **Wspiera w PRD**: generowanie fiszek na podstawie wklejonego tekstu, podpowiadanie tagów, wymuszenie Markdown + bloków kodu w odpowiedziach.
- **Uwaga bezpieczeństwa**: klucze API i wywołania do modeli muszą być wykonywane **wyłącznie po stronie backendu** (nigdy z przeglądarki).

## CI/CD i hosting

### GitHub Actions
- **Cel**: automatyzacja jakości i wdrożeń (lint, testy, build), szybka informacja zwrotna przy PR-ach.
- **Wspiera w PRD**: stabilność rozwoju, minimalizacja regresji w kluczowych przepływach (auth, generowanie, CRUD).

### DigitalOcean
- **Cel**: hosting/uruchomienie aplikacji (i ewentualnie usług pomocniczych) z większą kontrolą nad środowiskiem niż platformy “serverless”.
- **Wspiera w PRD**: uruchomienie produkcyjne i kontrola zasobów przy rosnącym obciążeniu.
- **Uwaga**: na etap MVP to większy narzut operacyjny (sekrety, deployment, monitoring) niż hosting zarządzany.
