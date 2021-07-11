import Util from './h5p-seesaw-util';

export default class SeesawRenderer {

  constructor(params = {}, callbacks = {}) {
    this.params = Util.extend({
    }, params);

    this.callbacks = Util.extend({
    }, callbacks);

    this.physics = params.physics;

    this.setScale(1);
  }

  setScale(scale) {
    this.scale = scale;
  }

  getScale() {
    return this.scale;
  }

  update() {
    if (!this.physics.isEnabled()) {
      this.stop();
    }

    this.physics.update();

    this.physics.getObjects().forEach(body => {

      if (body.skipUpdate === true) {
        return; // Should skip rendering based on physics position
      }

      body.boxDOM.style.left = `${body.boxMatter.position.x * this.scale}px`;
      body.boxDOM.style.top = `${body.boxMatter.position.y * this.scale}px`;
      body.boxDOM.style.transform = `translate(-50%, -50%) rotate(${body.boxMatter.angle || 0}rad) scale(${this.scale})`;
    });

    this.frameRequestId = window.requestAnimationFrame(() => {
      this.update();
    });
  }

  run() {
    this.frameRequestId = window.requestAnimationFrame(() => {
      this.update();
    });
  }

  stop() {
    window.cancelAnimationFrame(this.frameRequestId);
  }
}
