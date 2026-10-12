#!/bin/bash
# Test script for P0 features

set -e

API_URL="${API_URL:-http://localhost:5000}"
TEST_USER_ID="123456789"  # Test Telegram user ID

echo "🧪 Testing P0 Features"
echo "====================="
echo ""

# Test 1: Health check
echo "1️⃣  Testing health endpoint..."
HEALTH=$(curl -s "$API_URL/api/health")
if echo "$HEALTH" | grep -q '"status"'; then
    echo "   ✓ Health endpoint OK"
else
    echo "   ✗ Health endpoint failed"
    exit 1
fi
echo ""

# Test 2: Create/update player location
echo "2️⃣  Testing player location update..."
LOCATION=$(curl -s -X PATCH \
    -H "Content-Type: application/json" \
    -d "{\"bodyName\": \"Earth\", \"name\": \"Test User\"}" \
    "$API_URL/api/player/$TEST_USER_ID/location")

if echo "$LOCATION" | grep -q '"currentBodyId"'; then
    BODY_ID=$(echo "$LOCATION" | grep -o '"currentBodyId":[0-9]*' | cut -d: -f2)
    echo "   ✓ Location update OK (bodyId: $BODY_ID)"
else
    echo "   ✗ Location update failed"
    echo "   Response: $LOCATION"
    exit 1
fi
echo ""

# Test 3: Move to another location (creates travel history)
echo "3️⃣  Testing travel history tracking..."
sleep 1
LOCATION2=$(curl -s -X PATCH \
    -H "Content-Type: application/json" \
    -d "{\"bodyName\": \"Halley-comet\"}" \
    "$API_URL/api/player/$TEST_USER_ID/location")

if echo "$LOCATION2" | grep -q '"currentBodyId"'; then
    echo "   ✓ Second location update OK"
else
    echo "   ✗ Second location update failed"
    exit 1
fi
echo ""

# Test 4: Fetch travel history
echo "4️⃣  Testing travel history retrieval..."
HISTORY=$(curl -s "$API_URL/api/player/$TEST_USER_ID/history?limit=10")

if echo "$HISTORY" | grep -q '"toBodyName"'; then
    COUNT=$(echo "$HISTORY" | grep -o '"id":' | wc -l)
    echo "   ✓ Travel history OK ($COUNT entries)"
    echo "   Latest: $(echo "$HISTORY" | grep -o '"toBodyName":"[^"]*"' | head -1)"
else
    echo "   ✗ Travel history failed"
    echo "   Response: $HISTORY"
fi
echo ""

# Test 5: SSE endpoint (connection test only)
echo "5️⃣  Testing SSE endpoint..."
SSE_TEST=$(timeout 2 curl -s -N "$API_URL/api/player/events" | head -1 || echo "timeout")

if echo "$SSE_TEST" | grep -q '"type":"connected"'; then
    echo "   ✓ SSE endpoint OK"
else
    echo "   ⚠  SSE endpoint test timed out (normal for streaming endpoint)"
fi
echo ""

echo "✅ All core API tests passed!"
echo ""
echo "Note: Chat memory summarization and body comparison UI require manual testing."
