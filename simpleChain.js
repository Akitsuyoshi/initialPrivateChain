const SHA256 = require("crypto-js/sha256");
const level = require("level");
const chainDB = "./chaindataForSimple";
const db = level(chainDB);

class Block {
  constructor(data) {
    this.hash = "";
    this.height = 0;
    this.body = data;
    this.time = 0;
    this.previousBlockHash = "";
  }
}

class Blockchain {
  constructor() {
    this.chain = [];
  }

  putBlockToDB(newBlock, height) {
    newBlock.height = height;
    newBlock.time = new Date().getTime().toString().slice(0, -3);
    newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
    return addDataToLevelDB(height, JSON.stringify(newBlock).toString());
  }

  // Add new block
  async addBlock(newBlock) {
    try {
      let blockHeight = await this.getBlockHeight();
      if (blockHeight === 0) await this.putBlockToDB(new Block("First block in the chain - Genesis block"), blockHeight);
      else if (blockHeight > 0) blockHeight -= 1;

      // previous block hash
      const prev = await this.getBlock(blockHeight);
      newBlock.previousBlockHash = prev.hash;
      await this.putBlockToDB(newBlock, blockHeight + 1);

      return newBlock;
    } catch (err) {
      console.log("addBlock is failed " + err);
    }
  }

  // Get block height
  getBlockHeight() {
    return new Promise((resolve, reject) => {
      let count = 0;
      db.createKeyStream()
        .on("data", () => count++)
        .on("error", (err) => reject(console.log("Unable to read data stream!", err)))
        .on("close", () => resolve(count));
    });
  }

  // get block
  getBlock(blockHeight) {
    // return object
    return new Promise((resolve, reject) => {
      db.get(blockHeight)
        .then((value) => resolve(JSON.parse(value)))
        .catch((err) => reject(console.log("Not found!", err)));
    });
  }

  // validate block
  async validateBlock(blockHeight) {
    try {
      const block = await this.getBlock(blockHeight);
      console.log(block);
      let blockHash = block.hash;
      block.hash = "";
      let validBlockHash = SHA256(JSON.stringify(block)).toString();

      return (blockHash === validBlockHash) ? true : false;
    } catch (err) {
      console.log("validateBlock is failed " + err);
    }
  }

  // Validate blockchain
  async validateChain() {
    try {
      // if validation is gonna be failed, it push false into errorLog, otherwise, true.
      const errorLog = [];
      const blockHeight = await this.getBlockHeight();
      for (let i = 0; i < blockHeight - 1; i++) {
        // validate block
        errorLog.push(this.validateBlock(i));
        // compare blocks hash link
        errorLog.push(this.getBlock(i).hash === this.getBlock(i + 1).previousBlockHash);
      }
      return Promise.all(errorLog).then((result) => {
        // if something wrong happed, result supposed to hold error
        result = result.filter((v) => v === false);
        if (result.length > 0) {
          console.log("Block errors = " + result.length + "Blocks: " + result);
        } else {
          console.log("No errors detected");
        }
      }); 
    } catch (err) {
      console.log("validateChain is failed " + err);
    }
  }
}


// Add data to levelDB with key/value
function addDataToLevelDB(key, value) {
  return new Promise((resolve, reject) => {
    db.put(key, value)
      .then((value) => resolve(value))
      .catch((err) => reject(console.log("Block " + key + " submission failed", err)));
  });
}

let blockchain = new Blockchain();
(function theLoop (i) {
  setTimeout(() => {
    let blockTest = new Block("Test Block - " + (i + 1));
    blockchain.addBlock(blockTest).then((result) => {
      console.log(result);
      i++;
      if (i < 10) theLoop(i);
    });
  }, 1000);
})(0);

setTimeout(() => {
  blockchain.validateChain();
}, 11150);