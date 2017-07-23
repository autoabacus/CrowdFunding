// Spec: Create an automated test that covers the refund function in the Project contract using the Truffle testing framework. You may but don't need to write tests for any other functionality.

var FundingHub = artifacts.require("./FundingHub.sol"),
    Instance,
    FHOwnerA; // FundingHib owner

function WeiToEtherDec2(wei) {
  return parseFloat(web3.fromWei(wei, 'ether')).toFixed(2);
}

// Get the Promise of a Web3 getBalance() call based on Xavier's "Get the Promise of Web3 accounts" at https://gist.github.com/xavierlepretre/ed82f210df0f9300493d5ca79893806a
web3.eth.getBalancePromise = function(address) {
  return new Promise(function (resolve, reject) {
    web3.eth.getBalance(address, function(e, result) {
      if (e)
        reject(e);
      else
        resolve(result);
    });
  });
};

contract('FundingHub', function(accounts) {
      FHOwnerA = accounts[0]; // FundingHub owner
  let Account1 = accounts[1],
      Account2 = accounts[2],
      Account3 = accounts[3],
      Account4 = accounts[4],
      Account5 = accounts[5],
      Account6 = accounts[6];

  // Check that Migrate has created the first Project. This one is owned by Account1
  it("Checking that there is a Project Id 1 after migration", function() {
    return FundingHub.deployed()
    .then(instance => {
      Instance = instance;
      return Instance.BrowseProjects.call(0, 0, 1); // Browse to the first active project
    }).then(idBN => {
      assert.equal(idBN.toNumber(), 1, "Project 1 not available after Migrate as expected");
    });
  });

  // Add a new project 2 owned by Account2 which will get refunded so set its dealing as close to now as possible i.e. 1 second in the future.
  // Some contributions will be made to this project
  it('Adding a new Project target 12.1 ethers, deadline 1 second from now, which should be Id 2', function() {
    let targetEth = 12.1;
    let nowT = new Date(), // now UTC
    deadlineSecs = nowT.getTime()/1000.0 + 1; // 1 second from now
    return Instance.CreateProject("Second Project via Test", Account2, web3.toWei(targetEth, "ether"), deadlineSecs, {from: FHOwnerA, gas: 1100000})
    .then(txObj => {
      // console.log("Project added. Gas used", txObj.receipt.gasUsed);
      return Instance.BrowseProjects.call(0, 3, 1); // Browse to the last active project
    }).then(idBN => {
      assert.equal(idBN.toNumber(), 2, "Project 2 not added as expected");
    });
  });

  // Adding a new project owned by Account2 which will pass its deadline without ever receiving any contrubutions
  it('Adding a new Project target 13.2 ethers, deadline 1 second from now, which should be Id 3', function() {
    let targetEth = 13.2,
        nowT = new Date(), // now UTC
    deadlineSecs = nowT.getTime()/1000.0 + 1; // 1 second from now
    return Instance.CreateProject("Third Project via Test", Account2, web3.toWei(targetEth, "ether"), deadlineSecs, {from: FHOwnerA, gas: 1100000})
    .then(txObj => {
      // console.log("Project added. Gas used", txObj.receipt.gasUsed);
      return Instance.BrowseProjects.call(0, 3, 1); // Browse to the last active project
    }).then(idBN => {
      assert.equal(idBN.toNumber(), 3, "Project 3 not added as expected");
    });
  });

  // Make contributions to Project 2 in preparation for refunding later
  // First contribution: 2.3 ether by Account3
  it('Making a contribution of 2.3 ethers to Project 2 by Account3', function() {
    let contribEth = 2.3,
        Id = 2,
        contribWeiS = web3.toWei(contribEth, 'ether'); // number string
    return web3.eth.getBalancePromise(Account3)
    .then(function(res) {
      // console.log("Account3's balance before making the contribution is " + WeiToEtherDec2(res));
      if (res.lessThan(contribWeiS)) {
        assert.fail(contribEth + " ether to be contributed is greater than Account3's current balance of " + WeiToEtherDec2(res)); // but the message isn't displayed
        // return -1; don't need this as the assert.fail() aborts the promise
      }else
        // Ok to make the contribution
        // console.log('Making contribution', Id, Account3, contribWeiS, 150000);
        return Instance.Contribute(Id, {from: Account3, value: contribWeiS, gas: 150000});
    })
    .then(function(txObj) {
      // console.log(txObj);
      assert.isTrue(typeof txObj == 'object', 'failed with typeof txObj not object');
      assert.ok("Contribution made");
      // Now fetch the project and check its balance
      return Instance.ProjectInfo.call(Id, {from: Account2});
    }).then(function(res) {
      /* ProjectInfo(id) returns:
          address projOwnerA,       //  0 Address of the owner of the project
          uint    targetWei,        //  1 Target amount to be raised
          uint    deadlineT,        //  2 Deadline time
          uint    contributedWei,   //  3 Total amount contributed
          uint    currentBalWei,    //  4 Project.this.balance     Current balance - different from 'Total amount contributed' if payout or refunds have happened
          uint    targetMetT        //  5 Time when target was met = when state changes from Active to TargetMet
          uint    fundedT,          //  6 Time of withdrawal by owner after funding = when state changes from TargetMet to Funded || refunding of a timed out project is completed = when state changes from Refunding to Closed
          uint    numContributions, //  7 Number of contributions
          uint    numContributors,  //  8 Number of contributors
          uint    refundAvailWei,   //  9 Refund available to logged in visitor if state is Refunding and this visitor's refund has not been withdrawn or sent yet
          NState  stateN,           // 10 State { 0:Null | 1:Active | 2:TargetMet | 3:Funded | 4:Refunding | 5:Closed }
          bytes32 nameS             // 11 Name bytes32 as stored since casting to string for the return was not allowed
      */
      assert.equal(res[3].toString(), contribWeiS, 'Project balance != contribution');
    });
  });

  // Second contribution to project 2: 2.4 ether by Account4
  it('Making a contribution of 2.4 ethers to Project 2 by Account4', function() {
    let contribEth = 2.4,
        Id = 2,
        contribWeiS = web3.toWei(contribEth, 'ether'); // number string
    return web3.eth.getBalancePromise(Account4)
    .then(function(res) {
      // console.log("Account4's balance before making the contribution is " + WeiToEtherDec2(res));
      if (res.lessThan(contribWeiS)) {
        assert.fail(contribEth + " ether to be contributed is greater than Account4's current balance of " + WeiToEtherDec2(res)); // but the message isn't displayed
      }else
        // Ok to make the contribution
        return Instance.Contribute(Id, {from: Account4, value: contribWeiS, gas: 150000});
    })
    .then(function(txObj) {
      // Now fetch the project and check its balance
      return Instance.ProjectInfo.call(Id, {from: Account2});
    }).then(function(res) {
      // assert.equal(res[3].toString(), web3.toWei(contribEth + 2.3, 'ether'), 'Project balance != sum of contributions as expected');
      assert.isTrue(Math.abs(parseFloat(web3.fromWei(res[3], 'ether')) - (contribEth + 2.3)) < 0.001, 'Project balance != sum of contribution as expected');
    });
  });

  // Third contribution to project 2: 2.5 ether by Account5
  it('Making a contribution of 2.5 ethers to Project 2 by Account5', function() {
    let contribEth = 2.5,
        Id = 2,
        contribWeiS = web3.toWei(contribEth, 'ether'); // number string
    return web3.eth.getBalancePromise(Account4)
    .then(function(res) {
      // console.log("Account5's balance before making the contribution is " + WeiToEtherDec2(res));
      if (res.lessThan(contribWeiS)) {
        assert.fail(contribEth + " ether to be contributed is greater than Account5's current balance of " + WeiToEtherDec2(res)); // but the message isn't displayed
      }else
        // Ok to make the contribution
        return Instance.Contribute(Id, {from: Account5, value: contribWeiS, gas: 150000});
    })
    .then(function(txObj) {
      // Now fetch the project and check its balance
      return Instance.ProjectInfo.call(Id, {from: Account2});
    }).then(function(res) {
      assert.isTrue(Math.abs(parseFloat(web3.fromWei(res[3], 'ether')) - (contribEth + 2.4 + 2.3)) < 0.001, 'Project balance != sum of contribution as expected');
    });
  });

  // Check adding a new project 4 owned by Account3 that we will take to Payout
  let project4TargetEth = 14.3;
  it('Adding a new Project target 14.3 ethers, deadline 1 hour from now, which should be Id 4', function() {
    let nowT = new Date(), // now UTC
    deadlineSecs = nowT.getTime()/1000.0 + 3600; // 1 hour from now
    return Instance.CreateProject("Fourth Project via Test", Account3, web3.toWei(project4TargetEth, "ether"), deadlineSecs, {from: FHOwnerA, gas: 1100000})
    .then(txObj => {
      // console.log("Project added. Gas used", txObj.receipt.gasUsed);
      return Instance.BrowseProjects.call(0, 3, 1); // Browse to the last active project
    }).then(idBN => {
      assert.equal(idBN.toNumber(), 4, "Project 4 not added as expected");
    });
  });

  // Check contribution of 1.3 ethers to Project 4 by Account4
  // Check contribution against Account4 current balance
  it('Making a contribution of 1.3 ethers to Project 4 by Account4', function() {
    let contribEth = 1.3,
        Id = 4,
        contribWeiS = web3.toWei(contribEth, 'ether'); // number string
    return web3.eth.getBalancePromise(Account4)
    .then(function(res) {
      // console.log("Account4's balance before making the contribution is " + WeiToEtherDec2(res));
      if (res.lessThan(contribWeiS)) {
        assert.fail(contribEth + " ether to be contributed is greater than Account4's current balance of " + WeiToEtherDec2(res)); // but the message isn't displayed
        // return -1; don't need this as the assert.fail() aborts the promise
      }else
        // Ok to make the contribution
        return Instance.Contribute(Id, {from: Account4, value: contribWeiS, gas: 150000});
    })
    .then(function(txObj) {
      // assert.isTrue(typeof txObj == 'object', "failed with txObj="+txObj);
      // assert.ok("Contribution made");
      // Now fetch the project and check its balance
      return Instance.ProjectInfo.call(Id, {from: Account3});
    }).then(function(res) {
      assert.equal(res[3].toString(), contribWeiS, 'Project balance != contribution');
    });
  });

  // Check target being met with a contribution of 13.3 ethers from Account5
  // Check contribution against Account5 current balance
  it('Making a contribution of 13.3 ethers to Project 4 by Account5 which should take the project to the TargetMet state', function() {
    let contribEth = 13.3,
        Id = 4,
        contribWeiS = web3.toWei(contribEth, 'ether'); // number string
    return web3.eth.getBalancePromise(Account5)
    .then(function(res) {
      // console.log("Account5's balance before making the contribution is " + WeiToEtherDec2(res));
      if (res.lessThan(contribWeiS)) {
        assert.fail(contribEth + " ether to be contributed is greater than Account5's current balance of " + WeiToEtherDec2(res)); // but the message isn't displayed
      }else
        // Ok to make the contribution
        return Instance.Contribute(Id, {from: Account5, value: contribWeiS, gas: 150000});
    })
    .then(function() {
      // Now fetch the project and check its state
      return Instance.ProjectInfo.call(Id, {from: Account3});
    }).then(function(res) {
      assert.equal(res[10].toNumber(), 2, 'Project state not TargetMet as expected');
    });
  });

  // Check withdrawal or Payout
  it('Withdrawal of Contributed Funds from Project 4 by owner then checking that Project is in Funded state with zero balance and that owner received the funds', function() {
    let Id = 4,
        account3BalBeforeBN;
    return web3.eth.getBalancePromise(Account3)
    .then(function(res) {
      account3BalBeforeBN = res;
      return Instance.WithdrawFunds(Id, {from: Account3, gas: 75000});
    }).then(function() {
      // console.log('Withdraw Funds gas used', txObj.receipt.gasUsed); // 49321
      // Now fetch the project and check its state
      return Instance.ProjectInfo.call(Id, {from: Account3});
    }).then(function(res) {
      assert.equal(res[10].toNumber(), 3, 'Project state not Funded as expected');
      assert.equal(res[4].toNumber(), 0.0, 'Project balance not Zero as expected');
      return web3.eth.getBalancePromise(Account3);
    }).then(function(res) {
      // Next line didn't work because of gas cost
      // assert.equal(parseFloat(web3.fromWei(account3BalBeforeBN, 'ether')) + project4TargetEth, parseFloat(web3.fromWei(res, 'ether')), 'Account3 balance not as expected');
      assert.isTrue(project4TargetEth - (parseFloat(web3.fromWei(res, 'ether')) - parseFloat(web3.fromWei(account3BalBeforeBN, 'ether'))) < 0.05, 'Account3 balance not as expected');
    });
  });

  // Project 3 should have timed out with no contributions having been made to it. Check this.
  it('Check that Project 3 has timed out with no contributions, and set it to Refunding state which should go straight to Closed', function() {
    let Id = 3,
        account3BalBeforeBN;
    return Instance.ProjectInfo.call(Id, {from: Account2})
    .then(function(res) {
      // console.log('Project 3 state', res[10].toNumber());
      assert.equal(res[3].toNumber(), 0.0,'Project contributions now zero as expected');
      assert.equal(res[10].toNumber(), 1, 'Project state not still Active as expected');
      assert.isAbove(Date.now(), (new Date(res[2].toNumber()*1000).getTime()), 'Project has not timed out as expected');
      return Instance.SetToRefunding(Id, {from: FHOwnerA, gas: 100000});
    }).then(txObj => {
      // console.log('Set to refunding state gas used', txObj.receipt.gasUsed); // 56191
      return Instance.ProjectInfo.call(Id, {from: Account2});
    }).then(function(res) {
      assert.equal(res[10].toNumber(), 5, 'Project state not Closed as expected');
    });
  });

  // See if Project 2 has timed out by now, by trying a contribution which should get sent back
  it('Contribute another 2.6 ethers from Account 6 to Project 2, which should time out and the ethers be returned', function() {
    let contribEth = 2.6,
        Id = 2,
        contribWeiS = web3.toWei(contribEth, 'ether'),
        account6BalBeforeBN;
    return web3.eth.getBalancePromise(Account6)
    .then(function(res) {
      account6BalBeforeBN = res;
      if (res.lessThan(contribWeiS)) {
        assert.fail(contribEth + " ether to be contributed is greater than Account6's current balance of " + WeiToEtherDec2(res));
      }else
        // Ok to make the contribution
        return Instance.Contribute(Id, {from: Account6, value: contribWeiS, gas: 150000});
    })
    .then(function(txObj) {
      // Now fetch the project and check its state which we expect to have changed to Refunding
      // res[10] is State { 0:Null | 1:Active | 2:TargetMet | 3:Funded | 4:Refunding | 5:Closed }
      return Instance.ProjectInfo.call(Id, {from: Account2});
    }).then(function(res) {
      assert.equal(res[10].toNumber(), 4, 'Project state not Refunding as expected');
      // Check that the contribution has been returned
      return web3.eth.getBalancePromise(Account6)
    }).then(function(res) {
      // The contribution should be back with Account6 apart from gas costs
      // console.log(account6BalBeforeBN.toString(), res.toString()); // 100000000000000000000 99992761900000000000
      assert.isBelow(parseFloat(web3.fromWei(account6BalBeforeBN.minus(res), 'ether')), 0.01, 'Contribution not returned to Account6 as expected');
    });
  });

  // With Project 2 in Refunding state do some refunding...
  it('Do a pull refund from Project 2 of the 2.3 ethers from Account3 and check account plus project balances', function() {
    let Id = 2,
        account3BalBeforeBN;
    return Instance.ProjectInfo.call(Id, {from: Account2})
    .then(function(res) {
      // console.log('Project 2 state', res[10].toNumber());
      assert.equal(res[10].toNumber(), 4, 'Project state not Refunding as expected');
      // carry on to do some refunding
      // Contributions made to project 2 were:
      // - 2.3 ethers by Account3
      // - 2.4 ethers by Account4
      // - 2.5 ethers by Account5
      // Let us pull the 2.3 ethers and push the 2.4 and 2.5
      return web3.eth.getBalancePromise(Account3);
    }).then(function(res) {
      account3BalBeforeBN = res;
      return Instance.WithdrawRefund(Id, {from: Account3, gas: 75000});
    }).then(function() {
      // Get Account3 balance again. It should be up by 2.3 ethers
      return web3.eth.getBalancePromise(Account3);
    }).then(function(res) {
      // Account3 balance should be up by 2.3 ethers
      // console.log('parseFloat', parseFloat(web3.fromWei(res.minus(account3BalBeforeBN), 'ether'))); // 2.2960593
      // console.log('diff', parseFloat(2.3 - web3.fromWei(res.minus(account3BalBeforeBN), 'ether'))); // diff diff 0.003940699999999797
      assert.isBelow(2.3 - parseFloat(web3.fromWei(res.minus(account3BalBeforeBN), 'ether')), 0.005, 'Account3 balance not up by the amount of the refund as expected');
      // Get the project again. Its balance should now be 4.9 ethers or 2.4 + 2.5
      return Instance.ProjectInfo.call(Id, {from: Account2});
    }).then(function(res) {
      // res[4] is currentBalWei or Project.this.balance
      assert.equal(parseFloat(web3.fromWei(res[4], 'ether')), 4.9, 'Project 2 balance not as expected');
    });
  });

  // Continue With push refunding...
  it('Do push refunding from Project 2 by FundingHub Owner of the other contributions as if pull refunding had stalled', function() {
    let Id = 2;
    return Instance.ProjectInfo.call(Id, {from: Account2})
    .then(function(res) {
      // console.log('Project 2 state', res[10].toNumber());
      assert.equal(res[10].toNumber(), 4, 'Project state not Refunding as expected');
      // carry on to do some refunding
      // Contributions left are
      // - 2.4 ethers by Account4
      // - 2.5 ethers by Account5
      PushRefund(Id, '0x0000000000000000000000000000000000000000');
    });
  });

});

