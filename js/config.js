import { GRIP } from './Simulation.js';
export const CONFIG = {
    TRACK_WIDTH: 8,
    SURFACES: {
        TARMAC: {grip:GRIP.tarmac,sound:'tarmac',color:0x333333},
        GRAVEL: {grip:GRIP.gravel,sound:'gravel',color:0xc9b88e},
        MUD: {grip:GRIP.mud,sound:'mud',color:0x665044}
    }
};
