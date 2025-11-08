# 🤖 AUTONOMOUS A2A TEST BUTTON - FULLY AUTOMATIC!

Paste this in browser console to create a button that triggers REAL agent collaboration:

```javascript
// Remove old button
const oldBtn = document.querySelector('button[data-test="a2a"]');
if(oldBtn) oldBtn.remove();

// Create AUTONOMOUS test button
const testBtn = document.createElement('button');
testBtn.setAttribute('data-test', 'a2a');
testBtn.innerHTML = '🤖 Autonomous A2A Test';
testBtn.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 99999;
  padding: 15px 25px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  transition: transform 0.2s;
`;

testBtn.onmouseover = () => testBtn.style.transform = 'scale(1.05)';
testBtn.onmouseout = () => testBtn.style.transform = 'scale(1)';

testBtn.onclick = async () => {
  const token = localStorage.getItem('auth_token');
  
  try {
    testBtn.innerHTML = '⏳ Agent Working...';
    testBtn.disabled = true;
    
    // Get wallet
    const walletsResp = await fetch('http://localhost:3000/api/wallets/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const walletsData = await walletsResp.json();
    const myWallet = walletsData.wallets?.[0] || walletsData[0];
    
    // Get contract
    let contractId = window.location.pathname.split('/').pop();
    if (!contractId || contractId === 'contracts' || contractId === 'a2a' || contractId === 'dashboard') {
      const contractsResp = await fetch('http://localhost:3000/api/contracts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contractsData = await contractsResp.json();
      contractId = contractsData.contracts[0].id;
    }
    
    // Create request - AGENT AUTO-EVALUATES!
    const resp = await fetch('http://localhost:3000/api/a2a/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contractId: contractId,
        amount: "2",
        description: "Test A2A Payment - " + new Date().toLocaleTimeString(),
        fromWalletId: myWallet.id,
        toWalletAddress: "0x5e93c689d4bc0a87690d6cd53119dbe7349cb00d",
        network: "ARC-TESTNET"
      })
    });
    
    const result = await resp.json();
    console.log('🤖 Full Response:', result);
    
    testBtn.innerHTML = '✅ Done!';
    testBtn.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
    
    // Show agent decision
    if (result.agentDecision) {
      const decision = result.agentDecision;
      const emoji = decision.approved ? '✅' : '❌';
      const status = decision.approved ? 'APPROVED' : 'REJECTED';
      
      alert(`${emoji} AGENT ${status}!\n\n🤖 AI Reasoning:\n"${decision.reasoning}"\n\n${result.message}\n\nCheck Activity Log for full details!`);
    } else {
      alert('✅ Request Created!\n\nA2A not enabled or agent evaluation pending.\n\nCheck A2A page!');
    }
    
    // Auto-refresh after 2 seconds
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch(err) {
    console.error('Error:', err);
    testBtn.innerHTML = '❌ Error';
    testBtn.style.background = '#e74c3c';
    alert('❌ Error: ' + err.message);
    
    setTimeout(() => {
      testBtn.innerHTML = '🤖 Autonomous A2A Test';
      testBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      testBtn.disabled = false;
    }, 3000);
  }
};

document.body.appendChild(testBtn);
console.log('🤖 AUTONOMOUS TEST READY!');
console.log('Click button → Agent auto-evaluates → See decision instantly!');
```

## 🎯 WHAT THIS DOES (FULLY AUTONOMOUS!):

1. **You click button** → Creates payment request
2. **Backend receives it** → Immediately triggers AI agent
3. **Agent evaluates** → Checks contract terms automatically
4. **Decision made** → Approved/Rejected with reasoning
5. **Status updated** → Saved in database
6. **Alert shows** → Agent's decision and reasoning
7. **Page refreshes** → See updated status in UI!

## 🔥 THIS IS THE REAL A2A MAGIC!

- ✅ **Automatic evaluation** - No manual clicks needed!
- ✅ **Instant decision** - Agent responds immediately!
- ✅ **Transparent reasoning** - See why approved/rejected!
- ✅ **Real collaboration** - Agents actually "talk"!
- ✅ **Activity logged** - Everything tracked!

## 📝 FOR DEMO:

Show how clicking ONE button triggers ENTIRE autonomous flow:
1. Request sent
2. Agent evaluates
3. Decision made
4. Status updated
5. Activity logged

**All automatically! No manual intervention!**

