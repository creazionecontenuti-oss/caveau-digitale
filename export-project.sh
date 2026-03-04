#!/bin/bash
# export-project.sh — Concatena tutti i file del progetto in un unico file di testo
# Uso: bash export-project.sh
# Output: project-export.txt (nella root del progetto, sovrascrive ogni volta)

set -e
cd "$(dirname "$0")"

OUT="project-export.txt"

# Estensioni da escludere (binari/multimediali)
BINARY_EXT="png|jpg|jpeg|gif|bmp|webp|ico|svg|woff|woff2|ttf|eot|otf|mp3|mp4|wav|ogg|avi|mov|pdf|zip|tar|gz|bz2|7z|rar|map"

# Cartelle da escludere
EXCLUDE_DIRS="node_modules|.git|.next|dist|build|.vercel|.windsurf|artifacts|cache|lib"

# File da escludere
EXCLUDE_FILES="$OUT|package-lock.json|thirdweb-sdk.js|tailwind.min.css"

# ── 1. Struttura ad albero ──
echo "============================================" > "$OUT"
echo "  PROJECT TREE"                               >> "$OUT"
echo "============================================" >> "$OUT"
echo ""                                             >> "$OUT"

find . -not -path '*/node_modules/*' \
       -not -path '*/.git/*' \
       -not -path '*/.next/*' \
       -not -path '*/dist/*' \
       -not -path '*/build/*' \
       -not -path '*/.vercel/*' \
       -not -path '*/.windsurf/*' \
       -not -path '*/artifacts/*' \
       -not -path '*/cache/*' \
       -not -path '*/lib/*' \
       -not -name "$OUT" \
       -not -name "package-lock.json" \
       -not -name "thirdweb-sdk.js" \
       -not -name "tailwind.min.css" \
  | sort \
  | while IFS= read -r path; do
      depth=$(echo "$path" | tr -cd '/' | wc -c)
      indent=$(printf '%*s' "$((depth * 2))" '')
      name=$(basename "$path")
      if [ -d "$path" ]; then
        echo "${indent}📁 ${name}/"
      else
        size=$(wc -c < "$path" 2>/dev/null | tr -d ' ')
        echo "${indent}📄 ${name} (${size}B)"
      fi
    done >> "$OUT"

echo ""                                             >> "$OUT"
echo ""                                             >> "$OUT"

# ── 2. Contenuto dei file ──
echo "============================================" >> "$OUT"
echo "  FILE CONTENTS"                              >> "$OUT"
echo "============================================" >> "$OUT"

find . -type f \
       -not -path '*/node_modules/*' \
       -not -path '*/.git/*' \
       -not -path '*/.next/*' \
       -not -path '*/dist/*' \
       -not -path '*/build/*' \
       -not -path '*/.vercel/*' \
       -not -path '*/.windsurf/*' \
       -not -path '*/artifacts/*' \
       -not -path '*/cache/*' \
       -not -path '*/lib/*' \
       -not -name "$OUT" \
       -not -name "package-lock.json" \
       -not -name "thirdweb-sdk.js" \
       -not -name "tailwind.min.css" \
  | sort \
  | while IFS= read -r file; do
      # Salta file binari/multimediali in base all'estensione
      ext="${file##*.}"
      if echo "$ext" | grep -qiE "^($BINARY_EXT)$"; then
        echo ""                                     >> "$OUT"
        echo "────────────────────────────────────" >> "$OUT"
        echo "📎 $file  [BINARY — contenuto omesso]" >> "$OUT"
        echo "────────────────────────────────────" >> "$OUT"
        continue
      fi

      echo ""                                       >> "$OUT"
      echo "────────────────────────────────────"   >> "$OUT"
      echo "📄 $file"                               >> "$OUT"
      echo "────────────────────────────────────"   >> "$OUT"
      cat "$file"                                   >> "$OUT"
      echo ""                                       >> "$OUT"
    done

echo ""                                             >> "$OUT"
echo "═══════════ FINE EXPORT ═══════════"          >> "$OUT"

# Statistiche
FILE_COUNT=$(grep -c '^📄 \.' "$OUT" || true)
TOTAL_SIZE=$(wc -c < "$OUT" | tr -d ' ')
echo ""
echo "✅ Export completato: $OUT"
echo "   File inclusi: $FILE_COUNT"
echo "   Dimensione totale: ${TOTAL_SIZE} bytes"
