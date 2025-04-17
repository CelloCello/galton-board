// 配置
const config = {
    ballSize: 0.15,
    pinSize: 0.08,
    pinSpacing: 0.8,
    rows: 12,
    binCount: 13, // rows + 1
    ballColor: 0xffffff,
    pinColor: 0xf5c542,
    gravity: 9.8,
    restitution: 0.5, // Bounce factor
    damping: 0.98,
    maxBalls: 200,
    ballDelay: 150, // ms between ball drops
    ballStackOffset: 0.22, // 調整球在箱子中的堆疊間距
    boardColor: 0x444444,
    binColor: 0x555555,
    standColor: 0x222222,
    // 縮放因子 - 用於整體縮小場景使所有元素在視野中
    scaleFactor: 0.9
};

// App state
const state = {
    scene: null,
    camera: null,
    renderer: null,
    balls: [],
    pins: [],
    bins: [],
    lastTime: 0,
    isInverted: false,
    isAddingBalls: false,
    ballAddInterval: null,
    totalBallsToAdd: 50, // 預設球數
    ballsAdded: 0, // 已添加的球數
    deviceFrame: null, // 設備外框3D物體
    physicsWorld: { 
        gravity: new THREE.Vector3(0, -config.gravity, 0),
        update: function(delta) {
            // Simple physics simulation
            state.balls.forEach(ball => {
                if (!ball.settled) {
                    // Apply gravity (方向會根據設備方向改變)
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
                    
                    // Calculate board boundaries based on current state
                    const boardWidth = config.binCount * config.pinSpacing;
                    const boardHeight = config.rows * config.pinSpacing;
                    
                    // Top and bottom based on device orientation
                    const isInverted = state.isInverted;
                    const topY = isInverted ? -boardHeight * 0.9 : boardHeight * 0.3;
                    const bottomY = isInverted ? boardHeight * 0.3 : -boardHeight * 0.9;
                    
                    // Check if ball should settle in a bin
                    if ((isInverted && ball.position.y < bottomY) || 
                        (!isInverted && ball.position.y < bottomY)) {
                        // Determine which bin based on x position
                        const binIndex = Math.floor((ball.position.x + boardWidth/2) / config.pinSpacing);
                        if (binIndex >= 0 && binIndex < config.binCount) {
                            const bin = state.bins[binIndex];
                            const ballsInBin = bin.userData.ballCount || 0;
                            
                            // Set final position in the bin
                            ball.position.x = bin.position.x;
                            if (isInverted) {
                                // 如果裝置倒置，球在頂部的收集箱中堆疊
                                ball.position.y = bottomY + (ballsInBin * config.ballSize * config.ballStackOffset);
                            } else {
                                // 正常方向，球在底部的收集箱中堆疊
                                ball.position.y = bottomY + (ballsInBin * config.ballSize * config.ballStackOffset);
                            }
                            
                            ball.position.z = 0;
                            ball.velocity.set(0, 0, 0);
                            ball.settled = true;
                            
                            // Update bin count
                            bin.userData.ballCount = ballsInBin + 1;
                        }
                    }
                    
                    // Boundary checks for the left and right walls
                    if (ball.position.x < -boardWidth/2 + config.ballSize) {
                        ball.position.x = -boardWidth/2 + config.ballSize;
                        ball.velocity.x *= -config.restitution;
                    } else if (ball.position.x > boardWidth/2 - config.ballSize) {
                        ball.position.x = boardWidth/2 - config.ballSize;
                        ball.velocity.x *= -config.restitution;
                    }
                    
                    // Boundary check for top
                    if (ball.position.y > topY) {
                        ball.position.y = topY;
                        ball.velocity.y *= -config.restitution;
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
    state.scene.background = new THREE.Color(0x000000); // 黑色背景
    
    // Create camera
    const container = document.getElementById('container');
    const aspect = container.clientWidth / container.clientHeight;
    state.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
    
    // 調整相機位置，使底部更加可見 - 向上移動相機
    state.camera.position.set(0, -1.5, 12);
    
    // Create renderer
    state.renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
    });
    state.renderer.setSize(container.clientWidth, container.clientHeight);
    state.renderer.setPixelRatio(window.devicePixelRatio);
    state.renderer.setClearColor(0x000000, 0); // 透明背景
    container.appendChild(state.renderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    state.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    state.scene.add(directionalLight);
    
    // 創建場景容器 - 用於整體縮放
    const sceneContainer = new THREE.Group();
    state.scene.add(sceneContainer);
    state.sceneContainer = sceneContainer;
    
    // 應用整體縮放
    sceneContainer.scale.set(
        config.scaleFactor, 
        config.scaleFactor, 
        config.scaleFactor
    );
    
    // Create Galton board device
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
    state.totalBallsToAdd = parseInt(ballCountInput.value) || 50;
    
    // Listen for ball count changes
    ballCountInput.addEventListener('change', function() {
        state.totalBallsToAdd = parseInt(this.value) || 50;
    });
    
    // 添加幫助調試的鍵盤控制
    window.addEventListener('keydown', function(e) {
        // 調整相機位置
        if (e.key === 'ArrowUp') {
            state.camera.position.y += 0.5;
        } else if (e.key === 'ArrowDown') {
            state.camera.position.y -= 0.5;
        } else if (e.key === 'ArrowLeft') {
            state.camera.position.z += 0.5;
        } else if (e.key === 'ArrowRight') {
            state.camera.position.z -= 0.5;
        }
        
        // 顯示當前相機位置
        console.log(`Camera position: ${state.camera.position.x}, ${state.camera.position.y}, ${state.camera.position.z}`);
    });
    
    // Start animation loop
    animate();
}

function createBoard() {
    const boardWidth = config.binCount * config.pinSpacing;
    const boardHeight = config.rows * config.pinSpacing;
    
    // Create main board background (透明)
    const boardGeometry = new THREE.BoxGeometry(boardWidth + 0.5, boardHeight * 1.7, 0.1);
    const boardMaterial = new THREE.MeshPhongMaterial({
        color: config.boardColor,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    board.position.z = -0.2;
    state.sceneContainer.add(board);
    
    // Create pins
    const pinGeometry = new THREE.SphereGeometry(config.pinSize, 16, 16);
    const pinMaterial = new THREE.MeshPhongMaterial({ 
        color: config.pinColor,
        specular: 0xffffff,
        shininess: 100
    });
    
    for (let row = 0; row < config.rows; row++) {
        const pinCount = row + 1;
        const rowOffset = (config.binCount - pinCount) * config.pinSpacing / 2;
        
        for (let i = 0; i < pinCount; i++) {
            const pin = new THREE.Mesh(pinGeometry, pinMaterial);
            const xPos = i * config.pinSpacing + rowOffset;
            const yPos = -row * config.pinSpacing + boardHeight * 0.2;
            pin.position.set(xPos - boardWidth/2 + config.pinSpacing/2, yPos, 0);
            state.sceneContainer.add(pin);
            state.pins.push(pin);
        }
    }
    
    // 創建收集區域底部背景 - 顯示可見區域以便觀察球的堆積
    const collectionAreaGeometry = new THREE.BoxGeometry(boardWidth + 0.5, boardHeight * 0.4, 0.1);
    const collectionAreaMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.6,
    });
    const collectionArea = new THREE.Mesh(collectionAreaGeometry, collectionAreaMaterial);
    collectionArea.position.set(0, -boardHeight * 0.7, -0.15);
    state.sceneContainer.add(collectionArea);
    
    // 增加底部高亮提示 - 使底部收集區更明顯
    const bottomHighlightGeometry = new THREE.BoxGeometry(boardWidth + 0.5, 0.1, 0.2);
    const bottomHighlightMaterial = new THREE.MeshPhongMaterial({
        color: 0xf5c542,
        transparent: true,
        opacity: 0.3,
        emissive: 0xf5c542,
        emissiveIntensity: 0.2
    });
    const bottomHighlight = new THREE.Mesh(bottomHighlightGeometry, bottomHighlightMaterial);
    bottomHighlight.position.set(0, -boardHeight * 0.9, 0.1);
    state.sceneContainer.add(bottomHighlight);
    
    // Create bins (collection areas) - 調整收集箱的大小和位置
    const binWidth = config.pinSpacing * 0.95;
    
    for (let i = 0; i < config.binCount; i++) {
        // 創建隔板
        if (i > 0) {
            const dividerGeometry = new THREE.BoxGeometry(0.03, boardHeight * 0.4, 0.15);
            const dividerMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x999999,
                transparent: true,
                opacity: 0.5
            });
            
            const divider = new THREE.Mesh(dividerGeometry, dividerMaterial);
            divider.position.set(
                (i * config.pinSpacing) - boardWidth/2,
                -boardHeight * 0.7,
                0
            );
            state.sceneContainer.add(divider);
        }
        
        // 創建收集箱的底部
        const binFloorGeometry = new THREE.BoxGeometry(binWidth, 0.03, 0.15);
        const binFloorMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xdddddd,
            transparent: true,
            opacity: 0.3
        });
        
        const binFloor = new THREE.Mesh(binFloorGeometry, binFloorMaterial);
        binFloor.position.set(
            (i * config.pinSpacing) - boardWidth/2 + config.pinSpacing/2,
            -boardHeight * 0.9,
            0
        );
        
        binFloor.userData = { ballCount: 0 };
        state.sceneContainer.add(binFloor);
        state.bins.push(binFloor);
    }
    
    // Create frame edges (left & right walls)
    const wallHeight = boardHeight * 1.7;
    const wallGeometry = new THREE.BoxGeometry(0.1, wallHeight, 0.3);
    const wallMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xcccccc,
        transparent: true,
        opacity: 0.3
    });
    
    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-boardWidth/2 - 0.05, 0, 0);
    state.sceneContainer.add(leftWall);
    
    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(boardWidth/2 + 0.05, 0, 0);
    state.sceneContainer.add(rightWall);
    
    // Create top funnel
    const funnelGeometry = new THREE.ConeGeometry(boardWidth * 0.1, boardHeight * 0.2, 32, 1, true);
    const funnelMaterial = new THREE.MeshPhongMaterial({
        color: 0xdddddd,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    
    const funnel = new THREE.Mesh(funnelGeometry, funnelMaterial);
    funnel.rotation.x = Math.PI; // 旋轉使尖端朝下
    funnel.position.set(0, boardHeight * 0.3, 0);
    state.sceneContainer.add(funnel);
    
    // 創建底座
    const standGeometry = new THREE.BoxGeometry(boardWidth * 0.8, boardHeight * 0.1, 0.2);
    const standMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        transparent: false
    });
    const stand = new THREE.Mesh(standGeometry, standMaterial);
    stand.position.set(0, -boardHeight * 1.05, -0.1);
    state.sceneContainer.add(stand);
}

