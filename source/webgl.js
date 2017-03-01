/* Compatibility */
(function() {
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
})();

class WebGL {
    constructor(canvasId, fragmentShaderId, fullscreen, maxLength=0.0) {
        this.canvas = document.getElementById(canvasId);
        this.gl = this.canvas.getContext("experimental-webgl");
        this.audio = null;
        this.maxLength = maxLength;

        let shaderToyPrefix = "precision mediump float; uniform vec3 iResolution; uniform float iGlobalTime;\n ";
        let shaderToySuffix = "\nvoid main() { vec4 color = vec4(0.0); mainImage(color, gl_FragCoord.xy); gl_FragColor = color; }"

        let vertexShader = "attribute vec4 aPosition; void main() { gl_Position = aPosition; } ";
        let fragmentShader = shaderToyPrefix + WebGL.loadShader(fragmentShaderId) + shaderToySuffix;

        this.shader = WebGL.linkShader(this.gl, vertexShader, fragmentShader);        
        this.shader.vertexAttribute = this.gl.getAttribLocation(this.shader, "aPosition");
        this.gl.enableVertexAttribArray(this.shader.vertexAttribute);

        if (fullscreen) {
            this.height = window.innerHeight - 20;
            this.width = window.innerWidth - 20;
        } else {
            this.width = parseInt(this.canvas.getAttribute('width'));
            this.height = parseInt(this.canvas.getAttribute('height'));
        }
        this.canvas.setAttribute('width', this.width);
        this.canvas.setAttribute('height', this.height);

        this.vertexBuffer = WebGL.createVBO(this.gl, 3, [ 1.0,  1.0,  0.0, -1.0,  1.0,  0.0, 1.0, -1.0,  0.0, -1.0, -1.0,  0.0 ]);        
        this.running = false;
        this.time0 = 0.0;
        this.refresh_audio = false;

        window.addEventListener("keydown", (event) => {
            if (event.keyCode == 32) {
                event.preventDefault();
                if (this.running) {
                    this.stop();
                } else {
                    this.start();
                }
            } 
            var now = WebGL.getTime();
            if (event.keyCode == 37) {
                this.time0 = Math.min(this.time0, now);
                this.refresh_audio = true;
            }
            if (event.keyCode == 39) {
                this.time0 -= 1.0;
                this.refresh_audio = true;
            }
        });
    }

    loadMusic(elementId, runWhenLoaded) {
        this.audio = document.getElementById(elementId);
        if (runWhenLoaded) {
            this.audio.oncanplay = () => this.start();
        } 
        this.audio.load();
    }

    start() {
        if (this.running) {
            return;
        }

        if (this.audio != null) {
            this.audio.play();
        }

        this.running = true;
        this.time0 = WebGL.getTime();
        this.timePreviousFrame = this.time0;

        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.viewport(0, 0, this.width, this.height);
        this.gl.useProgram(this.shader);

        this._frame(this.gl);
    }

    stop() {
        this.running = false;

        if (this.audio != null) {
            this.audio.pause();
        }
    } 

    _frame(gl) {
        if (!this.running) {
            return;
        }

        let shader = this.shader;
        let time = WebGL.getTime() - this.time0;
        let dt = time - this.timePreviousFrame;
        this.timePreviousFrame = time;

        if (this.refresh_audio && this.audio) {
            this.audio.currentTime = time;     
            this.refresh_audio = false;       
        }

        if (this.maxLength > 0.0 && time > this.maxLength) {
            this.stop();
            return;
        }

        gl.clear(gl.DEPTH_BUFFER_BIT);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(shader.vertexAttribute, this.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

        // update uniforms        
        gl.uniform3f(gl.getUniformLocation(shader, "iResolution"), this.width, this.height, 0.);
        gl.uniform1f(gl.getUniformLocation(shader, "iGlobalTime"), time);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.vertexBuffer.numItems);

        requestAnimationFrame(() => this._frame(gl));
    }

    static createVBO(gl, stride, vertexData) {
        var vertexBuffer = gl.createBuffer();    
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);        
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData), gl.STATIC_DRAW);
        vertexBuffer.itemSize = stride;
        vertexBuffer.numItems = vertexData.length / stride;
        return vertexBuffer;
    }

    static linkShader(gl, vertexSource, fragmentSource) {
        var program = gl.createProgram();
        gl.attachShader(program, WebGL.compileShader(gl, gl.VERTEX_SHADER, vertexSource));
        gl.attachShader(program, WebGL.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            WebGL.showLog(gl, program);
            throw `Failed to link shader!`;
        }

        program.uniformLocation = (gl, name) => gl.getUniformLocation(program, name);

        return program;
    }

    static compileShader(gl, shaderType, source) {
        var shader = gl.createShader(shaderType);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            let type = shaderType == gl.VERTEX_SHADER ? 'vertex shader' : 'fragment shader';
            WebGL.showLog(gl, shader);
            throw `Failed to compile ${type}`;
        }
        return shader;
    }

    static loadShader(elementId) {
        console.log("Loading shader from #" + elementId);
        let node = document.getElementById(elementId);
        if (node == null) {
            throw `Can't find element with id ${elementId}`;
        }

        var content = "";
        var n = node.firstChild;
        while (n) {
            if (n.nodeType == 3) content += n.textContent;
            n = n.nextSibling;
        }

        return content;
    }

    static showLog(gl, shader) {
        var compilationLog = gl.getShaderInfoLog(shader);
        console.log('ERROR: ' + compilationLog);        
    }

    static getTime() {
        return 0.001 * new Date().getTime();
    }
}