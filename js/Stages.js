// Course and vehicle rules shared by the game and replay-validation server.
export const RULES_VERSION = 'rally-2.0.0';
export const STEP = 1 / 60;
export const CARS = [
    { id: 'scout', name: 'Scout 1600', tag: 'FORGIVING · FWD', description: 'Light, planted and easy to recover. Learn the line.', power: 10.5, maxSpeed: 39, grip: 1.14, turn: 0.52, color: 0x3bafa1 },
    { id: 'comet', name: 'Comet Turbo', tag: 'BALANCED · AWD', description: 'More punch with dependable grip. Chase your best.', power: 12.4, maxSpeed: 44, grip: 1.02, turn: 0.56, color: 0xe4a449 },
    { id: 'lynx', name: 'Lynx RS', tag: 'PLAYFUL · RWD', description: 'Fast and loose. Manage the throttle through slides.', power: 14, maxSpeed: 47, grip: 0.86, turn: 0.60, color: 0xd16e52 }
];
// Blocks describe distance, total turn (degrees; negative = left), and visible surface.
export const STAGES = [
    { id: 'school', name: 'First Tracks', subtitle: 'Learn the rhythm', region: 'DRIVING SCHOOL', difficulty: 'Training', timeOfDay: 0, medals: [30, 42, 60], blocks: [[100,0,'tarmac'],[110,-35,'tarmac'],[100,45,'tarmac'],[100,0,'gravel'],[120,-50,'gravel'],[90,0,'tarmac']] },
    { id: 'fern', name: 'Fern Valley', subtitle: 'Find your flow', region: 'THE FOREST RUN', difficulty: 'Easy', timeOfDay: 0, medals: [56, 70, 95], blocks: [[140,0,'tarmac'],[140,-50,'tarmac'],[130,55,'tarmac'],[100,0,'tarmac'],[170,-65,'gravel'],[130,45,'gravel'],[120,0,'gravel'],[150,65,'tarmac'],[120,-40,'tarmac'],[110,0,'tarmac']] },
    { id: 'amber', name: 'Amber Ridge', subtitle: 'Brake. Turn. Commit.', region: 'THE GOLDEN HILLS', difficulty: 'Medium', timeOfDay: 0.48, medals: [69, 88, 118], blocks: [[120,0,'tarmac'],[130,65,'tarmac'],[150,-100,'gravel'],[120,0,'gravel'],[90,105,'gravel'],[160,-55,'gravel'],[140,0,'tarmac'],[130,70,'tarmac'],[100,-80,'tarmac'],[150,45,'tarmac'],[180,0,'tarmac']] },
    { id: 'marsh', name: 'Mosswater', subtitle: 'A softer touch', region: 'THE WETLANDS', difficulty: 'Hard', timeOfDay: 0.15, medals: [73, 96, 128], blocks: [[140,0,'gravel'],[140,-65,'gravel'],[150,75,'mud'],[130,0,'mud'],[110,-90,'mud'],[150,50,'gravel'],[160,-60,'gravel'],[140,85,'mud'],[160,0,'mud'],[130,-45,'tarmac'],[170,0,'tarmac']] },
    { id: 'night', name: 'Blue Hour', subtitle: 'Trust your notes', region: 'THE LAST LIGHT', difficulty: 'Expert', timeOfDay: 0.83, medals: [72, 95, 130], blocks: [[130,0,'tarmac'],[100,75,'tarmac'],[150,-100,'tarmac'],[120,45,'gravel'],[140,0,'gravel'],[120,-90,'gravel'],[130,80,'tarmac'],[170,-45,'tarmac'],[110,90,'tarmac'],[180,-40,'gravel'],[170,0,'tarmac']] }
];
export const LIVERIES = [
    { id: 'heritage', name: 'Heritage Teal', color: 0x3bafa1, points: 0 },
    { id: 'sunrise', name: 'Sunrise Ochre', color: 0xe4a449, points: 3 },
    { id: 'clay', name: 'Terracotta', color: 0xd16e52, points: 6 },
    { id: 'pearl', name: 'Pearl & Brass', color: 0xeee4cf, points: 10 }
];
export function hash(text) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function seededRandom(seed) { let x = seed >>> 0; return () => { x += 0x6D2B79F5; let t=x; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
export function utcDay(date = new Date()) { return date.toISOString().slice(0, 10); }
export function getStage(id) {
    if (id?.startsWith('daily-')) {
        const day = id.slice(6);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10) !== day) throw new Error('Invalid challenge date');
        const random = seededRandom(hash(day));
        const base = STAGES[1 + Math.floor(random() * 4)];
        const mirror = random() > 0.5 ? 1 : -1;
        const scale = 0.9 + random() * 0.2;
        return { ...base, id, name: 'Daily Rally', subtitle: day + ' · one course, one car', region: base.name.toUpperCase(), seed: hash(day), daily: true, car: 'comet', medals: base.medals.map(t=>Math.round(t*scale)), blocks: base.blocks.map(([d,a,s])=>[Math.round(d*scale),a*mirror,s]) };
    }
    const stage = STAGES.find(s=>s.id===id);
    if (!stage) throw new Error('Unknown stage');
    return { ...stage, seed: hash(stage.id) };
}
export function medalFor(seconds, targets) { return seconds <= targets[0] ? 3 : seconds <= targets[1] ? 2 : seconds <= targets[2] ? 1 : 0; }
export const MEDAL_NAMES = ['Finish', 'Bronze', 'Silver', 'Gold'];
