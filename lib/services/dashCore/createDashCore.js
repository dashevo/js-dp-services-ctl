const RpcClient = require('@dashevo/dashd-rpc/promise');

const DashCoreOptions = require('./DashCoreOptions');
const Network = require('../../docker/Network');
const getAwsEcrAuthorizationToken = require('../../docker/getAwsEcrAuthorizationToken');
const Image = require('../../docker/Image');
const Container = require('../../docker/Container');
const DashCore = require('./DashCore');

/**
 * Create Dash Core instance
 *
 * @param {object} [opts]
 * @returns {Promise<DashCore>}
 */
async function createDashCore(opts) {
  const options = opts instanceof DashCoreOptions
    ? opts
    : new DashCoreOptions(opts);

  const { name: networkName, driver } = options.getContainerNetworkOptions();
  const network = new Network(networkName, driver);

  const imageName = options.getContainerImageName();

  let authorizationToken;
  if (imageName.includes('amazonaws.com')) {
    authorizationToken = await getAwsEcrAuthorizationToken(options.getAwsOptions());
  }

  const image = new Image(imageName, authorizationToken);

  const containerOptions = options.getContainerOptions();
  const container = new Container(networkName, imageName, containerOptions);

  return new DashCore(network, image, container, RpcClient, options);
}

module.exports = createDashCore;
