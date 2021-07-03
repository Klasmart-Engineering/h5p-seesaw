// Import required classes
import BalanceContent from './h5p-balance-content';
import Util from './h5p-balance-util';

/**
 * Class for Balance.
 */
export default class Balance extends H5P.Question {
  /**
   * @constructor
   * @param {object} params Parameters passed by the editor.
   * @param {number} contentId Content's id.
   * @param {object} [extras] Saved state, metadata, etc.
   */
  constructor(params, contentId, extras = {}) {
    super('balance'); // CSS class selector for content's iframe: h5p-balance

    /*
     * this.params.behaviour.enableSolutionsButton and this.params.behaviour.enableRetry
     * are used by H5P's question type contract.
     * @see {@link https://h5p.org/documentation/developers/contracts#guides-header-8}
     * @see {@link https://h5p.org/documentation/developers/contracts#guides-header-9}
     */

    // Make sure all variables are set
    this.params = Util.extend({
      item1: {
        width: 100,
        height: 100,
        weight: 1000
      },
      item2: {
        width: 100,
        height: 100,
        weight: 1000
      },
      behaviour: {
        enableSolutionsButton: true,
        enableRetry: true
      },
      l10n: {
        checkAnswer: 'Check answer',
        showSolution: 'Show solution',
        tryAgain: 'Retry'
      },
      a11y: {
        checkAnswer: 'Check the answers. The responses will be marked as correct, incorrect, or unanswered.',
        showSolution: 'Show the solution. The task will be marked with its correct solution.',
        tryAgain: 'Reset the exercise to its original state.'
      }
    }, params);

    this.contentId = contentId;
    this.extras = extras;

    // Sanitize a11y and l10n
    for (let phrase in this.params.a11y) {
      this.params.a11y[phrase] = Util.stripHTML(Util.htmlDecode(this.params.a11y[phrase]));
    }
    for (let phrase in this.params.l10n) {
      this.params.l10n[phrase] = Util.stripHTML(Util.htmlDecode(this.params.l10n[phrase]));
    }

    // Set default language for xAPI
    const defaultLanguage = (extras.metadata) ? extras.metadata.defaultLanguage || 'en' : 'en';
    this.languageTag = Util.formatLanguageCode(defaultLanguage);

    // this.previousState now holds the saved content state of the previous session
    this.previousState = this.extras.previousState || {};
  }

  /**
   * Register the DOM elements with H5P.Question
   */
  registerDomElements() {
    this.content = new BalanceContent({
      items: [this.params.item1, this.params.item2]
    });

    // Register content with H5P.Question
    this.setContent(this.content.getDOM());

    // Register Buttons
    // this.addButtons();

    /*
     * H5P.Question also offers some more functions that could be used.
     * Consult https://github.com/h5p/h5p-question for details
     */

    this.on('resize', () => {
      this.handleResize();
    });
  }

  /**
   * Add all the buttons that shall be passed to H5P.Question.
   */
  addButtons() {
    // Check answer button
    this.addButton('check-answer', this.params.l10n.checkAnswer, () => {
      // TODO: Implement something useful to do on click
      this.hideButton('check-answer');

      if (this.params.behaviour.enableSolutionsButton) {
        this.showButton('show-solution');
      }

      if (this.params.behaviour.enableRetry) {
        this.showButton('try-again');
      }
    }, true, {
      'aria-label': this.params.a11y.checkAnswer
    }, {});

    // Show solution button
    this.addButton('show-solution', this.params.l10n.showSolution, () => {
      // TODO: Implement something useful to do on click
    }, false, {
      'aria-label': this.params.a11y.showSolution
    }, {});

    // Retry button
    this.addButton('try-again', this.params.l10n.tryAgain, () => {
      this.showButton('check-answer');
      this.hideButton('show-solution');
      this.hideButton('try-again');

      this.resetTask();

      this.trigger('resize');
    }, false, {
      'aria-label': this.params.a11y.tryAgain
    }, {});
  }

  /**
   * Check if result has been submitted or input has been given.
   * @return {boolean} True, if answer was given.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-1}
   */
  getAnswerGiven() {
    return false; // TODO: Return your value here
  }

  /**
   * Get latest score.
   * @return {number} latest score.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-2}
   */
  getScore() {
    return 0; // TODO: Return real score here
  }

  /**
   * Get maximum possible score.
   * @return {number} Score necessary for mastering.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-3}
   */
  getMaxScore() {
    return 0; // TODO: Return real maximum score here
  }

  /**
   * Show solutions.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-4}
   */
  showSolutions() {
    // TODO: Implement showing the solutions

    this.trigger('resize');
  }

  /**
   * Reset task.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-5}
   */
  resetTask() {
    // TODO: Reset what needs to be reset
  }

  /**
   * Get xAPI data.
   * @return {object} XAPI statement.
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   */
  getXAPIData() {
    return {
      statement: this.getXAPIAnswerEvent().data.statement
    };
  }

  /**
   * Build xAPI answer event.
   * @return {H5P.XAPIEvent} XAPI answer event.
   */
  getXAPIAnswerEvent() {
    const xAPIEvent = this.createXAPIEvent('answered');

    xAPIEvent.setScoredResult(this.getScore(), this.getMaxScore(), this,
      true, this.isPassed());

    /*
     * TODO: Add other properties here as required, e.g. xAPIEvent.data.statement.result.response
     * https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#245-result
     */

    return xAPIEvent;
  }

  /**
   * Create an xAPI event for Dictation.
   * @param {string} verb Short id of the verb we want to trigger.
   * @return {H5P.XAPIEvent} Event template.
   */
  createXAPIEvent(verb) {
    const xAPIEvent = this.createXAPIEventTemplate(verb);
    Util.extend(
      xAPIEvent.getVerifiedStatementValue(['object', 'definition']),
      this.getxAPIDefinition());
    return xAPIEvent;
  }

  /**
   * Get the xAPI definition for the xAPI object.
   * @return {object} XAPI definition.
   */
  getxAPIDefinition() {
    const definition = {
      name: {},
      description: {},
      type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
      interactionType: 'other'
    };

    // Fallback for h5p-php-reporting, expects en-US
    definition.name[this.languageTag] = this.getTitle();
    definition.name['en-US'] = definition.name[this.languageTag];

    // Fallback for h5p-php-reporting, expects en-US
    definition.description[this.languageTag] = this.getDescription();
    definition.description['en-US'] = definition.description[this.languageTag];

    return definition;
  }

  /**
   * Determine whether the task has been passed by the user.
   * @return {boolean} True if user passed or task is not scored.
   */
  isPassed() {
    return true;
  }

  /**
   * Get tasks title.
   * @return {string} Title.
   */
  getTitle() {
    let raw;
    if (this.extras.metadata) {
      raw = this.extras.metadata.title;
    }
    raw = raw || Balance.DEFAULT_DESCRIPTION;

    // H5P Core function: createTitle
    return H5P.createTitle(raw);
  }

  /**
   * Get tasks description.
   * @return {string} Description.
   */
  // TODO: Have a field for a task description in the editor if you need one.
  getDescription() {
    return this.params.taskDescription || Balance.DEFAULT_DESCRIPTION;
  }

  /**
   * Answer call to return the current state.
   * @return {object} Current state.
   */
  getCurrentState() {
    /*
     * TODO: Return any data object that will indicate the state that should
     * be loaded on start, here it's a random number
     */
    return {
      random: Math.random(100)
    };
  }

  /**
   * Handle resize.
   */
  handleResize() {
    this.content.resize();
  }
}

/** @constant {string} */
Balance.DEFAULT_DESCRIPTION = 'Balance';
