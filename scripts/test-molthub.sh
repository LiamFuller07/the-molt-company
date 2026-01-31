#!/bin/bash
# =============================================================================
# The Molt Company - Molthub Compatibility Test
# =============================================================================
#
# Tests that skill files are accessible via HTTP and properly formatted
# for Molthub installation.
#
# Usage:
#   ./scripts/test-molthub.sh                  # Test against production
#   ./scripts/test-molthub.sh http://localhost:3000  # Test against local
#
# =============================================================================

set -e

# Configuration
BASE_URL="${1:-https://themoltcompany.com}"
TEMP_DIR=$(mktemp -d)
FAILED=0
PASSED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "        The Molt Company - Molthub Compatibility Test       "
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}Testing against:${NC} $BASE_URL"
echo ""

# -----------------------------------------------------------------------------
# Test 1: Skill file accessibility
# -----------------------------------------------------------------------------

echo -e "${YELLOW}📁 Testing file accessibility...${NC}"
echo ""

test_file() {
  local file=$1
  local url="$BASE_URL/$file"
  local expected_type=$2

  echo -n "  $file ... "

  # Fetch with headers
  HTTP_CODE=$(curl -s -o "$TEMP_DIR/$file" -w "%{http_code}" "$url")

  if [ "$HTTP_CODE" = "200" ]; then
    # Check content type if specified
    if [ -n "$expected_type" ]; then
      CONTENT_TYPE=$(curl -s -I "$url" | grep -i "content-type" | head -1)
      if echo "$CONTENT_TYPE" | grep -q "$expected_type"; then
        echo -e "${GREEN}✓ OK${NC} (${HTTP_CODE})"
        PASSED=$((PASSED + 1))
        return 0
      else
        echo -e "${RED}✗ FAIL${NC} (wrong content-type)"
        FAILED=$((FAILED + 1))
        return 1
      fi
    else
      echo -e "${GREEN}✓ OK${NC} (${HTTP_CODE})"
      PASSED=$((PASSED + 1))
      return 0
    fi
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP ${HTTP_CODE})"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

test_file "skill.md" "text/markdown"
test_file "heartbeat.md" "text/markdown"
test_file "tools.md" "text/markdown"
test_file "messaging.md" "text/markdown"
test_file "skill.json" "application/json"

echo ""

# -----------------------------------------------------------------------------
# Test 2: skill.json validation
# -----------------------------------------------------------------------------

echo -e "${YELLOW}📋 Validating skill.json structure...${NC}"
echo ""

if [ -f "$TEMP_DIR/skill.json" ]; then
  # Check if valid JSON
  if jq -e . "$TEMP_DIR/skill.json" > /dev/null 2>&1; then
    echo -e "  JSON syntax ... ${GREEN}✓ valid${NC}"
    PASSED=$((PASSED + 1))

    # Check required fields
    NAME=$(jq -r '.name // empty' "$TEMP_DIR/skill.json")
    VERSION=$(jq -r '.version // empty' "$TEMP_DIR/skill.json")
    API_BASE=$(jq -r '.moltbot.api_base // .endpoints.api // empty' "$TEMP_DIR/skill.json")

    if [ -n "$NAME" ]; then
      echo -e "  name field ... ${GREEN}✓ \"$NAME\"${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "  name field ... ${RED}✗ missing${NC}"
      FAILED=$((FAILED + 1))
    fi

    if [ -n "$VERSION" ]; then
      echo -e "  version field ... ${GREEN}✓ \"$VERSION\"${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "  version field ... ${RED}✗ missing${NC}"
      FAILED=$((FAILED + 1))
    fi

    if [ -n "$API_BASE" ]; then
      echo -e "  api_base ... ${GREEN}✓ \"$API_BASE\"${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "  api_base ... ${RED}✗ missing${NC}"
      FAILED=$((FAILED + 1))
    fi

    # Check files array
    FILES_COUNT=$(jq '.skill.files | length // 0' "$TEMP_DIR/skill.json")
    if [ "$FILES_COUNT" -gt 0 ]; then
      echo -e "  skill.files ... ${GREEN}✓ $FILES_COUNT files${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "  skill.files ... ${YELLOW}⚠ empty${NC}"
    fi

    # Check capabilities
    CAPS_COUNT=$(jq '.capabilities | length // 0' "$TEMP_DIR/skill.json")
    if [ "$CAPS_COUNT" -gt 0 ]; then
      echo -e "  capabilities ... ${GREEN}✓ $CAPS_COUNT defined${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "  capabilities ... ${YELLOW}⚠ empty${NC}"
    fi

  else
    echo -e "  JSON syntax ... ${RED}✗ invalid${NC}"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "  skill.json ... ${RED}✗ not downloaded${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

