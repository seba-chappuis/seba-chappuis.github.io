(function () {
    'use strict';

    // Colors
    const COLOR_PATH = '#CCC';
    const COLOR_START = '#51AAF5';
    const COLOR_END = '#A5F74D';
    const COLOR_RESOLVED_PATH = 'crimson';
    const COLOR_CURRENT_PROGRESS = "#A14DF7"

    // Directions
    const DIR_TOP    = 0;
    const DIR_LEFT   = 1;
    const DIR_RIGHT  = 2;
    const DIR_BOTTOM = 3;

    // Convert a direction to its opposite
    const DIR_TO_OPPOSITE_DIR_LOOKUP = [
        /* DIR_TOP    --> */ DIR_BOTTOM,
        /* DIR_LEFT   --> */ DIR_RIGHT,
        /* DIR_RIGHT  --> */ DIR_LEFT,
        /* DIR_BOTTOM --> */ DIR_TOP,
    ];

    // Convert a direction to an unit vector
    const DIR_TO_RELATIVE_COORD_LOOKUP = [
        /* DIR_TOP    --> */ [ 0, -1],
        /* DIR_LEFT   --> */ [-1,  0],
        /* DIR_RIGHT  --> */ [+1,  0],
        /* DIR_BOTTOM --> */ [ 0, +1],
    ];

    // Animation speed (delay between each frames (0 is the normal frame rate))
    const ANIMATION_SPEED = [1000, 750, 500, 250, 200, 150, 100, 50, 0];
    

    class Node {

        constructor(x, y) {

            this.x = x;
            this.y = y;
            this.nighs = [null, null, null, null];
            this.metBy = null;
            this.isVisited = false;
        }

        // Link to nodes together
        addEdge(dir, target) {

            const oppositeDir = DIR_TO_OPPOSITE_DIR_LOOKUP[dir];
            this.nighs[dir] = target;
            target.nighs[oppositeDir] = this;
        }

        // Check if the target node is linked to this node
        isLinkedTo(target) {

            for (let nigh of this.nighs) {

                if (nigh === target) {
                    return true;
                }
            }

            return false;
        }

        // Do a breath-first search starting from the current node
        // and ending to the given node, the state of the affected nodes
        // will be updated
        breadthFirstSearch(endingNode) {

            const queue = [];

            queue.push(this);

            while (queue.length > 0) {

                const node = queue.shift();
                node.isVisited = true;

                if (node === endingNode) return queue;

                for (let nigh of node.nighs) {

                    if (!nigh) continue;
                    if (nigh.metBy || nigh.isVisited) continue;

                    nigh.metBy = node;
                    queue.push(nigh);
                }
            }

            return null;
        }

        // Reset the state previously modified by the breathFirstSearch() method
        resetState() {
            this.metBy = null;
            this.isVisited = false;
        }
    }

    // Global variables

    let maze = [];
    let shortestPath = [];
    let radius = 0;
    let innerRadius = 0;
    let diameter = 0;
    let nodeSize = 20;
    let nbExtraPaths = 0;
    let startingNode = null;
    let endingNode = null;
    let genPathTraveled = 0;

    let mazeResolved = false;

    let promiseReject = null;

    // - For animation
    let isAsyncMode = false;
    let animFrameId = 0;
    let generationAnimationSpeed = 0;
    let resolveAnimationSpeed = 0;
    let currentGenAnimationNode = null; // Used for the coloration when generating the maze
    let currentProgress = 0;
    let showSolution = false;

    // - For export
    let mazeId = 0;

    // HTML elements

    const mazeWrapper = document.getElementById('lps-canvas-wrapper');

    const canvas = document.getElementById('lps-canvas');
    const ctx = canvas.getContext('2d');

    // HTML inputs

    // - Generation
    const inputRadius = document.getElementById('lps-input-radius');
    const inputInnerRadius = document.getElementById('lps-input-inner-radius');
    const inputPathsDensity = document.getElementById('lps-input-paths-density');
    const buttonRegenerate = document.getElementById('lps-button-regenerate');

    // - Animation
    const inputShowSolution = document.getElementById('lps-input-show-solution');
    const inputPreviewType = document.getElementById('lps-input-preview-type');
    const inputGenerationSpeed = document.getElementById('lps-input-generation-speed');
    const inputResolveSpeed = document.getElementById('lps-input-resolve-speed');
    const labelGenTraveledDist = document.getElementById('lps-path-length-traveled');
    const labelShortestDist = document.getElementById('lps-shortest-resolve-distance');

    // - Export
    const link = document.getElementById('lps-link');
    const exportUnresolvedToPng = document.getElementById('lps-export-unresolved-png');
    const exportResolvedToPng = document.getElementById('lps-export-resolved-png');
    const exportUnfinishedToPng = document.getElementById('lps-export-unfinished-png');

    // Events

    window.addEventListener('resize', resize);

    // - Generation
    inputRadius.addEventListener('input', generateMaze);
    inputInnerRadius.addEventListener('input', generateMaze);
    inputPathsDensity.addEventListener('input', generateMaze);
    buttonRegenerate.addEventListener('click', generateMaze);

    // - Animation
    inputShowSolution.addEventListener('change', ev => {
        showSolution = inputShowSolution.checked;
        if (!showSolution) currentProgress = 0;
        showSolutionAnimationIfNeeded();
    });

    inputPreviewType.addEventListener('input', ev => {
        isAsyncMode = (inputPreviewType.value === 'show-progress');
    });

    inputGenerationSpeed.addEventListener('input', ev => {
        generationAnimationSpeed = ANIMATION_SPEED[inputGenerationSpeed.value];
    });
    inputResolveSpeed.addEventListener('input', ev => {
        resolveAnimationSpeed = ANIMATION_SPEED[inputResolveSpeed.value];
    });

    // - Export
    exportUnresolvedToPng.addEventListener('click', ev => {
        // Redraw the maze without the resolved path
        redraw(false);

        // Export the canvas to a PNG
        saveCanvasToPng(`lps${mazeId}_unresolved.png`);

        // Redraw like it was before
        redraw(); // To avoid flicker
    });

    exportResolvedToPng.addEventListener('click', ev => {

        // Save resolution animation state
        let saveProgress = currentProgress;
        if (!showSolution) {
            // Set the resolution as "ended" to display it full
            currentProgress = shortestPath.length - 1;
            redraw(true)
        }

        saveCanvasToPng(`lps${mazeId}_resolved.png`);

        if (!showSolution) {
            // Restore the resolve animation
            currentProgress = saveProgress;
            redraw(); // To avoid flicker
        }
    });

    exportUnfinishedToPng.addEventListener('click', ev => {
        saveCanvasToPng(`lps${mazeId}_unfinished.png`);
    });

    // Default value 
    // (not radius or other, because they called the generation instead of directly setted values)
    showSolution = inputShowSolution.checked;
    isAsyncMode = (inputPreviewType.value === 'show-progress');
    generationAnimationSpeed = ANIMATION_SPEED[inputGenerationSpeed.value];
    resolveAnimationSpeed = ANIMATION_SPEED[inputResolveSpeed.value];


    // Functions

    generateMaze();
    // Generate the full maze (with animation)
    async function generateMaze() {

        onGenerationStart();

        mazeId++;

        mazeResolved = false;
        shortestPath = [];

        startingNode = null;
        endingNode = null;
        currentGenAnimationNode = null;
        genPathTraveled = 0;

        radius = +inputRadius.value;
        innerRadius = radius * (inputInnerRadius.value / 100) | 0;
        const areaOuter = Math.PI * radius ** 2;
        const areaInner = Math.PI * innerRadius ** 2;
        const density = inputPathsDensity.value / 100;
        nbExtraPaths = (areaOuter - areaInner) * density;

        diameter = 2 * radius + 1;

        maze = new Array(diameter ** 2).fill(null);

        const startingX = 0;
        const startingY = diameter / 2 | 0;

        const endingX = diameter - 1;
        const endingY = diameter / 2 | 0;

        const fromX = diameter / 2 | 0;
        const fromY = 0;

        const history = [];

        history.push(createNodeInMaze(fromX, fromY));

        resize();

        while (true) {

            if (history.length === 0) {
                break;
            }

            const node = history[history.length - 1];
            const x = node.x;
            const y = node.y;

            const freeSpacesCoord = [];

            for (let dir = 0; dir < 4; dir++) {

                const [relX, relY] = DIR_TO_RELATIVE_COORD_LOOKUP[dir];
                const targetX = x + relX;
                const targetY = y + relY;

                if (checkSpaceFree(targetX, targetY)) {
                    freeSpacesCoord.push([dir, targetX, targetY]);
                }
            }

            genPathTraveled++;
            // Animation is placed here insted after check "freeSpaceCoord" length, to see the "history" deplacement
            if (generationAnimationSpeed > 0 || 
                (generationAnimationSpeed === 0 && freeSpacesCoord.length > 0)
            ) { // Checking anim. speed because we don't display the history movement at speed 0
                currentGenAnimationNode = node;
                redrawIfNeeded();
                if (isAsyncMode) {
                    labelGenTraveledDist.innerText = genPathTraveled;
                    await waitNextFrame(generationAnimationSpeed);
                }
            }


            if (freeSpacesCoord.length === 0) {

                history.pop();
                continue;
            }

            const [dir, newX, newY] = getRandomValue(freeSpacesCoord);
            const newNode = createNodeInMaze(newX, newY);

            node.addEdge(dir, newNode);
            history.push(newNode);
        }

        await addRandomExtraPaths(nbExtraPaths);

        currentGenAnimationNode = null;

        startingNode = getNodeAt(startingX, startingY);
        endingNode = getNodeAt(endingX, endingY);

        onGenerationEnd();
    }


    // Resolve the maze
    function resolveMaze() {

        startingNode.breadthFirstSearch(endingNode);

        let prevNode = endingNode;

        shortestPath = [endingNode];

        while (prevNode) {
            shortestPath.push(prevNode);
            prevNode = prevNode.metBy;
        }

        shortestPath.reverse();

        for (let node of maze) {
            if (node) node.resetState();
        }

        mazeResolved = true;

        onResolveEnd();
    }


    // Update the visual progress corresponding to the shortest path to take
    async function updateVisualProgress() {
        currentProgress = 0;
        const totalProgress = shortestPath.length - 1;

        let previousDrawTime = Date.now();
        let duration = previousDrawTime;

        do {
            if (!showSolution) return;
            
            if (!isAsyncMode) {
                currentProgress = totalProgress;
                break;
            }


            duration = Date.now() - previousDrawTime;

            // ++ to avoid division by 0
            if (resolveAnimationSpeed == 0) resolveAnimationSpeed++;

            currentProgress += duration / resolveAnimationSpeed;

            previousDrawTime = Date.now();

            redrawIfNeeded();
            await waitNextFrame();

        } while (currentProgress < totalProgress);

        redraw();

        onResolveAnimationEnd();
    }


    // Resize the canvas and redraw its content
    function resize() {

        const nbTiles = 2 * diameter + 1;
        const rect = mazeWrapper.getBoundingClientRect();

        let canvasWidth = (rect.width < rect.height ? rect.width : rect.height);

        nodeSize = canvasWidth / nbTiles | 0;

        canvasWidth = nodeSize * nbTiles;

        canvas.width  = nodeSize * nbTiles;
        canvas.height = nodeSize * nbTiles;

        redraw();
    }


    // Redraw the canvas if the async mode is set to true
    function redrawIfNeeded() {
        if (isAsyncMode) {
            redraw();
        }
    }


    // Redraw the whole canvas
    function redraw(withResolvedPath = true) {

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw labyrinth path
        // -  Path
        for (let y = 0; y < diameter; y++) {
            for (let x = 0; x < diameter; x++) {

                const node = getNodeAt(x, y);

                if (!node) continue;

                if (node === startingNode || node === endingNode) {
                    // for drawing start and end after the path (better visual)
                    continue;
                }

                drawNode(node)
            }
        }

        // - Start and end
        if (startingNode) drawNode(startingNode);
        if (endingNode) drawNode(endingNode);

        // Draw the path resolution
        if (withResolvedPath) {
            drawPath();
        }
    }

    // Draw a node (with his path to the next node) at the correct coordinates in the canvas
    function drawNode(node) {
        const [pxX, pxY] = nodeCoordToPxCoordTopLeft(node.x, node.y);

        let marginX = 0;
        let marginY = 0;

        if (node === startingNode || node === endingNode) {
            marginX = nodeSize / 2 | 0;
            marginY = nodeSize / 2 | 0;
        }

        ctx.fillStyle = COLOR_PATH;



        for (let dir = 0; dir < 2; dir++) {

            if (!node.nighs[dir]) {
                continue;
            }

            const [relX, relY] = DIR_TO_RELATIVE_COORD_LOOKUP[dir];

            const targetPxX = pxX + relX * nodeSize;
            const targetPxY = pxY + relY * nodeSize;

            ctx.fillRect(targetPxX, targetPxY, nodeSize, nodeSize);
        }

        if (node === startingNode) {
            ctx.fillStyle = COLOR_START;
        } else if (node === endingNode) {
            ctx.fillStyle = COLOR_END;
        } else if (node == currentGenAnimationNode && generationAnimationSpeed > 0) { // Checking anim. speed to avoid useless flickering
            ctx.fillStyle = COLOR_CURRENT_PROGRESS;
        }

        ctx.fillRect(pxX - marginX, pxY - marginY, nodeSize + 2 * marginX, nodeSize + 2 * marginY);
    }

    // Draw the shortest path in the maze
    function drawPath() {
        ctx.strokeStyle = COLOR_RESOLVED_PATH;
        ctx.lineWidth = nodeSize;

        let i = 0;

        if (shortestPath.length === 0) return;

        const firstNode = shortestPath[0];

        let [prevPxX, prevPxY] = nodeCoordToPxCoordCenter(firstNode.x, firstNode.y);

        ctx.beginPath();

        for (let node of shortestPath) {

            if (i >= currentProgress + 1) break;

            let [pxX, pxY] = nodeCoordToPxCoordCenter(node.x, node.y);

            if (node === startingNode) {
                ctx.moveTo(pxX, pxY);
            }
            else if (currentProgress >= i) {
                ctx.lineTo(pxX, pxY);
            }
            else {
                const weight = i - currentProgress;
                const [deltaPxX, deltaPxY] = interpolatePoints(pxX, pxY, prevPxX, prevPxY, weight);
                ctx.lineTo(deltaPxX, deltaPxY);
            }

            prevPxX = pxX;
            prevPxY = pxY;

            i++;
        }

        ctx.stroke();
    }


    // Add the specified number of extra paths (extra connections) to the maze
    async function addRandomExtraPaths(nbExtraPaths) {
        let allNodes = maze.filter(node => node !== null && node.nighs.some(nigh => nigh === null));


        while (nbExtraPaths > 0) {

            const node = getRandomValue(allNodes);

            // get a possible direction for this node
            const possibleDir = getAllIndexes(node.nighs, null);
            let dir = getRandomValue(possibleDir);

            const [relX, relY] = DIR_TO_RELATIVE_COORD_LOOKUP[dir];

            const targetX = node.x + relX;
            const targetY = node.y + relY;

            const target = getNodeAt(targetX, targetY);

            // Target can be null if the it is outside the maze
            if (target && !node.isLinkedTo(target)) {
                node.addEdge(dir, target);

                // To avoid infinity loop, we update the list without the node which have all nighs connected
                allNodes = maze.filter(node => node !== null && node.nighs.some(nigh => nigh === null));

                currentGenAnimationNode = node;
                nbExtraPaths--;

                redrawIfNeeded();
                await waitNextFrame(generationAnimationSpeed);
            }
        }
    }


    // Check if the space at the specified coordinate
    // can be used to create a new node on it
    function checkSpaceFree(x, y) {

        const x0 = x - radius;
        const y0 = y - radius;

        if (x < 0 || x >= diameter || y < 0 || y >= diameter) return false;

        if (Math.sqrt(x0 ** 2 + y0 ** 2) > radius + 1 / 3) return false;

        if (Math.sqrt(x0 ** 2 + y0 ** 2) < innerRadius - 2 / 3) return false;

        const node = getNodeAt(x, y);

        return node === null;
    }


    // Convert a coordinate to an index for the maze variable
    function coordToIndex(x, y) {
        return y * diameter + x;
    }


    // Get a node from the maze at the specified coordinate,
    // or null if none is presents here
    function getNodeAt(x, y) {

        if (x < 0 || x >= diameter) return null;
        if (y < 0 || y >= diameter) return null;

        return maze[coordToIndex(x, y)];
    }


    // Create a new node in the specified coordinate in the maze
    function createNodeInMaze(x, y) {

        const node = new Node(x, y);
        maze[coordToIndex(x, y)] = node;

        return node;
    }


    // Convert the coordinate of a node to
    // the pixel coordinate (top left corner of the node)
    function nodeCoordToPxCoordTopLeft(x, y) {
        return [
            nodeSize * (2 * x + 1),
            nodeSize * (2 * y + 1),
        ];
    }


    // Convert the coordinate of a node to
    // the pixel coordinate (center of the node)
    function nodeCoordToPxCoordCenter(x, y) {
        return [
            nodeSize * (2 * x + 1) + nodeSize / 2,
            nodeSize * (2 * y + 1) + nodeSize / 2,
        ];
    }


    // Do a linear interpolation between two points
    // with the specified weight
    function interpolatePoints(x1, y1, x2, y2, weight) {
        return [
            x1 + weight * (x2 - x1),
            y1 + weight * (y2 - y1),
        ]
    }


    // Get a random value from the given array
    function getRandomValue(array) {
        return array[Math.random() * array.length | 0];
    }

    // Get each index where the value is found in the array
    // Source :https://stackoverflow.com/questions/20798477/how-to-find-index-of-all-occurrences-of-element-in-array 
    function getAllIndexes(array, value) {
        let indexes = [], i = -1;
        while ((i = array.indexOf(value, i+1)) != -1){
            indexes.push(i);
        }
        return indexes;
    }

    // Return a promise which is resolved the next frame (async mode only)
    async function waitNextFrame(animationSpeed = 0) {
        if (isAsyncMode) {

            if (animationSpeed > 0) {
                await new Promise((resolve, reject) => {
                    promiseReject = reject;
                    setTimeout(resolve, animationSpeed);
                });
            }

            return new Promise((resolve, reject) => {
                promiseReject = reject;
                animFrameId = requestAnimationFrame(resolve);
            });
        }

        return Promise.resolve();
    }

    async function saveCanvasToPng(name = 'LPS-maze.png') {
        link.download = name;
        link.href = canvas.toDataURL();
        link.click();
    }

    // Display the export buttons according if the maze animation is finished or not
    function exportButtonVisibility(isGenerationFinished, isResolveFinished) {

        const generationFinishedElements = document.querySelectorAll(".export-generation-finished");
        const resolveFinishedElements = document.querySelectorAll(".export-resolve-finished");
        const unfinishedElements = document.querySelectorAll(".export-unfinished");

        if (isGenerationFinished) {
            generationFinishedElements.forEach(e => e.classList.remove("lps-hidden"));
            unfinishedElements.forEach(e => e.classList.add("lps-hidden"));
        } else {
            generationFinishedElements.forEach(e => e.classList.add("lps-hidden"));
            unfinishedElements.forEach(e => e.classList.remove("lps-hidden"));
        }

        if (isResolveFinished) {
            resolveFinishedElements.forEach(e => e.classList.remove("lps-hidden"));
        } else {
            resolveFinishedElements.forEach(e => e.classList.add("lps-hidden"));
        }
    }

    function onGenerationStart() {
        exportButtonVisibility(false, false);

        cancelAnimationFrame(animFrameId);
        animFrameId = 0;
        if (promiseReject) promiseReject();
        promiseReject = null;
    }

    function onGenerationEnd() {
        redrawIfNeeded();
        labelGenTraveledDist.innerText = genPathTraveled;
        resolveMaze();
    }

    function onResolveEnd() {
        labelShortestDist.innerText = shortestPath.length - 1 - 1; // 2nd -1 is to exclude the start node
        showSolutionAnimationIfNeeded();
    }

    function onResolveAnimationEnd() {
        exportButtonVisibility(true, true);
    }

    // start the resolve animation if enable and display export buttons for resolution
    function showSolutionAnimationIfNeeded() {
        if (!mazeResolved) {
            exportButtonVisibility(false, false);
        } else if (showSolution) {
            exportButtonVisibility(true, false);
            updateVisualProgress();
        } else {
            exportButtonVisibility(true, true);
            redraw(false);
        }
    }
})();
