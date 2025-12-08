# Firebase Ranking System Setup Guide

## Overview
Your game now has a complete global ranking system using Firebase Firestore. Players can submit their scores and view leaderboards for multiple categories.

## Features Implemented
- ✅ **7 Ranking Categories**: Level, Total Kills, Gold, Achievements, Bestiary Completion, Boss Kills, Combat Score
- ✅ **Anti-Cheat System**: Checksum validation to prevent score tampering
- ✅ **Rate Limiting**: Maximum 1 submission per 10 minutes per player
- ✅ **Auto-Submission**: Automatically submits when player levels up (if 5+ minutes played)
- ✅ **Manual Submission**: Players can manually submit via Rankings window
- ✅ **Real-Time Leaderboard**: View top 100 players in each category
- ✅ **Player Rank Display**: Shows player's global rank in each category
- ✅ **Hotkey Support**: Press 'R' to open Rankings window
- ✅ **Global Chat**: Real-time chat with other players online
- ✅ **Online Presence**: See who's online and what map they're on
- ✅ **Player Trading**: Trade items and gold with other online players

## Setup Instructions

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name (e.g., "bennsauce-game")
4. (Optional) Enable Google Analytics
5. Click "Create project"

### 2. Enable Firestore Database
1. In your Firebase project, click "Firestore Database" in the left menu
2. Click "Create database"
3. Choose a location (select closest to your players)
4. Start in **production mode** (we'll add security rules next)
5. Click "Enable"

### 3. Get Firebase Configuration
1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon `</>` to add a web app
5. Enter app nickname (e.g., "bennsauce-web")
6. Click "Register app"
7. Copy the configuration object shown

### 4. Add Firebase Credentials
Open `firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY_HERE",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

### 5. Set Firestore Security Rules
In Firebase Console > Firestore Database > Rules tab, add these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Rankings collection
    match /rankings/{playerId} {
      // Allow anyone to read rankings
      allow read: if true;
      
      // Allow writes (anyone can create/update their ranking)
      allow write: if request.resource.data.playerName is string
                   && request.resource.data.level is number
                   && request.resource.data.checksum is string;
      
      // Prevent deletes
      allow delete: if false;
    }
    
    // Global Chat collection
    match /globalChat/{messageId} {
      // Allow anyone to read chat messages
      allow read: if true;
      
      // Allow writes with basic validation
      allow create: if request.resource.data.playerName is string
                    && request.resource.data.message is string
                    && request.resource.data.message.size() <= 200;
      
      // Prevent updates and deletes (messages are immutable)
      allow update, delete: if false;
    }
    
    // Announcements collection (level ups, job advancements, etc.)
    match /announcements/{announcementId} {
      // Allow anyone to read announcements
      allow read: if true;
      
      // Allow writes with basic validation
      allow create: if request.resource.data.playerName is string
                    && request.resource.data.type is string;
      
      // Prevent updates and deletes
      allow update, delete: if false;
    }
    
    // Characters collection (cloud save data)
    match /characters/{characterName} {
      // Allow anyone to read character data
      allow read: if true;
      
      // Allow writes with basic validation
      allow write: if request.resource.data.name is string
                   && request.resource.data.level is number
                   && request.resource.data.class is string;
      
      // Allow deletes
      allow delete: if true;
    }
    
    // Online Players / Presence collection
    match /presence/{playerId} {
      // Allow anyone to read online players list
      allow read: if true;
      
      // Allow writes for presence updates
      allow write: if request.resource.data.playerName is string
                   && request.resource.data.level is number;
      
      // Allow deletes for going offline
      allow delete: if true;
    }
    
    // Player Sync collection (multiplayer positions/animations)
    match /playerSync/{playerId} {
      // Allow anyone to read player positions
      allow read: if true;
      
      // Allow writes for position updates
      allow write: if request.resource.data.playerName is string
                   && request.resource.data.x is number
                   && request.resource.data.y is number;
      
      // Allow deletes for cleanup
      allow delete: if true;
    }
    
    // Trades collection
    match /trades/{tradeId} {
      // Allow all operations for trades
      allow read, write: if true;
    }
  }
}
```

Click "Publish" to save the rules.

### 6. Optional: Create Firestore Indexes (Not Required)
The system now uses client-side sorting, so no indexes are required! The rankings will work immediately after setting up security rules.

### 7. Test the System
1. Load your game
2. Play for a bit to generate stats
3. Press 'R' to open Rankings window
4. Click "Submit My Ranking"
5. Switch between tabs to view different categories
6. Check Firebase Console > Firestore Database to see your entry

## How It Works

### Data Structure
Each ranking entry in Firestore contains:
```javascript
{
  playerName: "PlayerName",
  level: 50,
  category: "level",
  score: 50,
  timestamp: Timestamp,
  checksum: "hash_value",
  stats: {
    totalKills: 1234,
    gold: 50000,
    achievements: 25,
    bestiaryPercent: 85.5,
    bossKills: 12
  }
}
```

### Anti-Cheat System
- Generates checksum using player stats + secret salt
- Server can validate checksum to detect tampering
- Rate limiting prevents spam submissions
- Duplicate player names only keep highest score per category

### Ranking Categories
1. **Level** - Highest character level
2. **Total Kills** - Most monsters defeated
3. **Gold** - Most gold accumulated
4. **Achievements** - Most achievements unlocked
5. **Bestiary** - Highest bestiary completion %
6. **Boss Kills** - Most boss monsters defeated

## Usage

### For Players
- Press **R** to open Rankings window
- Press **O** to open Online Players window
- Click tabs to view different ranking categories
- Click "Submit My Ranking" to submit current stats
- Your entry is highlighted in gold on the leaderboard
- Your current rank shows at the top

### Global Chat
- Press **Enter** to type chat messages
- Messages are visible to all online players
- Chat history shows last 50 messages

### Online Players & Trading
- Press **O** to see who's online
- Click "Trade" next to a player's name to initiate trade
- Accept/decline incoming trade requests
- Add items from your inventory to the trade
- Enter gold amount to trade
- Both players must confirm to complete trade

### For Developers
- Rankings auto-submit when player levels up (5+ min cooldown)
- Manual submission via `submitRanking()` function
- Customize checksum salt in `firebase-config.js` for extra security
- Add more categories by extending the system

## Troubleshooting

### Rankings window won't open
- Check browser console for errors
- Verify Firebase credentials are correct
- Ensure `initializeFirebase()` was called

### "Failed to submit ranking" error
- Check Firebase security rules allow writes
- Verify internet connection
- Check browser console for specific error
- Ensure Firestore is enabled in Firebase Console

### Rankings not displaying
- Verify Firebase configuration is correct
- Check Firebase Console > Firestore Database for entries
- Check browser console for errors
- Ensure indexes are built (not in "Building" state)

### Checksum validation fails
- Don't modify the checksum generation logic
- Keep the secret salt consistent
- Ensure all required stats are present

## Next Steps (Optional)
1. **Cloud Functions**: Add server-side validation
2. **Advanced Anti-Cheat**: Implement server-side stat verification
3. **Season System**: Reset rankings periodically
4. **More Categories**: Add specific boss speedruns, etc.
5. **Rewards**: Give in-game rewards for top rankings
6. **Social Features**: Add player profiles, clans, etc.

## Cost Considerations
Firebase free tier includes:
- 50,000 reads/day
- 20,000 writes/day
- 1GB storage

This should be plenty for a small-medium player base. Monitor usage in Firebase Console.

## Security Notes
- Never expose Firebase admin SDK keys in client code
- The checksum provides basic validation but isn't cryptographically secure
- For serious anti-cheat, implement server-side validation
- Consider rate limiting to prevent abuse
- Monitor Firestore usage to prevent spam

---

**System Status**: ✅ Fully Integrated and Ready to Use
**Last Updated**: Created during Firebase implementation
**Version**: 1.0
