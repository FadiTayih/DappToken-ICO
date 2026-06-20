# DappToken ICO

A fully tested, feature-rich Initial Coin Offering (ICO) smart contract suite built with Solidity 0.4.26, OpenZeppelin 1.12.0, and Truffle 5.11.5.

## Features

- **Mintable & Pausable ERC20 Token** – DappToken (DAPP)
- **Multi-stage Crowdsale** – Pre-ICO and ICO with adjustable rates
- **Hard-capped & Refundable** – Goal not reached? Investors can claim refunds
- **Whitelisted** – Only approved addresses can participate
- **Timed** – Automatic opening/closing with time-travel support in tests
- **Investor Caps** – Minimum and maximum contributions per address
- **Token Vesting** – Founders/partners tokens locked in `TokenTimelock` and released after a set time
- **Pausable transfers** – Token transfers blocked during crowdsale
- **Complete Test Suite** – 27 tests covering all scenarios (minting, caps, stages, refunds, vesting, etc.)

## Tech Stack

- Solidity 0.4.26
- OpenZeppelin 1.12.0
- Truffle 5.11.5
- Node.js 24.16.0
- Ganache-cli for local development
- Chai + Chai-as-promised for testing


## Quick Start

### Prerequisites

- Node.js (>=14) and npm
- Truffle installed globally (`npm install -g truffle`)
- Ganache-cli (`npm install -g ganache-cli`) – or use the built‑in Ganache

### Installation

```bash
git clone https://github.com/your-username/DappToken-ICO.git
cd DappToken-ICO
npm install
