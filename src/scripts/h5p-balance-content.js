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

    this.content = document.createElement('div');
    this.content.classList.add('h5p-balance-canvas');

    this.seesawAngles = [];

    this.physics = new BalancePhysics({}, {
      onUpdate: () => {
        this.handlePhysicsUpdate();
      }
    });
    this.renderer = new BalanceRenderer({ physics: this.physics });

    /*
     * TODO outline
     * - Add editor option to add images
     * - Add editor option to choose timeout
     */
    this.aspectRatio = BalanceContent.DEFAULT_ASPECT_RATIO;

    this.maxSize = {
      x: BalanceContent.BASE_SIZE,
      y: BalanceContent.BASE_SIZE / this.aspectRatio
    };

    this.content.style.width = `${this.maxSize.x}px`;
    this.content.style.height = `${this.maxSize.y}px`;

    this.addBoundaries();
    this.boxes = this.addBoxes(this.params.items);

    this.group = Matter.Body.nextGroup(true);
    this.seesaw = this.addSeesaw();

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

  handlePhysicsUpdate() {
    this.updateNumbers = this.updateNumbers || 0;
    this.updateNumbers++;

    const seesawAngle = this.seesaw.getMatter().angle * 180 / Math.PI;

    this.seesawAngles.push(seesawAngle);
    if (this.seesawAngles.length > 100) {
      this.seesawAngles.shift();
    }

    if (this.currentDraggable || this.seesawAngles.length < 100) {
      return;
    }

    const anglesMinMax = this.seesawAngles.reduce((anglesMinMax, angle) => {
      return {
        min: Math.min(anglesMinMax.min, angle),
        max: Math.max(anglesMinMax.max, angle)
      };
    }, {min: 360, max: -360});

    const anglesDelta = Math.abs(anglesMinMax.max - anglesMinMax.min);

    // This would need to be adjusted for more than 2 movables
    const speed1 = this.boxes[0].getMatter().speed;
    const speed2 = this.boxes[1].getMatter().speed;

    if (anglesDelta < 1 && speed1 < 0.3 && speed2 < 0.3 && Math.abs(speed1 - speed2) < 0.001) {
      this.seesawAngles = [];
      this.physics.stop();
    }
  }

  handleMoveStart(event) {
    if (!this.physics.isEnabled()) {
      this.physics.run();
    }

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
        mass: item.weight / 10,
        inverseMass: 1 / item.weight * 10
      }, boxOptions);

      const box = new BalanceBox(
        {
          position: position,
          size: { width: item.width, height: item.height },
          matterOptions: matterOptions,
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

      this.physics.add(box);
      boxes.push(box);
    });

    return boxes;
  }

  addSeesaw() {
    const seesaw = new BalanceBox({
      position: { x: this.maxSize.x / 2, y: this.maxSize.y - (this.maxSize.y / 10) },
      size: { width: this.maxSize.x / 1.25, height: this.maxSize.y / 25 },
      matterOptions: {
        collisionFilter: { group: this.group },
        friction: 0.9,
        frictionStatic: 10,
        restitution: 0,
        mass: 10000,
        inverseMass: 1 / 10000,
        label: 'seesaw'
      },
      options: {
        classes: ['wireframe']
      }
    });
    this.physics.add(seesaw);

    const base = new BalanceBox({
      position: { x: this.maxSize.x / 2, y: this.maxSize.y - (this.maxSize.y / 20) },
      size: { width: this.maxSize.y / 25, height: this.maxSize.y / 10 },
      matterOptions: {
        collisionFilter: { group: this.group },
        isStatic: true
      },
      options: {
        classes: ['wireframe']
      }
    });
    this.physics.add(base);

    this.physics.add(
      Matter.Constraint.create({
        bodyA: seesaw.getMatter(),
        // bodyB: base.getMatter(),
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
