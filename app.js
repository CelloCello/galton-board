// 配置
const config = {
    // 球體大小將根據針腳間距自動計算
    pinSize: 0.08,
    pinSpacing: 0.5,  // 縮小針腳間距
    rows: 20,         // 增加行數
    binCount: 21,     // rows + 1
    ballColor: 0xffffff,
    pinColor: 0xf5c542,
    gravity: 9.8,
    restitution: 0.5, // Bounce factor
    damping: 0.98,
    maxBalls: 1000,    // 增加最大球數量
    maxSettledBalls: 1000, // 收集區允許的最大球數
    ballDelay: 150,   // ms between ball drops
    ballStackOffset: 0.3, // 調整球在箱子中的堆疊間距，增加堆疊密度
    boardColor: 0x444444,
    binColor: 0x555555,
    standColor: 0x222222,
    // 縮放因子 - 用於整體縮小場景使所有元素在視野中
    scaleFactor: 0.35,  // 更小的縮放因子以適應更寬的板
    // 相機設置
    cameraZoom: 35,   // 更廣的視野
    // 針腳區域向上偏移量
    pinAreaOffset: 0.3,
    // 梯形配置
    trapezoidTopWidth: 0.5, // 頂部寬度相對於底部寬度的比例 (0.5 = 50%)
    
    // 獲取當前球體大小（自動根據針腳間距計算）
    getBallSize: function() {
        // 將球體大小增加到針腳間距的24%
        return this.pinSpacing * 0.24;
    }
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
    isAddingBalls: false,
    ballAddInterval: null,
    totalBallsToAdd: 50, // 預設球數
    ballsAdded: 0, // 已添加的球數
    deviceFrame: null, // 設備外框3D物體
    sceneContainer: null, // 場景容器
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
                        // 使用自動計算的球體大小
                        const ballSize = config.getBallSize();
                        const minDist = ballSize/2 + config.pinSize/2;
                        
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
                    
                    // Top and bottom boundaries
                    const topY = boardHeight * (0.3 + config.pinAreaOffset);
                    // 底部邊界，對應收集區的頂部邊緣
                    const bottomY = -boardHeight * 0.8;
                    // 收集區底部位置
                    const binFloorY = -boardHeight * 1.05;
                    
                    // Check if ball has reached the collection area
                    if (ball.position.y < bottomY) {
                        // Determine which bin based on x position
                        const binIndex = Math.floor((ball.position.x + boardWidth/2) / config.pinSpacing);
                        if (binIndex >= 0 && binIndex < config.binCount) {
                            const bin = state.bins[binIndex];
                            const ballsInBin = bin.userData.ballCount || 0;
                            
                            // Set final position in the bin
                            ball.position.x = bin.position.x;
                            // 正常方向，球在底部的收集箱中堆疊
                            // 確保球體至少在收集區底部
                            ball.position.y = Math.max(
                                binFloorY + config.getBallSize() * 0.5,
                                bottomY + (ballsInBin * config.getBallSize() * config.ballStackOffset)
                            );
                            
                            ball.position.z = 0;
                            ball.velocity.set(0, 0, 0);
                            ball.settled = true;
                            
                            // Update bin count
                            bin.userData.ballCount = ballsInBin + 1;
                        }
                    }
                    
                    // 額外檢查，如果球體位置低於收集區底部，將其重置到收集區底部
                    if (ball.position.y < binFloorY) {
                        // 找到最近的收集槽
                        const binIndex = Math.floor((ball.position.x + boardWidth/2) / config.pinSpacing);
                        if (binIndex >= 0 && binIndex < config.binCount) {
                            const bin = state.bins[binIndex];
                            const ballsInBin = bin.userData.ballCount || 0;
                            
                            // 強制定位到收集槽底部
                            ball.position.x = bin.position.x;
                            ball.position.y = binFloorY + config.getBallSize() * 0.5;
                            ball.position.z = 0;
                            ball.velocity.set(0, 0, 0);
                            ball.settled = true;
                            
                            // 更新收集槽計數
                            bin.userData.ballCount = ballsInBin + 1;
                        }
                    }
                    
                    // Boundary checks for the left and right walls
                    // 使用自動計算的球體大小
                    const ballSize = config.getBallSize();
                    if (ball.position.x < -boardWidth/2 + ballSize) {
                        ball.position.x = -boardWidth/2 + ballSize;
                        ball.velocity.x *= -config.restitution;
                    } else if (ball.position.x > boardWidth/2 - ballSize) {
                        ball.position.x = boardWidth/2 - ballSize;
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
    
    // Create camera - 使用透視相機但設置較低的FOV使其接近正交效果
    const container = document.getElementById('container');
    const aspect = container.clientWidth / container.clientHeight;
    
    // 使用透視相機，但設置較低的FOV使其接近正交效果，避免兼容性問題
    state.camera = new THREE.PerspectiveCamera(config.cameraZoom, aspect, 0.1, 1000);
    
    // 調整相機位置，使整個場景呈現出較為平面的效果
    state.camera.position.set(0, 0, 10);
    state.camera.lookAt(0, 0, 0);
    
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
    
    // 添加高爾頓板參數調整控制項
    setupBoardControls();
    
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
            state.camera.position.x -= 0.5;
        } else if (e.key === 'ArrowRight') {
            state.camera.position.x += 0.5;
        } else if (e.key === 'z') {
            // 縮小視野
            state.camera.fov *= 0.9;
            state.camera.updateProjectionMatrix();
        } else if (e.key === 'x') {
            // 放大視野
            state.camera.fov *= 1.1;
            state.camera.updateProjectionMatrix();
        }
        
        // 顯示當前相機設置
        console.log(`Camera position: x=${state.camera.position.x}, y=${state.camera.position.y}, z=${state.camera.position.z}, fov=${state.camera.fov}`);
    });
    
    // Start animation loop
    animate();
}

