import SharedExecutor from './sharedexecutor/SharedExecutor.js';


const executor = new SharedExecutor(async (isMaster) => {
    if (isMaster) {
        console.log("Master worker started");
    } else {
        console.log("Worker connected to master");
    }
});

executor.bindToClient();
executor.registerMethod('draw', (...args) => {
    const [x, y, rgb] = args;
    executor.triggerCallback('onDraw', x, y, rgb);
}); 

 

