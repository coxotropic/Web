document.addEventListener('DOMContentLoaded', () => {
    // Función para cargar un componente
    const loadComponent = async (containerId, url) => {
        try {
            const response = await fetch(url);
            const html = await response.text();
            document.getElementById(containerId).innerHTML = html;
        } catch (error) {
            console.error(`Error al cargar el componente ${url}:`, error);
        }
    };

    // Detección de plataforma
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    document.body.classList.add(isMobile ? 'mobile-view' : 'desktop-view');

    // Cargar componentes
    loadComponent('menu-container', 'components/menu.html');
    loadComponent('content-container', 'components/content.html');
    loadComponent('footer-container', 'components/footer.html');
});