const { merge } = require('lodash');

const startInsight = require('./insightApi/startInsightApi');
const createDapiCore = require('./dapi/core/createDapiCore');
const createDapiTxFilterStream = require('./dapi/txFilterStream/createDapiTxFilterStream');
const startDrive = require('./startDrive');
const startTendermintCore = require('./tendermintCore/startTendermintCore');

async function remove(services) {
  // Remove instances in right order

  try {
    await services.tendermintCore.remove();
  } catch (e) {
    // ignore
  }

  try {
    await services.dapiTxFilterStream.remove();
  } catch (e) {
    // ignore
  }

  try {
    await services.dapiCore.remove();
  } catch (e) {
    // ignore
  }

  try {
    await services.driveAbci.remove();
  } catch (e) {
    // ignore
  }

  try {
    await services.mongoDb.remove();
  } catch (e) {
    // ignore
  }

  try {
    await services.insightApi.remove();
  } catch (e) {
    // ignore
  }

  try {
    await services.dashCore.remove();
  } catch (e) {
    // ignore
  }
}

/**
 * @typedef Dapi
 * @property {DapiCore} dapiCore
 * @property {DapiTxFilterStream} dapiTxFilterStream
 * @property {DashCore} dashCore
 * @property {MongoDb} mongoDb
 * @property {Drive} drive
 * @property {InsightApi} insightApi
 * @property {DockerService} sync
 * @property {Promise<void>} clean
 * @property {Promise<void>} remove
 */

/**
 * Create Dapi instance
 *
 * @param {object} [options]
 * @returns {Promise<Dapi>}
 */
async function startDapi(options) {
  const instances = await startDapi.many(1, options);
  return instances[0];
}

/**
 * Generate random port
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function getRandomPort(min, max) {
  return Math.floor((Math.random() * ((max - min) + 1)) + min);
}

/**
 * Create Dapi instances
 *
 * @param {Number} number
 * @param {object} [options]
 * @returns {Promise<Dapi[]>}
 */
startDapi.many = async function many(number, options = {}) {
  if (number < 1) {
    throw new Error('Invalid number of instances');
  }
  if (number > 1) {
    throw new Error("We don't support more than 1 instance");
  }

  // generate tendermint settings
  const tendermintNodesOptions = [];

  for (let i = 0; i < number; i++) {
    tendermintNodesOptions.push({
      port: getRandomPort(11560, 26664),
      host: `node${i}`,
    });
  }


  // const driveInstances = await startDrive.many(number, options);
  const abciUrls = [];
  const instances = [];
  const driveInstances = [];
  // Start Drive dependencies simultaneously

  for (let i = 0; i < number; i++) {
    const driveOptions = { ...options };
    const driveInstance = await startDrive(driveOptions);

    driveInstances.push(driveInstance);

    const {
      dashCore,
      mongoDb,
      driveAbci,
    } = driveInstance;

    abciUrls.push(`tcp://${driveAbci.getIp()}:${driveAbci.getAbciPort()}`);

    const insightOptions = {
      container: {},
      config: {},
      ...options.insightApi,
    };

    merge(insightOptions.config, {
      servicesConfig: {
        dashd: {
          connect: [{
            rpchost: `${dashCore.getIp()}`,
            rpcport: `${dashCore.options.getRpcPort()}`,
            rpcuser: `${dashCore.options.getRpcUser()}`,
            rpcpassword: `${dashCore.options.getRpcPassword()}`,
            zmqpubrawtx: `tcp://host.docker.internal:${dashCore.options.getZmqPorts().rawtx}`,
            zmqpubhashblock: `tcp://host.docker.internal:${dashCore.options.getZmqPorts().hashblock}`,
          }],
        },
      },
    });

    const insightApi = await startInsight(insightOptions);

    instances.push({
      insightApi,
      driveAbci,
      mongoDb,
      dashCore,
    });
  }

  // Start Tendermint Core
  const tendermintCoreOptions = {
    abciUrls,
    nodes: tendermintNodesOptions,
  };

  const tendermintCoreInstances = await startTendermintCore.many(number, tendermintCoreOptions);

  for (let i = 0; i < number; i++) {
    // Start DAPI processes
    const { dashCore } = driveInstances[i];
    const { insightApi } = instances[i];
    const tendermintCore = tendermintCoreInstances[i];

    const dapiEnvs = [
      `INSIGHT_URI=http://${insightApi.getIp()}:${insightApi.options.getApiPort()}/insight-api`,
      `DASHCORE_RPC_HOST=${dashCore.getIp()}`,
      `DASHCORE_RPC_PORT=${dashCore.options.getRpcPort()}`,
      `DASHCORE_RPC_USER=${dashCore.options.getRpcUser()}`,
      `DASHCORE_RPC_PASS=${dashCore.options.getRpcPassword()}`,
      `DASHCORE_ZMQ_HOST=${dashCore.getIp()}`,
      `DASHCORE_ZMQ_PORT=${dashCore.options.getZmqPorts().rawtxlock}`,
      `DASHCORE_P2P_HOST=${dashCore.getIp()}`,
      `DASHCORE_P2P_PORT=${dashCore.options.getDashdPort()}`,
      'DASHCORE_P2P_NETWORK=regtest',
      'NETWORK=regtest',
      `TENDERMINT_RPC_HOST=${tendermintNodesOptions[i].host}`,
      `TENDERMINT_RPC_PORT=${tendermintNodesOptions[i].port}`,
    ];

    const dapiOptions = { ...options.dapi };
    dapiOptions.container = dapiOptions.container || {};
    dapiOptions.container.envs = dapiOptions.container.envs || [];
    dapiOptions.container.envs = dapiOptions.container.envs.concat(dapiEnvs);

    const dapiCore = await createDapiCore(dapiOptions);
    await dapiCore.start();

    // Pass JSON RPC port from DapiCore to the DapiTxFilterStream service
    dapiOptions.port = dapiCore.options.getRpcPort();

    const dapiTxFilterStream = await createDapiTxFilterStream(dapiOptions);
    await dapiTxFilterStream.start();

    const instance = Object.assign({}, instances[i], {
      dapiCore,
      dapiTxFilterStream,
      tendermintCore,
      async clean() {
        await remove(instance);

        const newServices = await startDapi(options);

        Object.assign(instance, newServices);
      },
      async remove() {
        await remove(instance);
      },
    });

    instances[i] = instance;
  }

  return instances;
};

module.exports = startDapi;
