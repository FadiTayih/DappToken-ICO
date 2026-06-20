module.exports = async function latestTime() {
  const block = await web3.eth.getBlock("latest");
  return block.timestamp;
};
