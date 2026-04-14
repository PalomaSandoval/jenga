const datosRuleta = [
    { tema: "CMMI", color: "#e74c3c" },
    { tema: "MOPROSOFT", color: "#f1c40f" },
    { tema: "PSP", color: "#3498db" },
    { tema: "TSP", color: "#2ecc71" }
];

const coloresTorre = [0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71];
let scene, camera, renderer, controls, raycaster, mouse;
let torre = [], perdido = false;
let piezasDescartadas = 0;
let piezaSeleccionada = null, necesitaSacarFicha = false;
let posicionAlClick = new THREE.Vector3(); 
let jugadores = [], indiceTurno = 0;
let plane = new THREE.Plane(), pNormal = new THREE.Vector3(), pIntersect = new THREE.Vector3(), pOffset = new THREE.Vector3();
let bloqueado = true;

document.addEventListener('DOMContentLoaded', () => {
    const numInput = document.getElementById('num-jugadores');
    const containerNombres = document.getElementById('inputs-nombres');
    const btnComenzar = document.getElementById('btn-comenzar');
    const btnGirar = document.getElementById('btn-girar');

    const actualizarInputs = () => {
        containerNombres.innerHTML = '';
        let cantidad = parseInt(numInput.value);
        for (let i = 1; i <= cantidad; i++) {
            const input = document.createElement('input');
            input.type = 'text'; input.placeholder = `Nombre Jugador ${i}`;
            input.className = 'input-nombre'; containerNombres.appendChild(input);
        }
    };

    numInput.addEventListener('change', actualizarInputs);
    actualizarInputs();

    btnComenzar.onclick = () => {
        const inputs = document.querySelectorAll('.input-nombre');
        jugadores = Array.from(inputs).map(inp => ({ nombre: inp.value || "Jugador" }));
        
        // Activar Interfaz
        document.getElementById('setup-menu').style.display = 'none';
        document.getElementById('ui').style.display = 'block';
        document.getElementById('panel-ruleta').style.display = 'flex';
        
        init();
        iniciarTurnoCompleto();
    };

    btnGirar.onclick = () => {
        btnGirar.disabled = true;
        correrRuleta();
    };
});

function init() {
    scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0x050505);
    
    const width = window.innerWidth - 320; // Restamos el espacio del panel derecho
    camera = new THREE.PerspectiveCamera(60, width / window.innerHeight, 0.1, 1000);
    camera.position.set(12, 10, 12);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 5, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    const geo = new THREE.BoxGeometry(3, 0.85, 1);
    for (let f = 0; f < 15; f++) {
        let piso = [];
        for (let i = 0; i < 3; i++) {
            const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: coloresTorre[Math.floor(Math.random()*4)] }));
            const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x000000 }));
            line.raycast = () => {}; mesh.add(line);
            
            const offset = (i - 1) * 1.05;
            if (f % 2 === 0) { mesh.position.set(0, f * 0.9, offset); mesh.userData.axis = 'x'; }
            else { mesh.position.set(offset, f * 0.9, 0); mesh.rotation.y = Math.PI/2; mesh.userData.axis = 'z'; }
            
            // MECÁNICA: Sensibilidad/Fricción aleatoria
            mesh.userData.friccion = Math.random() * (0.7 - 0.1) + 0.1;
            mesh.userData.activo = true; 
            mesh.userData.centroOriginal = mesh.position.clone();
            scene.add(mesh); piso.push(mesh);
        }
        torre.push(piso);
    }

    raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    animate();
    dibujarRuleta(0);
}

function dibujarRuleta(anguloActual) {
    const canvas = document.getElementById('ruleta-canvas');
    const ctx = canvas.getContext('2d');
    const radio = canvas.width / 2;
    const arco = (2 * Math.PI) / datosRuleta.length;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    datosRuleta.forEach((item, i) => {
        const anguloInicio = anguloActual + i * arco;
        ctx.beginPath(); ctx.fillStyle = item.color; ctx.moveTo(radio, radio);
        ctx.arc(radio, radio, radio, anguloInicio, anguloInicio + arco); ctx.fill(); ctx.stroke();
        
        ctx.save(); ctx.translate(radio, radio); ctx.rotate(anguloInicio + arco / 2);
        ctx.textAlign = "right"; ctx.fillStyle = "white"; ctx.font = "bold 12px Arial";
        ctx.fillText(item.tema, radio - 10, 5); ctx.restore();
    });
}

