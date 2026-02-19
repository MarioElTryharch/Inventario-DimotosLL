(function() {
    // ========== MODELOS DE MOTOS ==========
    const MODELOS = [
        { id: 'aguila', nombre: 'ÁGUILA 150CC' },
        { id: 'condor', nombre: 'CÓNDOR 150CC' },
        { id: 'canario', nombre: 'CANARIO 150CC' },
        { id: 'tucan', nombre: 'TUCÁN 110CC' },
        { id: 'lechuza', nombre: 'LECHUZA 200CC' },
        { id: 'lechuza2', nombre: 'LECHUZA II 200CC' }
    ];

    // ========== ESTADO GLOBAL ==========
    const STORAGE_KEY = 'inventarioMotosApp';
    let inventarioData = {};
    let editState = {};
    let scannerStream = null;
    let modeloSeleccionadoScanner = null;
    let tesseractWorker = null;

    MODELOS.forEach(m => { editState[m.id] = null; });

    // ========== CARGA DE DATOS ==========
    function cargarDatos() {
        const guardado = localStorage.getItem(STORAGE_KEY);
        if (guardado) {
            try {
                inventarioData = JSON.parse(guardado);
                MODELOS.forEach(m => {
                    if (!inventarioData[m.id]) inventarioData[m.id] = [];
                });
            } catch (e) {
                setDatosPorDefecto();
            }
        } else {
            setDatosPorDefecto();
        }
    }

    function setDatosPorDefecto() {
        inventarioData = {
            aguila: [
                { id: crypto.randomUUID(), nombre: 'Kit arrastre', cantidad: 5 },
                { id: crypto.randomUUID(), nombre: 'Pastillas freno', cantidad: 12 }
            ],
            condor: [
                { id: crypto.randomUUID(), nombre: 'Carburador', cantidad: 2 },
                { id: crypto.randomUUID(), nombre: 'Manillar', cantidad: 3 }
            ],
            canario: [
                { id: crypto.randomUUID(), nombre: 'Cubierta trasera', cantidad: 4 },
                { id: crypto.randomUUID(), nombre: 'Espejos', cantidad: 6 }
            ],
            tucan: [
                { id: crypto.randomUUID(), nombre: 'Filtro aire', cantidad: 8 },
                { id: crypto.randomUUID(), nombre: 'Bujía', cantidad: 15 }
            ],
            lechuza: [
                { id: crypto.randomUUID(), nombre: 'Cadena', cantidad: 3 },
                { id: crypto.randomUUID(), nombre: 'Piñón', cantidad: 4 }
            ],
            lechuza2: [
                { id: crypto.randomUUID(), nombre: 'Amortiguador', cantidad: 2 },
                { id: crypto.randomUUID(), nombre: 'Manetas', cantidad: 5 }
            ]
        };
    }

    // ========== INICIALIZAR TESSERACT ==========
    async function initTesseract() {
        if (!tesseractWorker) {
            try {
                tesseractWorker = await Tesseract.createWorker('spa', 1, {
                    logger: progress => {
                        if (progress.status === 'recognizing text') {
                            console.log(`Progreso: ${Math.round(progress.progress * 100)}%`);
                        }
                    }
                });
                console.log('Tesseract listo');
            } catch (error) {
                console.error('Error inicializando Tesseract:', error);
            }
        }
    }

    // ========== GESTIÓN DEL LOGO ==========
    function inicializarLogo() {
        const logoImg = document.getElementById('logoImg');
        const logoPlaceholder = document.getElementById('logoPlaceholder');
        
        const img = new Image();
        img.onload = function() {
            logoImg.style.display = 'block';
            logoPlaceholder.style.display = 'none';
        };
        
        img.onerror = function() {
            logoImg.style.display = 'none';
            logoPlaceholder.style.display = 'flex';
            crearSelectorLogo();
        };
        
        img.src = logoImg.src;
    }

    function crearSelectorLogo() {
        const logoArea = document.querySelector('.logo-area');
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.id = 'logoFileInput';
        logoArea.appendChild(fileInput);
        
        const placeholder = document.getElementById('logoPlaceholder');
        placeholder.style.cursor = 'pointer';
        placeholder.title = 'Haz clic para subir tu logo';
        
        placeholder.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const logoImg = document.getElementById('logoImg');
                    logoImg.src = event.target.result;
                    logoImg.style.display = 'block';
                    placeholder.style.display = 'none';
                    try {
                        localStorage.setItem('motoInventLogo', event.target.result);
                    } catch (e) {
                        console.warn('No se pudo guardar el logo');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
        
        try {
            const savedLogo = localStorage.getItem('motoInventLogo');
            if (savedLogo) {
                const logoImg = document.getElementById('logoImg');
                logoImg.src = savedLogo;
                logoImg.style.display = 'block';
                placeholder.style.display = 'none';
            }
        } catch (e) {}
    }

    // ========== FUNCIONES DEL ESCÁNER ==========
    function abrirScanner(modeloId = null) {
        const modal = document.getElementById('scannerModal');
        const select = document.getElementById('scannerModeloSelect');
        const captureBtn = document.getElementById('captureText');
        
        // Llenar select con modelos
        select.innerHTML = '<option value="">Selecciona modelo destino</option>';
        MODELOS.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.nombre;
            select.appendChild(option);
        });
        
        if (modeloId) {
            select.value = modeloId;
            modeloSeleccionadoScanner = modeloId;
            captureBtn.disabled = false;
        } else {
            captureBtn.disabled = true;
        }
        
        modal.classList.add('show');
        iniciarCamara();
        initTesseract();
    }

    async function iniciarCamara() {
        try {
            if (scannerStream) {
                scannerStream.getTracks().forEach(track => track.stop());
            }
            
            scannerStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            
            const video = document.getElementById('scannerVideo');
            video.srcObject = scannerStream;
            await video.play();
        } catch (error) {
            console.error('Error al acceder a la cámara:', error);
            alert('No se pudo acceder a la cámara. Asegúrate de dar permisos.');
        }
    }

    async function capturarTexto() {
        if (!modeloSeleccionadoScanner) {
            alert('Selecciona un modelo destino');
            return;
        }
        
        const video = document.getElementById('scannerVideo');
        const canvas = document.getElementById('scannerCanvas');
        const context = canvas.getContext('2d');
        
        // Configurar canvas del tamaño del video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Dibujar frame del video en canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Mostrar estado
        const captureBtn = document.getElementById('captureText');
        const originalText = captureBtn.textContent;
        captureBtn.textContent = '⏳ Procesando...';
        captureBtn.disabled = true;
        
        try {
            // Usar Tesseract para reconocer texto
            const { data: { text } } = await tesseractWorker.recognize(canvas);
            
            if (text && text.trim()) {
                document.getElementById('detectedText').textContent = text.trim();
                document.getElementById('scannerResult').style.display = 'block';
                
                // Preguntar si quiere guardar
                if (confirm('¿Quieres guardar este texto como repuesto en ' + 
                    MODELOS.find(m => m.id === modeloSeleccionadoScanner).nombre + '?')) {
                    
                    const nuevoRepuesto = {
                        id: crypto.randomUUID(),
                        nombre: text.trim().substring(0, 50), // Limitar longitud
                        cantidad: 1
                    };
                    
                    if (!inventarioData[modeloSeleccionadoScanner]) {
                        inventarioData[modeloSeleccionadoScanner] = [];
                    }
                    
                    inventarioData[modeloSeleccionadoScanner].push(nuevoRepuesto);
                    persistirDatos();
                    renderizar();
                    
                    alert('✅ Repuesto guardado: ' + nuevoRepuesto.nombre);
                }
            } else {
                alert('No se detectó texto. Intenta de nuevo con mejor iluminación.');
            }
        } catch (error) {
            console.error('Error al reconocer texto:', error);
            alert('Error al procesar la imagen. Intenta de nuevo.');
        } finally {
            captureBtn.textContent = originalText;
            captureBtn.disabled = false;
        }
    }

    function cerrarScanner() {
        const modal = document.getElementById('scannerModal');
        modal.classList.remove('show');
        
        if (scannerStream) {
            scannerStream.getTracks().forEach(track => track.stop());
            scannerStream = null;
        }
        
        document.getElementById('scannerResult').style.display = 'none';
    }

    // ========== UTILIDADES ==========
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function persistirDatos() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inventarioData));
    }

    // ========== RENDERIZADO ==========
    const appDiv = document.getElementById('app');

    function renderizar() {
        let html = '<div class="inventario-grid">';

        MODELOS.forEach(modelo => {
            const items = inventarioData[modelo.id] || [];
            const edit = editState[modelo.id];

            let filasTabla = '';
            items.forEach(item => {
                filasTabla += `<tr>
                    <td>${escapeHTML(item.nombre)}</td>
                    <td>${item.cantidad}</td>
                    <td>
                        <button class="btn-editar" data-modelo="${modelo.id}" 
                                data-id="${item.id}" 
                                data-nombre="${escapeHTML(item.nombre)}" 
                                data-cantidad="${item.cantidad}">
                            ✏️ Editar
                        </button>
                        <button class="btn-eliminar" data-modelo="${modelo.id}" data-id="${item.id}">
                            🗑️ Eliminar
                        </button>
                    </td>
                </tr>`;
            });

            if (filasTabla === '') {
                filasTabla = `<tr><td colspan="3" style="text-align: center; padding: 2rem;">📦 No hay repuestos</td></tr>`;
            }

            const modoEdicion = edit !== null;
            const valorNombre = modoEdicion ? edit.nombre : '';
            const valorCantidad = modoEdicion ? edit.cantidad : '';
            const textoBoton = modoEdicion ? '✅ ACTUALIZAR' : '➕ AGREGAR';
            const idEditando = modoEdicion ? edit.itemId : '';
            const mostrarCancel = modoEdicion ? 'inline-block' : 'none';

            html += `
                <div class="moto-card" data-modelo-card="${modelo.id}">
                    <div class="card-header">
                        <h2>${modelo.nombre}</h2>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button class="btn-imprimir" data-imprimir="${modelo.id}">
                                🖨️ Imprimir
                            </button>
                            <button class="btn-scanner-card" data-scanner="${modelo.id}">
                                📸 Escanear
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <table class="tabla-repuestos">
                            <thead>
                                <tr>
                                    <th>Repuesto</th>
                                    <th>Cant</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filasTabla}
                            </tbody>
                        </table>

                        <div class="form-crud" data-modelo-form="${modelo.id}">
                            <input type="text" 
                                   id="input-nombre-${modelo.id}" 
                                   placeholder="Nombre repuesto" 
                                   value="${escapeHTML(valorNombre)}">
                            <input type="number" 
                                   id="input-cantidad-${modelo.id}" 
                                   placeholder="Cant" 
                                   min="0" 
                                   value="${escapeHTML(valorCantidad)}">
                            <button class="btn-agregar" 
                                    data-modelo="${modelo.id}" 
                                    data-editando="${modoEdicion}" 
                                    data-id-edit="${idEditando}">
                                ${textoBoton}
                            </button>
                            <button class="btn-cancel" 
                                    data-modelo="${modelo.id}" 
                                    id="cancelar-edit-${modelo.id}"
                                    style="display: ${mostrarCancel};">
                                ✖ Cancelar
                            </button>
                        </div>
                        ${modoEdicion ? '<span class="edit-flag">✏️ Editando</span>' : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        appDiv.innerHTML = html;
        agregarEventListeners();
    }

    // ========== EVENT LISTENERS ==========
    function agregarEventListeners() {
        // Eliminar
        document.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const modelo = btn.dataset.modelo;
                const idItem = btn.dataset.id;
                
                if (confirm('¿Eliminar este repuesto?')) {
                    inventarioData[modelo] = inventarioData[modelo].filter(it => it.id !== idItem);
                    if (editState[modelo] && editState[modelo].itemId === idItem) {
                        editState[modelo] = null;
                    }
                    persistirDatos();
                    renderizar();
                }
            });
        });

        // Editar
        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', () => {
                const modelo = btn.dataset.modelo;
                editState[modelo] = {
                    itemId: btn.dataset.id,
                    nombre: btn.dataset.nombre,
                    cantidad: btn.dataset.cantidad
                };
                renderizar();
            });
        });

        // Agregar / Actualizar
        document.querySelectorAll('.btn-agregar').forEach(btn => {
            btn.addEventListener('click', () => {
                const modelo = btn.dataset.modelo;
                const editando = btn.dataset.editando === 'true';
                
                const inputNombre = document.getElementById(`input-nombre-${modelo}`);
                const inputCantidad = document.getElementById(`input-cantidad-${modelo}`);
                
                const nombreVal = inputNombre.value.trim();
                const cantidadVal = parseInt(inputCantidad.value, 10);

                if (!nombreVal) {
                    alert('Escribe el nombre del repuesto');
                    return;
                }
                
                if (isNaN(cantidadVal) || cantidadVal < 0) {
                    alert('Cantidad inválida');
                    return;
                }

                if (editando) {
                    const idEdit = btn.dataset.idEdit;
                    const items = inventarioData[modelo];
                    const index = items.findIndex(it => it.id === idEdit);
                    
                    if (index !== -1) {
                        items[index].nombre = nombreVal;
                        items[index].cantidad = cantidadVal;
                    }
                    editState[modelo] = null;
                } else {
                    if (!inventarioData[modelo]) inventarioData[modelo] = [];
                    inventarioData[modelo].push({
                        id: crypto.randomUUID(),
                        nombre: nombreVal,
                        cantidad: cantidadVal
                    });
                }

                persistirDatos();
                renderizar();
            });
        });

        // Cancelar edición
        MODELOS.forEach(modelo => {
            const btnCancel = document.getElementById(`cancelar-edit-${modelo.id}`);
            if (btnCancel) {
                btnCancel.addEventListener('click', () => {
                    editState[modelo.id] = null;
                    renderizar();
                });
            }
        });

        // Botones de escáner en cada tarjeta
        document.querySelectorAll('.btn-scanner-card').forEach(btn => {
            btn.addEventListener('click', () => {
                abrirScanner(btn.dataset.scanner);
            });
        });

        // Imprimir
        document.querySelectorAll('.btn-imprimir').forEach(btn => {
            btn.addEventListener('click', () => {
                const modeloId = btn.dataset.imprimir;
                const modelo = MODELOS.find(m => m.id === modeloId);
                if (!modelo) return;

                const items = inventarioData[modeloId] || [];
                
                const ventana = window.open('', '_blank');
                if (!ventana) {
                    alert('Permite ventanas emergentes');
                    return;
                }

                let filas = '';
                items.forEach(it => {
                    filas += `<tr>
                        <td>${escapeHTML(it.nombre)}</td>
                        <td style="text-align: center;">${it.cantidad}</td>
                    </tr>`;
                });

                const contenido = `
                    <html>
                    <head>
                        <title>${modelo.nombre}</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body { font-family: sans-serif; padding: 1rem; }
                            h1 { color: #c41e1e; font-size: 1.8rem; }
                            table { width: 100%; border-collapse: collapse; }
                            th { background: #e62828; color: white; padding: 0.8rem; text-align: left; }
                            td { padding: 0.8rem; border-bottom: 1px solid #ffd6d6; }
                            @media print { th { background: #e62828 !important; } }
                        </style>
                    </head>
                    <body>
                        <h1>🛵 ${modelo.nombre}</h1>
                        <table>
                            <tr><th>Repuesto</th><th>Cantidad</th></tr>
                            ${filas}
                        </table>
                        <p style="margin-top: 2rem; color: #b71c1c;">
                            MotoInvent · ${new Date().toLocaleDateString()}
                        </p>
                        <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
                    </body>
                    </html>
                `;

                ventana.document.write(contenido);
                ventana.document.close();
            });
        });

        // Eventos del modal
        const selectModelo = document.getElementById('scannerModeloSelect');
        if (selectModelo) {
            selectModelo.addEventListener('change', (e) => {
                modeloSeleccionadoScanner = e.target.value;
                document.getElementById('captureText').disabled = !e.target.value;
            });
        }

        document.getElementById('captureText')?.addEventListener('click', capturarTexto);
        document.getElementById('closeScanner')?.addEventListener('click', cerrarScanner);
        document.getElementById('cancelScanner')?.addEventListener('click', cerrarScanner);
    }

    // ========== INICIALIZACIÓN ==========
    cargarDatos();
    renderizar();
    document.addEventListener('DOMContentLoaded', inicializarLogo);
})();
