import Matter from 'matter-js';
import Util from './h5p-seesaw-util';

import SeesawBox from './matter-objects/h5p-seesaw-box';
import SeesawPhysics from './h5p-seesaw-physics';
import SeesawRenderer from './h5p-seesaw-renderer';

/** Class representing the content */
export default class SeesawContent {
  /**
   * @constructor
   * @param {object} [params={}] Parameters.
   * @param {object} [callbacks={}] Callbacks.
   * @param {function} [callbacks.interacted] Callback for user interacted.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = Util.extend({
      items: []
    }, params);

    this.callbacks = Util.extend({
      onInteracted: () => {}
    }, callbacks);

    // Bind handlers
    this.handleMoveStart = this.handleMoveStart.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleMoveEnd = this.handleMoveEnd.bind(this);

    // Sequence of angles that the seesaw had
    this.seesawAngles = [];

    // Aspect ratio
    this.aspectRatio = SeesawContent.DEFAULT_ASPECT_RATIO;

    // Maximum size for physics world internally
    this.maxSize = {
      x: SeesawContent.BASE_SIZE,
      y: SeesawContent.BASE_SIZE / this.aspectRatio
    };

    // Create DOM
    this.content = document.createElement('div');
    this.content.classList.add('h5p-seesaw-canvas');
    this.content.style.width = `${this.maxSize.x}px`;
    this.content.style.height = `${this.maxSize.y}px`;

    // Add optional background image
    if (this.params?.backgroundImage?.path) {
      this.content.style.backgroundImage = `URL(${H5P.getPath(this.params.backgroundImage.path, this.params.contentId)})`;
      this.content.classList.add('h5p-seesaw-backgroundImage');
    }

    // Initialize physics world and renderer
    this.physics = new SeesawPhysics();
    this.renderer = new SeesawRenderer({ physics: this.physics });

    // Add elements to world
    this.addBoundaries();
    this.boxes = this.addBoxes(this.params.items);
    this.group = Matter.Body.nextGroup(true);
    this.seesaw = this.addSeesaw();

    // Handle item dragging
    ['mousedown', 'touchstart'].forEach(type => {
      this.content.addEventListener(type, (event) => {
        this.handleMoveStart(event);
      }, false);
    });

    // Add objects to DOM
    this.physics.getItems().forEach(object => {
      this.content.appendChild(object.getDOM());
    });

    // Run, Forrest!
    this.physics.run();
    this.renderer.run();

    // Check whether seesaw is stable
    this.stableTimer = setInterval(() => {
      this.handleStableTimer();
    }, 1000 / SeesawContent.SEESAW_STABLE_CHECKS_PER_SECOND);

    setTimeout(() => {
      this.resize();
    }, 0);
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
    }, 0);
  }

  /**
   * Determine whether seesaw is stable.
   * @param {object} [params] Parameters.
   * @return {boolean} True, if seesaw is stable. Else false.
   */
  isSeesawStable() {
    if (this.seesawAngles.length < this.params.stableTime * SeesawContent.SEESAW_STABLE_CHECKS_PER_SECOND) {
      return false;
    }

    const degrees = this.seesawAngles.reduce((degrees, angle) => {
      return {
        min: Math.min(degrees.min, angle),
        max: Math.max(degrees.max, angle)
      };
    }, {min: 360, max: -360});

    const degreesDelta = Math.abs(degrees.max - degrees.min);
    return (degreesDelta <= SeesawContent.SEESAW_STABLE_DEGREE);
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

  /**
   * Determine whether the boxes are moving very slowly.
   * @return {boolean} True, if the boxes are moving very slowly.
   */
  areBoxesVerySlow() {
    return this.boxes.every(box => box.getMatter().speed < SeesawContent.THRESHOLD_BOX_SLOW);
  }

  /**
   * Handler stable timer calling.
   */
  handleStableTimer() {
    if (!this.physics.isEnabled()) {
      return;
    }

    // Keep track of some previous angles of seesaw
    const seesawAngle = this.seesaw.getMatter().angle * 180 / Math.PI;

    this.seesawAngles.push(seesawAngle);
    if (this.seesawAngles.length > this.params.stableTime * SeesawContent.SEESAW_STABLE_CHECKS_PER_SECOND) {
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

    // Seesaw is stable
    this.handlesawStable(this.seesawAngles[this.seesawAngles.length - 1]);
  }

  /**
   * Handle seesaw being stable.
   */
  handlesawStable(angle) {
    this.seesawAngles = [];
    this.physics.stop();

    if (Math.abs(angle) < this.params.stableDegree) {
      this.handleDone();
    }
  }

  /**
   * Handle user is done.
   */
  handleDone() {
    this.done = true;

    this.physics.getItems().forEach(box => {
      box.getDOM().style.filter = 'grayscale(1) blur(1px)';
    });
  }

  /**
   * Handle user started moving a box.
   * @param {MouseEvent|TouchEvent} event Event.
   */
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

    // Add further handlers
    ['mousemove', 'touchmove'].forEach(type => {
      document.addEventListener(type, this.handleMove, { passive: false });
    });

    ['mouseup', 'touchend'].forEach(type => {
      window.addEventListener(type, this.handleMoveEnd, { passive: false });
    });
  }

  /**
   * Handle user moves a box.
   * @param {MouseEvent|TouchEvent} event Event.
   */
  handleMove(event) {
    event.preventDefault();

    if (!this.currentDraggable || this.done) {
      return; // nothing to drag
    }

    // Restart paused physics engine
    if (!this.physics.isEnabled()) {
      this.physics.run();
      this.renderer.run();
    }

    this.seesawAngles = [];
    this.currentDraggable.startDrag();

    // Compute new position
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

    // Set position of object in DOM.
    const currentPositionDOM = this.currentDraggable.getPositionInDOM();
    this.setPositionInDOM(this.currentDraggable, {
      x: currentPositionDOM.x + moveDelta.x,
      y: currentPositionDOM.y + moveDelta.y
    });

    // Update corresponding item position in physics world
    setTimeout(() => {
      this.setPositionInMatterFromDOM(this.currentDraggable);
    }, 0);
  }

  /**
   * Handle user ended moving a box.
   * @param {MouseEvent|TouchEvent} event Event.
   */
  handleMoveEnd(event) {
    event.preventDefault();

    if (!this.currentDraggable) {
      return; // nothing to stop
    }

    // Remove listeners
    ['mousemove', 'touchmove'].forEach(type => {
      document.removeEventListener(type, this.handleMove);
    });

    ['mouseup', 'touchend'].forEach(type => {
      window.removeEventListener(type, this.handleMoveEnd);
    });

    // Update position
    this.setPositionInMatterFromDOM(this.currentDraggable);

    this.currentDraggable.endDrag();

    this.currentDraggable = null;
    this.moveStartPosition = null;
  }

  /**
   * Set position in physical world based on DOM position.
   * @param {object} draggable Draggable in DOM.
   */
  setPositionInMatterFromDOM(draggable) {
    if (!draggable) {
      return;
    }

    const positionDOM = draggable.getPositionInDOM();
    const scale = this.renderer.getScale();

    this.setPositionInMatter(draggable, {
      x: positionDOM.x / scale,
      y: positionDOM.y / scale
    });
  }

  /**
   * Set draggable position in DOM.
   * @param {object} draggable Item being dragged.
   * @param {object} position X and y position.
   */
  setPositionInDOM(draggable, position) {
    const boundingBox = draggable.getBoundingBoxDOM();

    // Position 0/0 is translated to center
    const constraints = {
      min: {
        x: boundingBox.width / 2,
        y: boundingBox.height / 2
      },
      max: {
        x: this.content.offsetWidth - boundingBox.width / 2,
        y: this.content.offsetHeight - boundingBox.height / 2
      }
    };

    draggable.setPositionInDOM(position, { constraints: constraints });
  }

  /**
   * Set draggable position in matter.js object.
   * @param {object} draggable Item being dragged.
   * @param {object} position X and y position.
   */
  setPositionInMatter(object, position) {
    const constraints = {
      min: { x: 0, y: 0},
      max: { x: this.maxSize.x, y: this.maxSize.y }
    };

    object.setPositionInMatter(position, { constraints: constraints });
  }

  /**
   * Add boundaries to DOM.
   */
  addBoundaries() {
    const boundaries = [];

    // Add boundaries
    const boundaryThickness = SeesawContent.BASE_SIZE; // To prevent quick bodies from glitching through
    const boundaryTop = new SeesawBox({
      position: { x: this.maxSize.x / 2, y: -boundaryThickness / 2 },
      size: { width: this.maxSize.x, height: boundaryThickness },
      matterOptions: {isStatic: true}
    });
    this.physics.add(boundaryTop);
    boundaries.push(boundaryTop);

    const boundaryRight = new SeesawBox({
      position: { x: this.maxSize.x + boundaryThickness / 2, y: this.maxSize.y / 2 },
      size: { width: boundaryThickness, height: this.maxSize.y },
      matterOptions: {isStatic: true}
    });
    this.physics.add(boundaryRight);
    boundaries.push(boundaryRight);

    const boundaryBottom = new SeesawBox({
      position: { x: this.maxSize.x / 2, y: this.maxSize.y + boundaryThickness / 2 },
      size: { width: this.maxSize.x, height: boundaryThickness },
      matterOptions: {isStatic: true}
    });
    this.physics.add(boundaryBottom);
    boundaries.push(boundaryBottom);

    const boundaryLeft = new SeesawBox({
      position: { x: -boundaryThickness / 2, y: this.maxSize.y / 2 },
      size: { width: boundaryThickness, height: this.maxSize.y },
      matterOptions: {isStatic: true}
    });
    this.physics.add(boundaryLeft);
    boundaries.push(boundaryLeft);

    return boundaries;
  }

  /**
   * Add draggable boxes to DOM.
   * @param {object[]} items Items to be added to DOM.
   */
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
        mass: item.weight,
        inverseMass: item.weight ? 1 / item.weight : undefined
      }, boxOptions);

      const classes = !item.image?.params?.file ? ['wireframe'] : ['custom-image'];

      const box = new SeesawBox(
        {
          position: position,
          size: {
            width: item.width / 100 * this.maxSize.x,
            height: item.height / 100 * this.maxSize.x},
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

  /**
   * Add seesaw to DOM.
   */
  addSeesaw() {
    const base = new SeesawBox({
      position: { x: this.maxSize.x / 2, y: this.maxSize.y - (this.maxSize.y / 20) },
      size: { width: this.maxSize.y / 25, height: this.maxSize.y / 10 },
      matterOptions: {
        collisionFilter: { group: this.group },
        isStatic: true
      },
      options: {
        classes: ['wireframe', 'h5p-seesaw-seesaw']
      }
    });
    this.physics.add(base);

    const seesaw = new SeesawBox({
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
        classes: ['wireframe', 'h5p-seesaw-seesaw']
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
SeesawContent.BASE_SIZE = 1000;

/** @const {number} Default aspect ratio. */
SeesawContent.DEFAULT_ASPECT_RATIO = 2;

/** @const {number} Maximum degree deviation to consider seesaw stable. */
SeesawContent.SEESAW_STABLE_DEGREE = 1;

/** @const {number} Number of stability checks per second. */
SeesawContent.SEESAW_STABLE_CHECKS_PER_SECOND = 2;

/** @const {number} Speed value considered slow. */
SeesawContent.THRESHOLD_BOX_SLOW = 0.3;
