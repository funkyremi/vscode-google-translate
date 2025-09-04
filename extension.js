const { initializeCommands } = require('./src/commands');

function activate(context) {
  initializeCommands(context);
}

exports.activate = activate;