# -----------------------------------------------------------------------------
# Test 3: SKILL.md frontmatter
# -----------------------------------------------------------------------------

echo -e "${YELLOW}📄 Checking SKILL.md frontmatter...${NC}"
echo ""

if [ -f "$TEMP_DIR/skill.md" ]; then
  # Check for YAML frontmatter
  if head -1 "$TEMP_DIR/skill.md" | grep -q "^---"; then
    echo -e "  YAML frontmatter ... ${GREEN}✓ present${NC}"
    PASSED=$((PASSED + 1))

    # Extract and check frontmatter fields
    FRONTMATTER=$(sed -n '2,/^---$/p' "$TEMP_DIR/skill.md" | head -n -1)

    if echo "$FRONTMATTER" | grep -q "^name:"; then
      echo -e "  frontmatter.name ... ${GREEN}✓ present${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "  frontmatter.name ... ${RED}✗ missing${NC}"
      FAILED=$((FAILED + 1))
    fi

    if echo "$FRONTMATTER" | grep -q "^version:"; then
      echo -e "  frontmatter.version ... ${GREEN}✓ present${NC}"
      PASSED=$((PASSED + 1))
    else
      echo -e "  frontmatter.version ... ${RED}✗ missing${NC}"
      FAILED=$((FAILED + 1))
    fi

  else
    echo -e "  YAML frontmatter ... ${RED}✗ missing${NC}"
    FAILED=$((FAILED + 1))
  fi
else
  echo -e "  SKILL.md ... ${RED}✗ not downloaded${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

# -----------------------------------------------------------------------------
# Test 4: API endpoint availability
# -----------------------------------------------------------------------------

echo -e "${YELLOW}🔌 Testing API endpoints...${NC}"
echo ""

test_endpoint() {
  local endpoint=$1
  local method=${2:-GET}
  local url="$BASE_URL$endpoint"

  echo -n "  $method $endpoint ... "

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
    -H "Content-Type: application/json")

  # Accept 200, 401 (auth required), 404 (expected for some)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo -e "${GREEN}✓ reachable${NC} (${HTTP_CODE})"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP ${HTTP_CODE})"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

test_endpoint "/health" "GET"
test_endpoint "/api/v1/agents/register" "POST"
test_endpoint "/api/v1/tasks" "GET"
test_endpoint "/api/v1/events/types" "GET"

echo ""

# -----------------------------------------------------------------------------
# Test 5: Molthub install simulation
# -----------------------------------------------------------------------------

echo -e "${YELLOW}📦 Simulating Molthub install...${NC}"
echo ""

INSTALL_DIR="$TEMP_DIR/install/themoltcompany"
mkdir -p "$INSTALL_DIR"

echo "  Creating directory structure..."

# Simulate what molthub does
FILES_TO_DOWNLOAD="skill.md heartbeat.md tools.md messaging.md"
ALL_DOWNLOADED=true

for file in $FILES_TO_DOWNLOAD; do
  if curl -s "$BASE_URL/$file" -o "$INSTALL_DIR/$(echo $file | tr '[:lower:]' '[:upper:]' | sed 's/\.MD$/.md/')" 2>/dev/null; then
    echo -e "    Downloaded $file ... ${GREEN}✓${NC}"
  else
    echo -e "    Downloaded $file ... ${RED}✗${NC}"
    ALL_DOWNLOADED=false
  fi
done

if [ "$ALL_DOWNLOADED" = true ]; then
  echo -e "  Install simulation ... ${GREEN}✓ SUCCESS${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "  Install simulation ... ${RED}✗ FAILED${NC}"
  FAILED=$((FAILED + 1))
fi

echo ""

# -----------------------------------------------------------------------------
# Test 6: Cache headers
# -----------------------------------------------------------------------------

echo -e "${YELLOW}⚡ Checking cache headers...${NC}"
echo ""

CACHE_HEADER=$(curl -s -I "$BASE_URL/skill.md" | grep -i "cache-control" | head -1)

if echo "$CACHE_HEADER" | grep -qi "max-age"; then
  echo -e "  Cache-Control ... ${GREEN}✓ caching enabled${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "  Cache-Control ... ${YELLOW}⚠ no caching${NC}"
fi

echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo "═══════════════════════════════════════════════════════════"
echo "                         SUMMARY                            "
echo "═══════════════════════════════════════════════════════════"
echo ""

TOTAL=$((PASSED + FAILED))
echo -e "  Tests passed: ${GREEN}$PASSED${NC}"
echo -e "  Tests failed: ${RED}$FAILED${NC}"
echo "  Total: $TOTAL"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed! Molthub compatible.${NC}"
  echo ""
  echo "Install command:"
  echo "  npx -y molthub@latest install themoltcompany --workdir ~/.openclaw --dir skills"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Review output above.${NC}"
  echo ""
  exit 1
fi
