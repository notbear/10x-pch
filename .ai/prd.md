# Dokument wymagań produktu (PRD) - FlashcardsAI
## 1. Przegląd produktu
FlashcardsAI to webowa aplikacja (RWD, mobile first) dla programistów, która umożliwia szybkie tworzenie i naukę fiszek z użyciem algorytmu spaced repetition. Kluczową funkcją MVP jest generowanie fiszek przez AI na podstawie wklejonego tekstu, a następnie weryfikacja i zapis kart przez użytkownika. Aplikacja oferuje także ręczne tworzenie fiszek, zarządzanie tagami, wyszukiwanie oraz sesję nauki opartą o gotową bibliotekę SRS.

Założenia i decyzje MVP:
- Grupa docelowa: wyłącznie programiści, bez person.
- Format fiszek: wyłącznie Pytanie (do 100 znaków) i Odpowiedź (do 300 znaków).
- Generowanie AI: synchroniczne, z widocznym spinnerem.
- System powtórek: gotowa biblioteka open source, jeden algorytm w MVP.
- Autoryzacja: wyłącznie OAuth, minimalny zestaw dostawców.
- Limit generowania AI: 50 fiszek dziennie na użytkownika, licznik widoczny w UI.

Otwarte decyzje do uzupełnienia po PRD:
- Wybór biblioteki SRS.
- Wybór dostawców OAuth.
- Lista startowych tagów technologicznych.
- Prompt systemowy wymuszający Markdown i bloki kodu w odpowiedziach AI.

## 2. Problem użytkownika
Programiści uczą się skuteczniej dzięki spaced repetition, ale ręczne tworzenie wysokiej jakości fiszek jest czasochłonne i zniechęcające. Brakuje szybkiego sposobu na przekształcenie materiałów technicznych w gotowe do nauki fiszki, szczególnie z zachowaniem poprawnego formatowania kodu i Markdown.

Kluczowe potrzeby:
- Szybkie generowanie fiszek z tekstu technicznego.
- Możliwość weryfikacji i korekty treści przed zapisem.
- Wygodna nauka z klawiaturą i myszą, z możliwością szybkiej edycji błędów.
- Proste zarządzanie bazą wiedzy i tagami.

## 3. Wymagania funkcjonalne
3.1. Generowanie fiszek przez AI
- Użytkownik wkleja tekst (min. 300, max. 10 000 znaków) jako plain tekst lub markdown zawierający przykłady kodu.
- System generuje fiszki w formacie Pytanie-Odpowiedź z zachowaniem limitów długości.
- Wsparcie Markdown i bloków kodu w treści pytań i odpowiedzi.
- Automatyczne podpowiadanie tagów przez AI.
- Ostrzeżenie o danych wrażliwych i NDA przed wysłaniem tekstu.
- Limit 50 fiszek AI dziennie na użytkownika, licznik widoczny w UI.
- Logowanie sesji generowania, statusów kart i czasu generowania.

3.2. Panel weryfikacji fiszek (drafty)
- Widok przejściowy listy wygenerowanych fiszek przed zapisem.
- Operacje na kartach: zapisz/zatwierdź, edytuj, odrzuć/usuń.
- Operacje masowe: zaznacz, zapisz/zatwierdź, odrzuć/usuń, przypisz tagi.
- Podgląd tekstu źródłowego z możliwością ukrycia/pokazania.
- Przechowywanie draftów do momentu akceptacji lub odrzucenia.

3.3. Ręczne tworzenie fiszek
- Formularz tworzenia fiszki z walidacją długości pól.
- Przypisywanie dowolnej liczby tagów.
- Zapis do bazy bez limitów dziennych.

3.4. Zarządzanie fiszkami
- Przeglądanie listy fiszek użytkownika.
- Edycja i usuwanie fiszek.
- Wyszukiwanie pełnotekstowe w pytaniu i odpowiedzi (min. 3 znaki, case-insensitive).

3.5. System tagów
- CRUD tagów z licznikiem użyć.
- Lista startowych tagów technologicznych.
- Autouzupełnianie tagów przy edycji i tworzeniu fiszek.

