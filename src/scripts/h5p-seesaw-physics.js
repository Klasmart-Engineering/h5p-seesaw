import Matter from 'matter-js';
import Util from './h5p-seesaw-util';
import SeesawBox from './matter-objects/h5p-seesaw-box';

/** Class representing the physics */
export default class SeesawPhysics {
  constructor(params = {}, callbacks = {}) {

    this.params = Util.extend({
    }, params);

    this.callbacks = Util.extend({
      onUpdate: () => {}
    }, callbacks);

    this.objects = [];

    this.enabled = false;

    // create an engine
    this.engine = Matter.Engine.create({
      enableSleeping: false
    });

    this.runner = Matter.Runner.create();
  }

  isEnabled() {
    return this.enabled;
  }

  add(object) {
    if (object instanceof SeesawBox) {
      this.objects.push(object);
      Matter.Composite.add(this.engine.world, object.getMatter());
    }
    else {
      // Currently a Constraint only, but this should be checked
      Matter.Composite.add(this.engine.world, object);
    }
  }

  run() {
    this.enabled = true;
    Matter.Runner.start(this.runner, this.engine);
  }

  stop() {
    this.enabled = false;
    Matter.Runner.stop(this.runner);
  }

  update() {
    if (!this.enabled) {
      return;
    }

    Matter.Engine.update(this.engine);
  }

  getObjects() {
    return this.objects;
  }
}
