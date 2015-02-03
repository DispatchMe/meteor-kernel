////////////////////////////////////////////////////////////////////////////////
// Kernel RaiX 2014
////////////////////////////////////////////////////////////////////////////////

// Timed functions
var timedFunctions = [];

// General render engine
var renderFunctions = [];

// Functions that will be run when theres time for it
var deferedFunctions = [];

// Render loop global
Kernel = {};

// Max length of defered buffer
Kernel.maxDeferedLength = 100;

// Debug flag
Kernel.debug = false;

// DOMHighResTimeStamp - High resolution timestamp polyfil
var Time = (window.performance && window.performance.now) ?
        window.performance : Date;

/**
 * Return the current timestamp in high resolution
 * @return {Number}
 */
Kernel.now = function() {
  return Time.now();
};

/**
 * Run render function
 * @param  {function}   Function to run in frame
 * @return {Kernel}
 */
Kernel.onRender = function onRender(f) {
  renderFunctions.push(f);
  return Kernel;
};

/**
 * Run function when theres time for it in the render loop
 * @param  {function}   Function to run in frame when time permits it
 * @return {Kernel}
 */
Kernel.defer = function defer(f) {
  deferedFunctions.push(f);
  return Kernel;
};

/**
 * Run a function at a fixed timestamp
 * @param  {function}
 * @param  {Number}
 * @return {Kernel}
 */
Kernel.timed = function timed(f, runAt) {
  timedFunctions.push({
    f: f,
    runAt: runAt
  });
  return Kernel;
};

var _nextTimerReferenceId = 0;
var _timerRunning = {};

var _initTimer = function() {
  // Get id
  var id = _nextTimerReferenceId++;
  // Set the timer to run
  _timerRunning[id] = true;
  // Return id
  return id;
};

/**
 * Kernel.setTimeout
 * @param {Function}
 * @param {delay}
 */
Kernel.setTimeout = function(f, delay) {
  // Initialize timer reference
  var id = _initTimer();

  Kernel.timed(function() {
    if (_timerRunning[id]) {
      // Run the function
      f();
    }
  }, Kernel.now() + delay);

  // Return clear id
  return id;
};

Kernel.setInterval = function(f, interval) {
  // Initialize timer reference
  var id = _initTimer();

  // Calc the next run
  var nextRun = Kernel.now() + interval;

  // The interval function
  var intervalFunction = function intervalFunction() {
    if (_timerRunning[id]) {
      // Calc the next run
      nextRun += interval;
      // Add the next run to the queue
      Kernel.timed(intervalFunction, nextRun);
      // Run the function
      f();
    }
  };

  // Initial run
  Kernel.timed(intervalFunction, nextRun);

  // Return clear id
  return id;
};

Kernel.clearTimeout = function clearTimer(id) {
  // Remove the timeout
  delete _timerRunning[id];
};

Kernel.clearInterval = Kernel.clearTimeout;

/**
 * Create alias function for defer
 * @type {[type]}
 */
Kernel.then = Kernel.defer;

/**
 * Create alias for onRender as run
 * @type {[type]}
 */
Kernel.run = Kernel.onRender;

Kernel.each = function KernelEach(items, f) {
  // XXX: for now depend on underscore
  _.each(items, function KernelEach_Item(item, key) {
    // Let render loop run this when theres time
    Kernel.defer(function KernelEachItem() {
      // Run the function
      f(item, key);
    });
  });

  return Kernel;
};

Kernel.autorun = function(f) {
  return Tracker.autorun(function KernelComputation(c) {
    if (c.firstRun) {
      // Let the first run be run normally
      f.call(this, c);
    } else {
      // On reruns we defer via the kernel
      Kernel.defer(function() {
        // Store current computation
        var prev = Tracker.currentComputation;

        // Set the new computation
        Tracker.currentComputation = c;//thisComputation;
        Tracker.active = !! Tracker.currentComputation;

        // Call function
        f.call(this, c);

        // Switch back
        Tracker.currentComputation = prev;
        Tracker.active = !! Tracker.currentComputation;
      });

    }
  });
};

