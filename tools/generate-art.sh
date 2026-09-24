#!/usr/bin/env bash
# Optional AI marketing art via Pollinations (skill: .claude/skills/polli).
# The game itself needs NO generated images — everything in-game is drawn in code.
# Use this for social posts, ads or an alternative Play Store feature graphic.
#
# Requirements: npm i -g @pollinations/cli && polli auth login   (or POLLINATIONS_API_KEY)
# In a Claude Code cloud session the hosts gen.pollinations.ai and media.pollinations.ai
# must be allowed in the environment's network settings.
set -euo pipefail
OUT="$(dirname "$0")/../docs/store/ai-art"
mkdir -p "$OUT"

STYLE="neon synthwave arcade game art, deep indigo night, glowing cyan and hot pink neon, geometric enemies, clean vector shapes, high contrast, no text, no watermark"

polli gen image "a small glowing cyan orb hero with a magenta visor surrounded by a swarm of neon triangle and hexagon monsters on a perspective grid under a striped synthwave sun, $STYLE" \
  --width 1024 --height 500 --output "$OUT/key-art-wide.png"

polli gen image "vertical poster, a glowing cyan orb hero firing chain lightning into a huge horde of cute angry neon geometric monsters, giant golden boss floating above a synthwave sun, $STYLE" \
  --width 1080 --height 1920 --output "$OUT/key-art-vertical.png"

polli gen image "square social media tile, neon orbiting blades circling a cyan orb hero, explosions of pink and gold particles, $STYLE" \
  --width 1080 --height 1080 --output "$OUT/social-square.png"

echo "Saved to $OUT"