function addBall() {
    if (state.balls.length >= config.maxBalls) {
        // If we have too many balls, remove the oldest settled ones first
        let removed = false;
        for (let i = 0; i < state.balls.length; i++) {
            if (state.balls[i].settled) {
                state.scene.remove(state.balls[i]);
                state.balls.splice(i, 1);
                removed = true;
                break;
            }
        }
        
        // If no settled balls, remove the oldest
        if (!removed && state.balls.length > 0) {
            state.scene.remove(state.balls[0]);
            state.balls.shift();
        }
    }
    
    // Calculate board dimensions
    const boardWidth = config.binCount * config.pinSpacing;
    const boardHeight = config.rows * config.pinSpacing;
    
    // Determine start position based on device orientation
    const startX = (Math.random() - 0.5) * 0.2;
    const startY = state.isInverted ? -boardHeight * 0.9 : boardHeight * 0.3;
    const initialVelocity = state.isInverted ? new THREE.Vector3(0, 5, 0) : new THREE.Vector3(0, 0, 0);
    
    // Create ball with random colors
    const hue = Math.random();
    const ballGeometry = new THREE.SphereGeometry(config.ballSize, 32, 32);
    const ballMaterial = new THREE.MeshPhongMaterial({ 
        color: new THREE.Color().setHSL(hue, 0.9, 0.7),
        specular: 0xffffff,
        shininess: 100
    });
    
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(startX, startY, 0);
    ball.velocity = initialVelocity;
    ball.settled = false;
    
    state.sceneContainer.add(ball);
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
    while (state.balls.length > 0) {
        const ball = state.balls.pop();
        state.sceneContainer.remove(ball);
    }
    
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
    state.totalBallsToAdd = parseInt(ballCountInput.value) || 50;
    
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
    if (event.beta === null) return;
    
    // 當裝置旋轉到接近倒置時，翻轉整個模擬
    const wasInverted = state.isInverted;
    state.isInverted = Math.abs(event.beta) > 150;
    
    if (wasInverted !== state.isInverted) {
        // 反轉重力方向
        state.physicsWorld.gravity.y = state.isInverted ? config.gravity : -config.gravity;
        
        // 更新裝置框架的旋轉
        const deviceFrame = document.querySelector('.device-frame');
        if (deviceFrame) {
            deviceFrame.style.transform = state.isInverted ? 'rotate(180deg)' : 'rotate(0deg)';
        }
        
        // 如果有顯著變化且有球，重置並啟動新的模擬
        resetBoard();
        startSimulation();
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
    
    // Render scene
    state.renderer.render(state.scene, state.camera);
}

// Start the application
init(); 