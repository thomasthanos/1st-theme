/**
 * @name NoPause
 * @author Thomas
 * @description Prevents Discord from pausing videos when you alt-tab or lose focus
 * @version 1.2.0
 * @authorLink https://github.com/
 * @source https://github.com/
 */

module.exports = class NoPause {
    constructor() {
        this.name = "NoPause";
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
        
        console.log("[NoPause] Plugin started v1.2.0");
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
        
        console.log("[NoPause] Plugin stopped");
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

    patchAllVideos() {
        document.querySelectorAll('video').forEach(v => this.patchVideo(v));
    }

    patchVideo(video) {
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
            // Block automatic pause
            console.log("[NoPause] Blocked pause attempt");
            return undefined;
        };
        
        this.patchedVideos.add(video);
        console.log("[NoPause] Patched video element");
    }

    startVideoMonitor() {
        // Monitor videos and resume if paused unexpectedly
        const checkInterval = setInterval(() => {
            document.querySelectorAll('video').forEach(video => {
                // Patch new videos
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
                        this.patchVideo(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('video').forEach(v => this.patchVideo(v));
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
                <strong>NoPause v1.2.0</strong>
            </div>
            <div style="color: var(--text-muted); font-size: 14px;">
                Εμποδίζει το Discord να κάνει pause τα videos όταν κάνεις alt-tab.
                <br><br>
                <strong>Features:</strong>
                <ul style="margin-top: 10px;">
                    <li>Override visibility API</li>
                    <li>Block blur/focus events</li>
                    <li>Intercept video.pause()</li>
                    <li>Auto-resume αν γίνει pause</li>
                </ul>
            </div>
        `;
        return panel;
    }
};