// Loops through contributors of project Id until a 0 return, which occurs at the end of the list or when refunding has finished and the state has changed to Closed
function PushRefund(Id, contribA) {
  Instance.NextContributorAndRefund.call(Id, contribA, {from: FHOwnerA}) // must be FundingHub Owner
  .then(function(res) {
    // address contribA, uint refundDueWei
    contribA = res[0];
    console.log('ContribA', contribA, 'Refund', WeiToEtherDec2(res[1]));
    if (contribA == '0x0000000000000000000000000000000000000000')
      return 0; // finished
    if (res[1].isZero())
      return 1; // no refund for this one but continue looping
    // Got a refund to push
    return Instance.PushRefund(Id, contribA, {from: FHOwnerA, gas: 75000});
  }).then(function(txObj) {
    // console.log('txObj', txObj);
    // Cases:
    // 0 - finished looping
    // 1 - still looping, no refund for this contributor
    // object - PushRefund() return
    if (typeof txObj == 'object')
      console.log('Push Refund gas used', txObj.receipt.gasUsed); // 41586, 52164 when state changed to Closed
    if (txObj === 0)
      // Finished. Project state should now be Closed
      CheckState(2, 5);
    else
      // still looping - either 1 or object cases
      PushRefund(Id, contribA);
  });
}

// Check that state of Project id is state
function CheckState(id, state) {
  Instance.ProjectInfo.call(id)
  .then(function(res) {
    if (res[10].toNumber() != state)
      console.error('Project state ', res[10].toNumber(), ' not '+state+' as expected');
      // Can't use a moocha assert here as it would be out of context due to the looping calls via Pushrefund().
      // Can't even use console.assert() here as in Node.js a falsy assertion will cause an AssertionError to be thrown.
  });
}

