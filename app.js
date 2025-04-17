// 配置
const config = {
    ballSize: 0.2,
    pinSize: 0.1,
    pinSpacing: 1,
    rows: 10,
    binCount: 11, // rows + 1
    ballColor: 0xff6b6b,
    pinColor: 0x4dabf7,
    gravity: 9.8,
    restitution: 0.5, // Bounce factor
    damping: 0.98,
    maxBalls: 100,
    ballDelay: 300, // ms between ball drops
    ballStackOffset: 0.22, // 調整球在箱子中的堆疊間距
};

// App state
const state = {
    scene: null,
    camera: null,
    renderer: null,
    cameraRotation: 0, // 用於簡單的相機移動
    balls: [],
    pins: [],
    bins: [],
    lastTime: 0,
    isInverted: false,
    isAddingBalls: false,
    ballAddInterval: null,
    totalBallsToAdd: 20, // 預設球數
    ballsAdded: 0, // 已添加的球數
    physicsWorld: { 
        gravity: new THREE.Vector3(0, -config.gravity, 0),
        update: function(delta) {
            // Simple physics simulation
            state.balls.forEach(ball => {
                if (!ball.settled) {
                    // Apply gravity
                    ball.velocity.add(this.gravity.clone().multiplyScalar(delta));
                    
                    // Apply damping
                    ball.velocity.multiplyScalar(config.damping);
                    
                    // Update position
                    ball.position.add(ball.velocity.clone().multiplyScalar(delta));
                    
                    // Check collisions with pins
                    state.pins.forEach(pin => {
                        const distance = ball.position.distanceTo(pin.position);
                        const minDist = config.ballSize/2 + config.pinSize/2;
                        
                        if (distance < minDist) {
                            // Handle collision
                            const normal = new THREE.Vector3()
                                .subVectors(ball.position, pin.position)
                                .normalize();
                            
                            // Position correction
                            ball.position.copy(
                                pin.position.clone().add(
                                    normal.clone().multiplyScalar(minDist + 0.01)
                                )
                            );
                            
                            // Velocity reflection
                            const dotProduct = ball.velocity.dot(normal);
                            if (dotProduct < 0) {
                                ball.velocity.sub(
                                    normal.clone().multiplyScalar(
                                        (1 + config.restitution) * dotProduct
                                    )
                                );
                                
                                // Add some randomness to make the board interesting
                                const randomFactor = (Math.random() - 0.5) * 0.3;
                                ball.velocity.x += randomFactor;
                            }
                        }
                    });
                    
                    // Check bin settling
                    if (ball.position.y < -config.rows * config.pinSpacing - 1) {
                        // Find which bin the ball is in
                        const binIndex = Math.floor((ball.position.x + config.binCount/2 * config.pinSpacing) / config.pinSpacing);
                        if (binIndex >= 0 && binIndex < config.binCount) {
                            const bin = state.bins[binIndex];
                            const ballsInBin = bin.userData.ballCount || 0;
                            
                            // Set final position in the bin - 調整球的堆疊位置
                            ball.position.x = bin.position.x;
                            ball.position.y = -config.rows * config.pinSpacing - 1.5 + (ballsInBin * config.ballSize * config.ballStackOffset);
                            ball.position.z = 0;
                            ball.velocity.set(0, 0, 0);
                            ball.settled = true;
                            
                            // Update bin count
                            bin.userData.ballCount = ballsInBin + 1;
                        }
                    }
                    
                    // Boundary checks
                    const boardWidth = config.binCount * config.pinSpacing;
                    if (ball.position.x < -boardWidth/2) {
                        ball.position.x = -boardWidth/2 + 0.1;
                        ball.velocity.x *= -config.restitution;
                    } else if (ball.position.x > boardWidth/2) {
                        ball.position.x = boardWidth/2 - 0.1;
                        ball.velocity.x *= -config.restitution;
                    }
                }
            });
        }
    }
};

