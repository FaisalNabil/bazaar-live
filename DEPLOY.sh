#!/bin/bash
# Bazaar Live — One-shot GitHub deploy script
# Run this once from inside the bd-price-tracker folder

set -e

REPO="https://github.com/FaisalNabil/bazaar-live.git"

echo ""
echo "🛒  Bazaar Live — GitHub deploy"
echo "================================"
echo ""

# 1. Init repo if not already a git repo
if [ ! -d ".git" ]; then
  git init
  echo "✅  Git repo initialized"
else
  echo "✅  Git repo already exists"
fi

# 2. Rename branch to main
git branch -M main

# 3. Stage everything
git add index.html package.json README.md data/ scraper/ .github/ .gitignore 2>/dev/null || \
git add index.html package.json README.md data/ scraper/ .github/

echo "✅  Files staged"

# 4. Initial commit
git commit -m "init: Bazaar Live 🛒" 2>/dev/null || echo "   (nothing new to commit)"

# 5. Set remote
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"

echo "✅  Remote set to $REPO"

# 6. Push
echo ""
echo "⬆️   Pushing to GitHub…"
git push -u origin main

echo ""
echo "✅  Done! Now go to:"
echo "   https://github.com/FaisalNabil/bazaar-live/settings/pages"
echo "   → Source: GitHub Actions"
echo "   → Save"
echo ""
echo "🌐  Your site will be live at:"
echo "   https://faisalnabil.github.io/bazaar-live/"
echo ""
