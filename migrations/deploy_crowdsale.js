const DappToken = artifacts.require("DappToken");
const DappTokenCrowdsale = artifacts.require("DappTokenCrowdsale");

// Helper: convert ether to wei (returns BN)
const ether = (n) => new web3.utils.BN(web3.utils.toWei(n.toString(), "ether"));

// Duration in seconds
const duration = {
  seconds: (val) => val,
  minutes: (val) => val * 60,
  hours: (val) => val * 3600,
  days: (val) => val * 86400,
  weeks: (val) => val * 604800,
  years: (val) => val * 31536000,
};

module.exports = async function(deployer, network, accounts) {
  // ---------- Token ----------
  const name = "Dapp Token";
  const symbol = "DAPP";
  const decimals = 18;

  await deployer.deploy(DappToken, name, symbol, decimals);
  const token = await DappToken.deployed();

  // ---------- Crowdsale parameters ----------
  const rate = 500;
  const wallet = accounts[0]; // TODO: replace with real address
  const cap = ether(100); // 100 ETH
  const goal = ether(50); // 50 ETH

  // Use on-chain time (seconds)
  const block = await web3.eth.getBlock("latest");
  const latestTime = block.timestamp;

  const openingTime = latestTime + duration.minutes(1);
  const closingTime = openingTime + duration.weeks(1);

  const foundersFund = accounts[0]; // TODO: replace with real address
  const foundationFund = accounts[0]; // TODO: replace with real address
  const partnersFund = accounts[0]; // TODO: replace with real address
  const releaseTime = closingTime + duration.days(1);

  // ---------- Deploy Crowdsale ----------
  await deployer.deploy(
    DappTokenCrowdsale,
    rate,
    wallet,
    token.address,
    cap,
    openingTime,
    closingTime,
    goal,
    foundersFund,
    foundationFund,
    partnersFund,
    releaseTime,
  );
  const crowdsale = await DappTokenCrowdsale.deployed();

  // ---------- Configure token ----------
  // Pause token so transfers are blocked during crowdsale
  await token.pause();
  // Transfer ownership to crowdsale so it can mint tokens
  await token.transferOwnership(crowdsale.address);
};
