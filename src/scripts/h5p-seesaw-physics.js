import Matter from 'matter-js';
import Util from './h5p-seesaw-util';
import SeesawBox from './matter-objects/h5p-seesaw-box';

/** Class representing the physics */
export default class SeesawPhysics {
  /**
   * @constructor
   * @param {object} [params={}] Parameters.
   * @param {object} [callbacks={}] Callbacks.
   */
  constructor(params = {}, callbacks = {}) {

    this.params = Util.extend({
    }, params);

    this.callbacks = Util.extend({
    }, callbacks);

    this.items = [];

    // switch to toggle world on and off
    this.enabled = false;

    // create an engine
    this.engine = Matter.Engine.create({
      enableSleeping: false
    });

    // Create a runner
    this.runner = Matter.Runner.create();
  }

  /**
   * Determine whether world is enabled.
   * @return {boolean} True, if world is enabled. Else false.
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Add an item to the world.
   * @param {SeesawBox|Matter.Constraint} item Item to be added.
   */
  add(item) {
    if (item instanceof SeesawBox) {
      this.items.push(item);
      Matter.Composite.add(this.engine.world, item.getMatter());
    }
    else {
      // Currently a Constraint only, but this should be checked
      Matter.Composite.add(this.engine.world, item);
    }
  }

  /**
   * Run the world.
   */
  run() {
    this.enabled = true;
    Matter.Runner.start(this.runner, this.engine);
  }

  /**
   * Stop the world.
   */
  stop() {
    this.enabled = false;
    Matter.Runner.stop(this.runner);
  }

  /**
   * Update the world.
   */
  update() {
    if (!this.enabled) {
      return;
    }

    Matter.Engine.update(this.engine);
  }

  /**
   * Get itmes in this world.
   * @return {object[]} Items in this world.
   */
  getItems() {
    return this.items;
  }
}
