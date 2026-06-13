/**
 * @name NoPause for Quests
 * @description Prevents Discord from pausing QUEST videos when you alt-tab or lose focus
 * @version 2.1.0
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/NoPause.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/NoPause.plugin.js
 * @website https://github.com/thomasthanos
 */

module.exports = class NoPause {
    constructor() {
        this.name = "NoPause for Quests";
        this.observer = null;
        this.patchedVideos = new WeakSet();
        this.intervals = [];
    }

    start() {
        this.patchVisibilityAPI();
        this.blockVisibilityEvents();
        this.patchAllVideos();
        this.startObserver();
        this.startVideoMonitor();
        
        console.log("[NoPause for Quests] Plugin started v2.1.0 - stable detection (data-testid)");
    }

    stop() {
        // Clear intervals
        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];
        
        // Restore visibility API
        if (this.originalHiddenDescriptor) {
            Object.defineProperty(Document.prototype, 'hidden', this.originalHiddenDescriptor);
        }
        if (this.originalVisibilityStateDescriptor) {
            Object.defineProperty(Document.prototype, 'visibilityState', this.originalVisibilityStateDescriptor);
        }
        
        // Stop observer
        if (this.observer) {
            this.observer.disconnect();
        }
        
        // Remove event listeners
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler, true);
        }
        if (this.blurHandler) {
            window.removeEventListener('blur', this.blurHandler, true);
        }
        if (this.focusHandler) {
            window.removeEventListener('focus', this.focusHandler, true);
        }
        
        console.log("[NoPause for Quests] Plugin stopped");
    }

    patchVisibilityAPI() {
        // Store originals from prototype
        this.originalHiddenDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
        this.originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
        
        // Override on prototype level
        Object.defineProperty(Document.prototype, 'hidden', {
            get: () => false,
            configurable: true
        });
        
        Object.defineProperty(Document.prototype, 'visibilityState', {
            get: () => 'visible',
            configurable: true
        });
        
        // Also override on document instance
        Object.defineProperty(document, 'hidden', {
            get: () => false,
            configurable: true
        });
        
        Object.defineProperty(document, 'visibilityState', {
            get: () => 'visible',
            configurable: true
        });
    }

    blockVisibilityEvents() {
        // Capture phase - block before Discord sees it
        this.visibilityHandler = (e) => {
            e.stopImmediatePropagation();
            e.preventDefault();
            return false;
        };
        document.addEventListener('visibilitychange', this.visibilityHandler, true);
        
        // Block blur on window
        this.blurHandler = (e) => {
            e.stopImmediatePropagation();
            return false;
        };
        window.addEventListener('blur', this.blurHandler, true);
        
        // Block focus changes
        this.focusHandler = (e) => {
            e.stopImmediatePropagation();
        };
        window.addEventListener('focus', this.focusHandler, true);
        
        // Override hasFocus
        document.hasFocus = () => true;
    }

    isQuestVideo(video) {
        if (!video) return false;

        // 1) Σταθερά data-testid attributes που χρησιμοποιεί το Discord
        //    (δεν αλλάζουν σε κάθε update, σε αντίθεση με τα hashed classes)
        try {
            if (video.getAttribute('data-testid') === 'discord-web-video-player-video') {
                return true;
            }
            if (video.closest('[data-testid="discord-web-video-player-container"]')) {
                return true;
            }
            // 2) Οποιοδήποτε parent με data-quest-id (π.χ. το share button container)
            if (video.closest('[data-quest-id]')) {
                return true;
            }
            // 3) Modal που περιέχει quest controls (seek/progress του quest player)
            const modal = video.closest('[role="dialog"], [class*="modalRoot"]');
            if (modal && modal.querySelector('[data-testid^="discord-web-video-player"]')) {
                return true;
            }
        } catch (e) { /* closest μπορεί να πετάξει αν ο κόμβος αποσπαστεί */ }

        // 4) Fallback: URLs / posters που περιέχουν "quest"
        if (video.src && /quest/i.test(video.src)) return true;
        if (video.poster && /quest/i.test(video.poster)) return true;

        // 5) Fallback: class names (παλιά + νέα μορφή) ώστε να καλύπτονται updates
        try {
            for (const cls of video.classList) {
                if (/^videoInner/.test(cls)) return true;
            }
        } catch (e) { /* noop */ }

        return false;
    }

    patchAllVideos() {
        document.querySelectorAll('video').forEach(v => {
            if (this.isQuestVideo(v)) {
                this.patchVideo(v);
            }
        });
    }

    patchVideo(video) {
        // Αν ΔΕΝ είναι quest video, μην το επεξεργαστείς
        if (!this.isQuestVideo(video)) {
            console.log("[NoPause for Quests] Skipping non-quest video");
            return;
        }
        
        if (this.patchedVideos.has(video)) return;
        
        const originalPause = video.pause.bind(video);
        const state = { userWantsPause: false, videoEnded: false, lastUserAction: 0 };
        video._noPauseState = state;
        
        // Detect if video ended naturally
        video.addEventListener('ended', () => {
            state.videoEnded = true;
        });
        
        video.addEventListener('playing', () => {
            state.videoEnded = false;
            state.userWantsPause = false;
        });
        
        // Detect user-initiated pause μέσω πραγματικού click/keydown πάνω στα controls.
        // Σημειώνουμε χρόνο· ένα pause() εντός ~400ms από user action θεωρείται ηθελημένο.
        const markUserAction = () => { state.lastUserAction = Date.now(); };
        video.addEventListener('click', markUserAction, true);
        const container = video.closest('[data-testid="discord-web-video-player-container"]') || video.parentElement;
        if (container) {
            container.addEventListener('click', markUserAction, true);
            container.addEventListener('keydown', markUserAction, true);
        }
        
        // Override pause method
        video.pause = function() {
            if (state.videoEnded) {
                return originalPause();
            }
            // Αν το pause προήλθε από πρόσφατη ενέργεια χρήστη -> επίτρεψέ το
            if (Date.now() - state.lastUserAction < 400) {
                return originalPause();
            }
            // Block automatic pause (alt-tab / lost focus) για quest videos
            console.log("[NoPause for Quests] Blocked auto-pause on quest video");
            return undefined;
        };
        
        this.patchedVideos.add(video);
        console.log("[NoPause for Quests] Patched quest video element");
    }

    startVideoMonitor() {
        // Monitor videos and resume if paused unexpectedly
        const checkInterval = setInterval(() => {
            document.querySelectorAll('video').forEach(video => {
                // Αν ΔΕΝ είναι quest video, άφησέ το ήσυχο
                if (!this.isQuestVideo(video)) return;
                
                // Patch new quest videos
                if (!this.patchedVideos.has(video)) {
                    this.patchVideo(video);
                }
                
                // If video is paused but not ended and was playing
                if (video.paused && !video.ended && video.currentTime > 0 && video.currentTime < video.duration - 0.5) {
                    const state = video._noPauseState;
                    const userPausedRecently = state && (Date.now() - state.lastUserAction < 400);
                    // Resume μόνο αν ΔΕΝ το σταμάτησε ο χρήστης και έπαιζε πριν
                    if (!userPausedRecently && video.dataset.wasPlaying === 'true') {
                        video.play().catch(() => {});
                    }
                }
                
                // Track playing state
                if (!video.paused) {
                    video.dataset.wasPlaying = 'true';
                }
            });
        }, 200);
        
        this.intervals.push(checkInterval);
    }

    startObserver() {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeName === 'VIDEO') {
                        // Patch μόνο αν είναι quest video
                        if (this.isQuestVideo(node)) {
                            this.patchVideo(node);
                        }
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('video').forEach(v => {
                            // Patch μόνο αν είναι quest video
                            if (this.isQuestVideo(v)) {
                                this.patchVideo(v);
                            }
                        });
                    }
                });
            });
        });

        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "10px";
        panel.innerHTML = `
            <div style="color: var(--text-normal); font-size: 16px; margin-bottom: 10px;">
                <strong>NoPause for Quests v2.1.0</strong>
            </div>
            <div style="color: var(--text-muted); font-size: 14px;">
                Εμποδίζει το Discord να κάνει pause τα <strong>QUEST videos</strong> όταν κάνεις alt-tab.
                <br><br>
                <strong>Πως λειτουργεί:</strong>
                <ul style="margin-top: 10px;">
                    <li>Ενεργοποιείται ΜΟΝΟ για quest videos</li>
                    <li>Override visibility API</li>
                    <li>Block blur/focus events</li>
                    <li>Intercept video.pause() για quests</li>
                    <li>Auto-resume αν γίνει pause</li>
                </ul>
                <br>
                <strong>Αναγνωρίζει quest videos από:</strong>
                <ul>
                    <li>data-testid="discord-web-video-player-video"</li>
                    <li>Container με data-testid του video player</li>
                    <li>Parent με data-quest-id</li>
                    <li>URLs/posters που περιέχουν "quest" (fallback)</li>
                </ul>
                <br>
                <em>Κανονικά videos δεν επηρεάζονται.</em>
            </div>
        `;
        return panel;
    }
};