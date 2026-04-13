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
let jugadorActual = 1;

// Variables para el arrastre matemático
let plane = new THREE.Plane();
let pNormal = new THREE.Vector3();
let pIntersect = new THREE.Vector3();
let pOffset = new THREE.Vector3();

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
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

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
            if (f % 2 === 0) mesh.position.set(0, f * 0.9, offset);
            else { mesh.position.set(offset, f * 0.9, 0); mesh.rotation.y = Math.PI/2; }
            
            mesh.userData = { activo: true, axis: (f % 2 === 0 ? 'x' : 'z'), tema: t.n };
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

function onPointerDown(e) {
    const modal = document.getElementById('modal-pregunta');
    if (perdido || modal.style.display === 'flex') return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    const hits = raycaster.intersectObjects(torre.flat());
    if (hits.length > 0) {
        piezaSeleccionada = hits[0].object;
        posicionInicialPieza.copy(piezaSeleccionada.position); // Guardar por si hay que resetear
        controls.enabled = false;
        
        pNormal.copy(camera.position).normalize();
        plane.setFromNormalAndCoplanarPoint(pNormal, piezaSeleccionada.position);
        
        if (raycaster.ray.intersectPlane(plane, pIntersect)) {
            pOffset.copy(pIntersect).sub(piezaSeleccionada.position);
        }
    }
}

function onPointerMove(e) {
    if (!piezaSeleccionada) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (raycaster.ray.intersectPlane(plane, pIntersect)) {
        const newPos = pIntersect.sub(pOffset);
        if (piezaSeleccionada.userData.axis === 'x') {
            piezaSeleccionada.position.x = newPos.x;
        } else {
            piezaSeleccionada.position.z = newPos.z;
        }
    }

    const dist = (piezaSeleccionada.userData.axis === 'x') ? 
                 Math.abs(piezaSeleccionada.position.x) : 
                 Math.abs(piezaSeleccionada.position.z);

    if (dist > 2.0) {
        const p = piezaSeleccionada;
        const tienePreguntas = bancoPreguntas.some(bp => bp.tema.toUpperCase() === p.userData.tema.toUpperCase());

        if (tienePreguntas) {
            piezaSeleccionada = null; 
            lanzarCuestionario(p.userData.tema, p);
        } else {
            // Si el tema no tiene JSON, la pieza regresa a su lugar y no se puede sacar
            alert("Aún no hay preguntas cargadas para el tema: " + p.userData.tema);
            p.position.copy(posicionInicialPieza);
            piezaSeleccionada = null;
            controls.enabled = true;
        }
    }
}

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
    const p = filtradas[Math.floor(Math.random() * filtradas.length)];
    
    const modal = document.getElementById('modal-pregunta');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    document.getElementById('tema-titulo').innerText = p.tema;
    document.getElementById('texto-pregunta').innerText = p.q;
    
    const container = document.getElementById('opciones-container');
    container.innerHTML = '';

    p.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => {
            modal.style.display = 'none';
            modal.classList.add('hidden');
            
            // La pieza se elimina siempre que sale
            pieza.visible = false;
            pieza.userData.activo = false;
            pieza.position.y = -500;
            score++;
            document.getElementById('score').innerText = score;

            if (i === p.correct) {
                alert("¡Correcto! Turno del Jugador " + (jugadorActual === 1 ? "2" : "1"));
                jugadorActual = (jugadorActual % 2) + 1;
                document.getElementById('jugador-actual').innerText = jugadorActual;
            } else {
                alert("¡Incorrecto! Jugador " + jugadorActual + ", debes sacar otra pieza.");
                // NO se cambia el jugadorActual
            }
            validarEstabilidad();
            controls.enabled = true;
        };
        container.appendChild(btn);
    });
}

function validarEstabilidad() {
    for (let f = 0; f < torre.length - 1; f++) {
        if (torre[f].filter(b => b.userData.activo).length === 0) {
            perdido = true;
            const go = document.getElementById('game-over');
            go.style.display = 'flex';
            go.classList.remove('hidden');
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();