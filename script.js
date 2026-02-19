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

    // ========== INICIALIZAR TESSERACT PARA GITHUB PAGES ==========
    async function initTesseract() {
        if (!tesseractWorker && typeof Tesseract !== 'undefined') {
            try {
                console.log('Inicializando Tesseract...');
                
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
                console.log('✅ Tesseract listo para escanear');
            } catch (error) {
                console.error('Error inicializando Tesseract:', error);
                alert('Error al cargar el sistema de escaneo. Recarga la página.');
            }
        }
    }

    // ========== FUNCIONES DEL ESCÁNER - SOLO CENTRO DE ETIQUETA ==========
    function abrirScanner(modeloId = null) {
        const modal = document.getElementById('scannerModal');
        const select = document.getElementById('scannerModeloSelect');
        const captureBtn = document.getElementById('captureText');
        
        if (!modal || !select || !captureBtn) return;
        
        // Limpiar resultados anteriores
        document.getElementById('scannerResult').style.display = 'none';
        document.getElementById('detectedText').innerHTML = '';
        
        // Configurar select
        select.innerHTML = '<option value="">🔍 Selecciona modelo</option>';
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
            captureBtn.disabled = true;
        }
        
        modal.classList.add('show');
        iniciarCamara();
        initTesseract();
        
        // Mostrar instrucciones específicas
        mostrarInstruccionesCentro();
    }

    function mostrarInstruccionesCentro() {
        const instrucciones = document.createElement('div');
        instrucciones.className = 'scanner-instrucciones';
        instrucciones.style.cssText = `
            background: #e62828;
            color: white;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
            text-align: center;
            border: 3px solid white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        `;
        instrucciones.innerHTML = `
            <strong style="font-size: 18px;">📸 ENFOQUE EL CENTRO DE LA ETIQUETA</strong>
            <div style="margin-top: 10px; background: white; color: #e62828; padding: 10px; border-radius: 8px;">
                <p style="margin: 5px 0;">⬇️ El escáner capturará:</p>
                <p style="margin: 5px 0; font-weight: bold;">1. NOMBRE DEL REPUESTO (ej: C.D.I)</p>
                <p style="margin: 5px 0; font-weight: bold;">2. CÓDIGO (ej: 311000-1360-02TY0000)</p>
            </div>
            <p style="margin-top: 10px; font-size: 14px;">✅ Asegure buena iluminación y enfoque</p>
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
                    height: { ideal: 1080 }
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
                + '\n- Usar HTTPS'
                + '\n- Dar permisos de cámara');
        }
    }

    // ========== CAPTURAR SOLO EL CENTRO DE LA ETIQUETA ==========
    async function capturarCentroEtiqueta() {
        if (!modeloSeleccionadoScanner) {
            alert('Primero selecciona el modelo de moto');
            return;
        }
        
        const video = document.getElementById('scannerVideo');
        const canvas = document.getElementById('scannerCanvas');
        const captureBtn = document.getElementById('captureText');
        
        if (!video || !canvas || !captureBtn) return;
        
        const context = canvas.getContext('2d');
        
        // Configurar canvas
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        
        // Dibujar imagen completa
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Calcular área CENTRAL (50% del centro)
        const centerWidth = canvas.width * 0.5;
        const centerHeight = canvas.height * 0.4;
        const startX = (canvas.width - centerWidth) / 2;
        const startY = (canvas.height - centerHeight) / 2;
        
        // Crear canvas solo para el centro
        const centerCanvas = document.createElement('canvas');
        centerCanvas.width = centerWidth;
        centerCanvas.height = centerHeight;
        const centerCtx = centerCanvas.getContext('2d');
        
        // Dibujar solo el área central
        centerCtx.drawImage(canvas, startX, startY, centerWidth, centerHeight, 0, 0, centerWidth, centerHeight);
        
        // Mostrar estado
        const originalText = captureBtn.textContent;
        captureBtn.textContent = '⏳ ESCANEANDO...';
        captureBtn.disabled = true;
        
        try {
            console.log('Escaneando centro de etiqueta...');
            
            // Reconocer texto del área central
            const { data: { text } } = await tesseractWorker.recognize(centerCanvas);
            
            console.log('Texto detectado en centro:', text);
            
            if (text && text.trim()) {
                // Procesar para encontrar nombre y código
                const resultado = extraerNombreYCodigo(text);
                
                // Mostrar resultado
                const detectedText = document.getElementById('detectedText');
                const scannerResult = document.getElementById('scannerResult');
                
                let htmlResultado = '';
                if (resultado.nombre || resultado.codigo) {
                    htmlResultado = `
                        <div style="background: #f0f9f0; padding: 15px; border-radius: 10px; border: 2px solid #4CAF50;">
                            <p style="color: #2e7d32; font-weight: bold; margin-bottom: 10px;">✅ TEXTO DETECTADO:</p>
                            ${resultado.nombre ? '<p><strong>🔧 REPUESTO:</strong> ' + resultado.nombre + '</p>' : ''}
                            ${resultado.codigo ? '<p><strong>🔢 CÓDIGO:</strong> ' + resultado.codigo + '</p>' : ''}
                            <p style="margin-top: 10px; font-size: 12px; color: #666;">📋 Todo: ' + resultado.textoOriginal + '</p>
                        </div>
                    `;
                } else {
                    htmlResultado = '<p style="color: #e62828;">❌ No se detectó texto claro. Intenta de nuevo.</p>';
                }
                
                detectedText.innerHTML = htmlResultado;
                scannerResult.style.display = 'block';
                
                // Si se detectó al menos el nombre, preguntar si guardar
                if (resultado.nombre) {
                    const nombreGuardar = resultado.nombre;
                    const codigoGuardar = resultado.codigo ? ' [' + resultado.codigo + ']' : '';
                    
                    if (confirm('¿Guardar este repuesto?\n\n' +
                        '📦 ' + nombreGuardar + codigoGuardar + '\n' +
                        '📌 En: ' + MODELOS.find(m => m.id === modeloSeleccionadoScanner).nombre)) {
                        
                        const nuevoRepuesto = {
                            id: crypto.randomUUID(),
                            nombre: nombreGuardar + codigoGuardar,
                            cantidad: 1
                        };
                        
                        if (!inventarioData[modeloSeleccionadoScanner]) {
                            inventarioData[modeloSeleccionadoScanner] = [];
                        }
                        
                        inventarioData[modeloSeleccionadoScanner].push(nuevoRepuesto);
                        persistirDatos();
                        renderizar();
                        
                        alert('✅ Repuesto guardado correctamente');
                    }
                }
            } else {
                alert('No se detectó texto en el centro. Ajusta el enfoque.');
            }
        } catch (error) {
            console.error('Error al escanear:', error);
            alert('Error al procesar la imagen. Intenta de nuevo.');
        } finally {
            captureBtn.textContent = originalText;
            captureBtn.disabled = false;
        }
    }

    // ========== EXTRAER SOLO NOMBRE Y CÓDIGO ==========
    function extraerNombreYCodigo(textoCompleto) {
        const lineas = textoCompleto.split('\n')
            .map(linea => linea.trim())
            .filter(linea => linea.length > 0);
        
        console.log('Líneas a analizar:', lineas);
        
        let resultado = {
            nombre: '',
            codigo: '',
            textoOriginal: textoCompleto
        };
        
        // Patrones para identificar el código
        const patronCodigo = [
            /^\d{5,}[-]\d{4}[-]\w+$/,  // 311000-1360-02TY0000
            /^\d{5,}[-]\d{4}/,          // 311000-1360
            /^\d{6,}/,                   // 311000
            /[A-Z0-9]{8,}/               // Códigos largos
        ];
        
        // Palabras a ignorar (no son nombres de repuesto)
        const ignorar = ['GENUINE', 'PARTS', 'LECHUZA', 'AGUILA', 'CONDOR', 'CANARIO', 'TUCAN', '200CC', '110CC'];
        
        // Buscar primero el código
        for (let linea of lineas) {
            for (let patron of patronCodigo) {
                if (patron.test(linea) || linea.match(patron)) {
                    resultado.codigo = linea;
                    break;
                }
            }
            if (resultado.codigo) break;
        }
        
        // Buscar el nombre (línea que no sea código ni palabras ignoradas)
        for (let linea of lineas) {
            const lineaMayus = linea.toUpperCase();
            
            // Verificar que no sea código
            let esCodigo = false;
            for (let patron of patronCodigo) {
                if (patron.test(linea) || linea.match(patron)) {
                    esCodigo = true;
                    break;
                }
            }
            
            // Verificar que no sea palabra ignorada
            let esIgnorada = false;
            for (let palabra of ignorar) {
                if (lineaMayus.includes(palabra)) {
                    esIgnorada = true;
                    break;
                }
            }
            
            // Si no es código, no es ignorada y tiene longitud adecuada
            if (!esCodigo && !esIgnorada && linea.length > 1 && linea.length < 30) {
                resultado.nombre = linea;
                break;
            }
        }
        
        // Si no encontramos nombre, usar la línea más significativa
        if (!resultado.nombre) {
            for (let linea of lineas) {
                if (linea.length > 2 && linea.length < 20 && !linea.includes('-')) {
                    resultado.nombre = linea;
                    break;
                }
            }
        }
        
        console.log('Resultado extracción:', resultado);
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

        // Eventos del modal
        const selectModelo = document.getElementById('scannerModeloSelect');
        if (selectModelo) {
            selectModelo.addEventListener('change', (e) => {
                modeloSeleccionadoScanner = e.target.value;
                const captureBtn = document.getElementById('captureText');
                if (captureBtn) {
                    captureBtn.disabled = !e.target.value;
                }
            });
        }

        const captureBtn = document.getElementById('captureText');
        if (captureBtn) {
            captureBtn.addEventListener('click', capturarCentroEtiqueta);
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
