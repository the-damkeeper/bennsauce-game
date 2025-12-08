# Quick Start Guide

## For Steam Deck Users

### Option 1: Build and Install (Recommended)

1. **On your PC:**
   ```bash
   cd "C:\Users\Ben\Desktop\BennSauce\Game\.BennSauce"
   npm install
   npm run build:linux
   ```

2. **Copy to Steam Deck:**
   - Find the `.AppImage` file in the `dist` folder
   - Transfer it to your Steam Deck (USB, network share, or Steam Cloud)

3. **On Steam Deck (Desktop Mode):**
   ```bash
   chmod +x BennSauce-0.8.43.AppImage
   ./BennSauce-0.8.43.AppImage
   ```

4. **Add to Steam:**
   - Open Steam in Desktop Mode
   - Games → Add a Non-Steam Game
   - Browse and select the AppImage
   - Switch to Gaming Mode and play!

### Option 2: Browser Method (No Build)

1. **Transfer game files to Steam Deck**
2. **In Desktop Mode, open Firefox:**
   ```
   file:///path/to/.BennSauce/index.html
   ```
3. **Add Firefox to Steam with launch options:**
   ```
   --kiosk file:///path/to/.BennSauce/index.html
   ```

## What's New

✅ **Full Gamepad Support**
- Left stick for movement
- Face buttons for jump/attack/loot/interact
- Shoulder buttons for inventory/equipment
- Start/Select for menus

✅ **Standalone Desktop App**
- No browser required
- Fullscreen support (F11)
- Better performance

## Controller Layout

```
     Y (Interact)
X (Loot) ⬤ ⬤ B (Attack)
     A (Jump)

LB (Inventory)    RB (Equipment)

Select (Settings) Start (Map)

Left Stick: Movement
```

## First Time Setup

1. Install Node.js from nodejs.org
2. Open terminal in game folder
3. Run: `npm install`
4. Run: `npm start` (to test)
5. Run: `npm run build:linux` (for Steam Deck build)

That's it! Your game now has full gamepad support and can run as a standalone app on Steam Deck!