Blaze.View.prototype.autorun = function(f, _inViewScope) {
  var self = this;

  // Lets just have the Blaze autorun defered via the Kernel

  // The restrictions on when View#autorun can be called are in order
  // to avoid bad patterns, like creating a Blaze.View and immediately
  // calling autorun on it.  A freshly created View is not ready to
  // have logic run on it; it doesn't have a parentView, for example.
  // It's when the View is materialized or expanded that the onViewCreated
  // handlers are fired and the View starts up.
  //
  // Letting the render() method call `this.autorun()` is problematic
  // because of re-render.  The best we can do is to stop the old
  // autorun and start a new one for each render, but that's a pattern
  // we try to avoid internally because it leads to helpers being
  // called extra times, in the case where the autorun causes the
  // view to re-render (and thus the autorun to be torn down and a
  // new one established).
  //
  // We could lift these restrictions in various ways.  One interesting
  // idea is to allow you to call `view.autorun` after instantiating
  // `view`, and automatically wrap it in `view.onViewCreated`, deferring
  // the autorun so that it starts at an appropriate time.  However,
  // then we can't return the Computation object to the caller, because
  // it doesn't exist yet.
  if (! self.isCreated) {
    throw new Error("View#autorun must be called from the created callback at the earliest");
  }
  if (this._isInRender) {
    throw new Error("Can't call View#autorun from inside render(); try calling it from the created or rendered callback");
  }
  if (Tracker.active) {
    throw new Error("Can't call View#autorun from a Tracker Computation; try calling it from the created or rendered callback");
  }

  var c = Kernel.autorun(function viewAutorun(c) {

    Blaze._withCurrentView(_inViewScope || self, function () {
      return f.call(self, c);
    });

  });

  self.onViewDestroyed(function () { c.stop(); });

  return c;

};


/**
 * The frame rate limit is set matching 60 fps 1000/60
 * @type {Number}
 */
Kernel.frameRateLimit = 0; // 1000 / 60;

Kernel.deferedTimeLimit = 10; // ms

Kernel.currentFrame = 0;

var lastTimeStamp = null;

Kernel.loop = function renderLoop() {
  // Get timestamp
  var timestamp = Kernel.now();

  // Request animation frame at the beginning trying to maintain 60fps
  window.requestAnimationFrame(Kernel.loop);

  // Set initial value
  if (!lastTimeStamp) lastTimeStamp = timestamp;

  // Limit the cpu/gpu load constraint ourself to the frameRateLimit
  if (Kernel.frameRateLimit && Kernel.frameRateLimit > timestamp - lastTimeStamp) return;

  // Increase the frame counter
  Kernel.currentFrame++;

  // Set current timed functions
  var currentTimedFunctions = timedFunctions;

  // Reset timedFunctions
  timedFunctions = [];

  for (var i = 0; i < currentTimedFunctions.length; i++) {
    var timedFunction = currentTimedFunctions[i];

    if (timedFunction.runAt > timestamp) {
      // not ready yet, maybe next tick
      timedFunctions.push(timedFunction);
    } else {
      // Ready...
      timedFunction.f(timedFunction.runAt, timestamp, lastTimeStamp, Kernel.currentFrame);
    }
  }

  // Run all render functions
  var renderLength = renderFunctions.length;

  while (renderLength--) {
    // Run normal function in frame
    (renderFunctions.shift())(timestamp, lastTimeStamp, Kernel.currentFrame);
  }

  // Flags for limiting verbosity
  var displayForcedDeferedCount = true;
  var displayDeferedCount = true;

  // Make sure we keep the Kernel.maxDeferedLength limit
  while (Kernel.maxDeferedLength >= 0 && deferedFunctions.length - Kernel.maxDeferedLength > 0) {
    // Display debug info
    if (Kernel.debug && displayForcedDeferedCount) {
      console.log('Kernel: force run of ' + (deferedFunctions.length - Kernel.maxDeferedLength) + ' defered functions');
      displayForcedDeferedCount=false;
    }

    // Force defered function to run
    (deferedFunctions.shift())(timestamp, lastTimeStamp, Kernel.currentFrame);
  }

  // Run defered functions - in the defered time frame
  while (deferedFunctions.length && (Kernel.now() - timestamp) < Kernel.deferedTimeLimit) {

    // Display debug info
    if (Kernel.debug && displayDeferedCount) {
      console.log('Kernel: current defered queue size', deferedFunctions.length);
      displayDeferedCount=false;
    }

    // Run the defered function
    (deferedFunctions.shift())(timestamp, lastTimeStamp, Kernel.currentFrame);
  }

  // Set last time stamp
  lastTimeStamp = timestamp;
}


// Initialize render loop
window.requestAnimationFrame(Kernel.loop);
