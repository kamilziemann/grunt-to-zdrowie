#!/usr/bin/env bash
# Hook PostToolUse (Claude Code): formatuje plik, ktory agent wlasnie zapisal.
# Czyta JSON hooka ze stdin (tool_input.file_path), uruchamia oxfmt, a dla JS/TS autofix reguly
# padding-lines (puste linie, .oxlintrc.padding.json). Zawsze konczy sie kodem 0 - problem z formatowaniem
# nie moze blokowac agenta.

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
root="$(cd "$root" 2>/dev/null && pwd -P)" || exit 0
payload="$(cat)"

file="$(printf '%s' "$payload" | bun -e 'let s="";for await(const c of Bun.stdin.stream())s+=new TextDecoder().decode(c);try{console.log(JSON.parse(s).tool_input?.file_path??"")}catch{}' 2>/dev/null)"

[ -n "$file" ] || exit 0
case "$file" in
/*) ;;
*) file="$root/$file" ;;
esac
[ -f "$file" ] || exit 0

dir="$(cd "$(dirname "$file")" 2>/dev/null && pwd -P)" || exit 0
file="$dir/$(basename "$file")"

# Tylko pliki w repo, poza katalogami generowanymi/zewnetrznymi.
case "$file" in
"$root"/*) ;;
*) exit 0 ;;
esac
case "$file" in
*/node_modules/* | */.next/* | */.open-next/* | */.turbo/* | */.wrangler/* | */dist/* | */coverage/* | */migrations/* | "$root"/.git/* | "$root"/.agents/skills/* | "$root"/.claude/*) exit 0 ;;
esac

case "$file" in
*.ts | *.tsx | *.js | *.mjs | *.cjs | *.json | *.jsonc | *.md | *.css | *.yml | *.yaml) ;;
*) exit 0 ;;
esac

cd "$root" || exit 0

bun tools/scripts/oxfmt.mjs --write "$file" >/dev/null 2>&1 || true

case "$file" in
*.ts | *.tsx | *.js | *.mjs | *.cjs)
	bun x oxlint -c .oxlintrc.padding.json --fix "$file" >/dev/null 2>&1 || true
	;;
esac

exit 0
