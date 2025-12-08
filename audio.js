// Global variables to manage audio state
let currentBGM = null;
let sfxVolume = 0.5;
let bgmVolume = 0.3;
let lastSfxVolume = 0.5;
let lastBgmVolume = 0.3;
let pendingBGMTrack = null;

// Object containing all audio files for easy management
const audioAssets = {
    // SFX
    enterGame: new Audio('https://sounds.larry.science/sounds/819BC28C90F72157011EBBC212A886D383FF41B4E54BA3366B85FDAF5A0ACC23.mp3'),
    jump: new Audio('https://sounds.larry.science/sounds/4385B3B2536FF508062806E8434CCCEDD50724A1C4F76EFD7EE0A802C065A7C4.mp3'),
    attack: new Audio('https://sounds.larry.science/sounds/4CCA6F37BBA59E30BA6D5A6942BAAFCE56A62C6650FE2A2A005A00E26350098C.mp3'),
    monsterHit: new Audio('https://sounds.larry.science/sounds/7F4D92A0E0392E9DDE1B9242D737A156157948284489BC41CB24AE1C5169481B.mp3'),
    pickup: new Audio('https://sounds.larry.science/sounds/EC9A4E2DBEE431ABB396A4BA2CEEEA80BEDE68E83B9C789BCED5939EC9CB5A5E.mp3'),
    levelUp: new Audio('https://sounds.larry.science/sounds/BC2A952155E9B58BD16042CDDBC03E7CDB85C9EF94B007000A1D7693EBBBF9D6.mp3'),
    portal: new Audio('https://sounds.larry.science/sounds/8E6014A65DA8600575ECF7D0061E6C1A3256A9FA635F14538FB32FEAA7535520.mp3'),
    quest: new Audio('https://sounds.larry.science/sounds/6C39F2ACCB83935F013309E9E3C784D853876AA88CC4BC58F86F99274C2EB00B.mp3'),
    jobAdvance: new Audio('https://sounds.larry.science/sounds/497B12ADABEDC500AC138710D913D3722A7D07A7DBF96F5011D0626E79CA61D8.mp3'),
    death: new Audio('https://sounds.larry.science/sounds/FD5FCC734232393E244788D5A0CEB928F92FEDDD6CCBE9BE575CE40EB7F146A8.mp3'),
    enchantSuccess: new Audio('https://sounds.larry.science/sounds/194CEB29A083D4C196E1025FFD4678A052C25C2104BE78A9C5DF3D3642375A85.mp3'),
    enchantFail: new Audio('https://sounds.larry.science/sounds/B634621AD88AF6792B69D0641DA56A3922E934A3C4328131E8B4F8E511A31585.mp3'),
    usePotion: new Audio('https://sounds.larry.science/sounds/577E5CD24B674A52D15B5608C0EB7D3DA1450B4AB0A306CA9FFC2AAF7B6E4D56.mp3'),
    equipItem: new Audio('https://sounds.larry.science/sounds/C7CAFFB6224D8E57A19AB14BAAA119381AE09EACE23532E80AB464C2FC421177.mp3'),
    UImouserOver: new Audio('https://sounds.larry.science/sounds/7851E46485B06D984EF66BA5A2C6D9A86DCA0BEAF069B5674BDCB27B9B153148.mp3'),
    UImouseClick: new Audio('https://sounds.larry.science/sounds/71D1C000A98AAF2CBB5BD480BE16452ABDD4CB72630FCF3E62096A9B10295871.mp3'),
    UImouseTab: new Audio('https://sounds.larry.science/sounds/CECECBA0E45F0686A8154A063D66974971FC5F495155A8774D38413B2F8F638E.mp3'),
    playerOnline: new Audio('https://sounds.larry.science/sounds/6AE0B60C114B77A8C88A300B8334E6EBD5BA68A7F1E00B0EF08C3666F892FFEB.mp3'),



    // BGM (Background Music)
    henesys: new Audio('https://sounds.larry.science/sounds/C19F549E33DFBA0B470E21E26FA018B87E161A5EF2CAA37C78C1F0BDB17A5C3E.mp3'),
    kerningCity: new Audio('https://sounds.larry.science/sounds/40A04FA380078485E539909B348C8E44EBCA73A9631ED7FDCF5B6BA3B92B9B21.mp3'),
    hauntedMansion: new Audio('https://sounds.larry.science/sounds/EB9A77ACE9AFC1D4EEC44A4EF4A40BB089DEFED5FE316AF1A3332FDFA9AEBC5D.mp3'),
    perion: new Audio('https://sounds.larry.science/sounds/6B63051503801E464904D8B3EC5CD42231F212DFF76ABCAF807F0BCFE2D35591.mp3'),
    nautilus: new Audio('https://sounds.larry.science/sounds/177419B9699093AD86C37583B6BB8F6064E78D5047BAAF00E4E79671B404F433.mp3'),
    florinaBeach: new Audio('https://sounds.larry.science/sounds/D00F1250B5F784770982A7BC21AF2B9A21A158BE86A3E5A14632F3B1BCF78005.mp3'),
    elnath: new Audio('https://sounds.larry.science/sounds/07C105FFDD0031B40E88FBD97E325C72E32631341B3D690D53A10DBDDD9BFB78.mp3'),
    iceValley: new Audio('https://sounds.larry.science/sounds/AD1D3A6D7AF197141E0D759E000240DC92F1D109B1B40370A29D513C138BF25B.mp3'),
    title: new Audio('https://sounds.larry.science/sounds/0328D1FFDFF102AC30F19ADE2150B94DA03A4992FD4C41E3EC1016D8AB82CE48.mp3'),
    huntingground: new Audio('https://sounds.larry.science/sounds/FFB07F5DB2DC5F4548B3167D7AF31952371B04E8C43C6D9F226CD2827755158A.mp3'),
    dewdropIsland: new Audio('https://sounds.larry.science/sounds/133EFD1A12206A0C20CD37C57E12FC23BD4AB93978F3C3A55D39C24CD8F67ADB.mp3'),
    ludibrium: new Audio('https://sounds.larry.science/sounds/0C5294D90A8A3B309010F464B892ACE910C23CEE3ADA6134D5CE5BBBD1291958.mp3'),
    clockTower: new Audio('https://sounds.larry.science/sounds/36A61226E9B3F319E32C52302EFC8B8DB744DA2C3C68D106E25CD5EFC49A986F.mp3'),
    deepClocktower: new Audio('https://sounds.larry.science/sounds/9B7C0F5EDE2DF4D0904039FAEF37A91AA7395C052113871B8FF8D7254D349AA3.mp3'),
};