3.6. Sesja nauki (SRS)
- Maksymalnie 30 fiszek na sesję.
- Obsługa klawiatury i myszy.
- Ocena zapamiętania w skali 1-4.
- Minimalna latencja 24h, brak tej samej karty w jednej sesji.
- Możliwość szybkiej edycji treści i tagów inline podczas nauki.
- Wsparcie Markdown i bloków kodu w treści pytań i odpowiedzi.

3.7. Konta i autoryzacja
- Logowanie wyłącznie przez OAuth.
- Dostęp do fiszek tylko po autoryzacji.

## 4. Granice produktu
Poza zakresem MVP:
- Własny, zaawansowany algorytm powtórek (np. SuperMemo, Anki).
- Import wielu formatów (PDF, DOCX itp.).
- Współdzielenie zestawów fiszek między użytkownikami.
- Integracje z innymi platformami edukacyjnymi.
- Aplikacje mobilne.
- Tryb ciemny (dark mode) w pierwszej wersji.

Ograniczenia:
- Aplikacja wyłącznie webowa (RWD).
- Generowanie wyłącznie z tekstu wklejanego.
- Jeden algorytm SRS w MVP.

## 5. Historyjki użytkowników
ID: US-001
Tytuł: Logowanie OAuth
Opis: Jako użytkownik chcę zalogować się przez OAuth, aby bezpiecznie uzyskać dostęp do swoich fiszek.
Kryteria akceptacji:
- Użytkownik może wybrać dostawcę OAuth z listy.
- Po poprawnym logowaniu użytkownik trafia do aplikacji z widocznymi danymi.
- Próba wejścia na chroniony widok bez logowania przekierowuje do logowania.

ID: US-002
Tytuł: Anulowanie logowania OAuth
Opis: Jako użytkownik chcę móc przerwać logowanie, aby nie łączyć konta.
Kryteria akceptacji:
- Anulowanie logowania nie tworzy sesji użytkownika.
- Użytkownik widzi komunikat o anulowaniu i może spróbować ponownie.

ID: US-003
Tytuł: Wylogowanie
Opis: Jako użytkownik chcę się wylogować, aby zakończyć sesję.
Kryteria akceptacji:
- Wylogowanie usuwa sesję i przekierowuje do logowania.
- Chronione widoki są niedostępne po wylogowaniu.

ID: US-004
Tytuł: Wklejenie tekstu do generowania
Opis: Jako użytkownik chcę wkleić tekst źródłowy, aby wygenerować fiszki AI.
Kryteria akceptacji:
- System nie pozwala na zachowanie tekstu krótszego niż 300 znaków.
- System nie pozwala na zachowanie tekstu dłuższego niż 10 000 znaków.
- Widoczny licznik znaków informuje o limicie.
- Widoczna wizualna informacja o przekroczeniu jednego z limitów.

ID: US-005
Tytuł: Ostrzeżenie o danych wrażliwych
Opis: Jako użytkownik chcę być ostrzeżony o ryzyku przekazywania danych do AI.
Kryteria akceptacji:
- Przed wysłaniem tekstu pojawia się komunikat o NDA i danych wrażliwych.
- Użytkownik musi potwierdzić zapoznanie się z ostrzeżeniem.

ID: US-006
Tytuł: Generowanie fiszek AI
Opis: Jako użytkownik chcę uruchomić generowanie fiszek, aby szybko stworzyć zestaw kart.
Kryteria akceptacji:
- Po uruchomieniu widoczny jest spinner, a przyciski są zablokowane.
- Po zakończeniu generowania użytkownik widzi listę draftów.
- Każda karta zawiera pytanie i odpowiedź w limitach długości.

ID: US-007
Tytuł: Limit dzienny generowania AI
Opis: Jako użytkownik chcę widzieć limit i stan dzienny, aby wiedzieć ile kart mogę jeszcze wygenerować.
Kryteria akceptacji:
- UI pokazuje liczbę wykorzystanych i dostępnych generacji AI.
- Po przekroczeniu limitu generowanie jest zablokowane i pojawia się komunikat.

ID: US-008
Tytuł: Obsługa błędu generowania
Opis: Jako użytkownik chcę otrzymać informację o błędzie, aby móc spróbować ponownie.
Kryteria akceptacji:
- W przypadku błędu wyświetla się czytelny komunikat.
- Użytkownik może ponowić generowanie bez utraty wklejonego tekstu.

