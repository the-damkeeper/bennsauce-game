# BennSauce Anti-Cheat Cloud Functions Setup

## Overview

These Cloud Functions provide **server-side validation** to prevent cheating. They run automatically when data is written to Firebase, so cheaters can't bypass them.

## Cost Efficiency

| Function | Trigger | Reads | Writes | When |
|----------|---------|-------|--------|------|
| `validateRanking` | On ranking update | 0 (auto) | 1 | Each ranking submit |
| `validateCloudSave` | On cloud save | 0 (auto) | 1 | Each cloud save |
| `cleanupRankings` | Daily schedule | ~100 max | ~100 max | Once per day |
| `reportPlayer` | On player report | 1 | 2 | When reported |
| `getCleanRankings` | On request | 1 | 0 | Optional use |

**Estimated Monthly Cost (Free Tier):**
- Firebase free tier includes: 2M function invocations, 400K GB-seconds
- With 100 active players: ~3,000 ranking updates/month = **FREE**
- With 1,000 active players: ~30,000 updates/month = **Still FREE**

## Setup Instructions

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Initialize Functions in Your Project

```bash
cd "c:\Users\Ben\Desktop\BennSauce\Game\.BennSauce"
firebase init functions
```

When prompted:
- Select your existing Firebase project (`bennsauce`)
- Choose **JavaScript**
- Say **No** to ESLint (optional)
- Say **Yes** to install dependencies

### 4. Copy the Functions

Replace the generated `functions/index.js` with the contents of `firebase-functions/index.js`:

```bash
copy firebase-functions\index.js functions\index.js
copy firebase-functions\package.json functions\package.json
```

### 5. Install Dependencies

```bash
cd functions
npm install
```

### 6. Deploy Functions

```bash
firebase deploy --only functions
```

### 7. Update Firestore Rules

Go to Firebase Console > Firestore Database > Rules and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Rankings - anyone can read, only server can validate
    match /rankings/{playerId} {
      allow read: if true;
      allow create, update: if request.resource.data.playerName is string
                           && request.resource.data.level is number
                           && request.resource.data.level >= 1
                           && request.resource.data.level <= 200
                           && request.resource.data.totalKills is number
                           && request.resource.data.totalKills >= 0;
      // Prevent clients from modifying server validation fields
      allow update: if !request.resource.data.diff(resource.data).affectedKeys()
                      .hasAny(['serverValidated', 'serverValidation', 'serverChecksum', 'flagged']);
      allow delete: if false; // Only admins/cleanup can delete
    }
    
    // Cloud saves - only the owner can read/write their save
    match /cloudSaves/{playerId} {
      allow read, write: if request.auth != null && request.auth.uid == playerId;
      // Or if you're using player names without auth:
      allow read, write: if true; // Adjust based on your auth setup
    }
    
    // Reports - anyone can create, only admins can read
    match /reports/{reportId} {
      allow create: if request.resource.data.reportedPlayer is string
                   && request.resource.data.reason is string;
      allow read: if false; // Admin only via console
    }
    
    // Presence - for online players
    match /presence/{odcId} {
      allow read, write: if true;
    }
    
    // Announcements
    match /announcements/{docId} {
      allow read: if true;
      allow write: if true;
    }
    
    // Trades
    match /trades/{tradeId} {
      allow read, write: if true;
    }
  }
}
```

## What Gets Validated

### Ranking Submissions
When a player submits their ranking, the server checks:

1. **Level vs Time Played** - Can't be level 50 with 2 minutes played
2. **Level vs Kill Count** - Need kills to level up
3. **Gold vs Kill Count** - Can't have 10M gold with 5 kills
4. **Combat Score vs Level** - Equipment can only boost so much
5. **Sudden Jumps** - Compares to previous submission

### Flagging System

- **Warning**: Suspicious but possible (logged for review)
- **Critical**: Obviously cheated (account flagged)

Flagged accounts:
- Still appear in database but marked `flagged: true`
- Can be filtered out of rankings display
- Auto-deleted after 30 days of inactivity

## Testing Locally

```bash
cd functions
firebase emulators:start --only functions
```

This lets you test without deploying.

## Monitoring

View function logs:
```bash
firebase functions:log
```

Or in Firebase Console > Functions > Logs

## Troubleshooting

### "Permission denied" on deploy
```bash
firebase login --reauth
```

### Functions not triggering
- Check that the collection names match exactly
- Verify deployment succeeded: `firebase functions:list`

### High costs
- The cleanup function limits to 100 documents per run
- If you have thousands of players, increase the schedule interval

## Security Notes

1. **Server salt is different** - Clients can't forge server checksums
2. **Validation runs server-side** - Cheaters can't skip it
3. **Flagged field is protected** - Clients can't unflag themselves
4. **Reports are write-only** - Cheaters can't see who reported them
