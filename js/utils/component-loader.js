/* component-loader.js
 * Sistema para cargar componentes HTML de forma dinámica
 * 
 * Este módulo permite cargar componentes HTML desde archivos externos,
 * gestionar dependencias, adaptar según dispositivo y modo, y manejar
 * eventos después de la carga.
 */

<span class="comment">// Caché para componentes ya cargados</span>
<span class="keyword">const</span> <span class="variable">componentCache</span> = <span class="keyword">new</span> <span class="class">Map</span>();

<span class="comment">// Registro de dependencias entre componentes</span>
<span class="keyword">const</span> <span class="variable">componentDependencies</span> = {
    <span class="string">'content-novato'</span>: [<span class="string">'cards'</span>, <span class="string">'charts-basic'</span>],
    <span class="string">'content-intermedio'</span>: [<span class="string">'cards'</span>, <span class="string">'charts-medium'</span>],
    <span class="string">'content-senior'</span>: [<span class="string">'cards'</span>, <span class="string">'charts-advanced'</span>],
    <span class="string">'news-feed'</span>: [<span class="string">'news-card'</span>],
    <span class="string">'social-feed'</span>: [<span class="string">'comments'</span>, <span class="string">'user-card'</span>]
};

<span class="comment">// Configuración por defecto para cargar componentes</span>
<span class="keyword">const</span> <span class="variable">defaultConfig</span> = {
    <span class="variable">basePath</span>: <span class="string">'components/'</span>,
    <span class="variable">fileExtension</span>: <span class="string">'.html'</span>,
    <span class="variable">useCache</span>: <span class="keyword">true</span>,
    <span class="variable">loadDependencies</span>: <span class="keyword">true</span>,
    <span class="variable">deviceSpecific</span>: <span class="keyword">true</span>,
    <span class="variable">modeSpecific</span>: <span class="keyword">false</span>
};

<span class="comment">/**
 * Determina si el dispositivo es móvil
 * @returns {boolean} true si es dispositivo móvil
 */</span>
<span class="keyword">export</span> <span class="keyword">function</span> <span class="function">isMobileDevice</span>() {
    <span class="keyword">return</span> /iPhone|iPad|iPod|Android/i.<span class="function">test</span>(navigator.userAgent) || window.innerWidth < 768;
}

<span class="comment">/**
 * Carga un componente HTML en un contenedor
 * @param {string} componentName - Nombre del componente a cargar
 * @param {string|HTMLElement} container - Selector o elemento donde cargar el componente
 * @param {Object} data - Datos para pasar al componente
 * @param {Object} config - Configuración para la carga
 * @returns {Promise} Promesa que se resuelve cuando el componente se carga
 */</span>
