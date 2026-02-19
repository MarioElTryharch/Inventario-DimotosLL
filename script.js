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
            aguila: [],
            condor: [],
            canario: [],
            tucan: [],
            lechuza: [],
            lechuza2: []
        };
    }

    // ========== INICIALIZAR TESSERACT CON CDN SEGURO ==========
    async function initTesseract() {
        if (!tesseractWorker && typeof Tesseract !== 'undefined') {
            try {
                // Configuración para HTTPS y GitHub Pages
                tesseractWorker = await Tesseract.createWorker({
                    logger: progress => {
                        if (progress.status === 'recognizing text') {
                            console.log('Progreso: ' + Math.round(progress.progress * 100) + '%');
                        }
                    },
                    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4.0.2/tesseract-core.wasm.js',
                    workerPath: 'https://unpkg.com/tesseract.js@4.0.2/dist/worker.min.js',
                    langPath: 'https://tessdata.projectnaptha.com/4.0.0'
                });
                
                await tesseractWorker.loadLanguage('spa');
                await tesseractWorker.initialize('spa');
                console.log('Tesseract listo para escanear');
            } catch (error) {
                console.error('Error inicializando Tesseract:', error);
                alert('Error al cargar el sistema de escaneo. Recarga la página.');
            }
        }
    }

    // ========== FUNCIONES DEL ESCÁNER MEJORADO ==========
    function abrirScanner(modeloId = null) {
        const modal = document.getElementById('scannerModal');
        const select = document.getElementById('scannerModeloSelect');
        const captureBtn = document.getElementById('captureText');
        
        if (!modal || !select || !captureBtn) return;
        
        // Llenar select con modelos
        select.innerHTML = '<option value="">🔍 DETECTAR AUTOMÁTICAMENTE</option>';
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
            modeloSeleccionadoScanner = null;
            captureBtn.disabled = false; // Habilitar siempre para detección automática
        }
        
        modal.classList.add('show');
        iniciarCamara();
        initTesseract();
        
        // Mostrar instrucciones
        mostrarInstrucciones();
    }

    function mostrarInstrucciones() {
        const instrucciones = document.createElement('div');
        instrucciones.className = 'scanner-instrucciones';
        instrucciones.style.cssText = `
            background: #e62828;
            color: white;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
            text-align: center;
            font-size: 16px;
            animation: pulse 2s infinite;
        `;
        instrucciones.innerHTML = `
            <strong>📸 ESCANEE TODA LA ETIQUETA</strong>
            <p style="margin-top: 8px; font-size: 14px; color: #fff;">
                Incluya el modelo de moto y el código de barras
            </p>
            <p style="margin-top: 5px; font-size: 12px; opacity: 0.9;">
                El sistema detectará automáticamente el modelo
            </p>
        `;
        
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            const oldInst = document.querySelector('.scanner-instrucciones');
            if (oldInst) oldInst.remove();
            modalBody.insertBefore(instrucciones, modalBody.firstChild);
        }
    }

    async function iniciarCamara() {
        try {
            if (scannerStream) {
                scannerStream.getTracks().forEach(track => track.stop());
            }
            
            // Configuración específica para móviles
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    aspectRatio: { ideal: 1.7777777778 }
                }
            };
            
            scannerStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            const video = document.getElementById('scannerVideo');
            if (video) {
                video.srcObject = scannerStream;
                video.setAttribute('playsinline', true);
                video.setAttribute('autoplay', true);
                video.setAttribute('muted', true);
                await video.play();
            }
        } catch (error) {
            console.error('Error al acceder a la cámara:', error);
            alert('No se pudo acceder a la cámara. Asegúrate de:'
                + '\n- Usar HTTPS (GitHub Pages lo requiere)'
                + '\n- Dar permisos de cámara'
                + '\n- Estar en un dispositivo con cámara');
        }
    }

    // ========== PROCESAMIENTO COMPLETO DE ETIQUETA ==========
    async function capturarTextoCompleto() {
        const video = document.getElementById('scannerVideo');
        const canvas = document.getElementById('scannerCanvas');
        const captureBtn = document.getElementById('captureText');
        
        if (!video || !canvas || !captureBtn) return;
        
        const context = canvas.getContext('2d');
        
        // Configurar canvas del tamaño del video
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        
        // Dibujar frame completo
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Mostrar estado
        const originalText = captureBtn.textContent;
        captureBtn.textContent = '⏳ Procesando etiqueta...';
        captureBtn.disabled = true;
        
        try {
            // Reconocer texto de TODA la imagen
            const { data: { text } } = await tesseractWorker.recognize(canvas);
            
            if (text && text.trim()) {
                // Procesar el texto completo
                const resultado = procesarEtiquetaCompleta(text);
                
                // Mostrar resultado
                const detectedText = document.getElementById('detectedText');
                const scannerResult = document.getElementById('scannerResult');
                
                if (detectedText) {
                    detectedText.innerHTML = `
                        <strong>🔍 MODELO DETECTADO:</strong> ${resultado.modelo}<br>
                        <strong>📦 REPUESTO:</strong> ${resultado.repuesto}<br>
                        <strong>🔢 CÓDIGO:</strong> ${resultado.codigo}<br>
                        <strong>📋 TEXTO COMPLETO:</strong><br>${resultado.textoOriginal}
                    `;
                }
                if (scannerResult) scannerResult.style.display = 'block';
                
                // Verificar si el modelo existe
                if (resultado.modeloId) {
                    // Guardar automáticamente
                    if (confirm('✅ ¿Guardar este repuesto en ' + resultado.modelo + '?\n\n' +
                        'Repuesto: ' + resultado.repuesto + '\n' +
                        'Código: ' + resultado.codigo)) {
                        
                        const nuevoRepuesto = {
                            id: crypto.randomUUID(),
                            nombre: resultado.repuesto + ' [' + resultado.codigo + ']',
                            cantidad: 1
                        };
                        
                        if (!inventarioData[resultado.modeloId]) {
                            inventarioData[resultado.modeloId] = [];
                        }
                        
                        inventarioData[resultado.modeloId].push(nuevoRepuesto);
                        persistirDatos();
                        renderizar();
                        
                        alert('✅ Repuesto guardado en ' + resultado.modelo);
                        
                        // Cerrar modal después de guardar
                        setTimeout(cerrarScanner, 1000);
                    }
                } else {
                    // No se detectó modelo, pedir selección manual
                    alert('No se pudo detectar el modelo automáticamente.\n' +
                          'Por favor, seleccione el modelo manualmente.');
                }
            } else {
                alert('No se detectó texto. Asegure buena iluminación y enfoque.');
            }
        } catch (error) {
            console.error('Error al reconocer texto:', error);
            alert('Error al procesar la imagen. Intenta de nuevo.\n' +
                  'Error: ' + error.message);
        } finally {
            captureBtn.textContent = originalText;
            captureBtn.disabled = false;
        }
    }

    // ========== PROCESADOR INTELIGENTE DE ETIQUETAS ==========
    function procesarEtiquetaCompleta(textoCompleto) {
        const lineas = textoCompleto.split('\n')
            .map(linea => linea.trim())
            .filter(linea => linea.length > 0);
        
        console.log('Líneas detectadas:', lineas);
        
        // Inicializar resultado
        let resultado = {
            modelo: 'NO DETECTADO',
            modeloId: null,
            repuesto: 'REPUESTO',
            codigo: 'SIN CÓDIGO',
            textoOriginal: textoCompleto
        };
        
        // 1. DETECTAR MODELO DE MOTO
        const modelosBuscar = {
            'AGUILA': { id: 'aguila', nombre: 'ÁGUILA 150CC' },
            'CONDOR': { id: 'condor', nombre: 'CÓNDOR 150CC' },
            'CANARIO': { id: 'canario', nombre: 'CANARIO 150CC' },
            'TUCAN': { id: 'tucan', nombre: 'TUCÁN 110CC' },
            'TUCÁN': { id: 'tucan', nombre: 'TUCÁN 110CC' },
            'LECHUZA 200CC': { id: 'lechuza', nombre: 'LECHUZA 200CC' },
            'LECHUZA II': { id: 'lechuza2', nombre: 'LECHUZA II 200CC' }
        };
        
        for (let linea of lineas) {
            const lineaMayus = linea.toUpperCase();
            for (let [clave, modelo] of Object.entries(modelosBuscar)) {
                if (lineaMayus.includes(clave)) {
                    resultado.modelo = modelo.nombre;
                    resultado.modeloId = modelo.id;
                    break;
                }
            }
            if (resultado.modeloId) break;
        }
        
        // 2. DETECTAR NOMBRE DEL REPUESTO
        // Buscar líneas que no sean modelo, código o marcas
        for (let linea of lineas) {
            const lineaMayus = linea.toUpperCase();
            // Ignorar líneas que contengan modelos, códigos largos o marcas
            if (!lineaMayus.includes('GENUINE') && 
                !lineaMayus.includes('PARTS') &&
                !lineaMayus.includes('LECHUZA') &&
                !lineaMayus.includes('AGUILA') &&
                !lineaMayus.includes('CONDOR') &&
                !lineaMayus.includes('CANARIO') &&
                !lineaMayus.includes('TUCAN') &&
                !lineaMayus.match(/\d{8,}/) && // Códigos largos
                linea.length > 2 && 
                linea.length < 30) {
                resultado.repuesto = linea;
                break;
            }
        }
        
        // 3. DETECTAR CÓDIGO DEL REPUESTO
        for (let linea of lineas) {
            // Buscar patrones de código (números, guiones, combinaciones)
            if (linea.match(/\d+[-]\d+/) || 
                linea.match(/[A-Z0-9]{8,}/) ||
                linea.match(/\d{6,}/)) {
                resultado.codigo = linea;
                break;
            }
        }
        
        // Si no se encontró repuesto específico, usar la línea más significativa
        if (resultado.repuesto === 'REPUESTO') {
            for (let linea of lineas) {
                if (linea.length > 3 && 
                    linea.length < 25 && 
                    !linea.includes('GENUINE') &&
                    !linea.includes(resultado.modelo)) {
                    resultado.repuesto = linea;
                    break;
                }
            }
        }
        
        console.log('Resultado procesamiento:', resultado);
        return resultado;
    }

    function cerrarScanner() {
        const modal = document.getElementById('scannerModal');
        if (modal) {
            modal.classList.remove('show');
        }
        
        if (scannerStream) {
            scannerStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            scannerStream = null;
        }
        
        const scannerResult = document.getElementById('scannerResult');
        if (scannerResult) {
            scannerResult.style.display = 'none';
        }
        
        const instrucciones = document.querySelector('.scanner-instrucciones');
        if (instrucciones) instrucciones.remove();
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
        if (!appDiv) return;
        
        let html = '<div class="inventario-grid">';

        MODELOS.forEach(modelo => {
            const items = inventarioData[modelo.id] || [];
            const edit = editState[modelo.id];

            let filasTabla = '';
            items.forEach(item => {
                filasTabla += '<tr>' +
                    '<td>' + escapeHTML(item.nombre) + '</td>' +
                    '<td>' + item.cantidad + '</td>' +
                    '<td>' +
                        '<button class="btn-editar" data-modelo="' + modelo.id + '" ' +
                                'data-id="' + item.id + '" ' +
                                'data-nombre="' + escapeHTML(item.nombre) + '" ' +
                                'data-cantidad="' + item.cantidad + '">' +
                            '✏️ Editar' +
                        '</button>' +
                        '<button class="btn-eliminar" data-modelo="' + modelo.id + '" data-id="' + item.id + '">' +
                            '🗑️ Eliminar' +
                        '</button>' +
                    '</td>' +
                '</tr>';
            });

            if (filasTabla === '') {
                filasTabla = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">📦 No hay repuestos</td></tr>';
            }

            const modoEdicion = edit !== null;
            const valorNombre = modoEdicion ? edit.nombre : '';
            const valorCantidad = modoEdicion ? edit.cantidad : '';
            const textoBoton = modoEdicion ? '✅ ACTUALIZAR' : '➕ AGREGAR';
            const idEditando = modoEdicion ? edit.itemId : '';
            const mostrarCancel = modoEdicion ? 'inline-block' : 'none';

            html += '<div class="moto-card" data-modelo-card="' + modelo.id + '">' +
                '<div class="card-header">' +
                    '<h2>' + modelo.nombre + '</h2>' +
                    '<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' +
                        '<button class="btn-imprimir" data-imprimir="' + modelo.id + '">' +
                            '🖨️ Imprimir' +
                        '</button>' +
                        '<button class="btn-scanner-card" data-scanner="' + modelo.id + '">' +
                            '📸 Escanear' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card-body">' +
                    '<table class="tabla-repuestos">' +
                        '<thead>' +
                            '<tr>' +
                                '<th>Repuesto</th>' +
                                '<th>Cant</th>' +
                                '<th>Acciones</th>' +
                            '</tr>' +
                        '</thead>' +
                        '<tbody>' +
                            filasTabla +
                        '</tbody>' +
                    '</table>' +
                    '<div class="form-crud" data-modelo-form="' + modelo.id + '">' +
                        '<input type="text" ' +
                               'id="input-nombre-' + modelo.id + '" ' +
                               'placeholder="Nombre repuesto" ' +
                               'value="' + escapeHTML(valorNombre) + '">' +
                        '<input type="number" ' +
                               'id="input-cantidad-' + modelo.id + '" ' +
                               'placeholder="Cant" ' +
                               'min="0" ' +
                               'value="' + escapeHTML(String(valorCantidad)) + '">' +
                        '<button class="btn-agregar" ' +
                                'data-modelo="' + modelo.id + '" ' +
                                'data-editando="' + modoEdicion + '" ' +
                                'data-id-edit="' + idEditando + '">' +
                            textoBoton +
                        '</button>' +
                        '<button class="btn-cancel" ' +
                                'data-modelo="' + modelo.id + '" ' +
                                'id="cancelar-edit-' + modelo.id + '" ' +
                                'style="display: ' + mostrarCancel + ';">' +
                            '✖ Cancelar' +
                        '</button>' +
                    '</div>';
            
            if (modoEdicion) {
                html += '<span class="edit-flag">✏️ Editando</span>';
            }
            
            html += '</div></div>';
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
                
                const inputNombre = document.getElementById('input-nombre-' + modelo);
                const inputCantidad = document.getElementById('input-cantidad-' + modelo);
                
                if (!inputNombre || !inputCantidad) return;
                
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
            const btnCancel = document.getElementById('cancelar-edit-' + modelo.id);
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
                    filas += '<tr>' +
                        '<td>' + escapeHTML(it.nombre) + '</td>' +
                        '<td style="text-align: center;">' + it.cantidad + '</td>' +
                    '</tr>';
                });

                if (filas === '') {
                    filas = '<tr><td colspan="2" style="padding: 40px; text-align: center;">Inventario vacío</td></tr>';
                }

                const contenido = '<!DOCTYPE html>' +
                    '<html>' +
                    '<head>' +
                        '<title>' + modelo.nombre + '</title>' +
                        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
                        '<style>' +
                            'body { font-family: sans-serif; padding: 1rem; }' +
                            'h1 { color: #c41e1e; font-size: 1.8rem; }' +
                            'table { width: 100%; border-collapse: collapse; }' +
                            'th { background: #e62828; color: white; padding: 0.8rem; text-align: left; }' +
                            'td { padding: 0.8rem; border-bottom: 1px solid #ffd6d6; }' +
                            '@media print { th { background: #e62828 !important; } }' +
                        '</style>' +
                    '</head>' +
                    '<body>' +
                        '<h1>🛵 ' + modelo.nombre + '</h1>' +
                        '<table>' +
                            '<tr><th>Repuesto</th><th>Cantidad</th></tr>' +
                            filas +
                        '</table>' +
                        '<p style="margin-top: 2rem; color: #b71c1c;">' +
                            'MotoInvent · ' + new Date().toLocaleDateString() +
                        '</p>' +
                        '<script>window.onload = () => setTimeout(() => window.print(), 300);</script>' +
                    '</body>' +
                    '</html>';

                ventana.document.write(contenido);
                ventana.document.close();
            });
        });

        // Eventos del modal
        const selectModelo = document.getElementById('scannerModeloSelect');
        if (selectModelo) {
            selectModelo.addEventListener('change', (e) => {
                modeloSeleccionadoScanner = e.target.value || null;
            });
        }

        const captureBtn = document.getElementById('captureText');
        if (captureBtn) {
            captureBtn.addEventListener('click', capturarTextoCompleto);
        }
        
        const closeBtn = document.getElementById('closeScanner');
        if (closeBtn) {
            closeBtn.addEventListener('click', cerrarScanner);
        }
        
        const cancelBtn = document.getElementById('cancelScanner');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', cerrarScanner);
        }
    }

    // ========== INICIALIZACIÓN ==========
    cargarDatos();
    renderizar();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarLogo);
    } else {
        inicializarLogo();
    }
})();
