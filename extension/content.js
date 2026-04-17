(function() {
    'use strict';

    const injectScript = (path) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(path);
        script.onload = () => {
            script.remove();
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to inject ${path}`));
        (document.head || document.documentElement).appendChild(script);
    });

    async function boot() {
        if (window.__maristIcsExtensionBooted) {
            return;
        }

        window.__maristIcsExtensionBooted = true;

        try {
            await injectScript('lib/luxon.min.js');
            await injectScript('page-script.js');
        } catch (error) {
            console.error('MyMarist ICS Generator failed to initialize.', error);
        }
    }

    boot();
})();