<span class="keyword">export</span> <span class="keyword">async</span> <span class="keyword">function</span> <span class="function">loadComponent</span>(componentName, container, data = {}, config = {}) {
    <span class="comment">// Fusionar configuración por defecto con la proporcionada</span>
    <span class="keyword">const</span> <span class="variable">options</span> = { ...<span class="variable">defaultConfig</span>, ...<span class="variable">config</span> };
    
    <span class="comment">// Obtener el contenedor</span>
    <span class="keyword">const</span> <span class="variable">targetContainer</span> = <span class="keyword">typeof</span> container === <span class="string">'string'</span> 
        ? document.<span class="function">querySelector</span>(container) 
        : container;
    
    <span class="keyword">if</span> (!<span class="variable">targetContainer</span>) {
        <span class="function">console</span>.error(`Contenedor no encontrado: ${container}`);
        <span class="keyword">throw</span> <span class="keyword">new</span> <span class="class">Error</span>(`Contenedor no encontrado: ${container}`);
    }
    
    <span class="keyword">try</span> {
        <span class="comment">// Mostrar indicador de carga</span>
        <span class="function">showLoadingIndicator</span>(<span class="keyword">true</span>);
        
        <span class="comment">// Determinar la ruta del componente según el dispositivo y modo</span>
        <span class="keyword">const</span> <span class="variable">componentPath</span> = <span class="function">getComponentPath</span>(componentName, options);
        
        <span class="comment">// Cargar el HTML del componente (desde caché o red)</span>
        <span class="keyword">const</span> <span class="variable">html</span> = <span class="keyword">await</span> <span class="function">fetchComponentHtml</span>(componentPath, options.useCache);
        
        <span class="comment">// Procesar el HTML con los datos</span>
        <span class="keyword">const</span> <span class="variable">processedHtml</span> = <span class="function">processTemplate</span>(html, data);
        
        <span class="comment">// Insertar en el contenedor</span>
        <span class="variable">targetContainer</span>.innerHTML = <span class="variable">processedHtml</span>;
        
        <span class="comment">// Activar scripts en el componente</span>
        <span class="function">activateComponentScripts</span>(<span class="variable">targetContainer</span>);
        
        <span class="comment">// Cargar dependencias si es necesario</span>
        <span class="keyword">if</span> (options.loadDependencies && <span class="variable">componentDependencies</span>[componentName]) {
            <span class="keyword">await</span> <span class="function">loadDependencies</span>(componentName, options);
        }
        
        <span class="comment">// Lanzar evento de componente cargado</span>
        <span class="function">dispatchComponentEvent</span>(componentName, <span class="string">'loaded'</span>, { container: <span class="variable">targetContainer</span>, data });
        
        <span class="keyword">return</span> <span class="variable">targetContainer</span>;
    } <span class="keyword">catch</span> (error) {
        <span class="function">console</span>.error(`Error al cargar el componente ${componentName}:`, error);
        <span class="function">dispatchComponentEvent</span>(componentName, <span class="string">'error'</span>, { error });
        <span class="function">handleComponentError</span>(<span class="variable">targetContainer</span>, componentName, error);
        <span class="keyword">throw</span> error;
    } <span class="keyword">finally</span> {
        <span class="comment">// Ocultar indicador de carga</span>
        <span class="function">showLoadingIndicator</span>(<span class="keyword">false</span>);
    }
}

<span class="comment">/**
 * Determina la ruta correcta para un componente según dispositivo y modo
 * @param {string} componentName - Nombre del componente
 * @param {Object} options - Opciones de configuración
 * @returns {string} Ruta completa al archivo del componente
 */</span>
<span class="keyword">function</span> <span class="function">getComponentPath</span>(componentName, options) {
    <span class="keyword">let</span> <span class="variable">path</span> = options.basePath;
    <span class="keyword">const</span> <span class="variable">isMobile</span> = <span class="function">isMobileDevice</span>();
    <span class="keyword">const</span> <span class="variable">isProMode</span> = document.body.classList.contains(<span class="string">'pro-mode-active'</span>);
    
    <span class="comment">// Determinar la carpeta según la estructura de componentes</span>
    <span class="keyword">if</span> (componentName.startsWith(<span class="string">'content-'</span>)) {
        <span class="variable">path</span> += <span class="string">'content/'</span>;
    } <span class="keyword">else</span> <span class="keyword">if</span> (componentName.startsWith(<span class="string">'auth-'</span>)) {
        <span class="variable">path</span> += <span class="string">'auth/'</span>;
    } <span class="keyword">else</span> <span class="keyword">if</span> (componentName.startsWith(<span class="string">'news-'</span>)) {
        <span class="variable">path</span> += <span class="string">'news/'</span>;
    } <span class="keyword">else</span> <span class="keyword">if</span> (componentName.startsWith(<span class="string">'social-'</span>)) {
        <span class="variable">path</span> += <span class="string">'social/'</span>;
    } <span class="keyword">else</span> {
        <span class="variable">path</span> += <span class="string">'core/'</span>;
    }
    
    <span class="comment">// Añadir sufijo específico del dispositivo si está habilitado</span>
    <span class="keyword">if</span> (options.deviceSpecific && <span class="variable">isMobile</span>) {
        <span class="keyword">const</span> <span class="variable">mobileVersionPath</span> = `${<span class="variable">path</span>}${componentName}-mobile${options.fileExtension}`;
        
        <span class="comment">// Verificar si existe la versión móvil (solo si ya está en caché)</span>
        <span class="keyword">if</span> (<span class="variable">componentCache</span>.has(<span class="variable">mobileVersionPath</span>)) {
            <span class="keyword">return</span> <span class="variable">mobileVersionPath</span>;
        }
        
        <span class="comment">// Si no está en caché, intentamos cargar la versión móvil primero</span>
        <span class="comment">// Si falla, el fetchComponentHtml manejará la caída a la versión estándar</span>
        <span class="keyword">return</span> <span class="variable">mobileVersionPath</span>;
    }
    
    <span class="comment">// Añadir sufijo específico del modo si está habilitado</span>
    <span class="keyword">if</span> (options.modeSpecific && <span class="variable">isProMode</span>) {
        <span class="keyword">const</span> <span class="variable">proVersionPath</span> = `${<span class="variable">path</span>}${componentName}-pro${options.fileExtension}`;
        
        <span class="comment">// Verificar si existe la versión pro (solo si ya está en caché)</span>
        <span class="keyword">if</span> (<span class="variable">componentCache</span>.has(<span class="variable">proVersionPath</span>)) {
            <span class="keyword">return</span> <span class="variable">proVersionPath</span>;
        }
        
        <span class="comment">// Si no está en caché, intentamos la versión pro primero</span>
        <span class="keyword">return</span> <span class="variable">proVersionPath</span>;
    }
    
    <span class="comment">// Ruta estándar</span>
    <span class="keyword">return</span> `${<span class="variable">path</span>}${componentName}${options.fileExtension}`;
}

