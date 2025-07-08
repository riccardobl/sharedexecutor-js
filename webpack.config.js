const path = require('path');

module.exports = {
    mode: 'production',
    entry: './sharedexecutor/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'sharedexecutor.js',
        library: {
            name: 'SharedWorkerCompat',
            type: 'umd',
            export: 'default',
        },
        globalObject: 'this',
    },
    optimization: {
        minimize: false
    }
};