import Matter from 'matter-js';
import Util from './../h5p-seesaw-util';

/** Class representing a box */
export default class SeesawBox {
  /**
   * @constructor
   * @param {object} [params={}] Parameters.
   * @param {object} [callbacks={}] Callbacks.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = Util.extend({
      matterOptions: {},
      options: {
        classes: [],
        movable: false
      },
      position: { x: 0, y: 0 },
      size: { height: 0, width: 0 }
    }, params);

    this.callbacks = Util.extend({
    }, callbacks);

    // Sanitize additional CSS classes
    if (typeof this.params.classes === 'string') {
      this.params.classes = [this.params.classes];
    }

    // Create matter.js object
    this.boxMatter = Matter.Bodies.rectangle(
      this.params.position.x,
      this.params.position.y,
      this.params.size.width,
      this.params.size.height,
      this.params.matterOptions
    );

    // Create DOM
    this.boxDOM = document.createElement('div');

    this.boxDOM.classList.add('h5p-seesaw-matter-object');
    this.params.options.classes.forEach(className => {
      this.boxDOM.classList.add(className);
    });

    // Add optional background image
    if (this.params.options?.image?.params?.file?.path && this.params.options?.contentId) {
      this.boxDOM.style.backgroundImage = `URL(${H5P.getPath(this.params.options.image.params.file.path, this.params.options.contentId)})`;
    }

    // Set size.
    this.boxDOM.style.width = `${this.params.size.width}px`;
    this.boxDOM.style.height = `${this.params.size.height}px`;

    // Objects could be movable with mouse
    if (this.params.options.movable) {
      this.boxDOM.setAttribute('draggable', true);
    }
    else {
      this.boxDOM.setAttribute('draggable', false);
      this.boxDOM.classList.add('immovable');
    }
  }

  /**
   * Get bounding box width and height.
   * @return {object} Bounding box width and height.
   */
  getBoundingBoxDOM() {
    return {
      width: this.boxDOM.getBoundingClientRect().width,
      height: this.boxDOM.getBoundingClientRect().height
    };
  }

  /**
   * Get position in DOM.
   * @return {object} X and y position in DOM.
   */
  getPositionInDOM() {
    return {
      x: parseFloat(this.boxDOM.style.left),
      y: parseFloat(this.boxDOM.style.top)
    };
  }

  /**
   * Set position in DOM.
   * @param {object} position X and y position for DOM.
   * @param {object} [options] Optional paramaters.
   * @param {object} [options.contraints] Constraints for the position, min/max.
   */
  setPositionInDOM(position, options) {
    if (options.constraints) {
      position = {
        x: Util.constrain(position.x, options.constraints.min.x, options.constraints.max.x),
        y: Util.constrain(position.y, options.constraints.min.y, options.constraints.max.y)
      };
    }

    this.boxDOM.style.left = `${position.x}px`;
    this.boxDOM.style.top = `${position.y}px`;
  }

  /**
   * Get position in Matter.js.
   * @return {object} X and y position in DOM.
   */
  getPositionInMatter() {
    return {
      x: this.boxMatter.position.x,
      y: this.boxMatter.position.y
    };
  }

  /**
   * Set position in Matter.js.
   * @param {object} position X and y position for DOM.
   * @param {object} [options] Optional paramaters.
   * @param {object} [options.contraints] Constraints for the position, min/max.
   */
  setPositionInMatter(position, params = {}) {
    if (params.constraints) {
      position = {
        x: Util.constrain(position.x, params.constraints.min.x, params.constraints.max.x),
        y: Util.constrain(position.y, params.constraints.min.y, params.constraints.max.y)
      };
    }

    Matter.Body.setPosition(this.boxMatter, position);
  }

  /**
   * Get DOM element.
   * @return {HTMLElement} DOM element.
   */
  getDOM() {
    return this.boxDOM;
  }

  /**
   * Get Matter.js object.
   * @return {HTMLElement} Matter.js object.
   */
  getMatter() {
    return this.boxMatter;
  }

  /**
   * Start dragging item.
   * @param {number} scale Scale of view.
   */
  startDrag(scale) {
    Matter.Body.setAngle(this.boxMatter, 0);
    Matter.Body.setAngularVelocity(this.boxMatter, 0);

    this.boxDOM.style.transform = `translate(-50%, -50%) rotate(${this.boxMatter.angle || 0}rad) scale(${scale})`;

    this.boxMatter.isStatic = true;
    this.skipUpdate = true;
  }

  /**
   * Stop dragging item.
   * @param {number} scale Scale of view.
   */
  endDrag() {
    this.boxMatter.isStatic = false;
    this.skipUpdate = false;
  }

  /**
   * Hide item in view.
   */
  hide() {
    this.boxDOM.classList.add('invisible');
  }

  /**
   * Show item in view.
   */
  show() {
    this.boxDOM.classList.remove('invisible');
  }
}