<span class="comment">/**
 * Carga el HTML de un componente desde la red o caché
 * @param {string} componentPath - Ruta al archivo del componente
 * @param {boolean} useCache - Si se debe usar la caché
 * @returns {Promise<string>} El HTML del componente
 */</span>
<span class="keyword">async</span> <span class="keyword">function</span> <span class="function">fetchComponentHtml</span>(componentPath, useCache) {
    <span class="comment">// Comprobar si el componente está en caché</span>
    <span class="keyword">if</span> (useCache && <span class="variable">componentCache</span>.has(componentPath)) {
        <span class="keyword">return</span> <span class="variable">componentCache</span>.get(componentPath);
    }
    
    <span class="keyword">try</span> {
        <span class="keyword">const</span> <span class="variable">response</span> = <span class="keyword">await</span> fetch(componentPath);
        
        <span class="keyword">if</span> (!<span class="variable">response</span>.ok) {
            <span class="comment">// Si falla la carga y es una versión específica, intentar la versión estándar</span>
            <span class="keyword">if</span> (componentPath.includes(<span class="string">'-mobile'</span>) || componentPath.includes(<span class="string">'-pro'</span>)) {
                <span class="keyword">const</span> <span class="variable">standardPath</span> = componentPath
                    .replace(<span class="string">'-mobile'</span>, <span class="string">''</span>)
                    .replace(<span class="string">'-pro'</span>, <span class="string">''</span>);
                
                <span class="keyword">return</span> <span class="keyword">await</span> <span class="function">fetchComponentHtml</span>(<span class="variable">standardPath</span>, useCache);
            }
            
            <span class="keyword">throw</span> <span class="keyword">new</span> <span class="class">Error</span>(`Error HTTP ${<span class="variable">response</span>.status}: ${<span class="variable">response</span>.statusText}`);
        }
        
        <span class="keyword">const</span> <span class="variable">html</span> = <span class="keyword">await</span> <span class="variable">response</span>.text();
        
        <span class="comment">// Guardar en caché</span>
        <span class="keyword">if</span> (useCache) {
            <span class="variable">componentCache</span>.set(componentPath, <span class="variable">html</span>);
        }
        
        <span class="keyword">return</span> <span class="variable">html</span>;
    } <span class="keyword">catch</span> (error) {
        <span class="function">console</span>.error(`Error al obtener el componente ${componentPath}:`, error);
        <span class="keyword">throw</span> error;
    }
}

<span class="comment">/**
 * Procesa una plantilla HTML con datos
 * @param {string} template - HTML de la plantilla
 * @param {Object} data - Datos para la plantilla
 * @returns {string} HTML procesado
 */</span>
