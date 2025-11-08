#!/bin/bash

# A2A Payment Testing Script
# Tests the Agent-to-Agent payment flow

echo "🤖 Testing A2A (Agent-to-Agent) Payment System"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:3000"
TOKEN="YOUR_AUTH_TOKEN_HERE"  # Replace with actual token

echo -e "${BLUE}Step 1: Create A2A Payment Request${NC}"
echo "-------------------------------------------"

PAYMENT_REQUEST=$(curl -s -X POST "$API_URL/api/a2a/request" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "test-contract-123",
    "amount": "10",
    "description": "Test A2A payment - Monthly rent",
    "toWalletAddress": "0x8cb0a289928f88ab90291758513208f344e8354d",
    "network": "ARC-TESTNET"
  }')

echo "$PAYMENT_REQUEST" | jq '.'
echo ""

# Extract payment requirements
PAYMENT_REQ=$(echo "$PAYMENT_REQUEST" | jq -c '.paymentRequest')

echo -e "${BLUE}Step 2: Verify Payment Request${NC}"
echo "-------------------------------------------"

VERIFY_RESULT=$(curl -s -X POST "$API_URL/api/a2a/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentRequest\": $PAYMENT_REQ,
    \"contractId\": \"test-contract-123\"
  }")

echo "$VERIFY_RESULT" | jq '.'
echo ""

echo -e "${YELLOW}Step 3: Process Payment (Manual confirmation)${NC}"
echo "-------------------------------------------"
echo "To process the payment, run:"
echo ""
echo "curl -X POST $API_URL/api/a2a/process \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"paymentRequest\": $PAYMENT_REQ,"
echo "    \"walletId\": \"YOUR_WALLET_ID\","
echo "    \"autoApprove\": true"
echo "  }'"
echo ""

echo -e "${GREEN}✅ A2A Test Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Replace YOUR_AUTH_TOKEN_HERE with actual token"
echo "2. Replace YOUR_WALLET_ID with actual wallet ID"
echo "3. Run the process payment command above"
echo ""

