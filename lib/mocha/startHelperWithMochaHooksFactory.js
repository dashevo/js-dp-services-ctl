const removeContainers = require('../docker/removeContainers');

before(async function before() {
  this.timeout(60000);
  await removeContainers();
});

async function callInParallel(instances, method) {
  const promises = instances.map(instance => instance[method]());
  return Promise.all(promises);
}

/**
 * @param helper
 * @returns {startHelperWithMochaHooks}
 */
function startHelperWithMochaHooksFactory(helper) {
  /**
   * Start, clean and remove instance with Mocha hooks
   *
   * @typedef startHelperWithMochaHooks
   * @returns {Promise<DockerService>}
   */
  async function startHelperWithMochaHooks(options) {
    const instances = await startHelperWithMochaHooks.many(1, options);
    return instances[0];
  }

  /**
   * Start, clean and remove several instance with Mocha hooks
   *
   * @param {int} number
   * @returns {Promise<DockerService[]>}
   */
  startHelperWithMochaHooks.many = async function many(number, options) {
    return new Promise((resolve) => {
      let instances = [];
      const defaultTimeout = number * 90000;

      before(async function before() {
        this.timeout(defaultTimeout);

        instances = await helper.many(number, options);
        resolve(instances);
      });

      afterEach(async function afterEach() {
        this.timeout(defaultTimeout);
        await callInParallel(instances, 'clean');
      });

      after(async function after() {
        this.timeout(defaultTimeout);
        await callInParallel(instances, 'remove');
      });
    });
  };

  return startHelperWithMochaHooks;
}

module.exports = startHelperWithMochaHooksFactory;