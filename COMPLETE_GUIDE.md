# 🎮 BennSauce - Complete Setup Guide

## ✅ What's Been Added

### 1. **Full Gamepad Support**
- Works with Xbox, PlayStation, Steam Deck, and generic controllers
- Analog stick movement with customizable dead zones
- All game actions mapped to controller buttons
- Haptic feedback support (vibration)

### 2. **Electron Desktop App**
- Standalone executable (no browser needed)
- Fullscreen support
- Better performance
- Easy distribution

## 🚀 Quick Start

### For Immediate Testing
1. Open `gamepad-test.html` in your browser
2. Connect your controller
3. Verify all buttons and sticks work

### To Run the Game with Gamepad Support
1. Open `index.html` in your browser
2. Connect your controller
3. Game automatically detects it!

### To Create Desktop App

**Windows Users:**
```bash
# Double-click setup.bat, OR:
npm install
npm start
```

**Linux/Mac Users:**
```bash
chmod +x setup.sh
./setup.sh
# OR manually:
npm install
npm start
```

## 🎯 Steam Deck Installation

### Method 1: AppImage (Recommended)
```bash
# On your PC (Windows):
npm install
npm run build:linux

# Transfer the .AppImage from dist/ folder to Steam Deck
# On Steam Deck (Desktop Mode):
chmod +x BennSauce-*.AppImage
./BennSauce-*.AppImage
```

### Method 2: Add to Steam Library
1. Build the AppImage (see above)
2. Desktop Mode → Open Steam
3. Games → Add Non-Steam Game
4. Browse to the AppImage
5. Right-click game → Properties → Configure Steam Input
6. Switch to Gaming Mode → Play!

## 🎮 Controller Layout

### Steam Deck / Xbox Controller
```
        Y (Interact)
  X (Loot)  ◯  B (Attack)
        A (Jump)

LB (Inventory)         RB (Equipment)
LT (unused)            RT (unused)

View (Settings)        Menu (Map)

Left Stick: Movement
Right Stick: (reserved for future use)
D-Pad: Alternative movement
```

### Button Mappings
| Button | Action | Keyboard Equivalent |
|--------|--------|-------------------|
| A/Cross | Jump | Alt |
| B/Circle | Attack | Ctrl |
| X/Square | Loot | Z |
| Y/Triangle | Interact | Y |
| LB/L1 | Inventory | I |
| RB/R1 | Equipment | E |
| View/Select | Settings | Escape |
| Menu/Start | World Map | W |
| D-Pad/Left Stick | Movement | Arrow Keys |

## 📁 Files Added

### Core Files
- `gamepadManager.js` - Handles all controller input
- `electron-main.js` - Electron app entry point
- `package.json` - Node.js project config

### Helper Files
- `setup.bat` - Windows setup wizard
- `setup.sh` - Linux/Mac setup wizard
- `gamepad-test.html` - Test your controller
- `ELECTRON_SETUP.md` - Detailed Electron guide
- `QUICKSTART.md` - Quick reference
- `.gitignore` - Git ignore patterns

## 🔧 Customizing Controls

Edit `gamepadManager.js` to change button mappings:

```javascript
this.buttonMap = {
    0: 'jump',        // Change to any action
    1: 'attack',      // Available: jump, attack, loot,
    2: 'loot',        // interact, inventory, equipment,
    3: 'interact',    // settings, world-map, etc.
    // ... more buttons
};
```

## 🐛 Troubleshooting

### Gamepad Not Working
1. Open browser console (F12)
2. Look for "Gamepad connected" message
3. Try `gamepad-test.html` to verify hardware
4. Disconnect and reconnect controller

### Electron Build Fails
```bash
# Delete and reinstall:
rm -rf node_modules
npm install
```

### Steam Deck Performance
- Set game to native 800p resolution
- Enable "Allow Tearing" in properties
- Close background applications
- Consider 40Hz refresh rate lock

### Linux Permission Errors
```bash
# Make scripts executable:
chmod +x setup.sh
chmod +x BennSauce-*.AppImage
```

## 📦 Building for Distribution

### Windows
```bash
npm run build:win
# Creates: dist/BennSauce Setup 0.8.43.exe
# and: dist/BennSauce 0.8.43.exe (portable)
```

### Linux (Steam Deck)
```bash
npm run build:linux
# Creates: dist/BennSauce-0.8.43.AppImage
# and: dist/bennsauce-game_0.8.43_amd64.deb
```

### macOS
```bash
npm run build:mac
# Creates: dist/BennSauce-0.8.43.dmg
```

### All Platforms
```bash
npm run build:all
# Creates all of the above
```

## 🎨 Adding a Custom Icon

1. Create a 512x512 PNG image
2. Save as `icon.png` in game folder
3. Rebuild the app

## 🔄 Updating the Game

After making changes to game code:
```bash
# For development:
npm start

# For distribution:
npm run build:linux  # or build:win, build:mac
```

## 📝 Next Steps

1. ✅ Test gamepad with `gamepad-test.html`
2. ✅ Run game in browser with controller
3. ✅ Test Electron app with `npm start`
4. ✅ Build for Steam Deck with `npm run build:linux`
5. ✅ Transfer AppImage to Steam Deck
6. ✅ Add to Steam library
7. ✅ Configure Steam Input (optional)
8. ✅ Play in Gaming Mode!

## 💡 Tips

- F11 toggles fullscreen in Electron app
- Controller works in both browser and Electron
- Steam Input can override mappings if needed
- Dead zone is 15% by default (customizable)
- Vibration works if controller supports it

## 🆘 Need Help?

- Check console for errors (F12)
- Verify Node.js is installed: `node --version`
- Test controller with `gamepad-test.html`
- Review `ELECTRON_SETUP.md` for details

Enjoy playing BennSauce with full controller support! 🎮✨
