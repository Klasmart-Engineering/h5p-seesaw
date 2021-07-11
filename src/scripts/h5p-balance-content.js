import Matter from 'matter-js';
import Util from './h5p-balance-util';

import BalanceBox from './matter-objects/h5p-balance-box';
import BalancePhysics from './h5p-balance-physics';
import BalanceRenderer from './h5p-balance-renderer';

/** Class representing the content */
export default class BalanceContent {
  /**
   * @constructor
   * @param {object} [params={}] Parameters.
   * @param {object} [callbacks={}] Callbacks.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = Util.extend({
      items: []
    }, params);

    this.callbacks = Util.extend({
      onInteracted: () => {}
    }, callbacks);

    this.handleMoveStart = this.handleMoveStart.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleMoveEnd = this.handleMoveEnd.bind(this);

    // Sequence of angles that the seesaw had
    this.seesawAngles = [];

    // Aspect ratio
    this.aspectRatio = BalanceContent.DEFAULT_ASPECT_RATIO;

    // Maximum size for physics world internally
    this.maxSize = {
      x: BalanceContent.BASE_SIZE,
      y: BalanceContent.BASE_SIZE / this.aspectRatio
    };

    this.content = document.createElement('div');
    this.content.classList.add('h5p-balance-canvas');
    this.content.style.width = `${this.maxSize.x}px`;
    this.content.style.height = `${this.maxSize.y}px`;

    if (this.params?.backgroundImage?.path) {
      this.content.style.backgroundImage = `URL(${H5P.getPath(this.params.backgroundImage.path, this.params.contentId)})`;
      this.content.classList.add('h5p-balance-backgroundImage');
    }

    this.physics = new BalancePhysics();
    this.renderer = new BalanceRenderer({ physics: this.physics });

    // Add elements to world
    this.addBoundaries();
    this.boxes = this.addBoxes(this.params.items);
    this.group = Matter.Body.nextGroup(true);
    this.seesaw = this.addSeesaw();

    ['mousedown', 'touchstart'].forEach(type => {
      this.content.addEventListener(type, (event) => {
        this.handleMoveStart(event);
      }, false);
    });

    // Add objects to DOM
    this.physics.getObjects().forEach(object => {
      this.content.appendChild(object.getDOM());
    });

    // Run, Forrest!
    this.physics.run();
    this.renderer.run();

    // Check whether seesaw is stable
    this.stableTimer = setInterval(() => {
      this.handleStableTimer();
    }, 1000 / BalanceContent.SEESAW_STABLE_CHECKS_PER_SECOND);

    setTimeout(() => {
      this.resize();
    }, 0);

    // Check why this seems to be necessary on WordPress
    setTimeout(() => {
      this.resize();
    }, 1000);
  }

  /**
   * Return the DOM for this class.
   * @return {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.content;
  }

  /**
   * Resize DOM.
   */
  resize() {
    this.content.style.width = '';

    setTimeout(() => {
      const width = this.content.getBoundingClientRect().width;

      this.content.style.height = `${width / this.aspectRatio}px`;

      // Inform renderer about new size
      this.renderer.setScale(width / this.maxSize.x);
      this.renderer.setOffset({
        x: this.content.offsetLeft,
        y: this.content.offsetTop
      });
    }, 0);
  }

  /**
   * Determine whether seesaw is stable.
   * @param {object} [params] Parameters.
   * @return {boolean} True, if seesaw is stable. Else false.
   */
  isSeesawStable(params = {}) {
    if (this.seesawAngles.length < this.params.stableTime * BalanceContent.SEESAW_STABLE_CHECKS_PER_SECOND) {
      return false;
    }

    const degrees = this.seesawAngles.reduce((degrees, angle) => {
      return {
        min: Math.min(degrees.min, angle),
        max: Math.max(degrees.max, angle)
      };
    }, {min: 360, max: -360});

    const degreesDelta = Math.abs(degrees.max - degrees.min);
    return (degreesDelta <= BalanceContent.SEESAW_STABLE_DEGREE);
  }

  /**
   * Check whether boxes are on seesaw (based on same angle, could be wrong, but fine here).
   * @return {boolean} True if all boxes have same angle as seesaw.
   */
  areBoxesOnSeesaw() {
    if (this.currentDraggable) {
      return; // Someone is dragging a box
    }

    // Normalize angles to [0, 2 * Math.PI[
    const fullRad = 2 * Math.PI;
    const seesawAngle = (this.seesaw.getMatter().angle + fullRad) % fullRad;

    return this.boxes.every(box => {
      // Account for rotation of 90, 180, 270 as well
      return [0, 0.5, 1, 1.5].some(factor => {
        const boxAngle = (box.getMatter().angle + fullRad + factor * Math.PI) % fullRad;

        return Math.abs(seesawAngle - boxAngle) < 0.01;
      });
    });
  }

