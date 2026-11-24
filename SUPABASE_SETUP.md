# Konfiguracja bazy Supabase

## Jedno konto i cztery portfele

1. W Supabase Authentication utwórz jedyne konto aplikacji. Aplikacja umożliwia logowanie, ale nie ma publicznej rejestracji.
2. W pliku `supabase-schema.sql` ustaw w końcowym bloku SQL adres e-mail tego konta, a następnie wykonaj cały skrypt w SQL Editor projektu.
3. W `supabase-config.js` wpisz Project URL oraz publiczny klucz `anon`/`publishable`. Nie używaj klucza `service_role`.

Skrypt tworzy cztery portfele, historię cen oraz lokalizacje początkowe: IKE Zuzia, XTB i Obligacje Kuba. Można uruchamiać go ponownie na bazie z aktualnym schematem — nie usuwa tabel ani zapisanych w nich danych. Stara tabela `market_quotes`, jeśli istnieje, pozostaje nietknięta i nie jest używana przez aplikację.

## Lokalizacje aktywów

Przy dodawaniu lub edycji aktywa wybierz jego lokalizację. Przycisk **Zarządzaj lokalizacjami** pozwala dodać lokalizację i zmienić nazwę istniejącej. Zmiana nazwy aktualizuje etykietę na wszystkich przypisanych aktywach.

## Ręczne wyceny i historia

W każdej pozycji wybierz **Dodaj aktualną cenę** i wpisz cenę za jednostkę albo łączną wartość całej pozycji. Wszystkie kwoty, również dla aktywów notowanych w innych walutach, podawaj w PLN. Aplikacja dopisuje wpis do `asset_price_history` z dzisiejszą datą; wcześniejsze wpisy pozostają dostępne w historii pozycji. Przy każdym wpisie można zmienić cenę lub datę albo usunąć wpis.

Po dodaniu edycji i usuwania historii uruchom ponownie `supabase-schema.sql` w SQL Editorze, aby nadać polityki i uprawnienia do aktualizacji oraz usuwania własnych wpisów historii.

Opcjonalną cenę zakupu za jednostkę również wpisuj w PLN. Suma portfeli jest wyświetlana w PLN.

Nad listą aktywów w wybranym portfelu widoczny jest udział poszczególnych typów aktywów według ich aktualnej wartości. Pozycje bez wyceny są pomijane.

Jeśli tabela historii zawierała wcześniejsze ceny w EUR, ponowne wykonanie `supabase-schema.sql` przeliczy je na PLN dla wpisów, które mają zapisany kurs EUR/PLN. Wpisy bez kursu zostaną zachowane, ale nie będą użyte jako aktualna wycena.

## Obligacje skarbowe

Pozycja obligacji przechowuje kod emisji (np. `EDO1035`), liczbę sztuk i datę zakupu. Wartość brutto obligacji wpisz ręcznie jako cenę za jednostkę albo łączną wartość pozycji.

Do wdrożenia aplikacji na iPhonie użyj HTTPS.
