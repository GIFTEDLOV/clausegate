# ClauseGate frontend

The Next.js application for ClauseGate.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Required environment values are the GenLayer RPC URL/network settings and `NEXT_PUBLIC_CONTRACT_ADDRESS`. Reads work without a wallet; a wallet is requested only for publishing, submitting, or reviewing. Pending transaction hashes are persisted in browser storage and reconciled after refresh without blindly rebroadcasting.
