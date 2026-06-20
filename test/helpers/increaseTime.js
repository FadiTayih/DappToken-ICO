const latestTime = require("./latestTime");

function increaseTime(duration) {
  const id = Date.now();
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [duration],
        id: id,
      },
      (err1) => {
        if (err1) return reject(err1);
        web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            method: "evm_mine",
            id: id + 1,
          },
          (err2, res) => {
            return err2 ? reject(err2) : resolve(res);
          },
        );
      },
    );
  });
}

async function increaseTimeTo(target) {
  const now = await latestTime();
  if (target < now)
    throw Error(
      `Cannot increase current time(${now}) to a moment in the past(${target})`,
    );
  const diff = target - now;
  return increaseTime(diff);
}

const duration = {
  seconds: function(val) {
    return val;
  },
  minutes: function(val) {
    return val * 60;
  },
  hours: function(val) {
    return val * 3600;
  },
  days: function(val) {
    return val * 86400;
  },
  weeks: function(val) {
    return val * 604800;
  },
  years: function(val) {
    return val * 31536000;
  },
};

module.exports = { increaseTime, increaseTimeTo, duration };