// Initialize the scene
function init() {
    // Create scene
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0xf8f9fa);
    
    // Create camera
    const container = document.getElementById('container');
    const aspect = container.clientWidth / container.clientHeight;
    state.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    
    // 調整初始相機位置，使視角更好地顯示整個板
    state.camera.position.set(0, -5, 18);
    state.camera.lookAt(0, -5, 0);
    
    // Create renderer
    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setSize(container.clientWidth, container.clientHeight);
    state.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(state.renderer.domElement);
    
    // 實現簡單的相機交互
    setupCameraInteraction(container);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    state.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    state.scene.add(directionalLight);
    
    // Create Galton board
    createBoard();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Setup device orientation for mobile
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation);
    }
    
    // Add event listeners for buttons
    document.getElementById('reset-btn').addEventListener('click', resetBoard);
    document.getElementById('start-btn').addEventListener('click', startSimulation);
    
    // Get initial ball count value
    const ballCountInput = document.getElementById('ball-count');
    state.totalBallsToAdd = parseInt(ballCountInput.value) || 20;
    
    // Listen for ball count changes
    ballCountInput.addEventListener('change', function() {
        state.totalBallsToAdd = parseInt(this.value) || 20;
    });
    
    // Start animation loop
    animate();
}

// 簡單的相機控制實現
function setupCameraInteraction(container) {
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    container.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaMove = {
                x: e.clientX - previousMousePosition.x,
                y: e.clientY - previousMousePosition.y
            };
            
            // 從相機位置向場景中心的方向
            const target = new THREE.Vector3(0, -5, 0);
            const direction = new THREE.Vector3().subVectors(target, state.camera.position).normalize();
            
            // 計算相機的旋轉
            if (deltaMove.x !== 0) {
                state.camera.position.x += deltaMove.x * 0.05;
            }
            
            if (deltaMove.y !== 0) {
                // 限制上下移動範圍
                const newY = state.camera.position.y - deltaMove.y * 0.05;
                if (newY > -12 && newY < 2) {
                    state.camera.position.y = newY;
                }
            }
            
            state.camera.lookAt(0, -5, 0);
            previousMousePosition = { x: e.clientX, y: e.clientY };
        }
    });
    
    container.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    container.addEventListener('mouseleave', () => {
        isDragging = false;
    });
    
    // 觸摸屏支持
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    });
    
    container.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            const deltaMove = {
                x: e.touches[0].clientX - previousMousePosition.x,
                y: e.touches[0].clientY - previousMousePosition.y
            };
            
            // 從相機位置向場景中心的方向
            const target = new THREE.Vector3(0, -5, 0);
            const direction = new THREE.Vector3().subVectors(target, state.camera.position).normalize();
            
            // 計算相機的旋轉
            if (deltaMove.x !== 0) {
                state.camera.position.x += deltaMove.x * 0.05;
            }
            
            if (deltaMove.y !== 0) {
                // 限制上下移動範圍
                const newY = state.camera.position.y - deltaMove.y * 0.05;
                if (newY > -12 && newY < 2) {
                    state.camera.position.y = newY;
                }
            }
            
            state.camera.lookAt(0, -5, 0);
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    });
    
    container.addEventListener('touchend', () => {
        isDragging = false;
    });
    
    // 滾輪縮放
    container.addEventListener('wheel', (e) => {
        const zoomSpeed = 0.1;
        const direction = (e.deltaY > 0) ? 1 : -1;
        
        // 限制縮放範圍
        const newZ = state.camera.position.z + direction * zoomSpeed * 5;
        if (newZ > 10 && newZ < 30) {
            state.camera.position.z = newZ;
            state.camera.lookAt(0, -5, 0);
        }
        
        e.preventDefault();
    });
}

function createBoard() {
    // Create board elements
    const boardWidth = config.binCount * config.pinSpacing;
    const boardHeight = config.rows * config.pinSpacing;
    
    // Create board background
    const boardGeometry = new THREE.BoxGeometry(boardWidth + 2, boardHeight + 5, 0.2);
    const boardMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    board.position.z = -0.5;
    state.scene.add(board);
    
    // Create pins
    const pinGeometry = new THREE.SphereGeometry(config.pinSize, 16, 16);
    const pinMaterial = new THREE.MeshPhongMaterial({ 
        color: config.pinColor,
        specular: 0x111111,
        shininess: 30
    });
    
    for (let row = 0; row < config.rows; row++) {
        const pinCount = row + 1;
        const rowOffset = (config.binCount - pinCount) * config.pinSpacing / 2;
        
        for (let i = 0; i < pinCount; i++) {
            const pin = new THREE.Mesh(pinGeometry, pinMaterial);
            const xPos = i * config.pinSpacing + rowOffset;
            const yPos = -row * config.pinSpacing;
            pin.position.set(xPos - boardWidth/2 + config.pinSpacing/2, yPos, 0);
            state.scene.add(pin);
            state.pins.push(pin);
        }
    }
    
    // Create bins - 調整收集箱的大小和位置
    const binGeometry = new THREE.BoxGeometry(config.pinSpacing * 0.9, 3, 0.5);
    
    for (let i = 0; i < config.binCount; i++) {
        const bin = new THREE.Mesh(
            binGeometry, 
            new THREE.MeshLambertMaterial({ 
                color: 0xbbe0ff,
                transparent: true,
                opacity: 0.7
            })
        );
        
        bin.position.set(
            (i * config.pinSpacing) - boardWidth/2 + config.pinSpacing/2,
            -boardHeight - 1.5,
            0
        );
        
        bin.userData = { ballCount: 0 };
        state.scene.add(bin);
        state.bins.push(bin);
    }
    
    // Create side walls
    const wallGeometry = new THREE.BoxGeometry(0.5, boardHeight + 5, 1);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
    
    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-boardWidth/2 - 0.25, -boardHeight/2, 0);
    state.scene.add(leftWall);
    
    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(boardWidth/2 + 0.25, -boardHeight/2, 0);
    state.scene.add(rightWall);
}

