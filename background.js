(async function () {
    'use strict';
    
    const PI = Math.PI;
    const TAU = 2 * PI;
    
    const SCREEN_SIZE_MULT = 8;
    const DENSITY = 1 / 1024 * (SCREEN_SIZE_MULT * SCREEN_SIZE_MULT);
    const ORB_SIZE = 256 / SCREEN_SIZE_MULT;
    const ORB_SPEED_MIN = 16 / SCREEN_SIZE_MULT;
    const ORB_SPEED_MAX = 48 / SCREEN_SIZE_MULT;
    const ORB_SPEED_MULT = ORB_SPEED_MAX - ORB_SPEED_MIN;
    const MARGIN = 0.25 * ORB_SIZE;
    const MARGIN_DOUBLE = 2 * MARGIN;
    
    function clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }
    
    function remap(val, min_a, max_a, min_b, max_b) {
        return min_b + (val - min_a) * (max_b - min_b) / (max_a - min_a);
    }
    
    function createShaderProgram(gl, vertexSource, fragmentSource) {
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(vertexShader);
        gl.compileShader(fragmentShader);
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        gl.detachShader(shaderProgram, vertexShader);
        gl.detachShader(shaderProgram, fragmentShader);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return shaderProgram;
    }
    
    async function loadImage(url) {
        const image = new Image;
        image.src = url;
        await new Promise(resolve => image.onload = resolve);
        return image;
    }
    
    const canvas = document.createElement('canvas');
    canvas.classList.add('background');
    document.body.appendChild(canvas);
    
    
    const gl = canvas.getContext('webgl');
    const ext = gl.getExtension('ANGLE_instanced_arrays');
    
    // Load texture from image
    const orbImagePromise = loadImage('/img/orb.png');
    const gaugeImagePromise = loadImage('/img/gauge.png');
    const [orbImage, gaugeImage] = await Promise.all([orbImagePromise, gaugeImagePromise]);
    
    const orbTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, orbTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, orbImage);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    const gaugeTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, gaugeTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gaugeImage);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    canvas.style.opacity = 1;
    
    const vertices = new Float32Array([
        -0.5, -0.5,
        +0.5, -0.5,
        -0.5, +0.5,
        +0.5, +0.5,
    ]);
    
    const indices = new Uint16Array([
        0, 1, 2,
        2, 1, 3,
    ]);
    
    // Instance positions
    let instancePositions = new Float32Array([]);
    
    // Create vertex buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // Create index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    
    // Create instance position buffer
    const instanceBuffer = gl.createBuffer();
    // Buffer is set in render loop
    
    const orbProgram = createShaderProgram(gl,
        /* VERTEX SHADER */ `
            attribute vec2 vpos; // Vertex position
            attribute vec2 ipos; // Instance position
            uniform vec2 size;
            varying vec2 uv;
            
            void main() {
                uv = vpos;
                gl_Position = vec4(vpos * size + ipos, 0, 1);
            }
        `,
        /* FRAGMENT SHADER */ `
            precision mediump float;
            varying vec2 uv;
            uniform sampler2D tex;
            
            void main() {
                // Get color from texture
                float r2 = uv.x * uv.x + uv.y * uv.y;
                float w = texture2D(tex, vec2(4.0 * r2, 0.5)).r;
                gl_FragColor = vec4(1.0, 1.0, 1.0, 0.0625 * w);
            }
        `,
    );
    
    {
        const vposLocation = gl.getAttribLocation(orbProgram, 'vpos');
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(vposLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vposLocation);
        
        gl.useProgram(orbProgram);
        
        const texLocation = gl.getUniformLocation(orbProgram, 'tex');
        gl.uniform1i(texLocation, 0);
    }
    
    const iposLocation = gl.getAttribLocation(orbProgram, 'ipos');
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.vertexAttribPointer(iposLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(iposLocation);
    // One ipos per instance instead of one ipos per vertex
    ext.vertexAttribDivisorANGLE(iposLocation, 1);
    
    const postProcessProgram = createShaderProgram(gl,
        /* VERTEX SHADER */ `
            attribute vec2 vpos;
            varying vec2 uv;
            
            void main() {
                uv = vpos + vec2(0.5);
                gl_Position = vec4(2.0 * vpos, 0, 1);
            }
        `,
        /* FRAGMENT SHADER */ `
            precision mediump float;
            varying vec2 uv;
            uniform sampler2D tex;
            uniform sampler2D gauge;
            uniform vec2 offset;
            
            void main() {
                float w_a = texture2D(tex, uv - vec2(offset.x, 0.0)).r;
                float w_b = texture2D(tex, uv + vec2(offset.x, 0.0)).r;
                float w_c = texture2D(tex, uv - vec2(0.0, offset.y)).r;
                float w_d = texture2D(tex, uv + vec2(0.0, offset.y)).r;
                float weight = 0.25 * (w_a + w_b + w_c + w_d);
                gl_FragColor = vec4(texture2D(gauge, vec2(weight, 0.5)).rgb, 1.0);
            }
        `,
    );
    
    {
        const vposLocation = gl.getAttribLocation(postProcessProgram, 'vpos');
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(vposLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vposLocation);
        
        gl.useProgram(postProcessProgram);
        
        const texLocation = gl.getUniformLocation(postProcessProgram, 'tex');
        gl.uniform1i(texLocation, 0);
        
        const gaugeLocation = gl.getUniformLocation(postProcessProgram, 'gauge');
        gl.uniform1i(gaugeLocation, 1);
    }
    
    const orbSizeLocation = gl.getUniformLocation(orbProgram, 'size');
    
    // Create a frame buffer and a texture used to render the orbs,
    // then the result is drawn on the canvas with post-processing
    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    let frameBufferTexture = null;
    
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    
    
    let frameBufferWidth = 1;
    let frameBufferHeight = 1;
    
    class Orb {
        constructor() {
            const angle = Math.random() * TAU;
            const speed = ORB_SPEED_MULT * Math.random() + ORB_SPEED_MIN;
            this.x = Math.random() * frameBufferWidth;
            this.y = Math.random() * frameBufferHeight;
            this.vx = speed * Math.cos(angle);
            this.vy = speed * Math.sin(angle);
        }
    }
    
    const orbs = [];
    let isTouchActive = false;
    let mouseX = 0;
    let mouseY = 0;
    let lastTime = 0;
    let mouseDownTime = 256;
    let touchEndTime = 256;
    
    resize();
    update();
    
    window.addEventListener('mousedown', ev => {
        if (touchEndTime === 0) return;
        mouseDownTime = 0;
        isTouchActive = true;
        mouseMove(ev);
    });
    window.addEventListener('mousemove', ev => {
        if (touchEndTime === 0) return;
        isTouchActive = true;
        mouseMove(ev);
    });
    window.addEventListener('touchstart', ev => {
        mouseDownTime = 0;
        isTouchActive = true;
        mouseMove(ev);
    });
    window.addEventListener('touchmove', ev => {
        isTouchActive = true;
        mouseMove(ev);
    });
    window.addEventListener('touchend', ev => {
        isTouchActive = false;
        touchEndTime = 0;
    });
    window.addEventListener('resize', resize);
    
    function mouseMove(ev) {
        let posX = 0;
        let posY = 0;
        if (ev.touches) {
            const touches = ev.touches;
            if (touches.length === 0) {
                isTouchActive = false;
                return;
            }
            for (const touch of touches) {
                posX += touch.clientX;
                posY += touch.clientY;
            }
            posX /= touches.length;
            posY /= touches.length;
        }
        else {
            posX = ev.clientX;
            posY = ev.clientY;
        }
        mouseX = posX / SCREEN_SIZE_MULT;
        mouseY = posY / SCREEN_SIZE_MULT;
    }
    
    function resize() {
        const oldWidth  = frameBufferWidth;
        const oldHeight = frameBufferHeight;
        frameBufferWidth  = Math.floor(innerWidth  / SCREEN_SIZE_MULT);
        frameBufferHeight = Math.floor(innerHeight / SCREEN_SIZE_MULT);
        // Reposition orbs
        const multW = frameBufferWidth  / oldWidth;
        const multH = frameBufferHeight / oldHeight;
        for (const orb of orbs) {
            orb.x *= multW;
            orb.y *= multH;
        }
        // Resize canvas
        canvas.width  = innerWidth;
        canvas.height = innerHeight;
        gl.useProgram(orbProgram);
        gl.uniform2f(orbSizeLocation, ORB_SIZE / frameBufferWidth, ORB_SIZE / frameBufferHeight);
        // Calculate the number of orbs to display
        const area = (frameBufferWidth + MARGIN_DOUBLE) * (frameBufferHeight + MARGIN_DOUBLE);
        const orbsCount = Math.floor(area * DENSITY);
        // Add or remove orbs
        if (orbsCount < orbs.length) {
            orbs.length = orbsCount;
        }
        while (orbs.length < orbsCount) {
            orbs.push(new Orb);
        }
        // Remove old texture from render buffer
        if (frameBufferTexture !== null) {
            gl.deleteTexture(frameBufferTexture);
            frameBufferTexture = null;
        }
        // Create new texture for render buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        frameBufferTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, frameBufferTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, frameBufferWidth, frameBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frameBufferTexture, 0);
        gl.useProgram(postProcessProgram);
        const offsetLocation = gl.getUniformLocation(postProcessProgram, 'offset');
        gl.uniform2f(offsetLocation, 1 / frameBufferWidth, 1 / frameBufferHeight);
    }
    
    function update() {
        requestAnimationFrame(update);
        const now = Date.now();
        const delta = (now - lastTime) / 1000;
        // Movement
        if (lastTime > 0) {
            let divisor = remap(clamp(mouseDownTime, 0, 1.5), 0, 1.5, 12, 96);
            let multiplier = 1;
            if (!isTouchActive) {
                multiplier = remap(touchEndTime, 0, 0.75, 1, 0);
            }
            for (const orb of orbs) {
                orb.x += orb.vx * delta;
                orb.y += orb.vy * delta;
                if (isTouchActive || touchEndTime < 0.75) {
                    const diffX = (mouseX - orb.x) * SCREEN_SIZE_MULT;
                    const diffY = (mouseY - orb.y) * SCREEN_SIZE_MULT;
                    const dist2 = diffX * diffX + diffY * diffY;
                    if (dist2 < 256 * 256) {
                        let dist = Math.sqrt(dist2);
                        if (dist > 0.0001) {
                            const speed = multiplier * (256 - dist) / (divisor * SCREEN_SIZE_MULT);
                            const angle = Math.atan2(diffY, diffX);
                            orb.x -= speed * Math.cos(angle);
                            orb.y -= speed * Math.sin(angle);
                        }
                    }
                }
                if (orb.x < -MARGIN) orb.x += frameBufferWidth + MARGIN_DOUBLE;
                else if (orb.x > frameBufferWidth + MARGIN) orb.x -= frameBufferWidth + MARGIN_DOUBLE;
                if (orb.y < -MARGIN) orb.y += frameBufferHeight + MARGIN_DOUBLE;
                else if (orb.y > frameBufferHeight + MARGIN) orb.y -= frameBufferHeight + MARGIN_DOUBLE;
            }
        }
        
        // If the buffer length doesn't match the number of orbs
        if (2 * instancePositions.length !== orbs.length) {
            instancePositions = new Float32Array(2 * orbs.length);
        }
        
        const halfW = 0.5 * frameBufferWidth;
        const halfH = 0.5 * frameBufferHeight;
        
        // Update instance positions
        for (let i = 0, len = orbs.length; i < len; i++) {
            const orb = orbs[i];
            instancePositions[2 * i + 0] = +(orb.x / halfW - 1);
            instancePositions[2 * i + 1] = -(orb.y / halfH - 1);
        }
        
        // Render
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.useProgram(orbProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, orbTexture);
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, instancePositions, gl.STATIC_DRAW);
        gl.viewport(0, 0, canvas.width / SCREEN_SIZE_MULT, canvas.height / SCREEN_SIZE_MULT);
        
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        ext.drawElementsInstancedANGLE(
            gl.TRIANGLES,
            indices.length,
            gl.UNSIGNED_SHORT,
            0,
            instancePositions.length / 2,
        );
        
        // Blit
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(postProcessProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, frameBufferTexture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, gaugeTexture);
        gl.viewport(0, 0, canvas.width, canvas.height);
        
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        
        mouseDownTime += delta;
        touchEndTime += delta;
        lastTime = now;
    }
})();
