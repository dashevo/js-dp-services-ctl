const IPFSInstanceOptions = require('./IPFSInstanceOptions');
const Network = require('../docker/Network');
const Image = require('../docker/Image');
const IpfsApi = require('ipfs-api');
const Container = require('../docker/Container');
const IPFSInstance = require('./IPFSInstance');

/**
 * Create IPFS instance
 *
 * @param {Array} envs
 * @returns {Promise<IPFSInstance>}
 */
async function createIPFSInstance(opts) {
  const options = opts instanceof IPFSInstanceOptions
    ? opts
    : new IPFSInstanceOptions(opts);

  const { name: networkName, driver } = options.getContainerNetworkOptions();
  const network = new Network(networkName, driver);

  const imageName = options.getContainerImageName();
  const image = new Image(imageName);

  const containerOptions = options.getContainerOptions();
  const container = new Container(networkName, imageName, containerOptions);

  return new IPFSInstance(network, image, container, IpfsApi, options);
}

module.exports = createIPFSInstance;
