const startHelperWithMochaHooksFactory = require('./startHelperWithMochaHooksFactory');
const startDashDrive = require('../services/startDashDrive');

module.exports = startHelperWithMochaHooksFactory(startDashDrive, { timeout: 170000 });