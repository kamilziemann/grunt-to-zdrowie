#!/usr/bin/env bash
# Hook Stop (Claude Code): przypomina o dzienniku postepu (docs/progress), gdy ostatni commit z kodem jest nowszy niz
# ostatnia zmiana w docs/progress i nie ma niezacommitowanych zmian dziennika. Blokuje zakonczenie tury tylko raz
# (stop_hook_active = druga proba -> przepuszcza), wiec nie zapetla agenta. Commity starsze niz 12 h ignoruje.

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$root" 2>/dev/null || exit 0
payload="$(cat)"

active="$(printf '%s' "$payload" | bun -e 'let s="";for await(const c of Bun.stdin.stream())s+=new TextDecoder().decode(c);try{console.log(JSON.parse(s).stop_hook_active===true?"1":"0")}catch{console.log("0")}' 2>/dev/null)"

[ "$active" = "1" ] && exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# niezacommitowane zmiany dziennika = sesja juz go prowadzi
[ -n "$(git status --porcelain -- docs/progress 2>/dev/null)" ] && exit 0

last_code="$(git log -1 --format=%ct -- . ':(exclude)docs/progress' 2>/dev/null)"
last_log="$(git log -1 --format=%ct -- docs/progress 2>/dev/null)"
now="$(date +%s)"

[ -n "$last_code" ] || exit 0
[ $((now - last_code)) -gt 43200 ] && exit 0
[ -n "$last_log" ] && [ "$last_log" -ge "$last_code" ] && exit 0

subject="$(git log -1 --format=%s -- . ':(exclude)docs/progress')"

printf '{"decision":"block","reason":"Ostatni commit (%s) nie ma wpisu w dzienniku postepu. Zaktualizuj docs/progress/RRRR-MM-DD/<nazwa>-<id>.md (skill progress-log: Stan teraz, Zrobione z hashem, Nastepny krok) albo, jesli zmiana nie wymaga wpisu, zakoncz bez zmian."}\n' "${subject//\"/\'}"
exit 0