// Pre-configure all audio elements for volume and looping
for (const key in audioAssets) {
    audioAssets[key].volume = 0.5; // Set a default volume
    if (['title', 'henesys', 'huntingground', 'kerningCity', 'hauntedMansion', 'perion', 'nautilus', 'florinaBeach', 'elnath', 'iceValley', 'dewdropIsland', 'ludibrium', 'clockTower', 'deepClocktower'].includes(key)) {
        audioAssets[key].loop = true; // Make sure BGM tracks loop
        audioAssets[key].volume = 0.3; // BGM should be quieter
    }
}

/**
 * Plays a specified sound effect from the audioAssets library.
 * @param {string} soundName - The key of the sound to play.
 */
function playSound(soundName) {
    if (audioAssets[soundName]) {
        audioAssets[soundName].currentTime = 0;
        const playPromise = audioAssets[soundName].play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name === 'NotAllowedError') {
                    // Browser blocked autoplay, unlock on first interaction
                    if (!audioUnlocked) {
                        unlockAudioOnInteraction();
                    }
                } else if (error.name !== 'AbortError') {
                    console.error(`Sound playback failed for ${soundName}:`, error);
                }
            });
        }
    }
}

// Track if audio has been unlocked
let audioUnlocked = false;

/**
 * Handles browser restrictions on auto-playing audio by waiting for user interaction.
 */
function unlockAudioOnInteraction() {
    if (audioUnlocked) return; // Prevent multiple initializations
    
    const unlockHandler = () => {
        audioUnlocked = true;
        
        if (pendingBGMTrack && audioAssets[pendingBGMTrack]) {
            // Retry playing the pending track
            audioAssets[pendingBGMTrack].play().then(_ => {
                console.log("Audio unlocked and playing.");
                pendingBGMTrack = null;
            }).catch(e => console.error("Could not play audio after interaction:", e));
        }
        
        // Remove the listeners so this only ever runs once
        document.removeEventListener('click', unlockHandler);
        document.removeEventListener('keydown', unlockHandler);
        document.removeEventListener('touchstart', unlockHandler);
    };

    // Listen for the first interaction (including touch for mobile)
    document.addEventListener('click', unlockHandler);
    document.addEventListener('keydown', unlockHandler);
    document.addEventListener('touchstart', unlockHandler);
}

