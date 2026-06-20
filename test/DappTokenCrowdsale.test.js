const ether = require("./helpers/ether");
const EVMReverts = require("./helpers/EVMReverts");
const { increaseTimeTo, duration } = require("./helpers/increaseTime");
const latestTime = require("./helpers/latestTime");

require("chai")
  .use(require("chai-as-promised"))
  .should();

const DappToken = artifacts.require("DappToken");
const DappTokenCrowdsale = artifacts.require("DappTokenCrowdsale");

// Manual ABIs for contracts whose artifacts are not exposed by Truffle
const RefundVaultABI = [
  {
    constant: false,
    inputs: [{ name: "refundee", type: "address" }],
    name: "refund",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

const TokenTimelockABI = [
  {
    constant: false,
    inputs: [],
    name: "release",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

contract("DappTokenCrowdsale", function([
  _,
  wallet,
  investor1,
  investor2,
  foundersFund,
  foundationFund,
  partnersFund,
]) {
  beforeEach(async function() {
    this.name = "DappToken";
    this.symbol = "DAPP";
    this.decimals = 18;

    this.token = await DappToken.new(this.name, this.symbol, this.decimals);

    this.rate = 500;
    this.wallet = wallet;
    this.cap = 100;
    this.openingTime = (await latestTime()) + duration.weeks(1);
    this.closingTime = this.openingTime + duration.weeks(1);
    this.goal = 50;
    this.foundersFund = foundersFund;
    this.foundationFund = foundationFund;
    this.partnersFund = partnersFund;
    this.releaseTime = this.closingTime + duration.years(1);

    this.investorMinCap = 0.002;
    this.investorHardCap = 50;

    this.preIcoStage = 0;
    this.preIcoRate = 500;
    this.icoStage = 1;
    this.icoRate = 250;

    this.tokenSalePercentage = 70;
    this.foundersPercentage = 10;
    this.foundationPercentage = 10;
    this.partnersPercentage = 10;

    this.crowdsale = await DappTokenCrowdsale.new(
      this.rate,
      this.wallet,
      this.token.address,
      ether(this.cap.toString()),
      this.openingTime,
      this.closingTime,
      ether(this.goal.toString()),
      this.foundersFund,
      this.foundationFund,
      this.partnersFund,
      this.releaseTime,
    );

    await this.token.pause();
    await this.token.transferOwnership(this.crowdsale.address);

    await this.crowdsale.addToWhitelist(investor1);
    await this.crowdsale.addToWhitelist(investor2);

    this.vaultAddress = await this.crowdsale.vault();
    this.vault = new web3.eth.Contract(RefundVaultABI, this.vaultAddress);

    await increaseTimeTo(this.openingTime + 1);
  });

  describe("crowdsale", function() {
    it("tracks the rate", async function() {
      const rate = await this.crowdsale.rate();
      rate.toNumber().should.equal(this.rate);
    });
    it("tracks the wallet", async function() {
      const wallet = await this.crowdsale.wallet();
      wallet.should.equal(this.wallet);
    });
    it("tracks the token", async function() {
      const token = await this.crowdsale.token();
      token.should.equal(this.token.address);
    });
  });

  describe("minted crowdsale", function() {
    it("mints tokens after purchase", async function() {
      const originalTotalSupply = await this.token.totalSupply();
      await this.crowdsale.sendTransaction({
        value: ether(1),
        from: investor1,
      });
      const newTotalSupply = await this.token.totalSupply();
      assert.isTrue(newTotalSupply > originalTotalSupply);
    });
  });

  describe("capped crowdsale", function() {
    it("has the correct hard cap", async function() {
      const cap = await this.crowdsale.cap();
      cap.toString().should.equal(ether(this.cap.toString()).toString());
    });
  });

  describe("timed crowdsale", function() {
    it("is open", async function() {
      const isClosed = await this.crowdsale.hasClosed();
      isClosed.should.be.false;
    });
  });

  describe("whitelisted crowdsale", function() {
    it("rejects contributions from non-whitelisted investors", async function() {
      const notWhitelisted = _;
      await this.crowdsale
        .buyTokens(notWhitelisted, { value: ether(1), from: notWhitelisted })
        .should.be.rejectedWith(EVMReverts);
    });
  });

  describe("refundable crowdsale", function() {
    beforeEach(async function() {
      await this.crowdsale.buyTokens(investor1, {
        value: ether(1),
        from: investor1,
      });
    });

    describe("during crowdsale", function() {
      it("prevents the investor from claiming refund", async function() {
        await this.vault.methods
          .refund(investor1)
          .send({ from: investor1 })
          .should.be.rejectedWith(EVMReverts);
      });
    });

    describe("when the crowdsale stage is PreICO", function() {
      beforeEach(async function() {
        await this.crowdsale.buyTokens(investor1, {
          value: ether(1),
          from: investor1,
        });
      });

      it("forwards funds to the wallet", async function() {
        const balance = await web3.eth.getBalance(this.wallet);
        const balanceBN = new web3.utils.BN(balance);
        assert(balanceBN.gt(ether(99)), "Wallet balance should be > 99 ETH");
      });
    });

    describe("when the crowdsale stage is ICO", function() {
      beforeEach(async function() {
        await this.crowdsale.setCrowdsaleStage(this.icoStage, { from: _ });
        await this.crowdsale.buyTokens(investor1, {
          value: ether(1),
          from: investor1,
        });
      });

      it("forwards funds to the refund vault", async function() {
        const balance = await web3.eth.getBalance(this.vaultAddress);
        Number(balance).should.be.above(0);
      });
    });
  });

  describe("crowdsale stages", function() {
    it("it starts in PreICO", async function() {
      const stage = await this.crowdsale.stage();
      stage.toNumber().should.equal(this.preIcoStage);
    });
    it("starts at the preICO rate", async function() {
      const rate = await this.crowdsale.rate();
      rate.toNumber().should.equal(this.preIcoRate);
    });
    it("allows admin to update the stage & rate", async function() {
      await this.crowdsale.setCrowdsaleStage(this.icoStage, { from: _ });
      const stage = await this.crowdsale.stage();
      stage.toNumber().should.equal(this.icoStage);
      const rate = await this.crowdsale.rate();
      rate.toNumber().should.equal(this.icoRate);
    });
    it("prevents non-admin from updating the stage", async function() {
      await this.crowdsale
        .setCrowdsaleStage(this.icoStage, { from: investor1 })
        .should.be.rejectedWith(EVMReverts);
    });
  });

  describe("accepting payments", function() {
    it("should accept payments", async function() {
      const value = ether(1);
      await this.crowdsale.sendTransaction({ value: value, from: investor1 })
        .should.be.fulfilled;
      await this.crowdsale.buyTokens(investor1, {
        value: value,
        from: investor2,
      }).should.be.fulfilled;
    });
  });

  describe("buyTokens()", function() {
    describe("when the contribution is less than the minimum cap", function() {
      it("rejects the transaction", async function() {
        const value = ether(this.investorMinCap.toString()).subn(1);
        await this.crowdsale
          .buyTokens(investor2, { value: value, from: investor2 })
          .should.be.rejectedWith(EVMReverts);
      });
    });

    describe("when the investor has already met the minimum cap", function() {
      it("allows the investor to contribute below the minimum cap", async function() {
        await this.crowdsale.buyTokens(investor1, {
          value: ether(1),
          from: investor1,
        });
        await this.crowdsale.buyTokens(investor1, { value: 1, from: investor1 })
          .should.be.fulfilled;
      });
    });
  });

  describe("when the total contributions exceed the investor hard cap", function() {
    it("rejects the transaction", async function() {
      await this.crowdsale.buyTokens(investor1, {
        value: ether(2),
        from: investor1,
      });
      await this.crowdsale
        .buyTokens(investor1, { value: ether(49), from: investor1 })
        .should.be.rejectedWith(EVMReverts);
    });
  });

  describe("when the contribution is within the valid range", function() {
    const value = ether(2);
    it("succeeds & updates the contribution amount", async function() {
      await this.crowdsale.buyTokens(investor2, {
        value: value,
        from: investor2,
      }).should.be.fulfilled;
      const contribution = await this.crowdsale.getUserContribution(investor2);
      contribution.toString().should.equal(value.toString());
    });
  });

  describe("token transfers", function() {
    it("does not allow investors to transfer tokens during crowdsale", async function() {
      await this.crowdsale.buyTokens(investor1, {
        value: ether(1),
        from: investor1,
      });
      await this.token
        .transfer(investor2, 1, { from: investor1 })
        .should.be.rejectedWith(EVMReverts);
    });
  });

  describe("finalizing the crowdsale", function() {
    describe("when the goal is not reached", function() {
      beforeEach(async function() {
        await this.crowdsale.buyTokens(investor2, {
          value: ether(1),
          from: investor2,
        });
        await increaseTimeTo(this.closingTime + 1);
        await this.crowdsale.finalize({ from: _ });
      });

      it("allows the investor to claim refund", async function() {
        await this.vault.methods.refund(investor2).send({ from: investor2 })
          .should.be.fulfilled;
      });
    });

    describe("when the goal is reached", function() {
      beforeEach(async function() {
        await this.crowdsale.buyTokens(investor1, {
          value: ether(26),
          from: investor1,
        });
        await this.crowdsale.buyTokens(investor2, {
          value: ether(26),
          from: investor2,
        });
        await increaseTimeTo(this.closingTime + 1);
        await this.crowdsale.finalize({ from: _ });
      });

      it("handles goal reached", async function() {
        const goalReached = await this.crowdsale.goalReached();
        goalReached.should.be.true;
        const mintingFinished = await this.token.mintingFinished();
        mintingFinished.should.be.true;
        const paused = await this.token.paused();
        paused.should.be.false;

        await this.token.transfer(investor2, 1, { from: investor1 }).should.be
          .fulfilled;

        // Use the exact contract division order: alreadyMinted / 70 * 100
        const alreadyMinted = ether(26000); // 13,000 × 2 investors
        const finalTotal = alreadyMinted.divn(70).muln(100);
        const foundersAmount = finalTotal
          .muln(this.foundersPercentage)
          .divn(100);
        const foundationAmount = finalTotal
          .muln(this.foundationPercentage)
          .divn(100);
        const partnersAmount = finalTotal
          .muln(this.partnersPercentage)
          .divn(100);

        const foundersTimelockAddress = await this.crowdsale.foundersTimelock();
        let foundersBal = await this.token.balanceOf(foundersTimelockAddress);
        foundersBal.toString().should.equal(foundersAmount.toString());

        const foundationTimelockAddress = await this.crowdsale.foundationTimelock();
        let foundationBal = await this.token.balanceOf(
          foundationTimelockAddress,
        );
        foundationBal.toString().should.equal(foundationAmount.toString());

        const partnersTimelockAddress = await this.crowdsale.partnersTimelock();
        let partnersBal = await this.token.balanceOf(partnersTimelockAddress);
        partnersBal.toString().should.equal(partnersAmount.toString());

        const foundersTimelock = new web3.eth.Contract(
          TokenTimelockABI,
          foundersTimelockAddress,
        );
        const foundationTimelock = new web3.eth.Contract(
          TokenTimelockABI,
          foundationTimelockAddress,
        );
        const partnersTimelock = new web3.eth.Contract(
          TokenTimelockABI,
          partnersTimelockAddress,
        );

        await foundersTimelock.methods
          .release()
          .send({ from: _ })
          .should.be.rejectedWith(EVMReverts);
        await foundationTimelock.methods
          .release()
          .send({ from: _ })
          .should.be.rejectedWith(EVMReverts);
        await partnersTimelock.methods
          .release()
          .send({ from: _ })
          .should.be.rejectedWith(EVMReverts);

        await increaseTimeTo(this.releaseTime + 1);
        await foundersTimelock.methods.release().send({ from: _ }).should.be
          .fulfilled;
        await foundationTimelock.methods.release().send({ from: _ }).should.be
          .fulfilled;
        await partnersTimelock.methods.release().send({ from: _ }).should.be
          .fulfilled;

        let foundersBeneficiaryBal = await this.token.balanceOf(
          this.foundersFund,
        );
        foundersBeneficiaryBal
          .toString()
          .should.equal(foundersAmount.toString());
        let foundationBeneficiaryBal = await this.token.balanceOf(
          this.foundationFund,
        );
        foundationBeneficiaryBal
          .toString()
          .should.equal(foundationAmount.toString());
        let partnersBeneficiaryBal = await this.token.balanceOf(
          this.partnersFund,
        );
        partnersBeneficiaryBal
          .toString()
          .should.equal(partnersAmount.toString());

        const owner = await this.token.owner();
        owner.should.equal(this.wallet);

        await this.vault.methods
          .refund(investor1)
          .send({ from: investor1 })
          .should.be.rejectedWith(EVMReverts);
      });
    });
  });

  describe("token distribution", function() {
    it("tracks token distribution correctly", async function() {
      const tokenSale = await this.crowdsale.tokenSalePercentage();
      tokenSale.toNumber().should.equal(this.tokenSalePercentage);
      const founders = await this.crowdsale.foundersPercentage();
      founders.toNumber().should.equal(this.foundersPercentage);
      const foundation = await this.crowdsale.foundationPercentage();
      foundation.toNumber().should.equal(this.foundationPercentage);
      const partners = await this.crowdsale.partnersPercentage();
      partners.toNumber().should.equal(this.partnersPercentage);
    });

    it("is a valid percentage breakdown", async function() {
      const tokenSale = await this.crowdsale.tokenSalePercentage();
      const founders = await this.crowdsale.foundersPercentage();
      const foundation = await this.crowdsale.foundationPercentage();
      const partners = await this.crowdsale.partnersPercentage();
      const total =
        tokenSale.toNumber() +
        founders.toNumber() +
        foundation.toNumber() +
        partners.toNumber();
      total.should.equal(100);
    });
  });
});
