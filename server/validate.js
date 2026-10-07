import { Course } from '../js/Course.js';
import { RallySimulation } from '../js/Simulation.js';
import { RULES_VERSION, CARS, utcDay } from '../js/Stages.js';
import { unpackInput } from '../js/Ghost.js';
export function validateReplay(payload) {
    if(!payload||payload.version!==RULES_VERSION)throw Error('Game rules changed. Reload and race again.');
    if(typeof payload.stage!=='string'||!CARS.some(c=>c.id===payload.car))throw Error('Invalid stage or car');
    const course=new Course(payload.stage);
    if(course.definition.daily&&(payload.car!==course.definition.car||payload.stage.slice(6)>utcDay()))throw Error('Invalid daily challenge rules');
    if(!Number.isFinite(payload.time)||payload.time<=0||payload.time>3300)throw Error('Invalid race time');
    if(!Array.isArray(payload.runs)||!payload.runs.length||payload.runs.length>18000)throw Error('Missing or oversized input replay');
    let ticks=0;
    for(const run of payload.runs){
        if(!Array.isArray(run)||run.length!==7||!run.every(Number.isInteger)||run[0]<1||run[0]>18000||run[1]<0||run[1]>1000||run[2]<0||run[2]>1000||run[3]<-1000||run[3]>1000||run[4]<0||run[4]>1000||![0,1].includes(run[5])||![0,1].includes(run[6]))throw Error('Invalid input replay');
        ticks+=run[0];if(ticks>18000)throw Error('Replay exceeds five-minute driving limit');
    }
    const sim=new RallySimulation(course,payload.car),frames=[sim.snapshot()];
    for(const run of payload.runs){const input=unpackInput(run);for(let i=0;i<run[0];i++){
        if(sim.finished)throw Error('Replay contains inputs after the finish');
        sim.step(input);if(sim.ticks%6===0||input.reset)frames.push(sim.snapshot());
    }}
    if(!sim.finished||sim.gate!==course.gates.length)throw Error('Replay did not cross every gate and finish');
    if(Math.abs(sim.elapsed-payload.time)>0.001)throw Error('Submitted time does not match the simulated replay');
    frames.push(sim.snapshot());return {time:sim.elapsed,frames,splits:sim.splits,stage:payload.stage,car:payload.car,version:RULES_VERSION};
}
