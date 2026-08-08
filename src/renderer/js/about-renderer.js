/**
 * Project: Chronoql Gossip
 * Feature: About View Renderer
 * Status: Extracted and orchestrated for strict separation of concerns.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Secure child-window closing logic via our established IPC bridge
    const btnExit = document.getElementById('btn-exit');
    if (btnExit) {
        btnExit.addEventListener('click', () => {
            if (window.api && window.api.system) {
                window.api.system.closeWindow();
            } else {
                // Fallback for native DOM if loaded outside strict bridge
                window.close(); 
            }
        });
    }
});