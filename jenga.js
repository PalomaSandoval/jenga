import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const temas = [
    { n: "CMMI", c: 0xe74c3c }, 
    { n: "Moprosoft", c: 0xf1c40f }, 
    { n: "PSP", c: 0x3498db }, 
    { n: "TSP", c: 0x2ecc71 }
];

let scene, camera, renderer, controls, raycaster, mouse;
let torre = [], bancoPreguntas = [], score = 0, perdido = false;
let piezaSeleccionada = null, posicionInicialPieza = new THREE.Vector3();
let jugadores = [];
let indiceTurno = 0;
let plane = new THREE.Plane();
let pNormal = new THREE.Vector3();
let pIntersect = new THREE.Vector3();
let pOffset = new THREE.Vector3();

// Configuración de la pantalla de inicio
document.addEventListener('DOMContentLoaded', () => {
    const numInput = document.getElementById('num-jugadores');
    const containerNombres = document.getElementById('inputs-nombres');
    const btnComenzar = document.getElementById('btn-comenzar');

    const actualizarInputs = () => {
        containerNombres.innerHTML = '';
        for (let i = 1; i <= numInput.value; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Nombre Jugador ${i}`;
            input.required = true;
            input.className = 'input-nombre';
            containerNombres.appendChild(input);
        }
    };

    numInput.addEventListener('change', actualizarInputs);
    actualizarInputs(); // Carga inicial

    btnComenzar.onclick = () => {
        const inputs = document.querySelectorAll('.input-nombre');
        jugadores = Array.from(inputs).map(inp => ({
            nombre: inp.value || `Jugador ${jugadores.length + 1}`,
            score: 0
        }));

        if (jugadores.length > 0) {
            document.getElementById('setup-menu').style.display = 'none';
            document.getElementById('jugador-actual').innerText = jugadores[indiceTurno].nombre;
            init(); // Arranca el motor 3D
        }
    };
});

async function cargarPreguntas() {
    // Solo intentamos cargar lo que existe para evitar errores en consola
    const archivos = ['moprosoft.json', 'tsp.json']; 
    for (const archivo of archivos) {
        try {
            const res = await fetch(archivo);
            if (res.ok) {
                const data = await res.json();
                bancoPreguntas = bancoPreguntas.concat(data);
            }
        } catch (e) { console.warn("Esperando archivo: " + archivo); }
    }
}

function init() {
    cargarPreguntas();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(12, 10, 12);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    // Dejamos el click izquierdo para arrastrar
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }; 
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const geo = new THREE.BoxGeometry(3, 0.85, 1); 

    for (let f = 0; f < 15; f++) {
        let piso = [];
        for (let i = 0; i < 3; i++) {
            const t = temas[Math.floor(Math.random()*4)];
            const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: t.c }));
            const edges = new THREE.EdgesGeometry(geo);
            // El color del contorno de las piezas BLANCO: 0xffffff NEGRO: 0x000000
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
            line.raycast = () => {}; 
            mesh.add(line); 

            const offset = (i - 1) * 1.05;
            if (f % 2 === 0) mesh.position.set(0, f * 0.9, offset);
            else { mesh.position.set(offset, f * 0.9, 0); mesh.rotation.y = Math.PI/2; }
            
            // Aqui es para que algunas piezas random sean mas pesadas
            const friccion = Math.random() * (0.9 - 0.05) + 0.05;
            mesh.userData = { activo: true, axis: (f % 2 === 0 ? 'x' : 'z'), tema: t.n, friccion: friccion };
            scene.add(mesh);
            piso.push(mesh);
        }
        torre.push(piso);
    }

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    animate();
}

// Esta función es para agarrar las piezas con el clic
function onPointerDown(e) {
    const modal = document.getElementById('modal-pregunta');
    if (perdido || e.button !== 0 || modal.style.display === 'flex') return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const hits = raycaster.intersectObjects(torre.flat());
    if (hits.length > 0) {
        piezaSeleccionada = hits[0].object;
        // Aqui se guarda la posicion de la pieza mientras la van jalando y la sueltan
        posicionInicialPieza.copy(piezaSeleccionada.position); 
        controls.enabled = false;
        
        pNormal.copy(camera.position).normalize();
        plane.setFromNormalAndCoplanarPoint(pNormal, piezaSeleccionada.position);
        
        if (raycaster.ray.intersectPlane(plane, pIntersect)) {
            pOffset.copy(pIntersect).sub(piezaSeleccionada.position);
        }
    }
}

// Esta es la función apra arrastrar las piezas mantiendo el clic con el mouse y despues arrastrando
function onPointerMove(e) {
    if (!piezaSeleccionada || perdido) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (raycaster.ray.intersectPlane(plane, pIntersect)) {
        // con esta es para ver cuanto se movio la pueza de la posicion original
        const mouseMove = pIntersect.sub(pOffset);
        
        if (piezaSeleccionada.userData.axis === 'x') {
            const deltaX = mouseMove.x - posicionInicialPieza.x;
            piezaSeleccionada.position.x = posicionInicialPieza.x + (deltaX * piezaSeleccionada.userData.friccion);
        } else {
            const deltaZ = mouseMove.z - posicionInicialPieza.z;
            piezaSeleccionada.position.z = posicionInicialPieza.z + (deltaZ * piezaSeleccionada.userData.friccion);
        }
    }

    // aqui es para que se le asigne una sensibilidad dentro de un rango al azar a cada pieza
    const dist = (piezaSeleccionada.userData.axis === 'x') ? 
                 Math.abs(piezaSeleccionada.position.x) : 
                 Math.abs(piezaSeleccionada.position.z);

    // 2.2 de sensibilidad para que no sea feo con piezas pesadas
    if (dist > 2.2) {
        const p = piezaSeleccionada;
        piezaSeleccionada = null; 
        lanzarCuestionario(p.userData.tema, p);
    }
}

//Esta es por si llegan a soltar el mouse
function onPointerUp() {
    if (piezaSeleccionada) {
        // Si soltamos la pieza a medio camino, regresa
        piezaSeleccionada.position.copy(posicionInicialPieza);
        piezaSeleccionada = null;
    }
    controls.enabled = true;
}

function lanzarCuestionario(temaNombre, pieza) {
    const filtradas = bancoPreguntas.filter(p => p.tema.toUpperCase() === temaNombre.toUpperCase());
    
    // Si no hay preguntas del tema en los JSON, usamos una genérica
    const pregunta = filtradas.length > 0 ? 
        filtradas[Math.floor(Math.random() * filtradas.length)] : 
        { q: `Pregunta de desafío sobre ${temaNombre}`, options: ["Opción A", "Opción B", "Opción C"], correct: 0, tema: temaNombre };
    
    const modal = document.getElementById('modal-pregunta');
    modal.style.display = 'flex';

    document.getElementById('tema-titulo').innerText = pregunta.tema;
    document.getElementById('texto-pregunta').innerText = pregunta.q;
    
    const container = document.getElementById('opciones-container');
    container.innerHTML = '';

    pregunta.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => {
            modal.style.display = 'none';
            // y esta si dejan de mover la pieza
            pieza.visible = false;
            pieza.userData.activo = false;
            pieza.position.y = -500;
            score++;
            document.getElementById('score').innerText = score;
            
            if (i === pregunta.correct) {
                cambiarTurno();
            } else {
                alert(`¡Incorrecto! ${jugadores[indiceTurno].nombre}, debes intentar con otra pieza.`);
                controls.enabled = true;
            }
            validarEstabilidad();
        };
        container.appendChild(btn);
    });
}

function cambiarTurno() {
    indiceTurno = (indiceTurno + 1) % jugadores.length;
    const proximoJugador = jugadores[indiceTurno].nombre;
    
    const modalTurno = document.getElementById('modal-turno');
    const anuncio = document.getElementById('anuncio-jugador');
    
    anuncio.innerText = `¡Correcto! Es turno de: ${proximoJugador}`;
    modalTurno.style.display = 'flex';
    
    setTimeout(() => {
        modalTurno.style.display = 'none';
        document.getElementById('jugador-actual').innerText = proximoJugador;
        controls.enabled = true;
    }, 2000); // 2 segundos de anuncio
}

function validarEstabilidad() {
    for (let f = 0; f < torre.length - 1; f++) {
        const activos = torre[f].filter(b => b.userData.activo).length;
        if (activos === 0) {
            derrumbe(f);
            break;
        }
    }
}

function derrumbe(pisoFalla) {
    perdido = true;
    document.getElementById('game-over').style.display = 'flex';

    torre.flat().forEach(b => {
        if (!b.userData.activo) return;

        // Calcula una direccion de explosion desde el centro de la torre
        const dirX = (Math.random() - 0.5) * 15;
        const dirZ = (Math.random() - 0.5) * 15;
        
        // Animacion de caída
        const caidaRapida = () => {
            if (b.position.y > -20) {
                b.position.y -= 0.4; // Velocidad de caida
                b.position.x += dirX * 0.01; // Se expanden hacia afuera
                b.position.z += dirZ * 0.01;
                
                //Para que funcione en los 3 ejes
                b.rotation.x += 0.1;
                b.rotation.y += 0.05;
                b.rotation.z += 0.1;
                
                requestAnimationFrame(caidaRapida);
            }
        };
        caidaRapida();
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update(); 
    if (renderer && scene && camera) renderer.render(scene, camera);
}