// 設置高爾頓板參數控制面板
function setupBoardControls() {
    // 檢查控制面板是否已經存在
    if (document.getElementById('board-controls')) return;
    
    // 創建控制面板容器
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'board-controls';
    controlsContainer.style.position = 'fixed';
    controlsContainer.style.top = '10px';
    controlsContainer.style.right = '10px';
    controlsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    controlsContainer.style.padding = '10px';
    controlsContainer.style.borderRadius = '5px';
    controlsContainer.style.color = 'white';
    controlsContainer.style.zIndex = '1000';
    controlsContainer.style.maxWidth = '250px';
    controlsContainer.style.transition = 'transform 0.3s ease-in-out, right 0.3s ease-in-out';
    controlsContainer.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.3)';
    
    // 創建切換按鈕
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-controls';
    toggleButton.textContent = '⚙️';
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = '10px';
    toggleButton.style.right = '10px';
    toggleButton.style.zIndex = '1001';
    toggleButton.style.padding = '8px 12px';
    toggleButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    toggleButton.style.color = 'white';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '5px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.display = 'none'; // 默認隱藏，在窄螢幕上才顯示
    toggleButton.style.fontSize = '18px';
    toggleButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    toggleButton.style.transition = 'background-color 0.3s ease';
    
    // 創建標題
    const title = document.createElement('h3');
    title.textContent = '高爾頓板參數設置';
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '16px';
    controlsContainer.appendChild(title);
    
    // 創建參數控制項 - 移除球體大小控制項，因為它現在是自動計算的
    const parameters = [
        { id: 'rows', label: '行數', min: 5, max: 30, value: config.rows },
        { id: 'pin-spacing', label: '針腳間距', min: 0.3, max: 1.0, step: 0.05, value: config.pinSpacing },
        { id: 'scale-factor', label: '縮放比例', min: 0.3, max: 1.0, step: 0.05, value: config.scaleFactor },
        { id: 'trapezoid-width', label: '梯形頂部寬度', min: 0.1, max: 1.0, step: 0.05, value: config.trapezoidTopWidth }
    ];
    
    // 添加每個控制項
    parameters.forEach(param => {
        const controlGroup = document.createElement('div');
        controlGroup.style.marginBottom = '10px';
        
        const label = document.createElement('label');
        label.textContent = param.label + ': ';
        label.style.display = 'block';
        label.style.marginBottom = '5px';
        controlGroup.appendChild(label);
        
        const valueDisplay = document.createElement('span');
        valueDisplay.id = `${param.id}-value`;
        valueDisplay.textContent = param.value;
        valueDisplay.style.marginLeft = '5px';
        valueDisplay.style.fontWeight = 'bold';
        label.appendChild(valueDisplay);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = param.min;
        slider.max = param.max;
        slider.step = param.step || 1;
        slider.value = param.value;
        slider.style.width = '100%';
        slider.addEventListener('input', function() {
            valueDisplay.textContent = this.value;
            
            // 更新配置
            if (param.id === 'rows') {
                config.rows = parseInt(this.value);
                config.binCount = config.rows + 1;
            } else if (param.id === 'pin-spacing') {
                config.pinSpacing = parseFloat(this.value);
            } else if (param.id === 'scale-factor') {
                config.scaleFactor = parseFloat(this.value);
                state.sceneContainer.scale.set(
                    config.scaleFactor, 
                    config.scaleFactor, 
                    config.scaleFactor
                );
            } else if (param.id === 'trapezoid-width') {
                config.trapezoidTopWidth = parseFloat(this.value);
            }
        });
        controlGroup.appendChild(slider);
        
        controlsContainer.appendChild(controlGroup);
    });
    
    // 添加應用按鈕
    const applyButton = document.createElement('button');
    applyButton.textContent = '應用更改';
    applyButton.style.width = '100%';
    applyButton.style.padding = '8px';
    applyButton.style.backgroundColor = '#f5c542';
    applyButton.style.border = 'none';
    applyButton.style.borderRadius = '4px';
    applyButton.style.cursor = 'pointer';
    applyButton.style.fontWeight = 'bold';
    applyButton.style.marginTop = '10px';
    applyButton.addEventListener('click', function() {
        // 停止所有活動
        stopSimulation();
        
        // 重新創建面板
        rebuildBoard();
    });
    controlsContainer.appendChild(applyButton);
    
    // 添加到文檔
    document.body.appendChild(controlsContainer);
    document.body.appendChild(toggleButton);
    
    // 添加切換按鈕的懸停效果
    toggleButton.addEventListener('mouseover', function() {
        this.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    });
    
    toggleButton.addEventListener('mouseout', function() {
        this.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    });
    
    // 切換控制面板顯示/隱藏
    toggleButton.addEventListener('click', function() {
        const isHidden = controlsContainer.style.transform === 'translateX(100%)';
        if (isHidden) {
            controlsContainer.style.transform = 'translateX(0)';
            toggleButton.textContent = '×';
        } else {
            controlsContainer.style.transform = 'translateX(100%)';
            toggleButton.textContent = '⚙️';
        }
    });
    
    // 根據螢幕寬度調整控制面板顯示
    function adjustControlsVisibility() {
        const narrowScreen = window.innerWidth < 768;
        if (narrowScreen) {
            toggleButton.style.display = 'block';
            controlsContainer.style.transform = 'translateX(100%)'; // 默認隱藏
            controlsContainer.style.right = '0'; // 確保面板完全貼在右側
            toggleButton.textContent = '⚙️'; // 重置切換按鈕圖標
        } else {
            toggleButton.style.display = 'none';
            controlsContainer.style.transform = 'translateX(0)'; // 默認顯示
            controlsContainer.style.right = '10px'; // 恢復原來的位置
        }
    }
    
    // 初始調整
    adjustControlsVisibility();
    
    // 當視窗大小改變時調整
    window.addEventListener('resize', adjustControlsVisibility);
}