  areBoxesVerySlow() {
    return this.boxes.every(box => box.getMatter().speed < BalanceContent.THRESHOLD_BOX_SLOW);
  }

  handleStableTimer() {
    if (!this.physics.isEnabled()) {
      return;
    }

    const seesawAngle = this.seesaw.getMatter().angle * 180 / Math.PI;

    this.seesawAngles.push(seesawAngle);
    if (this.seesawAngles.length > this.params.stableTime * BalanceContent.SEESAW_STABLE_CHECKS_PER_SECOND) {
      this.seesawAngles.shift();
    }

    if (this.currentDraggable) {
      return; // currently moving a draggable
    }

    if (!this.areBoxesOnSeesaw()) {
      return; // Boxes not on seesaw
    }

    if (!this.isSeesawStable()) {
      return; // Seesaw not stable
    }

    if (!this.areBoxesVerySlow()) {
      return; // Boxes moving too fast
    }

    this.handlesawStable(this.seesawAngles[this.seesawAngles.length - 1]);
  }

  handlesawStable(angle) {
    this.seesawAngles = [];
    this.physics.stop();

    if (Math.abs(angle) < this.params.stableDegree) {
      this.handleDone();
    }
  }

  handleDone() {
    this.done = true;

    this.physics.getObjects().forEach(box => {
      box.getDOM().style.filter = 'grayscale(1) blur(1px)';
    });
  }

  handleMoveStart(event) {
    if (event.type === 'touchstart') {
      event.preventDefault();
      // Adding this to mouse listener would prevent dropping outside canvas
    }

    const box = this.boxes
      .filter(box => box.getDOM() === event.target)
      .shift();

    if (!box) {
      return;
    }

    this.currentDraggable = box;

    this.currentDraggable.startDrag(this.renderer.getScale(this.renderer.getScale()));

    // Keep track of starting click position in absolute pixels
    this.moveStartPosition = {
      x: (event.type === 'touchstart') ? event.touches[0].clientX : event.clientX,
      y: (event.type === 'touchstart') ? event.touches[0].clientY : event.clientY
    };

    ['mousemove', 'touchmove'].forEach(type => {
      document.addEventListener(type, this.handleMove, { passive: false });
    });

    ['mouseup', 'touchend'].forEach(type => {
      window.addEventListener(type, this.handleMoveEnd, { passive: false });
    });
  }

  handleMove(event) {
    event.preventDefault();

    if (!this.currentDraggable || this.done) {
      return;
    }

    if (!this.physics.isEnabled()) {
      this.physics.run();
      this.renderer.run();
    }

    this.currentDraggable.startDrag();

    let movePosition = {
      x: (event.type === 'touchmove') ? event.touches[0].clientX : event.clientX,
      y: (event.type === 'touchmove') ? event.touches[0].clientY : event.clientY
    };

    if (movePosition.x < 0 && movePosition.y < 0) {
      return; // Skip - not sure why these get negative on final handling
    }

    const moveDelta = {
      x: movePosition.x - this.moveStartPosition.x,
      y: movePosition.y - this.moveStartPosition.y
    };

    this.moveStartPosition = movePosition;

    const currentPositionDOM = this.currentDraggable.getPositionDOM();
    this.setPositionDOM(this.currentDraggable, {
      x: currentPositionDOM.x + moveDelta.x,
      y: currentPositionDOM.y + moveDelta.y
    });

    setTimeout(() => {
      this.setPositionMatterFromDOM();
    }, 0);
  }

  handleMoveEnd(event) {
    event.preventDefault();

    if (!this.currentDraggable) {
      return;
    }

    ['mousemove', 'touchmove'].forEach(type => {
      document.removeEventListener(type, this.handleMove);
    });

    ['mouseup', 'touchend'].forEach(type => {
      window.removeEventListener(type, this.handleMoveEnd);
    });

    this.setPositionMatterFromDOM();

    this.currentDraggable.endDrag();

    this.currentDraggable = null;
    this.moveStartPosition = null;
  }

  setPositionMatterFromDOM() {
    if (!this.currentDraggable) {
      return;
    }

    const positionDOM = this.currentDraggable.getPositionDOM();
    const offset = this.renderer.getOffset();
    const scale = this.renderer.getScale();

    this.setPositionMatter(this.currentDraggable, {
      x: (positionDOM.x - offset.x) / scale,
      y: (positionDOM.y - offset.y) / scale
    });
  }

  setPositionDOM(draggable, position) {
    const boundingBox = draggable.getBoundingBoxDOM();

    const constraints = {
      min: {
        x: this.content.offsetLeft + boundingBox.width / 2,
        y: this.content.offsetTop + boundingBox.height / 2
      },
      max: {
        x: this.content.offsetLeft + this.content.offsetWidth - boundingBox.width / 2,
        y: this.content.offsetTop + this.content.offsetHeight - boundingBox.height / 2
      }
    };

    draggable.setPositionDOM(position, { constraints: constraints });
  }

