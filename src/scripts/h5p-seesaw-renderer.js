import Util from './h5p-seesaw-util';

export default class SeesawRenderer {

  /**
   * Constructor.
   * @param {object} params Parameters.
   * @param {object} params.physics Simulated physical world.
   * @param {object} [callbacks={}] Callbacks.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = Util.extend({
    }, params);

    this.callbacks = Util.extend({
    }, callbacks);

    this.physics = params.physics;

    this.setScale(1);
  }

  /**
   * Set scale to adjust for viewport resizing.
   * @param {number} scale Scale.
   */
  setScale(scale) {
    this.scale = scale;
  }

  /**
   * Get current scale.
   * @return {number} Scale.
   */
  getScale() {
    return this.scale;
  }

  /**
   * Update DOM.
   */
  update() {
    if (!this.physics.isEnabled()) {
      this.stop();
    }

    // Update the physical world.
    this.physics.update();

    // Update DOM entities representing world's objects.
    this.physics.getItems().forEach(body => {

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

  /**
   * Run the renderer.
   */
  run() {
    this.frameRequestId = window.requestAnimationFrame(() => {
      this.update();
    });
  }

  /**
   * Stop the renderer.
   */
  stop() {
    window.cancelAnimationFrame(this.frameRequestId);
  }
}