// 重建高爾頓板
function rebuildBoard() {
    // 清理舊的針腳和收集槽
    while (state.pins.length > 0) {
        const pin = state.pins.pop();
        state.sceneContainer.remove(pin);
    }
    
    while (state.bins.length > 0) {
        const bin = state.bins.pop();
        state.sceneContainer.remove(bin);
    }
    
    // 移除所有子物體
    while (state.sceneContainer.children.length > 0) {
        state.sceneContainer.remove(state.sceneContainer.children[0]);
    }
    
    // 重置球
    resetBoard();
    
    // 重新創建面板
    createBoard();
}

function createBoard() {
    const boardWidth = config.binCount * config.pinSpacing;
    const boardHeight = config.rows * config.pinSpacing;
    
    // 針腳區域向上偏移量 - 使用配置中的值
    const pinAreaOffset = config.pinAreaOffset;
    
    // 創建更短、更寬的高爾頓板 - 整體比例更扁
    const boardGeometry = new THREE.BoxGeometry(boardWidth + 0.5, boardHeight * 1.5, 0.1);
    const boardMaterial = new THREE.MeshPhongMaterial({
        color: config.boardColor,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    board.position.z = -0.2;
    state.sceneContainer.add(board);
    
    // Create pins - 增加針的發光效果
    const pinGeometry = new THREE.SphereGeometry(config.pinSize, 16, 16);
    const pinMaterial = new THREE.MeshPhongMaterial({ 
        color: config.pinColor,
        specular: 0xffffff,
        shininess: 100,
        emissive: 0xf5c542,
        emissiveIntensity: 0.2
    });
    
    // 創建針腳，拉近間距，並提高整體針腳區位置
    for (let row = 0; row < config.rows; row++) {
        // 計算當前行的針腳數量 - 梯形分佈
        // 最上行（row=0）的寬度是底部寬度的 trapezoidTopWidth 比例
        // 最下行（row=rows-1）的寬度是全寬
        const progress = row / (config.rows - 1); // 從0到1的進度值
        // 用線性插值計算針腳數量，確保最上行和最下行的針腳數量符合梯形要求
        const pinCount = Math.floor(
            config.trapezoidTopWidth * config.binCount + 
            (1 - config.trapezoidTopWidth) * config.binCount * progress
        );
        
        // 計算行的偏移量，使針腳居中對齊
        const rowOffset = (config.binCount - pinCount) * config.pinSpacing / 2;
        
        for (let i = 0; i < pinCount; i++) {
            const pin = new THREE.Mesh(pinGeometry, pinMaterial);
            const xPos = i * config.pinSpacing + rowOffset;
            // 調整y位置，向上偏移
            const yPos = -row * config.pinSpacing + boardHeight * (0.2 + pinAreaOffset);
            pin.position.set(xPos - boardWidth/2 + config.pinSpacing/2, yPos, 0);
            state.sceneContainer.add(pin);
            state.pins.push(pin);
        }
    }
    
    // 創建一個分隔線，明確區分針腳區和收集區
    const separatorGeometry = new THREE.BoxGeometry(boardWidth + 0.5, 0.05, 0.15);
    const separatorMaterial = new THREE.MeshPhongMaterial({
        color: 0xf5c542,
        transparent: true,
        opacity: 0.7,
        emissive: 0xf5c542,
        emissiveIntensity: 0.3
    });
    const separator = new THREE.Mesh(separatorGeometry, separatorMaterial);
    // 將分隔線放在針腳區和收集區之間
    separator.position.set(0, -boardHeight * 0.5, 0);
    state.sceneContainer.add(separator);
    
    // 創建收集區域 - 縮小高度並保持在底部，但增加高度以容納更多球
    const collectionAreaGeometry = new THREE.BoxGeometry(boardWidth + 0.5, boardHeight * 0.5, 0.1);
    const collectionAreaMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.6,
    });
    const collectionArea = new THREE.Mesh(collectionAreaGeometry, collectionAreaMaterial);
    // 保持收集區域在底部，略微降低位置
    collectionArea.position.set(0, -boardHeight * 0.8, -0.15);
    state.sceneContainer.add(collectionArea);
    
    // 創建底部高亮 - 更明顯，位置隨收集區調整
    const bottomHighlightGeometry = new THREE.BoxGeometry(boardWidth + 0.5, 0.1, 0.2);
    const bottomHighlightMaterial = new THREE.MeshPhongMaterial({
        color: 0xf5c542,
        transparent: true,
        opacity: 0.5,
        emissive: 0xf5c542,
        emissiveIntensity: 0.5
    });
    const bottomHighlight = new THREE.Mesh(bottomHighlightGeometry, bottomHighlightMaterial);
    bottomHighlight.position.set(0, -boardHeight * 0.8, 0.1);
    state.sceneContainer.add(bottomHighlight);
    
    // 創建收集槽 - 更明顯的分隔和底部
    const binWidth = config.pinSpacing * 0.95;
    
    // 先創建一個收集區域底部，將其位置調低
    const binBaseGeometry = new THREE.BoxGeometry(boardWidth + 0.5, 0.1, 0.15);
    const binBaseMaterial = new THREE.MeshPhongMaterial({
        color: 0xdddddd,
        transparent: true,
        opacity: 0.6,
        emissive: 0xdddddd,
        emissiveIntensity: 0.2
    });
    const binBase = new THREE.Mesh(binBaseGeometry, binBaseMaterial);
    // 將底部位置大幅降低，使收集區能夠容納更多球
    binBase.position.set(0, -boardHeight * 1.05, 0);
    state.sceneContainer.add(binBase);
    
    // 創建收集槽
    for (let i = 0; i < config.binCount; i++) {
        // 創建分隔板 - 使其更加明顯，並延長高度
        if (i > 0) {
            const dividerGeometry = new THREE.BoxGeometry(0.03, boardHeight * 0.5, 0.15);
            const dividerMaterial = new THREE.MeshPhongMaterial({ 
                color: 0xaaaaaa,
                transparent: true,
                opacity: 0.7,
                emissive: 0xaaaaaa,
                emissiveIntensity: 0.1
            });
            
            const divider = new THREE.Mesh(dividerGeometry, dividerMaterial);
            divider.position.set(
                (i * config.pinSpacing) - boardWidth/2,
                -boardHeight * 0.8,
                0
            );
            state.sceneContainer.add(divider);
        }
        
        // 創建每個收集格的底部，位置調低
        const binFloorGeometry = new THREE.BoxGeometry(binWidth, 0.05, 0.15);
        const binFloorMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xdddddd,
            transparent: true,
            opacity: 0.5,
            emissive: 0xdddddd,
            emissiveIntensity: 0.1
        });
        
        const binFloor = new THREE.Mesh(binFloorGeometry, binFloorMaterial);
        binFloor.position.set(
            (i * config.pinSpacing) - boardWidth/2 + config.pinSpacing/2,
            -boardHeight * 1.05,
            0
        );
        
        // 添加底部碰撞檢測數據
        binFloor.userData = { 
            ballCount: 0,
            isFloor: true,
            floorY: -boardHeight * 1.05
        };
        state.sceneContainer.add(binFloor);
        state.bins.push(binFloor);
    }
    
    // 創建側壁 - 增加邊緣清晰度
    const wallHeight = boardHeight * 1.5;
    const wallGeometry = new THREE.BoxGeometry(0.1, wallHeight, 0.3);
    const wallMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xcccccc,
        transparent: true,
        opacity: 0.4,
        emissive: 0xcccccc,
        emissiveIntensity: 0.1
    });
    
    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-boardWidth/2 - 0.05, 0, 0);
    state.sceneContainer.add(leftWall);
    
    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(boardWidth/2 + 0.05, 0, 0);
    state.sceneContainer.add(rightWall);
    
    // 創建頂部漏斗 - 也需要向上移動以匹配針腳區
    const funnelGeometry = new THREE.ConeGeometry(boardWidth * 0.07, boardHeight * 0.15, 32, 1, true);
    const funnelMaterial = new THREE.MeshPhongMaterial({
        color: 0xdddddd,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        emissive: 0xdddddd,
        emissiveIntensity: 0.1
    });
    
    const funnel = new THREE.Mesh(funnelGeometry, funnelMaterial);
    funnel.rotation.x = Math.PI; // 旋轉使尖端朝下
    // 調整漏斗位置，向上偏移更多
    funnel.position.set(0, boardHeight * (0.4 + pinAreaOffset), 0);
    state.sceneContainer.add(funnel);
    
    // 創建底座 - 增加視覺層次，位置調整以適應新的收集區高度
    const standGeometry = new THREE.BoxGeometry(boardWidth * 0.9, boardHeight * 0.1, 0.2);
    const standMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        transparent: false
    });
    const stand = new THREE.Mesh(standGeometry, standMaterial);
    stand.position.set(0, -boardHeight * 1.1, -0.1);
    state.sceneContainer.add(stand);
}