  setPositionMatter(object, position) {
    const constraints = {
      min: { x: 0, y: 0},
      max: { x: this.maxSize.x, y: this.maxSize.y }
    };

    object.setPositionMatter(position, { constraints: constraints });
  }

  addBoundaries() {
    const boundaries = [];

    // Add boundaries
    const boundaryThickness = BalanceContent.BASE_SIZE; // To prevent quick bodies from glitching through
    const boundaryTop = new BalanceBox({
      position: { x: this.maxSize.x / 2, y: -boundaryThickness / 2 },
      size: { width: this.maxSize.x, height: boundaryThickness },
      matterOptions: {isStatic: true}
    });
    this.physics.add(boundaryTop);
    boundaries.push(boundaryTop);

    const boundaryRight = new BalanceBox({
      position: { x: this.maxSize.x + boundaryThickness / 2, y: this.maxSize.y / 2 },
      size: { width: boundaryThickness, height: this.maxSize.y },
      matterOptions: {isStatic: true}
    });
    this.physics.add(boundaryRight);
    boundaries.push(boundaryRight);

    const boundaryBottom = new BalanceBox({
      position: { x: this.maxSize.x / 2, y: this.maxSize.y + boundaryThickness / 2 },
      size: { width: this.maxSize.x, height: boundaryThickness },
      matterOptions: {isStatic: true}
    });
    this.physics.add(boundaryBottom);
    boundaries.push(boundaryBottom);

    const boundaryLeft = new BalanceBox({
      position: { x: -boundaryThickness / 2, y: this.maxSize.y / 2 },
      size: { width: boundaryThickness, height: this.maxSize.y },
      matterOptions: {isStatic: true}
    });
    this.physics.add(boundaryLeft);
    boundaries.push(boundaryLeft);

    return boundaries;
  }

  addBoxes(items) {
    const boxes = [];

    const boxOptions = {
      friction: 0.9,
      frictionStatic: 10,
      restitution: 0
    };

    items.forEach((item, index) => {
      // Fixed positions for now
      const position = (index === 0) ?
        { x: this.maxSize.x / 2 - (this.maxSize.x / 3), y: this.maxSize.y / 4 } :
        { x: this.maxSize.x / 2 + (this.maxSize.x / 3), y: this.maxSize.y / 4 };

      const matterOptions = Util.extend({
        density: item.weight / 1000
      }, boxOptions);

      const classes = !item.image ? ['wireframe'] : ['custom-image'];

      const box = new BalanceBox(
        {
          position: position,
          size: { width: item.width, height: item.height },
          matterOptions: matterOptions,
          options: {
            contentId: this.params.contentId,
            classes: classes,
            movable: true,
            image: item.image
          }
        },
        {
          onMoveStart: (event, box) => {
            this.handleMoveStart(event, box);
          }
        }
      );

      this.physics.add(box);
      boxes.push(box);
    });

    return boxes;
  }

  addSeesaw() {
    const base = new BalanceBox({
      position: { x: this.maxSize.x / 2, y: this.maxSize.y - (this.maxSize.y / 20) },
      size: { width: this.maxSize.y / 25, height: this.maxSize.y / 10 },
      matterOptions: {
        collisionFilter: { group: this.group },
        isStatic: true
      },
      options: {
        classes: ['wireframe', 'h5p-balance-seesaw']
      }
    });
    this.physics.add(base);

    const seesaw = new BalanceBox({
      position: { x: this.maxSize.x / 2, y: this.maxSize.y - (this.maxSize.y / 10) },
      size: { width: this.maxSize.x / 1.25, height: this.maxSize.y / 25 },
      matterOptions: {
        collisionFilter: { group: this.group },
        friction: 0.9,
        frictionStatic: 10,
        restitution: 0,
        density: 0.1,
        label: 'seesaw'
      },
      options: {
        classes: ['wireframe', 'h5p-balance-seesaw']
      }
    });
    this.physics.add(seesaw);

    this.physics.add(
      Matter.Constraint.create({
        bodyA: seesaw.getMatter(),
        pointB: Matter.Vector.clone(seesaw.getMatter().position),
        stiffness: 0.9,
        type: 'pin',
        length: 0
      })
    );

    return seesaw;
  }
}

/** @const {number} Base size. */
BalanceContent.BASE_SIZE = 1000;

/** @const {number} Default aspect ratio. */
BalanceContent.DEFAULT_ASPECT_RATIO = 2;

/** @const {number} Maximum degree deviation to consider seesaw stable. */
BalanceContent.SEESAW_STABLE_DEGREE = 1;

/** @const {number} Number of stability checks per second. */
BalanceContent.SEESAW_STABLE_CHECKS_PER_SECOND = 2;

/** @const {number} Speed value considered slow. */
BalanceContent.THRESHOLD_BOX_SLOW = 0.3;
