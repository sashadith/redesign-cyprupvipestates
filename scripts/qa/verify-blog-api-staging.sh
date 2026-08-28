#!/usr/bin/env bash
# Gegenprobe gegen Staging. Aufruf:
#   KEY=<schluessel> bash verify-staging.sh
# Ohne KEY laeuft nur der Deployment-Check (Schritt 1).
BASE="https://design.cyprusvipestates.com/api/public/v1"

echo "1) Route deployed?"
body="$(curl -s --max-time 20 "$BASE/posts")"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/posts")"
case "$body" in
  *api_not_configured*) echo "   OK  HTTP $code · Route ist da, Schluessel fehlt noch in /var/www/cve-staging/.env" ;;
  *missing_api_key*)    echo "   OK  HTTP $code · Route ist da UND Schluessel ist gesetzt" ;;
  *'<!DOCTYPE'*)        echo "   FAIL HTTP $code · HTML statt JSON -> Route nicht deployed"; exit 1 ;;
  *)                    echo "   ?    HTTP $code · $(echo "$body" | head -c 120)" ;;
esac

[ -z "${KEY:-}" ] && { echo; echo "Kein KEY gesetzt - hier ist Schluss. Sobald der Schluessel in der Staging-.env steht:"; echo "  KEY=<schluessel> bash $0"; exit 0; }

echo "2) Index je Sprache"
total=0
for l in en de pl ru; do
  n="$(curl -s --max-time 30 -H "X-API-Key: $KEY" "$BASE/posts?lang=$l&limit=1" | sed -n 's/.*"total":\([0-9]*\).*/\1/p')"
  echo "   $l: ${n:-FEHLER}"
  total=$((total + ${n:-0}))
done
echo "   Summe: $total  (erwartet: 211)"

echo "3) Ein Artikel komplett"
# grep -o statt sed: ein gieriges .* greift sonst den LETZTEN "slug" im Payload
# (die Übersetzungen haben auch welche) statt den des Artikels selbst.
slug="$(curl -s --max-time 30 -H "X-API-Key: $KEY" "$BASE/posts?lang=de&limit=1" | grep -o '"slug":"[^"]*"' | head -1 | cut -d'"' -f4)"
curl -s --max-time 30 -H "X-API-Key: $KEY" "$BASE/posts/$slug?lang=de" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s);
    console.log("   slug:        "+d.slug);
    console.log("   canonical:   "+d.canonicalUrl);
    console.log("   HTML:        "+d.html.length+" Zeichen");
    console.log("   Bilder:      "+d.images.length+"  Platzhalter: "+d.embeds.length+"  FAQ: "+d.faq.length);
    console.log("   unbekannte Bausteine: "+(d.unsupportedBlockTypes.length?d.unsupportedBlockTypes.join(", "):"keine"));
    console.log(d.canonicalUrl.startsWith("https://cyprusvipestates.com/")?"   OK  canonical zeigt aufs Original":"   FAIL canonical falsch");
  })'

echo "4) Ohne Schluessel muss abgewiesen werden"
curl -s --max-time 20 "$BASE/posts?lang=de" | head -c 80; echo
