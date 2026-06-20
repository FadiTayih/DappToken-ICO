const DappToken = artifacts.require("DappToken");

require("chai").should();

contract("DappToken", (accounts) => {
  const _name = "Dapp Token";
  const _symbol = "Dapp";
  const _decimals = 18;

  beforeEach(async function() {
    this.token = await DappToken.new(_name, _symbol, _decimals);
  });

  describe("token attributes", function() {
    it("has the correct name", async function() {
      const name = await this.token.name();
      assert.equal(name, _name);
    });

    it("has the correct symbol", async function() {
      const symbol = await this.token.symbol();
      assert.equal(symbol, _symbol);
    });

    it("has the correct decimals", async function() {
      const decimals = await this.token.decimals();
      assert.equal(decimals.toNumber(), _decimals);
    });
  });
});
