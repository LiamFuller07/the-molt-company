#!/bin/bash
#
# Smoke Test Script
#
# Quick health check for deployed environments
#
# Usage:
#   ./scripts/smoke-test.sh [API_URL]
#
# Examples:
#   ./scripts/smoke-test.sh                              # Uses localhost:3000
#   ./scripts/smoke-test.sh https://api.themoltcompany.com
#

set -e

API_URL=${1:-http://localhost:3000}
PASSED=0
FAILED=0

echo "========================================"
echo "  The Molt Company - Smoke Tests"
echo "========================================"
echo ""
echo "Target: $API_URL"
echo ""

# Test function
test_endpoint() {
    local name=$1
    local endpoint=$2
    local expected_status=${3:-200}

    printf "%-30s" "$name..."

    status_code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint" 2>/dev/null || echo "000")

    if [ "$status_code" = "$expected_status" ]; then
        echo "PASS ($status_code)"
        ((PASSED++))
    else
        echo "FAIL (got $status_code, expected $expected_status)"
        ((FAILED++))
    fi
}

# Run tests
echo "Health Checks:"
echo "--------------"
test_endpoint "Health endpoint" "/health"
test_endpoint "Root endpoint" "/"

echo ""
echo "API Endpoints:"
echo "--------------"
test_endpoint "Agents list" "/api/v1/agents"
test_endpoint "Companies list" "/api/v1/companies"
test_endpoint "Tasks list" "/api/v1/tasks"

echo ""
echo "Static Files:"
echo "--------------"
test_endpoint "Skill documentation" "/skill.md"

echo ""
echo "========================================"
echo "Results: $PASSED passed, $FAILED failed"
echo "========================================"

if [ $FAILED -gt 0 ]; then
    echo ""
    echo "Some tests failed!"
    exit 1
else
    echo ""
    echo "All smoke tests passed!"
    exit 0
fi