function correrRuleta() {
    const texto = document.getElementById('ruleta-resultado-texto');
    texto.innerText = "¡Girando...!";
    let angulo = Math.random() * Math.PI;
    let vel = 0.4 + Math.random() * 0.4; 
    let fric = 0.96; // Ajuste para que dure menos (antes 0.985)

    function anim() {
        dibujarRuleta(angulo); angulo += vel; vel *= fric;
        if (vel > 0.002) requestAnimationFrame(anim);
        else {
            const arco = (2 * Math.PI) / datosRuleta.length;
            const ind = Math.floor((((1.5 * Math.PI - angulo) % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI) / arco);
            const tema = datosRuleta[ind].tema;
            texto.innerText = `¡TEMA: ${tema}!`;
            setTimeout(() => { lanzarPregunta(tema); }, 1000);
        }
    }
    anim();
}

function iniciarTurnoCompleto() {
    bloqueado = true;
    const nombre = jugadores[indiceTurno].nombre;
    document.getElementById('jugador-actual').innerText = nombre;
    document.getElementById('anuncio-jugador').innerText = `Turno de: ${nombre}`;
    const modalTurno = document.getElementById('modal-turno');
    modalTurno.style.display = 'flex';
    
    setTimeout(() => { 
        modalTurno.style.display = 'none'; 
        document.getElementById('btn-girar').disabled = false;
        document.getElementById('ruleta-resultado-texto').innerText = "¡Haz clic en Girar!";
    }, 2000);
}

function lanzarPregunta(tema) {
    const filtradas = bancoPreguntas.filter(p => p.tema.toUpperCase() === tema.toUpperCase());
    const preg = filtradas[Math.floor(Math.random() * filtradas.length)];
    const modal = document.getElementById('modal-pregunta');
    modal.style.display = 'flex';
    document.getElementById('tema-titulo').innerText = tema;
    document.getElementById('texto-pregunta').innerText = preg.q;
    const cont = document.getElementById('opciones-container'); cont.innerHTML = '';
    
    preg.options.forEach((opt, i) => {
        const btn = document.createElement('button'); btn.className = 'option-btn'; btn.innerText = opt;
        btn.onclick = () => {
            modal.style.display = 'none';
            if (i === preg.correct) {
                mostrarNotificacion("¡Correcto!", "No sacas ficha. Siguiente turno.", true, () => {
                    torre.flat().forEach(p => { if(p.userData.activo) p.position.copy(p.userData.centroOriginal); });
                    indiceTurno = (indiceTurno + 1) % jugadores.length; 
                    setTimeout(iniciarTurnoCompleto, 800);
                });
            } else {
                mostrarNotificacion("¡Incorrecto!", "Debes sacar una ficha.", false, () => {
                    necesitaSacarFicha = true; bloqueado = false;
                });
            }
        };
        cont.appendChild(btn);
    });
}

function onPointerDown(e) {
    if (perdido || bloqueado || !necesitaSacarFicha) return;
    const width = window.innerWidth - 320;
    mouse.x = (e.clientX / width) * 2 - 1; 
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(torre.flat());
    if (hits.length > 0 && hits[0].object.userData.activo) {
        piezaSeleccionada = hits[0].object; 
        posicionAlClick.copy(piezaSeleccionada.position);
        controls.enabled = false;
        pNormal.copy(camera.position).normalize(); plane.setFromNormalAndCoplanarPoint(pNormal, piezaSeleccionada.position);
        if (raycaster.ray.intersectPlane(plane, pIntersect)) pOffset.copy(pIntersect).sub(piezaSeleccionada.position);
    }
}

function onPointerMove(e) {
    if (!piezaSeleccionada) return;
    const width = window.innerWidth - 320;
    mouse.x = (e.clientX / width) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(plane, pIntersect)) {
        const move = pIntersect.clone().sub(pOffset);
        if (piezaSeleccionada.userData.axis === 'x') {
            const dx = move.x - posicionAlClick.x;
            piezaSeleccionada.position.x = posicionAlClick.x + (dx * piezaSeleccionada.userData.friccion);
        } else {
            const dz = move.z - posicionAlClick.z;
            piezaSeleccionada.position.z = posicionAlClick.z + (dz * piezaSeleccionada.userData.friccion);
        }
    }
}

function onPointerUp() {
    if (!piezaSeleccionada) return;
    const dist = piezaSeleccionada.position.distanceTo(piezaSeleccionada.userData.centroOriginal);
    if (dist > 2.0) {
        piezaSeleccionada.userData.activo = false;
        scene.remove(piezaSeleccionada);         
        necesitaSacarFicha = false; 
        bloqueado = true;
        validarEstabilidad();
        
        if(!perdido) {
            document.getElementById('btn-girar').disabled = false;
            document.getElementById('ruleta-resultado-texto').innerText = "¡Gira otra vez!";
        }
    }
    piezaSeleccionada = null; controls.enabled = true;
}

function mostrarNotificacion(tit, txt, ok, cb) {
    const mod = document.getElementById('modal-mensaje');
    document.getElementById('mensaje-titulo').innerText = tit;
    document.getElementById('mensaje-texto').innerText = txt;
    mod.querySelector('.modal-content').style.backgroundColor = ok ? "#2ecc71" : "#e74c3c";
    mod.style.display = 'flex'; setTimeout(() => { mod.style.display = 'none'; if(cb) cb(); }, 1500);
}

function validarEstabilidad() {
    for (let f = 0; f < torre.length - 1; f++) {
        const b = torre[f];
        const activos = b.filter(x => x.userData.activo);
        if (activos.length === 0 || (activos.length === 1 && !b[1].userData.activo)) {
            perdido = true;
            const culpable = jugadores[indiceTurno].nombre;
            const ganadores = jugadores.filter((_, i) => i !== indiceTurno).map(j => j.nombre).join(', ');
            document.getElementById('culpable-texto').innerText = `${culpable} tiró la torre`;
            document.getElementById('ganadores-texto').innerText = ganadores ? `Ganan: ${ganadores}` : '';
            document.getElementById('game-over').style.display = 'flex';
            derrumbe();
            return;
        }
    }
}

function derrumbe() {
    torre.flat().forEach(b => {
        const dx = b.position.x + (Math.random()-0.5)*10, dz = b.position.z + (Math.random()-0.5)*10;
        const c = () => { if (b.position.y > -20) { b.position.y -= 0.5; b.position.x += (dx-b.position.x)*0.05; b.position.z += (dz-b.position.z)*0.05; b.rotation.x += 0.1; b.rotation.y += 0.1; requestAnimationFrame(c); } };
        c();
    });
}

function animate() { requestAnimationFrame(animate); if(controls) controls.update(); renderer.render(scene, camera); }