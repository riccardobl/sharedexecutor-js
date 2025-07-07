class SharedWorkerCompatBackend {
    constructor(callback) {
        // Constants
        this.HEARTBEAT_INTERVAL = 400;
        this.HEARTBEAT_TIMEOUT = 2000;
        this.INVOKATIONS_TIMEOUT = 1200;
        this.INVOKATIONS_ATTEMPTS = 12;
        this.WARMUP_TIME = 1000;
        this.STARTUP_TIME = Date.now();


        // Counter for generating IDs
        this.counter = 0;

        // Initialize self
        this.self = {
            id: this.getId(),
            lastSeen: Date.now(),
            isSelf: true,
            isMaster: false
        };

        // Initialize collections
        this.slaveTable = [this.self];
        this.registeredMethods = {};
        this.invokations = {};

        this.callbacks = {};

        // State tracking
        this.onElection = callback;
        this.isMaster = false;

        
        console.log("Fallback to shared workers emulation");
        // Channel for communication
        this.channel = new BroadcastChannel('nge-sharedworker-compat');
        // Set up event handlers
        this.channel.onmessage = this.handleMessage.bind(this);

        // Start heartbeat interval
        this.heartbeatInterval = setInterval(() => this.update(), this.HEARTBEAT_INTERVAL);  

        this.readyPromise = new Promise((resolve) => {
            this.readyResolve = resolve;
        });
        

    }

    postMessageToMainThread(message) {
        self.postMessage(message);
    }

    addMainThreadMessageListener( callback) {
        self.addEventListener('message', callback);
    }

    ready() {
        return this.readyPromise;
    }


    getId() {
        let counter;
        try {
            counter = parseInt(localStorage.getItem('nge-sharedworker-compat-counter') || '0', 10);
            counter++;
            localStorage.setItem('nge-sharedworker-compat-counter', counter.toString());
        } catch (e) {
            // Fallback if localStorage is not available
            counter = Date.now();
        }
        return counter;
    }


    randomId() {
        return (this.counter++) + "-" + Math.random() + "-" + Date.now();
    }


    getMaster() {
        return this.slaveTable.find(slave => slave.isMaster);
    }


    async update() {
        this.channel.postMessage({ type: 'heartbeat', from: this.self.id });
        if (Date.now() - this.STARTUP_TIME < this.WARMUP_TIME) {
            // Skip updates during warmup period
            return;
        }

        // Clean up disconnected clients
        for (let i = 0; i < this.slaveTable.length; i++) {
            const slave = this.slaveTable[i];
            if (slave.isSelf) continue; // skip self
            if (Date.now() - slave.lastSeen > this.HEARTBEAT_TIMEOUT) {
                // console.log(`Slave ${slave.id} timed out.`);
                this.slaveTable.splice(i, 1);
                i--;
            }
        }

        // Clean up timed out callbacks
        for (const [i, invokation] of Object.entries(this.invokations)) {
            if (Date.now() - invokation.timestamp > this.HEARTBEAT_TIMEOUT) {
                console.warn(`Invokation ${i} timed out.`);
                invokation.rej(new Error('Callback timed out'));
                delete this.invokations[i];
            }
        }

        // Elect master (lowest ID wins)
        this.slaveTable.sort((a, b) => a.id - b.id);
        for (let i = 0; i < this.slaveTable.length; i++) {
            if (i === 0) {
                this.slaveTable[i].isMaster = true;
            } else {
                this.slaveTable[i].isMaster = false;
            }
        }



        // Notify on master status changes
        if (this.isMaster !== this.self.isMaster) {
            if (this.onElection) {
                this.onElection(this.self.isMaster);
            }
            this.isMaster = this.self.isMaster;
        }

        for (const [id, invokation] of Object.entries(this.invokations)) {
            if (this.self.isMaster) {
                invokation.lastTry = Date.now(); // Reset last try if master

                try {
                    const p = this.registeredMethods[invokation.method](...invokation.args);

                    if (p && typeof p.then === 'function') {
                        p.then(res => {
                            invokation.res(res);
                        }).catch(err => {
                            invokation.rej(err);
                        });
                    } else {
                        invokation.res(p);
                    }
                } catch (error) {
                    invokation.rej(error);
                }

                delete this.invokations[id];
            }
            if (Date.now() - invokation.lastTry > this.INVOKATIONS_TIMEOUT) {
                if (invokation.attempt < this.INVOKATIONS_ATTEMPTS) {
                    invokation.attempt++;
                    invokation.lastTry = Date.now();
                    this.channel.postMessage({
                        type: 'invoke',
                        method: invokation.method,
                        args: invokation.args,
                        invkId: id
                    });
                } else {
                    console.error(`Invokation ${id} failed after ${this.INVOKATIONS_ATTEMPTS} attempts.`);
                    invokation.rej(new Error('Invokation failed after retries'));
                    delete this.invokations[id];
                }
            }
        }

        this.readyResolve();
    }

    /**
     * Handle incoming messages
     */
    async handleMessage(e) {

        const msg = e.data;

        if (msg.type === 'heartbeat') {
            const date = Date.now();
            const id = msg.from;

            // Update existing client or add new one
            for (const slave of this.slaveTable) {
                if (slave.id === id) {
                    slave.lastSeen = date;
                    return;
                }
            }

            // New client
            this.slaveTable.push({ id, lastSeen: date, isSelf: false, isMaster: false });
            this.update();
        }
        else if (msg.type === 'invoke') {
            const { method, args, invkId } = msg;
            if (this.self.isMaster) {
                // console.log(`Invoking method ${method} with args`, args);
                const methodFunction = this.registeredMethods[method];
                if (methodFunction) {
                    try {
                        const result = await methodFunction(...args);
                        this.channel.postMessage({
                            type: 'result',
                            method,
                            result,
                            invkId
                        });
                    } catch (error) {
                        this.channel.postMessage({
                            type: 'result',
                            method,
                            error: error.message,
                            invkId
                        });
                    }
                }
            }
        }
        else if (msg.type === 'result') {
            const { method, result, error, invkId } = msg;
            if (this.invokations[invkId]) {
                if (error) {
                    this.invokations[invkId].rej(new Error(error));
                } else {
                    this.invokations[invkId].res(result);
                }
                delete this.invokations[invkId];
                // console.log(`Invokation ${invkId} completed for method ${method}`);

            } else {
                console.warn(`No invokation found for ${invkId}`);
            }
        } else if (msg.type === 'callback') {
            const { name, args } = msg;
            if (this.callbacks[name]) {
                try {
                    this.callbacks[name](...args);
                } catch (error) {
                    console.error(`Error in callback ${name}:`, error);
                }
            } else {
                console.warn(`No callback registered for ${name}`);
            }
        }
    }


    async invoke(method, args) {
        return new Promise((res, rej) => {
            const invkId = this.self.id + "-" + this.randomId();

            this.invokations[invkId] = {
                method,
                args,
                res: (result) => {
                    res(result);
                },
                rej: (error) => {
                    rej(error);
                },
                timestamp: Date.now(),
                lastTry: 0,
                attempt: 0
            };

            this.update();
        });
    }

    triggerCallback(callbackName, ...args) {
        if(this.isMaster){
            // console.log(`Triggering callback ${callbackName} with args`, args);
            this.channel.postMessage({ type: 'callback', name: callbackName, args });
            this.callbacks[callbackName](...args);
        }
    }

    registerCallback(callbackName, callbackFunction) {
        this.callbacks[callbackName] = callbackFunction;
    }

    unregisterCallback(callbackName) {
        delete this.callbacks[callbackName];
    }

    registerMethod(methodName, methodFunction) {
        this.registeredMethods[methodName] = methodFunction;
    }




    close() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.channel.close();
    }
}

export default SharedWorkerCompatBackend;