/**
 * Manages background music playback, ensuring smooth transitions.
 * @param {string} trackName - The key of the BGM track to play.
 */
function playBGM(trackName) {
    const newTrack = audioAssets[trackName];

    if (!newTrack) {
        if (currentBGM && !currentBGM.paused) {
            currentBGM.pause();
        }
        currentBGM = null;
        return;
    }

    // Don't restart the same track if it's already playing
    if (currentBGM && currentBGM.src === newTrack.src && !currentBGM.paused) {
        return;
    }

    // Stop current track if playing
    if (currentBGM && !currentBGM.paused) {
        currentBGM.pause();
        currentBGM.currentTime = 0;
    }

    currentBGM = newTrack;
    
    // Apply current volume settings
    currentBGM.volume = Math.pow(bgmVolume, 2.5);
    
    const playPromise = currentBGM.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            // Playback started successfully
        }).catch(error => {
            if (error.name === 'NotAllowedError') {
                // Browser blocked autoplay, store for later
                pendingBGMTrack = trackName;
                unlockAudioOnInteraction();
            } else if (error.name !== 'AbortError') {
                console.error("Audio playback failed:", error);
            }
        });
    }
}

/**
 * Applies the current volume settings to all audio assets.
 * Also updates the UI sliders and mute buttons to reflect current state.
 */
function applyAudioSettings() {
    const bgmVolumeSlider = document.getElementById('bgm-volume-slider');
    const sfxVolumeSlider = document.getElementById('sfx-volume-slider');
    const bgmMuteBtn = document.getElementById('bgm-mute-btn');
    const sfxMuteBtn = document.getElementById('sfx-mute-btn');

    // Update slider values if elements exist
    if (bgmVolumeSlider) bgmVolumeSlider.value = bgmVolume;
    if (sfxVolumeSlider) sfxVolumeSlider.value = sfxVolume;

    // A non-linear conversion for a more natural volume control
    const convertVolume = (value) => value > 0 ? Math.pow(value, 2.5) : 0;

    const finalBgmVolume = convertVolume(bgmVolume);
    const finalSfxVolume = convertVolume(sfxVolume);

    for (const key in audioAssets) {
        if (['title', 'henesys', 'huntingground', 'kerningCity', 'hauntedMansion', 'perion', 'nautilus', 'florinaBeach', 'elnath', 'iceValley', 'dewdropIsland', 'ludibrium', 'clockTower', 'deepClocktower'].includes(key)) {
            audioAssets[key].volume = finalBgmVolume;
        } else {
            audioAssets[key].volume = finalSfxVolume;
        }
    }

    // Update mute button text if elements exist
    if (sfxMuteBtn) sfxMuteBtn.textContent = sfxVolume === 0 ? 'Unmute' : 'Mute';
    if (bgmMuteBtn) bgmMuteBtn.textContent = bgmVolume === 0 ? 'Unmute' : 'Mute';
    
    // Auto-save audio settings
    if (typeof saveManager !== 'undefined' && typeof saveManager.saveAudioSettings === 'function') {
        saveManager.saveAudioSettings({
            sfx: sfxVolume,
            bgm: bgmVolume,
            lastSfx: lastSfxVolume,
            lastBgm: lastBgmVolume
        });
    }
}


// Wait for the DOM to be fully loaded before setting up UI sounds
document.addEventListener('DOMContentLoaded', () => {
    // Add UI sound effects to buttons and tabs
    // Note: Volume slider and mute button events are handled in ui.js
    setupUISounds();
});

/**
 * Sets up global event listeners for UI sound effects on buttons and tabs
 */
function setupUISounds() {
    // Add mouseover sound to all buttons
    document.addEventListener('mouseover', (e) => {
        const button = e.target.closest('button, .tab, .window-header button, .medal-toggle-btn, .close-btn');
        if (button && button.tagName === 'BUTTON' || (button && button.classList.contains('tab'))) {
            playSound('UImouserOver');
        }
    }, true);

    // Add click sound to all buttons
    document.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        const tab = e.target.closest('.tab');
        
        if (button) {
            playSound('UImouseClick');
        } else if (tab) {
            playSound('UImouseTab');
        }
    }, true);
}