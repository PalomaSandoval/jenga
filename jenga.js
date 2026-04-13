const temas = [
    { n: "CMMI", c: 0xe74c3c }, 
    { n: "Moprosoft", c: 0xf1c40f }, 
    { n: "PSP", c: 0x3498db }, 
    { n: "TSP", c: 0x2ecc71 }
];

let scene, camera, renderer, controls, raycaster, mouse;
let torre = [], score = 0, perdido = false;
let piezaSeleccionada = null, posicionInicialPieza = new THREE.Vector3();
let jugadores = [];
let indiceTurno = 0;
let plane = new THREE.Plane();
let pNormal = new THREE.Vector3();
let pIntersect = new THREE.Vector3();
let pOffset = new THREE.Vector3();
let bloqueado = false; 

document.addEventListener('DOMContentLoaded', () => {
    const numInput = document.getElementById('num-jugadores');
    const containerNombres = document.getElementById('inputs-nombres');
    const btnComenzar = document.getElementById('btn-comenzar');

    const actualizarInputs = () => {
        if(!containerNombres) return;
        containerNombres.innerHTML = '';
        let cantidad = numInput ? parseInt(numInput.value) : 2;
        for (let i = 1; i <= cantidad; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Nombre Jugador ${i}`;
            input.className = 'input-nombre';
            containerNombres.appendChild(input);
        }
    };

    if(numInput) numInput.addEventListener('change', actualizarInputs);
    actualizarInputs();

    if(btnComenzar) {
        btnComenzar.onclick = () => {
            const inputs = document.querySelectorAll('.input-nombre');
            jugadores = Array.from(inputs).map((inp, i) => ({
                nombre: inp.value || `Jugador ${i + 1}`,
                score: 0
            }));
            document.getElementById('setup-menu').style.display = 'none';
            document.getElementById('jugador-actual').innerText = jugadores[indiceTurno].nombre;
            init(); 
        };
    }
});

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(12, 10, 12);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 5, 0); 
    controls.update();
    
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const geo = new THREE.BoxGeometry(3, 0.85, 1); 

    for (let f = 0; f < 15; f++) {
        let piso = [];
        for (let i = 0; i < 3; i++) {
            const t = temas[Math.floor(Math.random()*4)];
            const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: t.c }));
            const edges = new THREE.EdgesGeometry(geo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
            line.raycast = () => {}; 
            mesh.add(line); 

            const offset = (i - 1) * 1.05;
            if (f % 2 === 0) {
                mesh.position.set(0, f * 0.9, offset);
                mesh.userData.axis = 'x';
            } else { 
                mesh.position.set(offset, f * 0.9, 0); 
                mesh.rotation.y = Math.PI/2; 
                mesh.userData.axis = 'z';
            }
            
            mesh.userData.activo = true;
            mesh.userData.tema = t.n;
            scene.add(mesh);
            piso.push(mesh);
        }
        torre.push(piso);
    }

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    // Importante: escuchamos los eventos en el canvas para no interferir con el HTML
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onWindowResize);
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerDown(e) {
    if (perdido || bloqueado || e.button !== 0) return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const hits = raycaster.intersectObjects(torre.flat());
    if (hits.length > 0 && hits[0].object.userData.activo) {
        piezaSeleccionada = hits[0].object;
        posicionInicialPieza.copy(piezaSeleccionada.position); 
        controls.enabled = false;
        
        pNormal.copy(camera.position).normalize();
        plane.setFromNormalAndCoplanarPoint(pNormal, piezaSeleccionada.position);
        
        if (raycaster.ray.intersectPlane(plane, pIntersect)) {
            pOffset.copy(pIntersect).sub(piezaSeleccionada.position);
        }
    }
}

function onPointerMove(e) {
    if (!piezaSeleccionada || bloqueado) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (raycaster.ray.intersectPlane(plane, pIntersect)) {
        const move = pIntersect.clone().sub(pOffset);
        if (piezaSeleccionada.userData.axis === 'x') {
            piezaSeleccionada.position.x = move.x;
            piezaSeleccionada.position.z = posicionInicialPieza.z;
        } else {
            piezaSeleccionada.position.z = move.z;
            piezaSeleccionada.position.x = posicionInicialPieza.x;
        }
        piezaSeleccionada.position.y = posicionInicialPieza.y;
    }
}

function onPointerUp() {
    // Si ya estamos en una pregunta o no hay pieza, no hacemos nada
    if (bloqueado || !piezaSeleccionada) {
        if (!bloqueado) controls.enabled = true;
        return;
    }

    const dist = piezaSeleccionada.position.distanceTo(posicionInicialPieza);
    
    if (dist > 1.8) {
        bloqueado = true;
        const p = piezaSeleccionada;
        piezaSeleccionada = null; // Limpiamos la referencia inmediatamente para evitar duplicados
        lanzarCuestionario(p.userData.tema, p);
    } else {
        piezaSeleccionada.position.copy(posicionInicialPieza);
        piezaSeleccionada = null;
        controls.enabled = true;
    }
}

function lanzarCuestionario(tema, pieza) {
    const filtradas = bancoPreguntas.filter(p => p.tema.toUpperCase() === tema.toUpperCase());
    const pregunta = filtradas[Math.floor(Math.random() * filtradas.length)];
    
    const modal = document.getElementById('modal-pregunta');
    const modalContent = modal.querySelector('.modal-content');
    
    modal.style.display = 'flex';
    modalContent.style.backgroundColor = 'white'; 
    modalContent.style.color = '#333';
    
    document.getElementById('tema-titulo').innerText = pregunta.tema;
    document.getElementById('texto-pregunta').innerText = pregunta.q;
    
    const container = document.getElementById('opciones-container');
    container.innerHTML = '';

    pregunta.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = (e) => {
            e.stopPropagation(); // Evita que el clic llegue al juego
            const botones = container.querySelectorAll('button');
            botones.forEach(b => b.style.pointerEvents = 'none');

            if (i === pregunta.correct) {
                // BIEN: La pieza regresa (Comodín) y pasa el turno
                modalContent.style.backgroundColor = '#2ecc71';
                modalContent.style.color = 'white';
                
                setTimeout(() => {
                    modal.style.display = 'none';
                    pieza.position.copy(posicionInicialPieza);
                    bloqueado = false;
                    controls.enabled = true;
                    cambiarTurno();
                }, 1500);

            } else {
                // MAL: La pieza se quita y el jugador sigue intentando
                modalContent.style.backgroundColor = '#e74c3c';
                modalContent.style.color = 'white';
                
                setTimeout(() => {
                    modal.style.display = 'none';
                    pieza.visible = false;
                    pieza.userData.activo = false;
                    pieza.position.y = -500;
                    score++;
                    document.getElementById('score').innerText = score;
                    
                    bloqueado = false;
                    controls.enabled = true;
                    validarEstabilidad();
                    
                    if(!perdido) {
                        alert("Incorrecto. La pieza se ha perdido. Debes intentar con otra hasta acertar.");
                    }
                }, 1500);
            }
        };
        container.appendChild(btn);
    });
}

function cambiarTurno() {
    indiceTurno = (indiceTurno + 1) % jugadores.length;
    const proximo = jugadores[indiceTurno].nombre;
    document.getElementById('anuncio-jugador').innerText = `Turno de: ${proximo}`;
    document.getElementById('modal-turno').style.display = 'flex';
    
    setTimeout(() => {
        document.getElementById('modal-turno').style.display = 'none';
        document.getElementById('jugador-actual').innerText = proximo;
    }, 1200);
}

function validarEstabilidad() {
    for (let f = 0; f < torre.length - 1; f++) {
        const activas = torre[f].filter(b => b.userData.activo).length;
        if (activas === 0) {
            perdido = true;
            document.getElementById('game-over').style.display = 'flex';
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update(); 
    renderer.render(scene, camera);
}