function addBall() {
    if (state.balls.length >= config.maxBalls) {
        // If we have too many balls, remove the oldest one
        const oldBall = state.balls.shift();
        state.scene.remove(oldBall);
    }
    
    // Randomize starting position slightly
    const startX = (Math.random() - 0.5) * 0.2;
    
    // Create ball
    const ballGeometry = new THREE.SphereGeometry(config.ballSize, 32, 32);
    const ballMaterial = new THREE.MeshPhongMaterial({ 
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
        specular: 0x333333,
        shininess: 30
    });
    
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(startX, config.rows * config.pinSpacing * 0.2, 0);
    ball.velocity = new THREE.Vector3(0, 0, 0);
    ball.settled = false;
    
    state.scene.add(ball);
    state.balls.push(ball);
    
    // 更新已添加的球數
    state.ballsAdded++;
    
    // 如果達到設定的球數，停止添加
    if (state.ballsAdded >= state.totalBallsToAdd) {
        stopSimulation();
    }
}

function resetBoard() {
    // Remove all balls
    state.balls.forEach(ball => {
        state.scene.remove(ball);
    });
    state.balls = [];
    
    // Reset bin counters
    state.bins.forEach(bin => {
        bin.userData.ballCount = 0;
    });
    
    // Stop adding balls if it was in progress
    if (state.isAddingBalls) {
        stopSimulation();
    }
    
    // Reset ball counter
    state.ballsAdded = 0;
    
    // Update button text
    document.getElementById('start-btn').textContent = 'Start';
}

function startSimulation() {
    if (state.isAddingBalls) {
        stopSimulation();
        return;
    }
    
    // Get the ball count from input
    const ballCountInput = document.getElementById('ball-count');
    state.totalBallsToAdd = parseInt(ballCountInput.value) || 20;
    
    // Reset counters
    state.ballsAdded = 0;
    
    // Start adding balls
    state.isAddingBalls = true;
    
    // Update button text
    document.getElementById('start-btn').textContent = 'Stop';
    
    // Add first ball immediately
    addBall();
    
    // Setup interval to add more balls
    state.ballAddInterval = setInterval(addBall, config.ballDelay);
}

function stopSimulation() {
    if (!state.isAddingBalls) return;
    
    // Stop adding balls
    clearInterval(state.ballAddInterval);
    state.isAddingBalls = false;
    
    // Update button text
    document.getElementById('start-btn').textContent = 'Start';
}

function handleOrientation(event) {
    // Check if device is upside down (inverted)
    if (event.beta !== null) {
        const isCurrentlyInverted = Math.abs(event.beta) > 150 || Math.abs(event.beta) < 30;
        
        // If orientation changed from normal to inverted or vice versa
        if (isCurrentlyInverted !== state.isInverted) {
            state.isInverted = isCurrentlyInverted;
            
            // If flipped upside down, reset the board
            if (isCurrentlyInverted) {
                resetBoard();
                // Start simulation automatically when flipped
                startSimulation();
            }
        }
    }
}

function onWindowResize() {
    const container = document.getElementById('container');
    state.camera.aspect = container.clientWidth / container.clientHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate(time = 0) {
    requestAnimationFrame(animate);
    
    const delta = (time - state.lastTime) / 1000;
    state.lastTime = time;
    
    // Update physics (with time delta clamping to handle tab switching)
    if (delta > 0 && delta < 0.2) {
        state.physicsWorld.update(delta);
    }
    
    // 更新相機位置，一直朝向場景中央
    state.camera.lookAt(0, -5, 0);
    
    // Render scene
    state.renderer.render(state.scene, state.camera);
}

// Start the application
init(); 