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
    let ultimoTextoDetectado = [];

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

    // ========== INICIALIZAR TESSERACT ==========
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
                console.log('✅ Tesseract listo');
            } catch (error) {
                console.error('Error:', error);
            }
        }
    }

    // ========== FUNCIONES DEL ESCÁNER ==========
    function abrirScanner(modeloId = null) {
        const modal = document.getElementById('scannerModal');
        const select = document.getElementById('scannerModeloSelect');
        const captureBtn = document.getElementById('captureText');
        
        if (!modal || !select || !captureBtn) return;
        
        // Limpiar resultados anteriores
        document.getElementById('scannerResult').style.display = 'none';
        document.getElementById('detectedText').innerHTML = '';
        ultimoTextoDetectado = [];
        
        // Configurar select
        select.innerHTML = '<option value="">Selecciona modelo</option>';
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
        `;
        instrucciones.innerHTML = `
            <strong style="font-size: 18px;">📸 ENFOQUE LA ETIQUETA COMPLETA</strong>
            <p style="margin-top: 10px;">Luego podrá seleccionar el texto correcto</p>
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
            
            scannerStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                } 
            });
            
            const video = document.getElementById('scannerVideo');
            if (video) {
                video.srcObject = scannerStream;
                video.setAttribute('playsinline', true);
                video.setAttribute('autoplay', true);
                video.setAttribute('muted', true);
                await video.play();
            }
        } catch (error) {
            alert('Error con la cámara. Asegúrate de dar permisos.');
        }
    }

    // ========== CAPTURAR Y MOSTRAR TODO EL TEXTO ==========
    async function capturarTexto() {
        if (!modeloSeleccionadoScanner) {
            alert('Selecciona un modelo');
            return;
        }
        
        const video = document.getElementById('scannerVideo');
        const canvas = document.getElementById('scannerCanvas');
        const captureBtn = document.getElementById('captureText');
        
        if (!video || !canvas || !captureBtn) return;
        
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const originalText = captureBtn.textContent;
        captureBtn.textContent = '⏳ ESCANEANDO...';
        captureBtn.disabled = true;
        
        try {
            // Escanear TODO el texto de la imagen
            const { data: { text } } = await tesseractWorker.recognize(canvas);
            
            if (text && text.trim()) {
                // Dividir en líneas y limpiar
                const lineas = text.split('\n')
                    .map(linea => linea.trim())
                    .filter(linea => linea.length > 2); // Solo líneas con más de 2 caracteres
                
                ultimoTextoDetectado = lineas;
                
                console.log('Texto detectado:', lineas);
                
                // Mostrar todas las líneas detectadas para que el usuario elija
                mostrarLineasDetectadas(lineas);
            } else {
                alert('No se detectó texto. Intenta de nuevo.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al escanear. Intenta de nuevo.');
        } finally {
            captureBtn.textContent = originalText;
            captureBtn.disabled = false;
        }
    }

    // ========== MOSTRAR LÍNEAS DETECTADAS ==========
    function mostrarLineasDetectadas(lineas) {
        const scannerResult = document.getElementById('scannerResult');
        const detectedText = document.getElementById('detectedText');
        
        let html = `
            <div style="background: #f5f5f5; padding: 15px; border-radius: 10px;">
                <p style="color: #e62828; font-weight: bold; margin-bottom: 15px;">
                    📋 TEXTO DETECTADO - Selecciona el nombre del repuesto:
                </p>
        `;
        
        // Mostrar cada línea como botón seleccionable
        lineas.forEach((linea, index) => {
            // Resaltar posibles nombres de repuesto (líneas cortas sin muchos números)
            const esProbableRepuesto = !linea.match(/\d{4,}/) && linea.length < 30 && linea.length > 1;
            const estiloBoton = esProbableRepuesto ? 
                'background: #4CAF50; color: white; font-weight: bold;' : 
                'background: #e0e0e0; color: #333;';
            
            html += `
                <button onclick="seleccionarTexto('${escapeHTML(linea)}')" 
                        style="display: block; width: 100%; margin: 5px 0; padding: 12px; 
                               border: none; border-radius: 8px; cursor: pointer;
                               ${estiloBoton}
                               text-align: left; font-size: 16px;
                               border: 2px solid ${esProbableRepuesto ? '#2e7d32' : '#999'};">
                    ${index + 1}. ${escapeHTML(linea)}
                </button>
            `;
        });
        
        // Opción para escribir manualmente
        html += `
            <div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #ccc;">
                <p style="margin-bottom: 10px;">✏️ O escribe manualmente:</p>
                <input type="text" id="textoManual" 
                       style="width: 100%; padding: 12px; border: 2px solid #e62828; 
                              border-radius: 8px; font-size: 16px;"
                       placeholder="Ej: C.D.I">
                <button onclick="guardarTextoManual()"
                        style="width: 100%; margin-top: 10px; padding: 12px;
                               background: #e62828; color: white; border: none;
                               border-radius: 8px; font-size: 16px; font-weight: bold;
                               cursor: pointer;">
                    ✅ GUARDAR TEXTO MANUAL
                </button>
            </div>
        `;
        
        html += '</div>';
        detectedText.innerHTML = html;
        scannerResult.style.display = 'block';
        
        // Hacer que las funciones sean globales
        window.seleccionarTexto = function(texto) {
            if (confirm('¿Guardar este texto como repuesto?\n\n' + texto)) {
                guardarRepuesto(texto);
            }
        };
        
        window.guardarTextoManual = function() {
            const texto = document.getElementById('textoManual').value.trim();
            if (texto) {
                if (confirm('¿Guardar este texto como repuesto?\n\n' + texto)) {
                    guardarRepuesto(texto);
                }
            } else {
                alert('Escribe un texto');
            }
        };
    }

    // ========== GUARDAR REPUESTO ==========
    function guardarRepuesto(texto) {
        const modelo = MODELOS.find(m => m.id === modeloSeleccionadoScanner);
        
        const nuevoRepuesto = {
            id: crypto.randomUUID(),
            nombre: texto,
            cantidad: 1
        };
        
        if (!inventarioData[modeloSeleccionadoScanner]) {
            inventarioData[modeloSeleccionadoScanner] = [];
        }
        
        inventarioData[modeloSeleccionadoScanner].push(nuevoRepuesto);
        persistirDatos();
        renderizar();
        
        alert('✅ Repuesto guardado en ' + modelo.nombre);
        cerrarScanner();
    }

    function cerrarScanner() {
        const modal = document.getElementById('scannerModal');
        if (modal) {
            modal.classList.remove('show');
        }
        
        if (scannerStream) {
            scannerStream.getTracks().forEach(track => track.stop());
            scannerStream = null;
        }
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

        // Botones de escáner
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
            captureBtn.addEventListener('click', capturarTexto);
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
})();
