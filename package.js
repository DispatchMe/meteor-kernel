Package.describe({
  name: 'dispatch:kernel',
  version: '0.0.3',
  summary: 'Run tasks in animation frame directly and throttled',
  git: 'https://github.com/DispatchMe/meteor-kernel.git'
});

Package.onUse(function (api) {
  api.export('Kernel');

  api.versionsFrom('1.0');

  api.use([
    'tracker',
    'blaze',
    'meteor',
    'dispatch:request-animation-frame@0.0.1',
    'underscore',
  ], 'web');

  api.addFiles([
    'kernel.js',
    'meteor.js'
  ], 'web');
});
