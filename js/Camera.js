// Camera.js
import * as THREE from 'three';

export class Camera {
    constructor(camera, vehicle) {
        this.camera = camera;
        this.vehicle = vehicle; // reference to Vehicle instance
        this.viewMode = 'CHASE'; // or 'COCKPIT'
        this.shake = 0; // impact shake 0..1, decays in update
    }

    update(dt, viewMode) {
        this.viewMode = viewMode;
        this.dt = dt;
        this.shake = Math.max(0, this.shake - dt * 2.2);
        if (this.viewMode === 'CLOSE') {
            this.updateClose();
        } else if (this.viewMode === 'CHASE') {
            this.updateChase();
        } else {
            this.updateCockpit();
        }
    }

    updateChase() {
        const offset = new THREE.Vector3(0, this.camera.aspect<.8?3.4:2.5, this.camera.aspect<.8?-9.5:-6).applyQuaternion(this.vehicle.group.quaternion);
        const targetPos = this.vehicle.group.position.clone().add(offset);
        this.camera.position.lerp(targetPos, 1-Math.exp(-6.322*this.dt));
        this.camera.lookAt(this.vehicle.group.position.clone().add(new THREE.Vector3(0, 1, 0)));
        
        // Dynamic FOV based on speed — smoothed so shifts/impacts don't pop
        const targetFov = 70 + Math.min(this.vehicle.speed / 6, 28);
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1-Math.exp(-5.003*this.dt));
        this.camera.updateProjectionMatrix();

        // Impact shake
        if (this.shake > 0.01) {
            this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.7;
            this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.5;
        }
    }

    updateClose() {
        // Close chase — hugs ~4 ft off the rear bumper, tighter and lower
        const offset = new THREE.Vector3(0, this.camera.aspect<.8?2.0:1.35, this.camera.aspect<.8?-5.5:-3.4).applyQuaternion(this.vehicle.group.quaternion);
        const targetPos = this.vehicle.group.position.clone().add(offset);
        this.camera.position.lerp(targetPos, 1-Math.exp(-17.261*this.dt));
        this.camera.lookAt(this.vehicle.group.position.clone().add(new THREE.Vector3(0, 0.9, 3)));
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 64, 1-Math.exp(-6.322*this.dt));
        this.camera.updateProjectionMatrix();
        if (this.shake > 0.01) {
            this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.5;
            this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.35;
        }
    }

    updateCockpit() {
        // Hood cam — sits over the bonnet, clear of the cabin geometry
        const hoodPos = new THREE.Vector3(0, 1.35, 1.0).applyQuaternion(this.vehicle.group.quaternion);
        this.camera.position.copy(this.vehicle.group.position).add(hoodPos);
        const lookAtPos = new THREE.Vector3(0, 0.8, 30).applyQuaternion(this.vehicle.group.quaternion);
        this.camera.lookAt(this.vehicle.group.position.clone().add(lookAtPos));
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 68, 1-Math.exp(-6.322*this.dt));
        this.camera.updateProjectionMatrix();
    }
}