ID: US-009
Tytuł: Podgląd tekstu źródłowego w weryfikacji
Opis: Jako użytkownik chcę podejrzeć tekst źródłowy, aby zweryfikować poprawność fiszek.
Kryteria akceptacji:
- Użytkownik może ukryć lub pokazać tekst źródłowy.
- Podgląd nie przeszkadza w edycji fiszek.

ID: US-010
Tytuł: Edycja pojedynczej fiszki w weryfikacji
Opis: Jako użytkownik chcę edytować wygenerowaną fiszkę, aby poprawić błędy.
Kryteria akceptacji:
- Edycja jest możliwa dla pytania, odpowiedzi i tagów.
- System waliduje limity znaków przy zapisie zmian.

ID: US-011
Tytuł: Zapisanie pojedynczej fiszki
Opis: Jako użytkownik chcę zapisać wybraną fiszkę, aby trafiła do mojej bazy.
Kryteria akceptacji:
- Zapis przenosi kartę z draftów do bazy fiszek.
- Zapisane karty są widoczne w liście fiszek.

ID: US-012
Tytuł: Odrzucenie pojedynczej fiszki
Opis: Jako użytkownik chcę odrzucić fiszkę, aby nie zapisywać błędnych treści.
Kryteria akceptacji:
- Odrzucona karta znika z listy draftów.
- System rejestruje odrzucenie w logach sesji.

ID: US-013
Tytuł: Operacje masowe na draftach
Opis: Jako użytkownik chcę zapisywać lub odrzucać wiele fiszek naraz, aby przyspieszyć pracę.
Kryteria akceptacji:
- Możliwe jest zaznaczenie wielu kart.
- Operacje masowe działają na wszystkie zaznaczone karty.

ID: US-014
Tytuł: Masowe tagowanie w weryfikacji
Opis: Jako użytkownik chcę przypisać tagi do wielu kart, aby szybciej kategoryzować.
Kryteria akceptacji:
- Możliwe jest dodanie tagów do wszystkich zaznaczonych kart.
- Liczniki użyć tagów są aktualizowane po zapisie.

ID: US-015
Tytuł: Trwałość draftów
Opis: Jako użytkownik chcę wrócić do draftów później, aby nie stracić wyników generowania.
Kryteria akceptacji:
- Drafty pozostają dostępne do czasu zapisania lub odrzucenia.
- Ponowne wejście do aplikacji pokazuje istniejące drafty.

ID: US-016
Tytuł: Ręczne dodanie fiszki
Opis: Jako użytkownik chcę dodać fiszkę ręcznie, aby tworzyć własne treści.
Kryteria akceptacji:
- Formularz wymusza limity długości pól.
- Fiszka zapisuje się bez wpływu na limit AI.

ID: US-017
Tytuł: Edycja istniejącej fiszki
Opis: Jako użytkownik chcę edytować fiszkę, aby aktualizować wiedzę.
Kryteria akceptacji:
- Edycja dotyczy pytania, odpowiedzi i tagów.
- Zmiany są widoczne natychmiast po zapisie.

ID: US-018
Tytuł: Usunięcie fiszki
Opis: Jako użytkownik chcę usunąć fiszkę, aby oczyścić bazę.
Kryteria akceptacji:
- Usunięcie wymaga potwierdzenia.
- Usunięta karta nie jest widoczna w wyszukiwarce ani liście.

ID: US-019
Tytuł: Wyszukiwanie pełnotekstowe
Opis: Jako użytkownik chcę wyszukiwać po treści, aby szybko znaleźć fiszki.
Kryteria akceptacji:
- Wyszukiwanie działa dla min. 3 znaków.
- Wyszukiwanie jest case-insensitive dla pytania i odpowiedzi.

ID: US-020
Tytuł: Zarządzanie tagami
Opis: Jako użytkownik chcę tworzyć, edytować i usuwać tagi, aby lepiej organizować fiszki.
Kryteria akceptacji:
- Możliwe są operacje CRUD na tagach.
- Każdy tag ma licznik użyć aktualizowany przy zapisie kart.

