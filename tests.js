Tinytest.addAsync('Kernel.autorun -- debounced', function (test, done) {
  var rerun = new ReactiveVar();

  var counter = 0;

  Kernel.autorun(function () {
    rerun.get();
    counter++;
  }, {debounce: 32});

  // Should run once on initial computation
  test.equal(counter, 1);

  var debouncedIncr = function () {
    rerun.set(rerun.get() + 1);
    Tracker.flush();
  };

  debouncedIncr();
  debouncedIncr();
  _.delay(debouncedIncr, 16);
  _.delay(function () {
    // Should run again once debounced
    test.equal(counter, 2);
    done();
  }, 96);
});

Tinytest.addAsync('Kernel.autorun -- throttled', function (test, done) {
  var rerun = new ReactiveVar();

  var counter = 0;

  Kernel.autorun(function () {
    rerun.get();
    counter++;
    console.log('counter', counter);
  }, {throttle: 8});

  // Should run once on initial computation
  test.equal(counter, 1);

  var throttledIncr = function () {
    rerun.set(rerun.get() + 1);
    Tracker.flush();
  };

  // Run a second time
  throttledIncr();

  // Run a third time
  _.delay(throttledIncr, 16);

  _.delay(function () {
    test.equal(counter, 3);
    done();
  }, 32);
});
