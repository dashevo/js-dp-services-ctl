const DriveSyncOptions = require('./DriveSyncOptions');
const Network = require('../../docker/Network');
const getAwsEcrAuthorizationToken = require('../../docker/getAwsEcrAuthorizationToken');
const Image = require('../../docker/Image');
const Container = require('../../docker/Container');
const DockerService = require('../../docker/DockerService');

/**
 * Create Drive sync instance
 *
 * @param {object} [opts]
 * @returns {Promise<DockerService>}
 */
async function createDashDrive(opts) {
  const options = opts instanceof DriveSyncOptions
    ? opts
    : new DriveSyncOptions(opts);

  const { name: networkName, driver } = options.getContainerNetworkOptions();
  const network = new Network(networkName, driver);

  const authorizationToken = await getAwsEcrAuthorizationToken(options.getAwsOptions());

  const imageName = options.getContainerImageName();
  const image = new Image(imageName, authorizationToken);

  const containerOptions = options.getContainerOptions();
  const container = new Container(networkName, imageName, containerOptions);

  return new DockerService(network, image, container, options);
}

module.exports = createDashDrive;