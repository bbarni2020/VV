class DeviceDetection {
    constructor() {
        this.init();
        this.bindEvents();
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768 && window.innerHeight <= 1024) ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0);
    }
    
    isTablet() {
        return /iPad|Android/i.test(navigator.userAgent) && 
               window.innerWidth >= 768 && window.innerWidth <= 1024;
    }
    
    isDesktop() {
        return !this.isMobile() && 
               window.innerWidth > 1024 && 
               !('ontouchstart' in window);
    }
    
    hasTouch() {
        return ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0) || 
               (navigator.msMaxTouchPoints > 0);
    }

    isLandscape() {
        return window.innerWidth > window.innerHeight;
    }

    isPortrait() {
        return window.innerHeight > window.innerWidth;
    }
    
    init() {
        const body = document.body;
        
        body.classList.remove('device-mobile', 'device-tablet', 'device-desktop');
        body.classList.remove('has-touch', 'no-touch');
        body.classList.remove('landscape', 'portrait');
        
        if (this.isMobile()) {
            body.classList.add('device-mobile');
        } else if (this.isTablet()) {
            body.classList.add('device-tablet');
        } else {
            body.classList.add('device-desktop');
        }
        
        if (this.hasTouch()) {
            body.classList.add('has-touch');
        } else {
            body.classList.add('no-touch');
        }
        
        body.classList.add(this.isLandscape() ? 'landscape' : 'portrait');
        
        this.updateMobileControls();
    }

    updateMobileControls() {
        const mobileControls = document.querySelector('.mobile-controls');
        if (mobileControls) {
            if (this.isMobile() || (this.isTablet() && this.isLandscape())) {
                mobileControls.style.display = 'block';
            } else {
                mobileControls.style.display = 'none';
            }
        }
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.init();
        });
        
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.init();
            }, 100);
        });
    }

    optimizeForDevice() {
        if (this.isMobile()) {
            this.optimizeForMobile();
        } else if (this.isTablet()) {
            this.optimizeForTablet();
        } else {
            this.optimizeForDesktop();
        }
    }

    optimizeForMobile() {
        const settingsPanel = document.querySelector('.settings-panel');
        if (settingsPanel && settingsPanel.style.display !== 'none') {
            document.body.classList.add('settings-open');
        }
        
        document.addEventListener('touchmove', function(e) {
            if (!e.target.closest('.settings-panel') && 
                !e.target.closest('.mobile-controls') &&
                e.target.tagName !== 'INPUT' && 
                e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        }, { passive: false });
    }

    optimizeForTablet() {
        this.optimizeForMobile();
    }

    optimizeForDesktop() {
        document.body.classList.remove('settings-open');
    }

    preventZoom() {
        if (this.isMobile()) {
            document.addEventListener('touchstart', function(e) {
                if (e.touches.length > 1) {
                    e.preventDefault();
                }
            }, { passive: false });

            let lastTouchEnd = 0;
            document.addEventListener('touchend', function(e) {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                    e.preventDefault();
                }
                lastTouchEnd = now;
            }, { passive: false });
        }
    }

    handleSettingsPanel(show = false) {
        const settingsPanel = document.getElementById('settingsPanel');
        if (!settingsPanel) return;

        if (show) {
            settingsPanel.style.display = 'block';
            if (this.isMobile()) {
                document.body.classList.add('settings-open');
                window.scrollTo(0, 0);
            }
        } else {
            settingsPanel.style.display = 'none';
            document.body.classList.remove('settings-open');
        }
    }
}

const deviceDetection = new DeviceDetection();

export { DeviceDetection, deviceDetection };