ID: US-021
Tytuł: Autouzupełnianie tagów
Opis: Jako użytkownik chcę mieć podpowiedzi tagów, aby szybciej je dodawać.
Kryteria akceptacji:
- System sugeruje tagi przy tworzeniu i edycji fiszek.
- Lista uwzględnia tagi popularne i wcześniej użyte.

ID: US-022
Tytuł: Start sesji nauki
Opis: Jako użytkownik chcę rozpocząć sesję, aby uczyć się kart.
Kryteria akceptacji:
- Sesja zawiera maksymalnie 30 kart.
- Jeśli brak kart do nauki, system pokazuje pusty stan.

ID: US-023
Tytuł: Ocena zapamiętania 1-4
Opis: Jako użytkownik chcę oceniać kartę w skali 1-4, aby SRS wyliczył kolejną powtórkę.
Kryteria akceptacji:
- Ocena 1-4 działa z klawiatury i myszy.
- Po ocenie system przechodzi do następnej karty.

ID: US-024
Tytuł: Brak powtórzeń w jednej sesji
Opis: Jako użytkownik chcę mieć pewność, że karta nie wróci w tej samej sesji.
Kryteria akceptacji:
- Karta oceniona w sesji nie pojawia się ponownie w tej sesji.
- System respektuje minimalną latencję 24h.

ID: US-025
Tytuł: Inline edycja w sesji nauki
Opis: Jako użytkownik chcę szybko edytować kartę podczas nauki, aby poprawić błędy.
Kryteria akceptacji:
- Możliwa jest edycja pytania, odpowiedzi i tagów bez opuszczania sesji.
- Zmiany są zapisywane i widoczne w kolejnych sesjach.

ID: US-026
Tytuł: Renderowanie Markdown i kodu
Opis: Jako użytkownik chcę widzieć poprawnie sformatowany Markdown i kod w kartach.
Kryteria akceptacji:
- Treść w odpowiedzi renderuje Markdown i bloki kodu.
- Formatowanie jest spójne w weryfikacji, liście i sesji nauki.

ID: US-027
Tytuł: Podsumowanie sesji nauki
Opis: Jako użytkownik chcę zobaczyć podsumowanie, aby śledzić postęp.
Kryteria akceptacji:
- Podsumowanie pokazuje liczbę ocenionych kart.
- Podsumowanie pokazuje rozkład ocen 1-4.

ID: US-028
Tytuł: Logowanie metryk akceptacji
Opis: Jako właściciel produktu chcę logów akceptacji, aby mierzyć skuteczność AI.
Kryteria akceptacji:
- System zapisuje status każdej karty wygenerowanej wstępnie przez AI: zapis/odrzucenie.
- Metryki są przeliczane i aktualizowane (zapis) po zakończeniu weryfikacji.
- Metryki są przeliczane i aktualizowane (zapis) na żądanie użytkownika - po naciśnięciu stosownego przycisku.

ID: US-029
Tytuł: Limit znaków w polach fiszki
Opis: Jako użytkownik chcę walidacji długości pól, aby zachować spójny format.
Kryteria akceptacji:
- Pytanie nie może przekroczyć 100 znaków.
- Odpowiedź nie może przekroczyć 300 znaków.

ID: US-030
Tytuł: Obsługa braku dostępu do zasobów
Opis: Jako użytkownik chcę jasnego komunikatu, gdy próbuję dostać się do cudzych fiszek.
Kryteria akceptacji:
- System blokuje dostęp do fiszek innego ć.
- Użytkownik widzi komunikat o braku uprawnień.

## 6. Metryki sukcesu
Metryki główne:
- 75% fiszek wygenerowanych przez AI jest akceptowane (zapis do bazy po edycji lub bez).
- 75% wszystkich fiszek w systemie pochodzi z generatora AI.

Metryki wspierające:
- Wykorzystanie limitu dziennego AI per użytkownik.

Lista kontrolna PRD:
- Każdą historię użytkownika można przetestować.
- Kryteria akceptacji są jasne i konkretne.
- Zestaw historyjek pokrywa pełną funkcjonalność aplikacji MVP.
- Uwierzytelnianie i autoryzacja są uwzględnione.
