/**
 * @name NoPause for Quests
 * @description Prevents Discord from pausing QUEST videos when you alt-tab or lose focus
 * @version 2.0.0
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
        
        console.log("[NoPause for Quests] Plugin started v1.3.0 - Quest videos only");
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
        // Έλεγχος για διάφορα χαρακτηριστικά quest videos
        return (
            (video.src && video.src.includes('quests')) ||
            video.classList.contains('videoInner__45776') ||
            video.closest('[class*="quest"]') !== null ||
            video.closest('[class*="Quest"]') !== null ||
            (video.poster && video.poster.includes('quests')) ||
            // Εναλλακτικός έλεγχος για blob URL
            (video.src && video.src.startsWith('blob:') && video.classList.contains('videoInner__45776')) ||
            // Έλεγχος για parent containers που μπορεί να έχουν quest
            (video.parentElement && (
                video.parentElement.className.includes('quest') ||
                video.parentElement.className.includes('Quest') ||
                video.parentElement.innerHTML.includes('quests')
            ))
        );
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
        let userWantsPause = false;
        let videoEnded = false;
        
        // Detect if video ended naturally
        video.addEventListener('ended', () => {
            videoEnded = true;
        });
        
        video.addEventListener('playing', () => {
            videoEnded = false;
            userWantsPause = false;
        });
        
        // Detect user-initiated pause (click on video or pause button)
        video.addEventListener('click', () => {
            userWantsPause = true;
        });
        
        // Override pause method
        video.pause = function() {
            if (videoEnded) {
                return originalPause();
            }
            if (userWantsPause) {
                userWantsPause = false;
                return originalPause();
            }
            // Block automatic pause for quest videos
            console.log("[NoPause for Quests] Blocked pause attempt on quest video");
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
                    // Check if it was auto-paused (not user action)
                    if (video.dataset.wasPlaying === 'true') {
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
                <strong>NoPause for Quests v1.3.0</strong>
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
                    <li>Class "videoInner__45776"</li>
                    <li>URLs που περιέχουν "quests"</li>
                    <li>Poster images από quests</li>
                    <li>Blob URLs με quest classes</li>
                </ul>
                <br>
                <em>Κανονικά videos δεν επηρεάζονται.</em>
            </div>
        `;
        return panel;
    }
};