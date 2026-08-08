/**
 * Chronoql Gossip: Documentation Logic
 * Orchestrates scroll-spying and table of contents active states.
 */

window.initDocumentationSystem = async () => {
    console.log('[Documentation] System initialized and bound to scroll context.');

    const docContainer = document.querySelector('.gossip-doc-container');
    if (!docContainer) return;

    const tocLinks = docContainer.querySelectorAll('.toc-link');
    const contentArea = docContainer.querySelector('#doc-content');

    // Handle Click and Smooth Scroll within the localized container
    tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            tocLinks.forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');

            const targetId = e.target.getAttribute('href').substring(1);
            const targetElement = docContainer.querySelector(`#${targetId}`);

            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Intersection Observer for updating TOC on scroll
    const headingElements = docContainer.querySelectorAll('.doc-article h1, .doc-article h2, .doc-article h3');
    
    const observerOptions = {
        root: contentArea,
        rootMargin: '0px 0px -80% 0px', 
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                if (id) {
                    tocLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${id}`) {
                            link.classList.add('active');
                        }
                    });
                }
            }
        });
    }, observerOptions);

    headingElements.forEach(heading => {
        if(heading.id) observer.observe(heading);
    });

    // Bind placeholder PDF export
    const btnDownloadGuideSidebar = docContainer.querySelector('#btn-sidebar-download-edu-guide');
    if (btnDownloadGuideSidebar) {
        btnDownloadGuideSidebar.addEventListener('click', () => {
            alert("The Architecture Export pipeline will be orchestrated in Phase 2.");
        });
    }
};