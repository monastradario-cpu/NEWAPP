#!/usr/bin/env bash
# Test dell'APK su emulatore Android: installa, avvia, verifica che l'app
# parta, superi l'autotest e mostri davvero contenuto sullo schermo.
set -u
APK=$(ls CasaMia-*.apk | head -1)
mkdir -p diagnostica
fail=0

adb install -r "$APK" || exit 1
adb logcat -c
adb shell am start -W -n it.casamia.app/.MainActivity

# Attendi l'avvio dell'app web (max 90 s)
for i in $(seq 1 45); do
  adb logcat -d -s CasaMia:I > diagnostica/logcat.txt
  grep -q CASAMIA_READY diagnostica/logcat.txt && break
  sleep 2
done
sleep 8

adb logcat -d -s CasaMia:I chromium:I > diagnostica/logcat.txt
adb logcat -d -b crash > diagnostica/crash.txt || true
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb pull /sdcard/ui.xml diagnostica/ui.xml >/dev/null 2>&1 || true
adb exec-out screencap -p > diagnostica/schermata.png
cp diagnostica/schermata.png schermata.png

echo "----- logcat -----"; cat diagnostica/logcat.txt

grep -q CASAMIA_READY diagnostica/logcat.txt || { echo "ERRORE: l'app non ha segnalato l'avvio"; fail=1; }
grep -q CASAMIA_SELFTEST_OK diagnostica/logcat.txt || { echo "ERRORE: autotest non superato"; fail=1; }
if grep -qE "Uncaught|CASAMIA_SELFTEST_FAIL" diagnostica/logcat.txt; then echo "ERRORE: errori JavaScript"; fail=1; fi
if [ -s diagnostica/ui.xml ]; then
  grep -qE "I tuoi progetti|Benvenuto in Casa Mia" diagnostica/ui.xml && echo "Testo dell'app presente nell'albero dell'interfaccia" || echo "AVVISO: testo dell'app non trovato nell'albero dell'interfaccia"
fi
python3 tests/png_check.py diagnostica/schermata.png || fail=1

exit $fail
