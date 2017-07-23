// Spec: In Truffle, create a migration script that calls the CreateProject function after FundingHub has been deployed.

var FundingHub = artifacts.require("./FundingHub.sol");

module.exports = function(deployer) {
  deployer.deploy(FundingHub)
  .then(function() {
    return FundingHub.deployed()
  }).then(instance => {
    console.log('Creating first project');
    let nowT = new Date(), // now UTC
    deadlineSecs = nowT.getTime()/1000.0 + 3600; // 1 hour from now
    // console.log('nowT', nowT);
    // console.log('deadline secs', deadlineSecs);
    // from needs to be FundingHub owner which will be web3.eth.accounts[0]
    // Make project owner web3.eth.accounts[1]
    // function CreateProject(bytes32 vNameS, address vOwnerA, uint vTargetWei, uint vDeadlineT) FHisActiveAndSenderIsOk IsOwner returns (uint Id) {
    // console.log('CreateProject("First Project via Migrate",'+ web3.eth.accounts[1]+', '+web3.toWei(11, "ether")+', '+deadlineSecs+', '+'{from: '+web3.eth.accounts[0]+', +gas: '+1000000+'})');
    return instance.CreateProject("First Project via Migrate", web3.eth.accounts[1], web3.toWei(11, "ether"), deadlineSecs, {from: web3.eth.accounts[0], gas: 1100000});
  })
  .then(txObj => {
    console.log("First project added. Gas used", txObj.receipt.gasUsed); // 1068241
  }).catch(e => console.log('Error creating initial project in migration script', e));
};

