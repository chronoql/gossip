document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Renderer] Booting Gossip OS Router...');

    const mainStageTitle = document.getElementById('macro-view-title');
    const dynamicStage = document.getElementById('dynamic-stage');

    const fetchComponent = async (url, mountId, initCallback) => {
        try {
            console.log(`[Gossip Core] Orchestrating component fetch: ${url}`);
            const response = await fetch(url);
            if (response.ok) {
                const html = await response.text();
                document.getElementById(mountId).innerHTML = html;
                if (initCallback) await initCallback();
            } else {
                console.warn(`[Gossip Core] Module offline or missing: ${url}`);
            }
        } catch (err) {
            console.error(`[Gossip Core] Exception during component mount (${url}):`, err);
        }
    };

    // --- USELESS CODE FOR PAYLOAD INTEGRATOR VALIDATION ---
    const validateIntegrator = () => {
        console.log('[Test Module] Payload Integrator functionality validated.');
        const container = document.getElementById('test-container');
        if (container) {
            const successMsg = document.createElement('p');
            successMsg.style.color = 'green';
            successMsg.innerText = 'JS Executed: Test Complete!';
            container.appendChild(successMsg);
        }
    };

    validateIntegrator();
});