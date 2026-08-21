import type { LegalDoc } from "./types";

/* Polityka prywatności — polski. Treść odpowiada wersji angielskiej
   (privacy.en.ts), gdzie opisano też, które obowiązkowe informacje RODO
   uzupełniono względem starego tekstu. Identyfikatory kotwic celowo NIE są
   tłumaczone, aby ta sama sekcja miała ten sam adres we wszystkich językach.

   TO NIE JEST porada prawna — przed publikacją wymagana weryfikacja prawnika. */

export const PRIVACY_PL: LegalDoc = {
  metaTitle: "Polityka prywatności — Cyprus VIP Estates",
  metaDescription:
    "Jak Cyprus VIP Estates (SecretBrand Solutions LTD) zbiera, wykorzystuje, udostępnia i chroni Twoje dane osobowe oraz jakie prawa przysługują Ci na mocy RODO.",
  eyebrow: "Informacje prawne",
  title: "Polityka prywatności",
  intro:
    "Ta polityka wyjaśnia, jakie dane osobowe zbieramy, gdy korzystasz z tej witryny lub kontaktujesz się z nami, dlaczego je przetwarzamy, kto je otrzymuje, jak długo je przechowujemy i z jakich praw możesz skorzystać w każdej chwili.",
  updatedLabel: "Ostatnia aktualizacja",
  updated: "2026-08-21",
  tocLabel: "Na tej stronie",

  sections: [
    {
      id: "controller",
      title: "1. Kto jest administratorem",
      blocks: [
        { kind: "p", text: "Administratorem danych osobowych przetwarzanych w tej witrynie jest:" },
        { kind: "list", items: [
          "SecretBrand Solutions LTD, działająca pod marką „Cyprus VIP Estates”",
          "Palaion Patron Germanou 11, 8011 Pafos, Cypr",
          "E-mail: office@cyprusvipestates.com",
          "Telefon: +357 99 278 285",
        ]},
        { kind: "p", text: "Nie wyznaczyliśmy inspektora ochrony danych, ponieważ nie jest to wymagane na podstawie art. 37 RODO. We wszystkich sprawach dotyczących prywatności prosimy pisać na powyższy adres — wiadomość trafi do osoby odpowiedzialnej." },
      ],
    },
    {
      id: "data-we-collect",
      title: "2. Co zbieramy i dlaczego",
      blocks: [
        { kind: "definitions", items: [
          { term: "Pliki dziennika serwera", text: "Przy każdym żądaniu strony serwer zapisuje typ i wersję przeglądarki, system operacyjny, adres odsyłający, nazwę hosta urządzenia, czas żądania i adres IP. Jest to technicznie niezbędne do udostępnienia witryny i wykrywania nadużyć. Dane nie są łączone z innymi źródłami. Podstawa prawna: art. 6 ust. 1 lit. f RODO (nasz prawnie uzasadniony interes w bezpiecznej, działającej witrynie)." },
          { term: "Formularze kontaktowe i zapytania", text: "Gdy przesyłasz zapytanie, przechowujemy podane dane — zwykle imię i nazwisko, dane kontaktowe, preferowany kanał kontaktu i treść wiadomości — aby odpowiedzieć i obsłużyć dalszą korespondencję. Zapytania trafiają do naszego systemu obsługi klienta, aby opiekująca się Tobą osoba widziała historię sprawy. Podstawa prawna: art. 6 ust. 1 lit. b RODO (działania przed zawarciem umowy na Twoje żądanie)." },
          { term: "Terminy spotkań", text: "Jeśli proponujesz lub potwierdzasz termin przez naszą stronę rezerwacji, przetwarzamy proponowane godziny, Twoją strefę czasową i dane kontaktowe w celu ustalenia i potwierdzenia spotkania. Podstawa prawna: art. 6 ust. 1 lit. b RODO." },
          { term: "Newsletter", text: "Po zapisaniu się przetwarzamy Twój adres e-mail, aby wysyłać newsletter. Podstawa prawna: art. 6 ust. 1 lit. a RODO (zgoda), którą możesz wycofać w każdej chwili." },
          { term: "Statystyka witryny (bez plików cookie)", text: "Liczymy odsłony przy użyciu codziennie zmieniającego się, nieodwracalnego skrótu utworzonego z adresu IP i identyfikatora przeglądarki. Skrót zmienia się każdego dnia, nigdy nie jest przechowywany razem z adresem IP i nie pozwala Cię zidentyfikować ani rozpoznać w kolejnych dniach. Podstawa prawna: art. 6 ust. 1 lit. f RODO (uzasadniony interes w poznaniu, które treści są przydatne), zrównoważony brakiem trwałego identyfikatora." },
          { term: "Google Analytics i piksel Meta", text: "Wyłącznie za Twoją zgodą korzystamy z Google Analytics (Google Ireland Limited) i piksela Meta (Meta Platforms Ireland Limited), aby mierzyć zasięg i skuteczność reklam. Podstawa prawna: art. 6 ust. 1 lit. a RODO (zgoda). Zgodę możesz wycofać w każdej chwili ze skutkiem na przyszłość." },
        ]},
      ],
    },
    {
      id: "recipients",
      title: "3. Kto otrzymuje Twoje dane",
      blocks: [
        { kind: "callout", text: "Przekazanie Twoich danych deweloperowi lub prawnikowi jest istotną częścią naszej usługi. Następuje wyłącznie w związku z konkretnym zainteresowaniem nieruchomością, które nam zgłosiłeś." },
        { kind: "p", text: "W zależności od zapytania Twoje dane kontaktowe mogą zostać przekazane:" },
        { kind: "list", items: [
          "Deweloperom na Cyprze — w celu organizacji oglądania i przygotowania ofert dla interesujących Cię nieruchomości. Podstawa prawna: art. 6 ust. 1 lit. b RODO.",
          "Niezależnym prawnikom — do weryfikacji prawnej i sporządzenia umów, jeśli poprosisz o taki kontakt. Działają jako odrębni administratorzy i są związani własną tajemnicą zawodową.",
          "Naszym dostawcom IT — hosting, wysyłka poczty i systemy obsługi zapytań. Działają jako podmioty przetwarzające na podstawie art. 28 RODO, wyłącznie zgodnie z naszymi udokumentowanymi poleceniami.",
        ]},
        { kind: "p", text: "Nie sprzedajemy Twoich danych osobowych i nie przekazujemy ich do celów reklamowych osób trzecich." },
      ],
    },
    {
      id: "transfers",
      title: "4. Przekazywanie poza EOG",
      blocks: [
        { kind: "p", text: "Google i Meta działają poprzez swoje irlandzkie spółki, jednak przetwarzanie na ich infrastrukturze może obejmować przekazanie danych do Stanów Zjednoczonych. Opiera się ono na decyzji Komisji Europejskiej stwierdzającej odpowiedni stopień ochrony w ramach EU–US Data Privacy Framework, o ile odbiorca posiada certyfikat, a w pozostałych przypadkach na standardowych klauzulach umownych zgodnie z art. 46 ust. 2 lit. c RODO." },
        { kind: "p", text: "Kopię stosowanych zabezpieczeń możesz uzyskać, kontaktując się z nami w sposób wskazany w punkcie 1." },
      ],
    },
    {
      id: "retention",
      title: "5. Jak długo przechowujemy",
      blocks: [
        { kind: "list", items: [
          "Pliki dziennika serwera: do 30 dni, następnie usuwane lub anonimizowane.",
          "Zapytania i związana z nimi korespondencja: przez czas trwania kontaktu i do 3 lat od ostatniej wymiany wiadomości, abyśmy mogli podjąć rozmowę, którą wznowisz później.",
          "Dane związane z zawartą transakcją: tak długo, jak wymaga tego cypryjskie prawo handlowe i podatkowe — zwykle 6 lat.",
          "Zapisy na newsletter: do momentu wypisania się.",
          "Dowody zgody: tak długo, jak to konieczne do wykazania zgody, oraz 3 lata po jej wycofaniu.",
          "Statystyka bez plików cookie: dzienny skrót trafia wyłącznie do zagregowanych liczników i na żadnym etapie nie da się go powiązać z osobą.",
        ]},
      ],
    },
    {
      id: "cookies",
      title: "6. Pliki cookie i zgoda",
      blocks: [
        { kind: "p", text: "Pliki cookie niezbędne do działania witryny — na przykład zapamiętujące wybór języka lub decyzję o plikach cookie — stosujemy na podstawie art. 6 ust. 1 lit. f RODO; nie wymagają one zgody." },
        { kind: "p", text: "Pliki analityczne i marketingowe, w tym Google Analytics i piksela Meta, ustawiamy dopiero po wyrażeniu przez Ciebie zgody. Możesz ją w każdej chwili zmienić lub wycofać; nie wpływa to na zgodność z prawem przetwarzania dokonanego wcześniej. Pliki cookie możesz też blokować lub usuwać w ustawieniach przeglądarki — części witryny mogą wtedy nie działać zgodnie z przeznaczeniem." },
      ],
    },
    {
      id: "rights",
      title: "7. Twoje prawa",
      blocks: [
        { kind: "p", text: "Na mocy RODO masz prawo do:" },
        { kind: "list", items: [
          "Dostępu — uzyskania potwierdzenia, czy przetwarzamy Twoje dane, oraz ich kopii (art. 15).",
          "Sprostowania — poprawienia danych nieprawidłowych lub niekompletnych (art. 16).",
          "Usunięcia — usunięcia danych, gdy zachodzi jedna z przesłanek art. 17.",
          "Ograniczenia — żądania, byśmy jedynie przechowywali dane na czas rozstrzygnięcia sporu (art. 18).",
          "Przenoszenia danych — otrzymania przekazanych nam danych w ustrukturyzowanym formacie nadającym się do odczytu maszynowego lub przesłania ich innemu administratorowi (art. 20).",
          "Sprzeciwu — w każdej chwili wobec przetwarzania opartego na prawnie uzasadnionym interesie, a bezwarunkowo wobec marketingu bezpośredniego (art. 21).",
          "Wycofania zgody — w każdej chwili ze skutkiem na przyszłość (art. 7 ust. 3).",
        ]},
        { kind: "p", text: "Aby skorzystać z tych praw, napisz na office@cyprusvipestates.com. Odpowiadamy w ciągu miesiąca; przy złożonych żądaniach możemy przedłużyć ten termin o dwa miesiące, informując o przyczynach." },
        { kind: "callout", text: "Masz również prawo wniesienia skargi do organu nadzorczego. Na Cyprze jest to Office of the Commissioner for Personal Data Protection, Iasonos 1, 1082 Nikozja (commissioner@dataprotection.gov.cy). Skargę możesz też złożyć do organu w kraju swojego zamieszkania lub pracy — w Polsce jest to Prezes Urzędu Ochrony Danych Osobowych." },
      ],
    },
    {
      id: "security",
      title: "8. Bezpieczeństwo",
      blocks: [
        { kind: "p", text: "Witryna działa przez TLS, więc przesyłane do nas treści są szyfrowane w transmisji — przeglądarka pokazuje „https://” i symbol kłódki. Stosujemy środki techniczne i organizacyjne odpowiednie do ryzyka, a dostęp do danych z zapytań mają wyłącznie osoby, które Cię obsługują." },
      ],
    },
    {
      id: "automated-decisions",
      title: "9. Zautomatyzowane decyzje",
      blocks: [
        { kind: "p", text: "Nie stosujemy zautomatyzowanego podejmowania decyzji ani profilowania wywołującego skutki prawne lub w podobny sposób istotnie wpływającego na Ciebie w rozumieniu art. 22 RODO. Jeśli używamy oprogramowania do porządkowania lub streszczania zapytań, o dalszych krokach zawsze decyduje człowiek." },
      ],
    },
    {
      id: "changes",
      title: "10. Zmiany tej polityki",
      blocks: [
        { kind: "p", text: "Aktualizujemy tę politykę, gdy zmieniają się nasze usługi lub wymogi prawne. Obowiązuje zawsze wersja opublikowana tutaj, a data u góry wskazuje ostatnią zmianę." },
      ],
    },
  ],

  contactTitle: "Pytania o Twoje dane?",
  contactText: "Napisz na office@cyprusvipestates.com lub zadzwoń pod +357 99 278 285. Chętnie wyjaśnimy każdy punkt prostym językiem.",
};
