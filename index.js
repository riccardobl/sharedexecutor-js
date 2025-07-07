import SharedExecutorClient from './sharedexecutor/SharedExecutorClient.js';

const COLOR = [Math.random() * 255, Math.random() * 255, Math.random() * 255];

async function main(){
    const executor = new SharedExecutorClient('worker.js', { type: 'module', forceCompat:localStorage.getItem("sharedexecutor-demo-forceCompat") === 'true' });

    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) {
        alert('Canvas element not found!');
        return;
    }

    console.log('Canvas dimensions:', canvas.width, canvas.height);


    const ctx = canvas.getContext('2d');
    if (!ctx) {
        alert('Failed to get canvas context!');
        return;
    }
 

    let isDrawing = false;

    const draw = (x, y, rgb) => {
        console.info(`Drawing at (${x}, ${y}) with color [${rgb.join(', ')}]`);
        ctx.beginPath();
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    console.log('Registering draw method');

    executor.registerCallback('onDraw', (x, y, rgb) => {
        console.log(`Callback onDraw invoked with (${x}, ${y}) and color [${rgb.join(', ')}]`);
        draw(x, y, rgb);
    });

    
    canvas.addEventListener('mousedown', ()=>{
        isDrawing = true;
    });
    canvas.addEventListener('mousemove', (event)=>{
        if (isDrawing) {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            console.log(`Mouse moved to (${x}, ${y})`);
            executor.invoke('draw', x, y, COLOR)
                .then(result => {
                    console.log('Draw operation completed:', result);
                })
                .catch(error => {
                    console.error('Error during draw operation:', error);
                });
        }
    });
    canvas.addEventListener('mouseup', ()=>{
        isDrawing = false;
    });
    canvas.addEventListener('mouseout', ()=>{
        isDrawing = false;
    });

    // touch 
    canvas.addEventListener('touchstart', (event) => {
        isDrawing = true;
        event.preventDefault(); // Prevent default touch behavior
    });
    canvas.addEventListener('touchmove', (event) => {
        if (isDrawing) {
            const rect = canvas.getBoundingClientRect();
            const touch = event.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            console.log(`Touch moved to (${x}, ${y})`);
            executor.invoke('draw', x, y, COLOR)
                .then(result => {
                    console.log('Draw operation completed:', result);
                })
                .catch(error => {
                    console.error('Error during draw operation:', error);
                });
        }
        event.preventDefault(); // Prevent default touch behavior
    }
    );
    canvas.addEventListener('touchend', () => {
        isDrawing = false;
    });
    canvas.addEventListener('touchcancel', () => {
        isDrawing = false;
    }
    );



    const forceCompatCheckbox = document.getElementById('forceCompat');
    forceCompatCheckbox.addEventListener('change', (event) => {
        localStorage.setItem("sharedexecutor-demo-forceCompat", event.target.checked ? 'true' : 'false');
        window.location.reload();
    });
    forceCompatCheckbox.checked = !executor.isNative();
    if(!executor.isNativeSupported()){
        forceCompatCheckbox.disabled = true;
        forceCompatCheckbox.title = "Native SharedWorker is not supported in this browser. Will run in compatibility mode.";
        console.warn("SharedWorker is not supported in this browser.");
    }

    const runningMode = document.getElementById('runningMode');
    if(executor.isNative()){
        runningMode.textContent = "Using native SharedWorker";
        runningMode.style.color = 'green';
    }else{
        runningMode.textContent = "Using emulated SharedWorker (compatibility mode)";
        runningMode.style.color = 'orange';
    }
}


window.addEventListener('load', function () {
  main();
});
// const worker = new SharedWorker('worker.js', { type: 'module' });


 

// async function main(){
//     const canvas = document.getElementById('drawingCanvas');
//     if (!canvas) {
//         alert('Canvas element not found!');
//         return;
//     }

//     console.log('Canvas dimensions:', canvas.width, canvas.height);


//     const ctx = canvas.getContext('2d');
//     if (!ctx) {
//         alert('Failed to get canvas context!');
//         return;
//     }
 

//     let isDrawing = false;

//     const draw = (x, y) => {
//         console.info(`Drawing at (${x}, ${y})`);
//         ctx.fillStyle = 'black';
//         ctx.beginPath();
//         ctx.arc(x, y, 5, 0, Math.PI * 2);
//         ctx.fill();
//     }

//     worker.addEventListener('message', function (event) {
//         const data = JSON.parse(event.data);
//         if (data.type === 'callback' && data.name === 'onDraw') {
//             const [x, y, rgb] = data.args;
//             console.log(`Callback onDraw invoked with (${x}, ${y}) and color [${rgb.join(', ')}]`);
//             draw(x, y);
//         }
//     });
    

//     canvas.addEventListener('mousedown', ()=>{
//         isDrawing = true;
//     });
//     canvas.addEventListener('mousemove', (event)=>{
//         if (isDrawing) {
//             const rect = canvas.getBoundingClientRect();
//             const x = event.clientX - rect.left;
//             const y = event.clientY - rect.top;
//             worker.postMessage(JSON.stringify({
//                 type: 'invoke',
//                 method: 'draw',
//                 args: [
//                     x,y,[Math.random() * 255, Math.random() * 255, Math.random() * 255]
//                 ],
//                 invkId: Math.random().toString(36).substring(2, 15)+Date.now()
//             }));
//         }
//     });
//     canvas.addEventListener('mouseup', ()=>{
//         isDrawing = false;
//     });
//     canvas.addEventListener('mouseout', ()=>{
//         isDrawing = false;
//     });
// }


// window.addEventListener('load', function () {
//   main();
// });