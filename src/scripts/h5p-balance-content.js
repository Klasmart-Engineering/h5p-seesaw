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
    }, params);

    this.callbacks = Util.extend({
      onInteracted: () => {}
    }, callbacks);

    this.handleMoveStart = this.handleMoveStart.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleMoveEnd = this.handleMoveEnd.bind(this);

    this.content = document.createElement('div');
    this.content.classList.add('h5p-balance-canvas');

    this.physics = new BalancePhysics();
    this.renderer = new BalanceRenderer({ physics: this.physics });

    /*
     * TODO outline
     *
     * - Do not use absolute mouse position for physics position! Must use delta
     * - Fix pushing objects beyond boundaries (translation issue?)
     * - Add editor option to add images
     * - Add editor option to choose timeout
     */

    this.maxSize = {x: 800, y: 400};

    this.aspectRatio = 2;

    this.content.style.width = `${this.maxSize.x}px`;
    this.content.style.height = `${this.maxSize.y}px`;

    this.addBoundaries();
    this.boxes = this.addBoxes();

    this.group = Matter.Body.nextGroup(true);
    this.addSeesaw();

    ['mousedown', 'touchstart'].forEach(type => {
      this.content.addEventListener(type, (event) => {
        this.handleMoveStart(event);
      }, false);
    });

    // Add object to DOM
    this.physics.getObjects().forEach(object => {
      this.content.appendChild(object.getDOM());
    });

    // Run, Forrest!
    this.physics.run();
    this.renderer.run();

    // Control renderer
    // const controlRender = document.createElement('div');
    // controlRender.style.height = `${this.maxSize.y}px`;
    // controlRender.style.overflow = 'hidden';
    // this.content.appendChild(controlRender);
    // const render = Matter.Render.create({
    //   element: controlRender,
    //   engine: this.physics.engine
    // });
    // Matter.Render.run(render);

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

  resize() {
    this.content.style.width = '';

    setTimeout(() => {
      const width = this.content.getBoundingClientRect().width;

      this.content.style.height = `${width / this.aspectRatio}px`;

      this.renderer.setScale(width / this.maxSize.x);
      this.renderer.setOffset({
        x: this.content.offsetLeft,
        y: this.content.offsetTop
      });
    }, 0);
  }

  handleMoveStart(event) {
    const box = this.boxes
      .filter(box => box.getDOM() === event.target)
      .shift();

    if (!box) {
      return;
    }

    this.currentDraggable = box;

    this.currentDraggable.startDrag();

    // Keep track of starting click position in absolute pixels
    this.moveStartPosition = {
      x: (event.type === 'touchstart') ? event.touches[0].clientX : event.clientX,
      y: (event.type === 'touchstart') ? event.touches[0].clientY : event.clientY
    };

    ['mousemove', 'touchmove'].forEach(type => {
      document.addEventListener(type, this.handleMove);
    });

    ['mouseup', 'touchend'].forEach(type => {
      window.addEventListener(type, this.handleMoveEnd);
    });
  }

  handleMove(event) {
    event.preventDefault();
    if (!this.currentDraggable) {
      return;
    }

    this.currentDraggable.startDrag();

    let movePosition = {
      x: (event.type === 'touchstart') ? event.touches[0].clientX : event.clientX,
      y: (event.type === 'touchstart') ? event.touches[0].clientY : event.clientY
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
    const positionDOM = this.currentDraggable.getPositionDOM();
    const offset = this.renderer.getOffset();
    const scale = this.renderer.getScale();

    this.setPositionMatter(this.currentDraggable, {
      x: (positionDOM.x - offset.x) / scale,
      y: (positionDOM.y - offset.y) / scale
    });
  }

  setPositionDOM(object, position) {
    const boundingBox = object.getBoundingBoxDOM();

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

    object.setPositionDOM(position, { constraints: constraints });
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
    const boundaryThickness = 1000; // To prevent quick bodies from glitching through
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

  addBoxes() {
    const boxes = [];

    const boxOptions = { friction: 1, restitution: 0 };

    const box1 = new BalanceBox(
      {
        position: { x: this.maxSize.x / 2 - (this.maxSize.x / 3), y: this.maxSize.y / 4 },
        size: { width: this.maxSize.x / 10, height: this.maxSize.x / 10 },
        matterOptions: boxOptions,
        options: {
          classes: ['wireframe'],
          movable: true
        }
      },
      {
        onMoveStart: (event, box) => {
          this.handleMoveStart(event, box);
        }
      }
    );
    this.physics.add(box1);
    boxes.push(box1);

    const box2 = new BalanceBox(
      {
        position: { x: this.maxSize.x / 2 + (this.maxSize.x / 3), y: this.maxSize.y / 4 },
        size: { width: this.maxSize.x / 10, height: this.maxSize.x / 10 },
        matterOptions: boxOptions,
        options: {
          classes: ['wireframe'],
          movable: true
        }
      },
      {
        onMoveStart: (box) => {
          this.currentDraggable = box;
        }
      }
    );
    this.physics.add(box2);
    boxes.push(box2);

    Matter.Body.set(box2.getMatter(), 'density', box1.getMatter().density * 5);

    return boxes;
  }

  addSeesaw() {
    const seesaw = new BalanceBox({
      position: { x: this.maxSize.x / 2, y: this.maxSize.y - (this.maxSize.y / 10) },
      size: { width: this.maxSize.x / 1.25, height: this.maxSize.y / 25 },
      matterOptions: {
        collisionFilter: { group: this.group },
        friction: 1,
        restitution: 0,
        density: 0.1
      },
      options: {
        classes: ['wireframe']
      }
    });

    this.physics.add(seesaw);
    this.physics.add(
      Matter.Constraint.create({
        bodyA: seesaw.getMatter(),
        pointB: Matter.Vector.clone(seesaw.getMatter().position),
        stiffness: 1,
        type: 'pin',
        length: 0
      })
    );
  }
}