<span class="keyword">function</span> <span class="function">processTemplate</span>(template, data) {
    <span class="keyword">if</span> (!data || Object.keys(data).length === 0) {
        <span class="keyword">return</span> template;
    }
    
    <span class="keyword">let</span> <span class="variable">processedTemplate</span> = template;
    
    <span class="comment">// Reemplazar variables {{ nombreVariable }}</span>
    <span class="keyword">for</span> (<span class="keyword">const</span> [key, value] of Object.entries(data)) {
        <span class="keyword">const</span> <span class="variable">regex</span> = <span class="keyword">new</span> <span class="class">RegExp</span>(`{{\\s*${key}\\s*}}`, <span class="string">'g'</span>);
        <span class="variable">processedTemplate</span> = <span class="variable">processedTemplate</span>.replace(<span class="variable">regex</span>, value);
    }
    
    <span class="comment">// Procesar bucles {{#each items}} ... {{/each}}</span>
    <span class="keyword">const</span> <span class="variable">eachRegex</span> = /{{#each\s+(\w+)\s*}}([\s\S]*?){{\/each}}/g;
    <span class="keyword">let</span> <span class="variable">match</span>;
    
    <span class="keyword">while</span> ((<span class="variable">match</span> = <span class="variable">eachRegex</span>.exec(<span class="variable">processedTemplate</span>)) !== <span class="keyword">null</span>) {
        <span class="keyword">const</span> [<span class="variable">fullMatch</span>, <span class="variable">arrayName</span>, <span class="variable">template</span>] = <span class="variable">match</span>;
        <span class="keyword">const</span> <span class="variable">array</span> = data[<span class="variable">arrayName</span>];
        
        <span class="keyword">if</span> (Array.isArray(<span class="variable">array</span>)) {
            <span class="keyword">const</span> <span class="variable">renderedItems</span> = <span class="variable">array</span>.map(<span class="variable">item</span> => {
                <span class="keyword">let</span> <span class="variable">itemTemplate</span> = <span class="variable">template</span>;
                
                <span class="keyword">if</span> (<span class="keyword">typeof</span> <span class="variable">item</span> === <span class="string">'object'</span>) {
                    <span class="keyword">for</span> (<span class="keyword">const</span> [<span class="variable">itemKey</span>, <span class="variable">itemValue</span>] of Object.entries(<span class="variable">item</span>)) {
                        <span class="keyword">const</span> <span class="variable">itemRegex</span> = <span class="keyword">new</span> <span class="class">RegExp</span>(`{{\\s*${<span class="variable">itemKey</span>}\\s*}}`, <span class="string">'g'</span>);
                        <span class="variable">itemTemplate</span> = <span class="variable">itemTemplate</span>.replace(<span class="variable">itemRegex</span>, <span class="variable">itemValue</span>);
                    }
                } <span class="keyword">else</span> {
                    <span class="comment">// Si el item no es un objeto, reemplazar {{this}}</span>
                    <span class="variable">itemTemplate</span> = <span class="variable">itemTemplate</span>.replace(/{{this}}/g, <span class="variable">item</span>);
                }
                
                <span class="keyword">return</span> <span class="variable">itemTemplate</span>;
            }).join(<span class="string">''</span>);
            
            <span class="variable">processedTemplate</span> = <span class="variable">processedTemplate</span>.replace(<span class="variable">fullMatch</span>, <span class="variable">renderedItems</span>);
        }
    }
    
    <span class="comment">// Procesar condicionales {{#if condition}} ... {{/if}}</span>
    <span class="keyword">const</span> <span class="variable">ifRegex</span> = /{{#if\s+(\w+)\s*}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g;
    
    <span class="keyword">while</span> ((<span class="variable">match</span> = <span class="variable">ifRegex</span>.exec(<span class="variable">processedTemplate</span>)) !== <span class="keyword">null</span>) {
        <span class="keyword">const</span> [<span class="variable">fullMatch</span>, <span class="variable">condition</span>, <span class="variable">ifContent</span>, <span class="variable">elseContent</span> = <span class="string">''</span>] = <span class="variable">match</span>;
        <span class="keyword">const</span> <span class="variable">conditionValue</span> = data[<span class="variable">condition</span>];
        
        <span class="variable">processedTemplate</span> = <span class="variable">processedTemplate</span>.replace(
            <span class="variable">fullMatch</span>, 
            <span class="variable">conditionValue</span> ? <span class="variable">ifContent</span> : <span class="variable">elseContent</span>
        );
    }
    
    <span class="keyword">return</span> <span class="variable">processedTemplate</span>;
}

<span class="comment">/**
 * Activa los scripts dentro de un componente
 * @param {HTMLElement} container - El contenedor del componente
 */</span>
<span class="keyword">function</span> <span class="function">activateComponentScripts</span>(container) {
    <span class="keyword">const</span> <span class="variable">scripts</span> = container.<span class="function">querySelectorAll</span>(<span class="string">'script'</span>);
    
    <span class="variable">scripts</span>.forEach(<span class="variable">oldScript</span> => {
        <span class="keyword">const</span> <span class="variable">newScript</span> = document.<span class="function">createElement</span>(<span class="string">'script'</span>);
        
        <span class="comment">// Copiar todos los atributos</span>
        Array.from(<span class="variable">oldScript</span>.attributes).forEach(<span class="variable">attr</span> => {
            <span class="variable">newScript</span>.<span class="function">setAttribute</span>(<span class="variable">attr</span>.name, <span class="variable">attr</span>.value);
        });
        
        <span class="comment">// Copiar el contenido del script</span>
        <span class="variable">newScript</span>.textContent = <span class="variable">oldScript</span>.textContent;
        
        <span class="comment">// Reemplazar el script antiguo con el nuevo</span>
        <span class="variable">oldScript</span>.parentNode.<span class="function">replaceChild</span>(<span class="variable">newScript</span>, <span class="variable">oldScript</span>);
    });
}

<span class="comment">/**
 * Carga las dependencias de un componente
 * @param {string} componentName - Nombre del componente
 * @param {Object} options - Opciones de configuración
 * @returns {Promise} Promesa que se resuelve cuando todas las dependencias están cargadas
 */</span>
<span class="keyword">async</span> <span class="keyword">function</span> <span class="function">loadDependencies</span>(componentName, options) {
    <span class="keyword">const</span> <span class="variable">dependencies</span> = <span class="variable">componentDependencies</span>[componentName] || [];
    
    <span class="keyword">if</span> (<span class="variable">dependencies</span>.length === 0) {
        <span class="keyword">return</span>;
    }
    
    <span class="keyword">const</span> <span class="variable">promises</span> = <span class="variable">dependencies</span>.map(<span class="keyword">async</span> <span class="variable">dependency</span> => {
        <span class="keyword">const</span> <span class="variable">dependencyPath</span> = <span class="function">getComponentPath</span>(<span class="variable">dependency</span>, options);
        <span class="keyword">await</span> <span class="function">fetchComponentHtml</span>(<span class="variable">dependencyPath</span>, options.useCache);
        <span class="function">dispatchComponentEvent</span>(<span class="variable">dependency</span>, <span class="string">'preloaded'</span>, {});
    });
    
    <span class="keyword">return</span> Promise.<span class="function">all</span>(<span class="variable">promises</span>);
}

<span class="comment">/**
 * Lanza un evento personalizado relacionado con un componente
 * @param {string} componentName - Nombre del componente
 * @param {string} eventName - Nombre del evento
 * @param {Object} data - Datos para el evento
 */</span>
<span class="keyword">function</span> <span class="function">dispatchComponentEvent</span>(componentName, eventName, data = {}) {
    <span class="keyword">const</span> <span class="variable">event</span> = <span class="keyword">new</span> <span class="class">CustomEvent</span>(`component:${componentName}:${eventName}`, {
        detail: { componentName, ...<span class="variable">data</span> },
        bubbles: <span class="keyword">true</span>
    });
    
    document.<span class="function">dispatchEvent</span>(<span class="variable">event</span>);
}

<span class="comment">/**
 * Maneja los errores de carga de componentes
 * @param {HTMLElement} container - El contenedor donde se cargará el componente
 * @param {string} componentName - Nombre del componente
 * @param {Error} error - El error ocurrido
 */</span>
<span class="keyword">function</span> <span class="function">handleComponentError</span>(container, componentName, error) {
    <span class="keyword">const</span> <span class="variable">errorTemplate</span> = `
        <div class="component-error">
            <h3>Error al cargar el componente: ${componentName}</h3>
            <p>${error.message}</p>
        </div>
    `;
    
    container.innerHTML = <span class="variable">errorTemplate</span>;
}

<span class="comment">/**
 * Muestra u oculta el indicador de carga
 * @param {boolean} show - Si se debe mostrar el indicador
 */</span>
<span class="keyword">function</span> <span class="function">showLoadingIndicator</span>(show) {
    <span class="keyword">const</span> <span class="variable">loadingIndicator</span> = document.<span class="function">getElementById</span>(<span class="string">'loading-indicator'</span>);
    
    <span class="keyword">if</span> (<span class="variable">loadingIndicator</span>) {
        <span class="variable">loadingIndicator</span>.classList.toggle(<span class="string">'active'</span>, show);
    }
}

<span class="comment">/**
 * Limpia la caché de componentes
 * @param {string} [componentName] - Nombre del componente a limpiar (si no se especifica, se limpia toda la caché)
 */</span>
<span class="keyword">export</span> <span class="keyword">function</span> <span class="function">clearComponentCache</span>(componentName) {
    <span class="keyword">if</span> (componentName) {
        <span class="keyword">for</span> (<span class="keyword">const</span> <span class="variable">key</span> of <span class="variable">componentCache</span>.keys()) {
            <span class="keyword">if</span> (<span class="variable">key</span>.includes(componentName)) {
                <span class="variable">componentCache</span>.<span class="function">delete</span>(<span class="variable">key</span>);
            }
        }
    } <span class="keyword">else</span> {
        <span class="variable">componentCache</span>.clear();
    }
}

<span class="comment">/**
 * Recarga los componentes cuando cambia el modo (novato/pro)
 * @param {boolean} isProMode - Si el modo pro está activo
 */</span>
<span class="keyword">export</span> <span class="keyword">async</span> <span class="keyword">function</span> <span class="function">reloadComponentsOnModeChange</span>(isProMode) {
    <span class="keyword">const</span> <span class="variable">loadedComponents</span> = document.<span class="function">querySelectorAll</span>(<span class="string">'[data-component]'</span>);
    
    <span class="keyword">const</span> <span class="variable">promises</span> = Array.from(<span class="variable">loadedComponents</span>).map(<span class="keyword">async</span> <span class="variable">element</span> => {
        <span class="keyword">const</span> <span class="variable">componentName</span> = <span class="variable">element</span>.<span class="function">getAttribute</span>(<span class="string">'data-component'</span>);
        <span class="keyword">const</span> <span class="variable">dataAttr</span> = <span class="variable">element</span>.<span class="function">getAttribute</span>(<span class="string">'data-component-data'</span>);
        <span class="keyword">const</span> <span class="variable">data</span> = <span class="variable">dataAttr</span> ? JSON.<span class="function">parse</span>(<span class="variable">dataAttr</span>) : {};
        
        <span class="comment">// Limpiar caché para este componente</span>
        <span class="function">clearComponentCache</span>(<span class="variable">componentName</span>);
        
        <span class="comment">// Recargar con modo específico activado</span>
        <span class="keyword">return</span> <span class="function">loadComponent</span>(<span class="variable">componentName</span>, <span class="variable">element</span>, <span class="variable">data</span>, { 
            modeSpecific: <span class="keyword">true</span>,
            deviceSpecific: <span class="keyword">true</span>
        });
    });
    
    <span class="keyword">return</span> Promise.<span class="function">all</span>(<span class="variable">promises</span>);
}

<span class="comment">/**
 * Configura una recarga automática de los componentes cuando cambia el tamaño de la ventana
 * (para cambios entre móvil y escritorio)
 */</span>
<span class="keyword">export</span> <span class="keyword">function</span> <span class="function">setupResponsiveReload</span>() {
    <span class="keyword">let</span> <span class="variable">isMobile</span> = <span class="function">isMobileDevice</span>();
    <span class="keyword">let</span> <span class="variable">resizeTimeout</span>;
    
    window.<span class="function">addEventListener</span>(<span class="string">'resize'</span>, () => {
        <span class="comment">// Debounce para evitar demasiadas recargas</span>
        <span class="function">clearTimeout</span>(<span class="variable">resizeTimeout</span>);
        <span class="variable">resizeTimeout</span> = <span class="function">setTimeout</span>(() => {
            <span class="keyword">const</span> <span class="variable">nowMobile</span> = <span class="function">isMobileDevice</span>();
            
            <span class="comment">// Solo recargar si cambia entre móvil y escritorio</span>
            <span class="keyword">if</span> (<span class="variable">isMobile</span> !== <span class="variable">nowMobile</span>) {
                <span class="variable">isMobile</span> = <span class="variable">nowMobile</span>;
                <span class="function">clearComponentCache</span>();
                
                <span class="keyword">const</span> <span class="variable">loadedComponents</span> = document.<span class="function">querySelectorAll</span>(<span class="string">'[data-component]'</span>);
                <span class="variable">loadedComponents</span>.forEach(<span class="variable">element</span> => {
                    <span class="keyword">const</span> <span class="variable">componentName</span> = <span class="variable">element</span>.<span class="function">getAttribute</span>(<span class="string">'data-component'</span>);
                    <span class="keyword">const</span> <span class="variable">dataAttr</span> = <span class="variable">element</span>.<span class="function">getAttribute</span>(<span class="string">'data-component-data'</span>);
                    <span class="keyword">const</span> <span class="variable">data</span> = <span class="variable">dataAttr</span> ? JSON.<span class="function">parse</span>(<span class="variable">dataAttr</span>) : {};
                    
                    <span class="function">loadComponent</span>(<span class="variable">componentName</span>, <span class="variable">element</span>, <span class="variable">data</span>, { deviceSpecific: <span class="keyword">true</span> });
                });
            }
        }, 250);
    });
}

<span class="comment">/**
 * Inicializa el sistema de carga de componentes
 */</span>
<span class="keyword">export</span> <span class="keyword">function</span> <span class="function">initComponentLoader</span>() {
    <span class="comment">// Configurar recarga automática para cambios de tamaño de ventana</span>
    <span class="function">setupResponsiveReload</span>();
    
    <span class="comment">// Escuchar eventos de cambio de modo</span>
    document.<span class="function">addEventListener</span>(<span class="string">'mode:change'</span>, (event) => {
        <span class="keyword">const</span> <span class="variable">isProMode</span> = event.detail.mode === <span class="string">'pro'</span>;
        <span class="function">reloadComponentsOnModeChange</span>(<span class="variable">isProMode</span>);
    });
    
    <span class="comment">// Cargar componentes marcados con data-component-auto-load</span>
    <span class="keyword">const</span> <span class="variable">autoLoadComponents</span> = document.<span class="function">querySelectorAll</span>(<span class="string">'[data-component-auto-load]'</span>);
    
    <span class="variable">autoLoadComponents</span>.forEach(<span class="variable">element</span> => {
        <span class="keyword">const</span> <span class="variable">componentName</span> = <span class="variable">element</span>.<span class="function">getAttribute</span>(<span class="string">'data-component-auto-load'</span>);
        <span class="keyword">const</span> <span class="variable">dataAttr</span> = <span class="variable">element</span>.<span class="function">getAttribute</span>(<span class="string">'data-component-data'</span>);
        <span class="keyword">const</span> <span class="variable">data</span> = <span class="variable">dataAttr</span> ? JSON.<span class="function">parse</span>(<span class="variable">dataAttr</span>) : {};
        
        <span class="function">loadComponent</span>(<span class="variable">componentName</span>, <span class="variable">element</span>, <span class="variable">data</span>);
    });
}

<span class="comment">// Exportación por defecto del módulo</span>
<span class="keyword">export</span> <span class="keyword">default</span> {
    loadComponent,
    clearComponentCache,
    reloadComponentsOnModeChange,
    setupResponsiveReload,
    initComponentLoader,
    isMobileDevice
}
