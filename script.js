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

    // ========== INICIALIZAR TESSERACT ==========
    async function initTesseract() {
        if (!tesseractWorker && typeof Tesseract !== 'undefined') {
            try {
                tesseractWorker = await Tesseract.createWorker('spa', 1, {
                    logger: progress => {
                        if (progress.status === 'recognizing text') {
                            console.log('Progreso: ' + Math.round(progress.progress * 100) + '%');
                        }
                    }
                });
                console.log('Tesseract listo');
            } catch (error) {
                console.error('Error inicializando Tesseract:', error);
            }
        }
    }

    // ========== FUNCIONES DEL ESCÁNER OPTIMIZADO ==========
    function abrirScanner(modeloId = null) {
        const modal = document.getElementById('scannerModal');
        const select = document.getElementById('scannerModeloSelect');
        const captureBtn = document.getElementById('captureText');
        
        if (!modal || !select || !captureBtn) return;
        
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
        
        // Mostrar instrucciones
        mostrarInstrucciones();
    }

    function mostrarInstrucciones() {
        const instrucciones = document.createElement('div');
        instrucciones.className = 'scanner-instrucciones';
        instrucciones.innerHTML = `
            <div style="background: #e62828; color: white; padding: 10px; border-radius: 10px; margin-bottom: 10px; text-align: center;">
                <strong>📸 ENFOQUE LA ETIQUETA EN EL RECUADRO ROJO</strong>
            </div>
            <div style="background: #fcf3f3; padding: 10px; border-radius: 10px; margin-bottom: 10px; font-size: 14px;">
                <p>✅ El escáner capturará automáticamente el texto CENTRAL</p>
                <p>✅ Buscará: NOMBRE DEL REPUESTO (ej: "C.D.I")</p>
                <p>✅ Buscará: CÓDIGO (ej: "311000-1360-02TY0000")</p>
                <p style="color: #b71c1c;">⚠️ Asegure buena iluminación y enfoque</p>
            </div>
        `;
        
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            // Remover instrucciones anteriores si existen
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
                await video.play();
            }
        } catch (error) {
            console.error('Error al acceder a la cámara:', error);
            alert('No se pudo acceder a la cámara. Asegúrate de dar permisos.');
        }
    }

    // Función para extraer solo el texto central (recuadro rojo)
    async function capturarTextoCentral() {
        if (!modeloSeleccionadoScanner) {
            alert('Selecciona un modelo destino');
            return;
        }
        
        if (!tesseractWorker) {
            alert('El sistema de reconocimiento aún no está listo. Intenta en unos segundos.');
            return;
        }
        
        const video = document.getElementById('scannerVideo');
        const canvas = document.getElementById('scannerCanvas');
        const captureBtn = document.getElementById('captureText');
        
        if (!video || !canvas || !captureBtn) return;
        
        const context = canvas.getContext('2d');
        
        // Configurar canvas del tamaño del video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Dibujar frame completo
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Calcular área central (40% del centro de la imagen)
        const centerWidth = canvas.width * 0.4;
        const centerHeight = canvas.height * 0.3;
        const startX = (canvas.width - centerWidth) / 2;
        const startY = (canvas.height - centerHeight) / 2;
        
        // Crear un nuevo canvas solo con el área central
        const centerCanvas = document.createElement('canvas');
        centerCanvas.width = centerWidth;
        centerCanvas.height = centerHeight;
        const centerCtx = centerCanvas.getContext('2d');
        
        // Copiar solo el área central
        centerCtx.drawImage(canvas, startX, startY, centerWidth, centerHeight, 0, 0, centerWidth, centerHeight);
        
        // Mostrar estado
        const originalText = captureBtn.textContent;
        captureBtn.textContent = '⏳ Procesando etiqueta...';
        captureBtn.disabled = true;
        
        try {
            // Reconocer texto del área central
            const { data: { text } } = await tesseractWorker.recognize(centerCanvas);
            
            if (text && text.trim()) {
                // Procesar el texto para extraer nombre y código
                const resultado = procesarTextoEtiqueta(text);
                
                // Mostrar resultado
                const detectedText = document.getElementById('detectedText');
                const scannerResult = document.getElementById('scannerResult');
                
                if (detectedText) {
                    detectedText.innerHTML = `
                        <strong>📦 Repuesto:</strong> ${resultado.nombre}<br>
                        <strong>🔢 Código:</strong> ${resultado.codigo}<br>
                        <strong>📋 Texto completo:</strong><br>${resultado.textoOriginal}
                    `;
                }
                if (scannerResult) scannerResult.style.display = 'block';
                
                // Preguntar si quiere guardar
                if (confirm('¿Guardar este repuesto en ' + 
                    MODELOS.find(m => m.id === modeloSeleccionadoScanner).nombre + '?\n\n' +
                    'Repuesto: ' + resultado.nombre + '\n' +
                    'Código: ' + resultado.codigo)) {
                    
                    const nuevoRepuesto = {
                        id: crypto.randomUUID(),
                        nombre: resultado.nombre + ' - ' + resultado.codigo,
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
                alert('No se detectó texto. Asegura buena iluminación y enfoque.');
            }
        } catch (error) {
            console.error('Error al reconocer texto:', error);
            alert('Error al procesar la imagen. Intenta de nuevo.');
        } finally {
            captureBtn.textContent = originalText;
            captureBtn.disabled = false;
        }
    }

    // Función para procesar texto de etiqueta y extraer nombre y código
    function procesarTextoEtiqueta(textoCompleto) {
        const lineas = textoCompleto.split('\n').filter(linea => linea.trim() !== '');
        
        let nombre = 'REPUESTO';
        let codigo = 'SIN CÓDIGO';
        
        // Buscar patrones típicos de etiquetas
        for (let i = 0; i < lineas.length; i++) {
            const linea = lineas[i].trim().toUpperCase();
            
            // Buscar nombre del repuesto (línea que no parece código)
            if (!linea.includes('-') && !linea.includes('GENUINE') && !linea.includes('PARTS') && 
                !linea.includes('LECHUZA') && !linea.includes('AGUILA') && !linea.includes('CONDOR') &&
                linea.length > 2 && linea.length < 30) {
                nombre = linea;
            }
            
            // Buscar código (línea con números y guiones)
            if (linea.match(/\d+[-]\d+/) || linea.match(/\d{6,}/)) {
                codigo = lineas[i].trim();
            }
            
            // Si encontramos las dos cosas, podemos parar
            if (nombre !== 'REPUESTO' && codigo !== 'SIN CÓDIGO') break;
        }
        
        // Si no encontramos nombre específico, usar la línea más larga que no sea código
        if (nombre === 'REPUESTO') {
            for (let linea of lineas) {
                const l = linea.trim();
                if (l.length > 5 && l.length < 30 && !l.includes('-') && !l.includes('GENUINE')) {
                    nombre = l;
                    break;
                }
            }
        }
        
        // Si aún así no hay nombre, usar primera línea significativa
        if (nombre === 'REPUESTO') {
            for (let linea of lineas) {
                const l = linea.trim();
                if (l.length > 2 && !l.includes('GENUINE') && !l.includes('PARTS')) {
                    nombre = l;
                    break;
                }
            }
        }
        
        return {
            nombre: nombre,
            codigo: codigo,
            textoOriginal: textoCompleto
        };
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
        
        const scannerResult = document.getElementById('scannerResult');
        if (scannerResult) {
            scannerResult.style.display = 'none';
        }
        
        // Remover instrucciones
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
                modeloSeleccionadoScanner = e.target.value;
                const captureBtn = document.getElementById('captureText');
                if (captureBtn) {
                    captureBtn.disabled = !e.target.value;
                }
            });
        }

        const captureBtn = document.getElementById('captureText');
        if (captureBtn) {
            captureBtn.addEventListener('click', capturarTextoCentral);
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
