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
    let cameraStream = null;
    let modeloSeleccionado = null;
    let tesseractWorker = null;
    let textoDetectado = [];
    let textoSeleccionado = '';
    let modeloGuardar = '';
    let ubicacionGuardar = '';

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

    // ========== FUNCIONES DE CÁMARA ==========
    function abrirCamara(modeloId = null) {
        const modal = document.getElementById('cameraModal');
        if (!modal) return;
        
        modeloSeleccionado = modeloId;
        modal.classList.add('show');
        
        // Resetear UI
        document.getElementById('photoPreview').style.display = 'none';
        document.getElementById('scanResult').style.display = 'none';
        document.getElementById('takePhotoBtn').style.display = 'block';
        
        iniciarCamara();
        initTesseract();
        
        // Llenar select de modelos
        const select = document.getElementById('scanModeloSelect');
        select.innerHTML = '<option value="">Seleccionar modelo</option>';
        MODELOS.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.nombre;
            if (m.id === modeloId) option.selected = true;
            select.appendChild(option);
        });
    }

    async function iniciarCamara() {
        try {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
            
            cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                } 
            });
            
            const video = document.getElementById('cameraVideo');
            if (video) {
                video.srcObject = cameraStream;
                video.setAttribute('playsinline', true);
                video.setAttribute('autoplay', true);
                video.setAttribute('muted', true);
                await video.play();
            }
        } catch (error) {
            alert('Error con la cámara. Asegúrate de dar permisos.');
        }
    }

    function tomarFoto() {
        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('cameraCanvas');
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Mostrar preview
        const capturedImage = document.getElementById('capturedImage');
        capturedImage.src = canvas.toDataURL('image/png');
        
        document.getElementById('photoPreview').style.display = 'block';
        document.getElementById('takePhotoBtn').style.display = 'none';
        
        // Detener cámara temporalmente
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
    }

    async function escanearFoto() {
        const canvas = document.getElementById('cameraCanvas');
        const scanBtn = document.getElementById('scanPhotoBtn');
        
        scanBtn.textContent = '⏳ ESCANEANDO...';
        scanBtn.disabled = true;
        
        try {
            const { data: { text } } = await tesseractWorker.recognize(canvas);
            
            if (text && text.trim()) {
                const lineas = text.split('\n')
                    .map(linea => linea.trim())
                    .filter(linea => linea.length > 1);
                
                textoDetectado = lineas;
                mostrarLineasDetectadas(lineas);
            } else {
                alert('No se detectó texto. Intenta con otra foto.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al escanear. Intenta de nuevo.');
        } finally {
            scanBtn.textContent = '🔍 ESCANEAR TEXTO';
            scanBtn.disabled = false;
        }
    }

    function mostrarLineasDetectadas(lineas) {
        const container = document.getElementById('detectedLines');
        let html = '<p style="margin-bottom: 10px;">Selecciona el texto del repuesto:</p>';
        
        lineas.forEach((linea, index) => {
            const esProbable = !linea.match(/\d{4,}/) && linea.length < 30 && linea.length > 1;
            html += `
                <button class="line-button" data-text="${escapeHTML(linea)}" style="${esProbable ? 'border-left: 5px solid #4CAF50;' : ''}">
                    ${index + 1}. ${escapeHTML(linea)}
                </button>
            `;
        });
        
        container.innerHTML = html;
        
        // Agregar eventos a los botones
        container.querySelectorAll('.line-button').forEach(btn => {
            btn.addEventListener('click', function() {
                container.querySelectorAll('.line-button').forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
                textoSeleccionado = this.dataset.text;
                
                const saveBtn = document.getElementById('saveScannedText');
                const modelo = document.getElementById('scanModeloSelect').value;
                saveBtn.disabled = !(modelo && textoSeleccionado);
            });
        });
        
        document.getElementById('scanResult').style.display = 'block';
    }

    function guardarRepuesto() {
        const modelo = document.getElementById('scanModeloSelect').value;
        const ubicacion = document.getElementById('scanLocation').value.toUpperCase().trim();
        
        if (!modelo || !textoSeleccionado) {
            alert('Selecciona modelo y texto');
            return;
        }
        
        const nombreCompleto = ubicacion ? 
            `[${ubicacion}] ${textoSeleccionado}` : 
            textoSeleccionado;
        
        const nuevoRepuesto = {
            id: crypto.randomUUID(),
            nombre: nombreCompleto,
            ubicacion: ubicacion || '',
            cantidad: 1
        };
        
        if (!inventarioData[modelo]) {
            inventarioData[modelo] = [];
        }
        
        inventarioData[modelo].push(nuevoRepuesto);
        persistirDatos();
        renderizar();
        
        alert('✅ Repuesto guardado correctamente');
        cerrarCamara();
    }

    function cerrarCamara() {
        const modal = document.getElementById('cameraModal');
        if (modal) {
            modal.classList.remove('show');
        }
        
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        
        // Resetear UI
        document.getElementById('photoPreview').style.display = 'none';
        document.getElementById('scanResult').style.display = 'none';
        document.getElementById('takePhotoBtn').style.display = 'block';
        document.getElementById('scanLocation').value = '';
        textoSeleccionado = '';
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
                const ubicacion = item.ubicacion ? `[${item.ubicacion}]` : '';
                filasTabla += '<tr>' +
                    '<td>' + ubicacion + ' ' + escapeHTML(item.nombre) + '</td>' +
                    '<td>' + item.cantidad + '</td>' +
                    '<td>' +
                        '<button class="btn-editar" data-modelo="' + modelo.id + '" ' +
                                'data-id="' + item.id + '" ' +
                                'data-nombre="' + escapeHTML(item.nombre) + '" ' +
                                'data-cantidad="' + item.cantidad + '" ' +
                                'data-ubicacion="' + escapeHTML(item.ubicacion || '') + '">' +
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
            const valorUbicacion = modoEdicion ? (edit.ubicacion || '') : '';
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
                        '<button class="btn-camera-card" data-camera="' + modelo.id + '">' +
                            '📸 Foto' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card-body">' +
                    '<table class="tabla-repuestos">' +
                        '<thead>' +
                            '<tr>' +
                                '<th>Repuesto (Ubicación)</th>' +
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
                        '<input type="text" ' +
                               'id="input-ubicacion-' + modelo.id + '" ' +
                               'placeholder="Ubicación (R1, V2)" ' +
                               'value="' + escapeHTML(valorUbicacion) + '" ' +
                               'style="flex: 0 1 100px;" ' +
                               'maxlength="10">' +
                        '<input type="number" ' +
                               'id="input-cantidad-' + modelo.id + '" ' +
                               'placeholder="Cant" ' +
                               'min="0" ' +
                               'value="' + escapeHTML(String(valorCantidad)) + '" ' +
                               'style="flex: 0 1 80px;">' +
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
                    cantidad: btn.dataset.cantidad,
                    ubicacion: btn.dataset.ubicacion
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
                const inputUbicacion = document.getElementById('input-ubicacion-' + modelo);
                
                if (!inputNombre || !inputCantidad) return;
                
                const nombreVal = inputNombre.value.trim();
                const cantidadVal = parseInt(inputCantidad.value, 10);
                const ubicacionVal = inputUbicacion ? inputUbicacion.value.toUpperCase().trim() : '';

                if (!nombreVal) {
                    alert('Escribe el nombre del repuesto');
                    return;
                }
                
                if (isNaN(cantidadVal) || cantidadVal < 0) {
                    alert('Cantidad inválida');
                    return;
                }

                const nombreCompleto = ubicacionVal ? 
                    `[${ubicacionVal}] ${nombreVal}` : 
                    nombreVal;

                if (editando) {
                    const idEdit = btn.dataset.idEdit;
                    const items = inventarioData[modelo];
                    const index = items.findIndex(it => it.id === idEdit);
                    
                    if (index !== -1) {
                        items[index].nombre = nombreCompleto;
                        items[index].ubicacion = ubicacionVal;
                        items[index].cantidad = cantidadVal;
                    }
                    editState[modelo] = null;
                } else {
                    if (!inventarioData[modelo]) inventarioData[modelo] = [];
                    inventarioData[modelo].push({
                        id: crypto.randomUUID(),
                        nombre: nombreCompleto,
                        ubicacion: ubicacionVal,
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

        // Botones de cámara
        document.querySelectorAll('.btn-camera-card').forEach(btn => {
            btn.addEventListener('click', () => {
                abrirCamara(btn.dataset.camera);
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
                            'table { width: 100%; border-collapse: collapse; margin-top: 20px; }' +
                            'th { background: #e62828; color: white; padding: 12px; text-align: left; }' +
                            'td { padding: 10px; border-bottom: 1px solid #ffd6d6; }' +
                            '.ubicacion { color: #e62828; font-weight: bold; }' +
                            '@media print { th { background: #e62828 !important; } }' +
                        '</style>' +
                    '</head>' +
                    '<body>' +
                        '<h1>🛵 ' + modelo.nombre + '</h1>' +
                        '<table>' +
                            '<tr><th>Repuesto</th><th>Cantidad</th></tr>' +
                            filas +
                        '</table>' +
                        '<p style="margin-top: 30px; color: #b71c1c;">' +
                            'MotoInvent · ' + new Date().toLocaleDateString() +
                        '</p>' +
                        '<script>window.onload = () => setTimeout(() => window.print(), 300);</script>' +
                    '</body>' +
                    '</html>';

                ventana.document.write(contenido);
                ventana.document.close();
            });
        });

        // Eventos de cámara
        document.getElementById('takePhotoBtn')?.addEventListener('click', tomarFoto);
        document.getElementById('scanPhotoBtn')?.addEventListener('click', escanearFoto);
        document.getElementById('retakePhotoBtn')?.addEventListener('click', () => {
            document.getElementById('photoPreview').style.display = 'none';
            document.getElementById('scanResult').style.display = 'none';
            document.getElementById('takePhotoBtn').style.display = 'block';
            iniciarCamara();
        });
        
        document.getElementById('scanModeloSelect')?.addEventListener('change', (e) => {
            const saveBtn = document.getElementById('saveScannedText');
            saveBtn.disabled = !(e.target.value && textoSeleccionado);
        });
        
        document.getElementById('scanLocation')?.addEventListener('input', () => {
            // No hace falta validar, solo guardar
        });
        
        document.getElementById('saveScannedText')?.addEventListener('click', guardarRepuesto);
        
        document.getElementById('closeCamera')?.addEventListener('click', cerrarCamara);
        document.getElementById('cancelCamera')?.addEventListener('click', cerrarCamara);
    }

    // ========== INICIALIZACIÓN ==========
    cargarDatos();
    renderizar();
})();