function addBall() {
    // 計算目前處於收集區的球數量
    const settledBallCount = state.balls.filter(ball => ball.settled).length;
    
    // 如果已經達到最大球數，先檢查是否有未落入收集區的球可以移除
    if (state.balls.length >= config.maxBalls || settledBallCount >= config.maxSettledBalls) {
        // 先嘗試移除未落入收集區的球
        let removed = false;
        for (let i = 0; i < state.balls.length; i++) {
            if (!state.balls[i].settled) {
                state.sceneContainer.remove(state.balls[i]);
                state.balls.splice(i, 1);
                removed = true;
                break;
            }
        }
        
        // 如果沒有未落入收集區的球，並且已達到收集區最大球數，再考慮移除最早的收集區球
        if (!removed && settledBallCount >= config.maxSettledBalls) {
            // 找出最早落入收集區的球（在每個收集槽中找位置最低的）
            // 為避免破壞分布形狀，從兩側邊緣的收集槽開始移除
            const edgeBins = [0, config.binCount - 1]; // 左右兩側的槽
            
            for (const binIndex of edgeBins) {
                const binBalls = state.balls.filter(ball => 
                    ball.settled && 
                    Math.abs(ball.position.x - state.bins[binIndex].position.x) < 0.1
                );
                
                if (binBalls.length > 0) {
                    // 移除這個槽中最早的球（位置最低的）
                    const oldestBall = binBalls.reduce((oldest, current) => {
                        return (current.position.y < oldest.position.y) ? current : oldest;
                    }, binBalls[0]);
                    
                    const index = state.balls.indexOf(oldestBall);
                    if (index !== -1) {
                        state.sceneContainer.remove(oldestBall);
                        state.balls.splice(index, 1);
                        
                        // 更新這個槽的計數
                        const bin = state.bins[binIndex];
                        if (bin.userData.ballCount > 0) {
                            bin.userData.ballCount--;
                        }
                        
                        removed = true;
                        break;
                    }
                }
            }
            
            // 如果邊緣槽沒有球，則從所有收集區中找最早的
            if (!removed) {
                // 找到所有已落入收集區的球
                const settledBalls = state.balls.filter(ball => ball.settled);
                if (settledBalls.length > 0) {
                    // 從中間向兩側尋找，保持分布形狀
                    const middleBin = Math.floor(config.binCount / 2);
                    const searchOrder = [];
                    
                    // 生成搜索順序：從最遠的槽開始
                    for (let distance = Math.floor(config.binCount / 2); distance >= 0; distance--) {
                        const leftBin = middleBin - distance;
                        const rightBin = middleBin + distance;
                        
                        if (leftBin >= 0) searchOrder.push(leftBin);
                        if (rightBin < config.binCount && rightBin !== leftBin) searchOrder.push(rightBin);
                    }
                    
                    // 按搜索順序尋找可移除的球
                    for (const binIndex of searchOrder) {
                        const binBalls = settledBalls.filter(ball => 
                            Math.abs(ball.position.x - state.bins[binIndex].position.x) < 0.1
                        );
                        
                        if (binBalls.length > 0) {
                            // 移除這個槽中最舊的球（高度最低的）
                            const oldestBall = binBalls.reduce((oldest, current) => {
                                return (current.position.y < oldest.position.y) ? current : oldest;
                            }, binBalls[0]);
                            
                            const index = state.balls.indexOf(oldestBall);
                            if (index !== -1) {
                                state.sceneContainer.remove(oldestBall);
                                state.balls.splice(index, 1);
                                
                                // 更新這個槽的計數
                                const bin = state.bins[binIndex];
                                if (bin.userData.ballCount > 0) {
                                    bin.userData.ballCount--;
                                }
                                
                                // 調整同一槽中其他球的位置
                                const sameBinBalls = state.balls.filter(ball => 
                                    ball.settled && 
                                    Math.abs(ball.position.x - state.bins[binIndex].position.x) < 0.1
                                );
                                
                                sameBinBalls.sort((a, b) => a.position.y - b.position.y);
                                
                                for (let i = 0; i < sameBinBalls.length; i++) {
                                    const boardHeight = config.rows * config.pinSpacing;
                                    const bottomY = -boardHeight * 0.7;
                                    sameBinBalls[i].position.y = bottomY + (i * config.getBallSize() * config.ballStackOffset);
                                }
                                
                                removed = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Calculate board dimensions
    const boardWidth = config.binCount * config.pinSpacing;
    const boardHeight = config.rows * config.pinSpacing;
    
    // 针腳區域向上偏移量 - 使用配置中的值
    const pinAreaOffset = config.pinAreaOffset;
    
    // Determine start position
    const startX = (Math.random() - 0.5) * 0.2;
    // 設置球的起始位置
    const funnelPosition = boardHeight * (0.4 + pinAreaOffset);
    const startY = funnelPosition;
    const initialVelocity = new THREE.Vector3(0, 0, 0);
    
    // 創建球 - 使用自動計算的球體大小
    const ballSize = config.getBallSize();
    const hue = Math.random();
    const ballGeometry = new THREE.SphereGeometry(ballSize, 32, 32);
    const ballMaterial = new THREE.MeshPhongMaterial({ 
        color: new THREE.Color().setHSL(hue, 0.9, 0.7),
        specular: 0xffffff,
        shininess: 100,
        emissive: new THREE.Color().setHSL(hue, 0.9, 0.3),
        emissiveIntensity: 0.3
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

function onWindowResize() {
    const container = document.getElementById('container');
    const aspect = container.clientWidth / container.clientHeight;
    
    // 更新透視相機
    state.camera.aspect = aspect;
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