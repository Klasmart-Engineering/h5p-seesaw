import Matter from 'matter-js';
import Util from './../h5p-balance-util';

/** Class representing a box */
export default class BalanceBox {

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
      onMoveStart: () => {}
    }, callbacks);

    if (typeof this.params.classes === 'string') {
      this.params.classes = [this.params.classes];
    }

    this.boxMatter = Matter.Bodies.rectangle(
      this.params.position.x,
      this.params.position.y,
      this.params.size.width,
      this.params.size.height,
      this.params.matterOptions
    );

    this.boxDOM = document.createElement('div');

    this.boxDOM.classList.add('h5p-balance-matter-object');
    this.params.options.classes.forEach(className => {
      this.boxDOM.classList.add(className);
    });

    if (this.params.options?.image?.params?.file?.path && this.params.options?.contentId) {
      this.boxDOM.style.backgroundImage = `URL(${H5P.getPath(this.params.options.image.params.file.path, this.params.options.contentId)})`;
    }

    // TODO: Set box height based on image width/height?
    this.boxDOM.style.width = `${this.params.size.width}px`;
    this.boxDOM.style.height = `${this.params.size.height}px`;

    if (this.params.options.movable) {
      this.boxDOM.setAttribute('draggable', true);
    }
    else {
      this.boxDOM.setAttribute('draggable', false);
      this.boxDOM.classList.add('immovable');
    }
  }

  getBoundingBoxDOM() {
    return {
      width: this.boxDOM.getBoundingClientRect().width,
      height: this.boxDOM.getBoundingClientRect().height
    };
  }

  getPositionDOM() {
    return {
      x: parseFloat(this.boxDOM.style.left),
      y: parseFloat(this.boxDOM.style.top)
    };
  }

  setPositionDOM(position, params) {
    if (params.constraints) {
      position = {
        x: Util.constrain(position.x, params.constraints.min.x, params.constraints.max.x),
        y: Util.constrain(position.y, params.constraints.min.y, params.constraints.max.y)
      };
    }

    this.boxDOM.style.left = `${position.x}px`;
    this.boxDOM.style.top = `${position.y}px`;
  }

  getPositionMatter() {
    return {
      x: this.boxMatter.position.x,
      y: this.boxMatter.position.y
    };
  }

  setPositionMatter(position, params = {}) {
    if (params.constraints) {
      position = {
        x: Util.constrain(position.x, params.constraints.min.x, params.constraints.max.x),
        y: Util.constrain(position.y, params.constraints.min.y, params.constraints.max.y)
      };
    }

    Matter.Body.setPosition(this.boxMatter, position);
  }

  getDOM() {
    return this.boxDOM;
  }

  getMatter() {
    return this.boxMatter;
  }

  startDrag(scale) {
    Matter.Body.setAngle(this.boxMatter, 0);
    Matter.Body.setAngularVelocity(this.boxMatter, 0);

    this.boxDOM.style.transform = `translate(-50%, -50%) rotate(${this.boxMatter.angle || 0}rad) scale(${scale})`;

    this.boxMatter.isStatic = true;
    this.skipUpdate = true;
  }

  endDrag() {
    this.boxMatter.isStatic = false;
    this.skipUpdate = false;
  }

  hide() {
    this.boxDOM.classList.add('invisible');
  }

  show() {
    this.boxDOM.classList.remove('invisible');
  }
}
