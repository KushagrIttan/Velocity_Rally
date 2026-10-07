import { parentPort, workerData } from 'node:worker_threads';
import { validateReplay } from './validate.js';
try{parentPort.postMessage({result:validateReplay(workerData)});}catch(error){parentPort.postMessage({error:error.message});}
