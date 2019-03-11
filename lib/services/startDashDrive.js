const createMongoDb = require('./mongoDb/createMongoDb');
const startIPFS = require('./IPFS/startIPFS');
const startDashCore = require('./dashCore/startDashCore');
const createDriveApi = require('./driveApi/createDriveApi');
const createDriveSync = require('./driveSync/createDriveSync');

async function callInParallel(services, method) {
  const instances = [
    services.ipfs,
    services.dashCore,
    services.mongoDb,
    services.driveApi,
    services.driveSync,
  ];
  const promises = instances.map(instance => instance[method]());
  await Promise.all(promises);
}

/**
 * @typedef DashDrive
 * @property {IPFS} ipfs
 * @property {DashCore} dashCore
 * @property {MongoDb} mongoDb
 * @property {DriveApi} driveApi
 * @property {DockerService} sync
 * @property {Promise<>} clean
 * @property {Promise<>} remove
 */

/**
 * Create DashDrive instance
 *
 * @param {object} [options]
 * @returns {Promise<DashDrive>}
 */
async function startDashDrive(options) {
  const instances = await startDashDrive.many(1, options);
  return instances[0];
}

/**
 * Create DashDrive instances
 *
 * @param {Number} number
 * @param {object} [options]
 * @returns {Promise<DashDrive[]>}
 */
startDashDrive.many = async function many(number, options = {}) {
  if (number < 1) {
    throw new Error('Invalid number of instances');
  }

  const instances = [];

  const ipfsAPIs = await startIPFS.many(number, options.ipfs);
  const dashCoreInstances = await startDashCore.many(number, options.dashCore);

  for (let i = 0; i < number; i++) {
    const dashCoreInstance = dashCoreInstances[i];
    const ipfsAPI = ipfsAPIs[i];
    const mongoDbInstance = await createMongoDb(options.mongoDb);
    await mongoDbInstance.start();

    const envs = [
      `DASHCORE_ZMQ_PUB_HASHBLOCK=${dashCoreInstance.getZmqSockets().hashblock}`,
      `DASHCORE_JSON_RPC_HOST=${dashCoreInstance.getIp()}`,
      `DASHCORE_JSON_RPC_PORT=${dashCoreInstance.options.getRpcPort()}`,
      `DASHCORE_JSON_RPC_USER=${dashCoreInstance.options.getRpcUser()}`,
      `DASHCORE_JSON_RPC_PASS=${dashCoreInstance.options.getRpcPassword()}`,
      `STORAGE_IPFS_MULTIADDR=${ipfsAPI.getIpfsAddress()}`,
      `STORAGE_MONGODB_URL=mongodb://${mongoDbInstance.getIp()}:27017`,
    ];
    const dashDriveOptions = { ...options.dashDrive };
    dashDriveOptions.container = dashDriveOptions.container || {};
    dashDriveOptions.container.envs = envs;
    const driveApiInstance = await createDriveApi(dashDriveOptions);
    await driveApiInstance.start();
    const driveSyncInstance = await createDriveSync(dashDriveOptions);
    await driveSyncInstance.start();

    const instance = {
      ipfs: ipfsAPI,
      dashCore: dashCoreInstance,
      mongoDb: mongoDbInstance,
      driveApi: driveApiInstance,
      driveSync: driveSyncInstance,
      clean: async function clean() {
        await callInParallel(instance, 'clean');
      },
      remove: async function clean() {
        await callInParallel(instance, 'remove');
      },
      connect: async function connect(otherInstance) {
        await Promise.all([
          instance.ipfs.connect(otherInstance.ipfs),
          instance.dashCore.connect(otherInstance.dashCore),
          instance.mongoDb.connect(otherInstance.mongoDb),
          instance.driveApi.connect(otherInstance.driveApi),
          instance.driveSync.connect(otherInstance.driveSync),
        ]);
      },
    };

    instances.push(instance);
  }

  return instances;
};

module.exports = startDashDrive;