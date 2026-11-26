// Input for Sky Courier: keyboard and mouse, read by the physics step.
// One clear job: hold the pilot's current stick, throttle and buttons,
// and translate raw events into -1..1 control axes.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.roll = 0; // -1 left .. 1 right, from keys or mouse
    this.pitch = 0; // -1 dive .. 1 climb
    this.throttleDelta = 0; // held throttle keys push this up or down
    this.mouseX = 0; // -1..1 across the canvas
    this.mouseY = 0; // -1..1 down the canvas
    this.mouseActive = false;
    this.pressed = new Set(); // edge-triggered keys, consumed by the game
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      this.mouseActive = true;
    });
    canvas.addEventListener('pointerdown', (e) => {
      this.mouseActive = true;
      this.pressed.add('PointerDown');
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.throttleDelta += e.deltaY < 0 ? 0.12 : -0.12;
    }, { passive: false });
  }

  // True once for a key pressed since the last call, then cleared.
  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  // Recompute the stick axes from whatever the pilot is holding now.
  update() {
    let roll = 0;
    let pitch = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) roll -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) roll += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) pitch += 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) pitch -= 1;

    // Mouse steering: hold the pointer off-centre to bank and climb.
    // It only takes over while the pointer is well away from centre,
    // so resting the mouse does not fight the keyboard.
    if (this.mouseActive && Math.abs(this.mouseX) > 0.08) {
      roll = Math.max(-1, Math.min(1, this.mouseX * 1.4));
    }
    if (this.mouseActive && Math.abs(this.mouseY) > 0.08) {
      pitch = Math.max(-1, Math.min(1, -this.mouseY * 1.4));
    }

    this.roll = roll;
    this.pitch = pitch;

    let throttle = 0;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyE')) throttle += 1;
    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyQ')) throttle -= 1;
    if (this.throttleDelta !== 0) {
      throttle += this.throttleDelta * 8;
      this.throttleDelta = 0;
    }
    this.throttleInput = throttle;
  }

  anyKey() {
    return this.pressed.size > 0;
  }

  clearPressed() {
    this.pressed.clear();
  }
}
