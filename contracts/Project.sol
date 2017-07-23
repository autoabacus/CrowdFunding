/* Project.sol

B9lab: ETH-8 Certified Online Ethereum Developer Course - January 2017
Exam Project started 2017.05.09

FINAL PROJECT
You are going to build a decentralised crowdfunding application. Please create a Truffle project for this. We are looking at code quality before UI beauty, so focus your efforts on the underlying code.

CONTRACTS
Create two Solidity smart contracts named FundingHub and Project. Name the files FundingHub.sol and Project.sol.

FundingHub
----------
FundingHub is the registry of all Projects to be funded. See FundingHub.sol for details.

Project
-------
Project is the contract that stores all the data of each project. Project should have a constructor and a struct to store the following information:
- the address of the owner of the project
- the amount to be raised (eg 100000 wei)
- the deadline, i.e. the time before which the amount has to be raised

Please also implement the following functions:

fund([parameters]) This is the function called when the FundingHub receives a contribution.
  The function must keep track of each contributor and the individual amounts contributed.
  If the contribution was sent after the deadline of the project passed, or the full amount has been reached, the function must return the value to the originator of the transaction and,
    left to your own decision, call none or one of the two other functions.
  If the full funding amount has been reached, the function must either call Payout() or make it possible to do so.
  If the deadline has passed without the funding goal being reached, the function must either call Refund() or make it possible to do so.

payout([parameters]) - This is the function that sends all funds received in the contract to the owner of the project.

refund([parameters]) - This function sends part or all individual contributions back to the respective contributors, or lets all contributors retrieve their contributions.

Notes
=====
• tx.origin is used here for the address of the original person via the UI: person -> FundingHub -> Project
  I am aware of the security issues involved with use of tx.origin so have included checks here and and in FundingHub which should make it safe to use tx.origin.

• All function call parameters used are checked for validity.

• State variables and struct members have been typed and ordered to minimise storage costs.

• Variable naming is loosely in accordance with \doc\Solidity_Style_Guide.txt
  (Only loosely so as not to be too different from the spec expectations.)

*/

pragma solidity ^0.4.11;

import "./State.sol";
import "./FundingHub.sol";

contract Project is State {
  // Project data
  // The spec said "Project should have a ... struct to store ..." but as there is only one instance of these values, nothing is gained by using a struct for them,
  // not even a saving of storage slots, as storage variables are packed just like struct members if they are declared in an appropriate order.
                         // Bytes Storage slot #
                         //     | | /- c = passed to constructor, m = msg.sender, t = tx.origin
  address projOwnerA;       // 20 0 c Address of the owner of the project
  uint16  id;               //  2 0 c Id of the project from 1 upwards. Used in FundingHub more than here.
  uint32  deadlineT;        //  4 0 c Deadline time
  uint    targetWei;        // 32 1 c Target amount to be raised. Could reduce this to uint16 if ether were used rather than wei
  bytes32 nameS;            // 32 2 c Project name
  address hubOwnerA;        // 20 3 t Address of the owner of FundingHub which is tx.origin
  address fundingHubA;      // 20 4 m Address of the FundingHub contract for this Project, used as part of checking that the sender is ok
  NState  stateN;           //  1 4   State { 0:Null | 1:Active | 2:TargetMet | 3:Funded | 4:Refunding | 5:Closed }
  uint32  fundedT;          //  4 4   Time of withdrawal by owner after funding = when state changes from TargetMet to Funded. (The time that the target is met is given by the time of the last contribution.)
  uint32  refundedT;        //  4 4   Time when refunding of a closed (failed) project is completed = when state changes from ReFunding to Closed
  uint    contributedWei;   // 32 5   Need this in addition to this.balnce to save the total that was contributed for funded, closed, refunded projects for which this.balance reduces again to zero
  address firstContribA;    // 20 6   Address of first contributor         /- for a linked list of all contributors, not used in normal operations.
  address lastContribA;     // 20 7   Address of last or final contributor |  Included so that if necessary e.g. a project is stuck at state Refunding, FundingHub owner can make an expensive pass through
  uint16  numContributions; //  2 7   Number of contributions                  contributors to push the outstanding refunds via use of NextContributorAndRefund() and PushRefund() calls and a UI loop
  uint16  numContributors;  //  2 7   Number of contributors which is <= numContributions
                            //        A real system would need to store a lot more info about the project than this, but that would not need to be on chain.
  // this.balance holds the total amount contributed, which is reduced to zero on payout or when refunding if needed is complete.

  // Contribution data struct allowing for a forwards linked list of contributions.
  // Multiple contributions by the same person are to be summed in one instance for that person -> just one refund if refunding happens.
  struct R_Contrib {   // Bytes Storage slot #
    uint    contribWei;   // 32 0 Wei contributed
    address nextContribA; // 20 1 Address of the next contributor, 0 for the last one
    uint32  contribT;     //  4 1 Time of the contribution. Will record the time of the last contribution for a person who makes multiple contributions
    uint32  refundT;      //  4 1 Time of refund, if any, which serves to indicate whether a refund has happened or not
  }
  mapping (address => R_Contrib) private contribsMR; // Contributions by contributor address

  // Constructor NOT payable
  // -----------
  // Requires:  Sender is set, sender is FundingHub, Id is set, name is set, owner is set, target is set, deadline is in the future
  //             tx.origin is set, tx.origin is different from ms.sender (= not FundingHub), tx.origin is FundingHub owner
  function Project(uint vId, bytes32 vNameS, address vProjOwnerA, uint vTargetWei, uint vDeadlineT) {
    require (msg.sender > address(0) // sender is set
     && msg.sender == FundingHub(msg.sender).FundingHubAddress() // Bit of a check for the constructor that the sender is FundingHub
     && vId > 0                  // Id is set
     && vNameS.length > 0        // name is set
     && vProjOwnerA > address(0) // owner is set
     && vTargetWei > 0           // target is set
     && vDeadlineT > now         // deadline is in the future
     && tx.origin > address(0)   // tx.origin is set
     && tx.origin != msg.sender  // tx.origin is different from FundingHub  i.e. person -> FundingHub -> this constructor
     && tx.origin == FundingHub(msg.sender).FundingHubOwner()); // originator is FundingHub owner
    fundingHubA = msg.sender;
    hubOwnerA   = tx.origin;
    id          = uint16(vId);
    targetWei   = vTargetWei;
    nameS       = vNameS;
    projOwnerA  = vProjOwnerA;
    deadlineT   = uint32(vDeadlineT);
    stateN      = NState.Active; // Projects start as active
  }

  // Fallback function
  // -----------------
  function() {
    throw; // reject any attempt to access the contract other than via the methods with their require testing for valid access
  }

  // Modifier functions
  // ==================
  // IsSenderOk
  // ----------
  // IsSenderOk throws if the sender is not ok
  // Requires: sender is FundingHub, tx.origin is different from ms.sender (= not FundingHub), tx.origin is set
  modifier IsSenderOk {
    require(msg.sender == fundingHubA // sender is expected to be the FundingHub which created this project
         && tx.origin != msg.sender   // tx.origin is expected to be different from the FundingHub  i.e. person -> FundingHub -> function here
         && tx.origin > address(0));  // tx.origin is expected to be non zero
    _;
  }

  // OriginatorIsFundingHubOwner
  // ---------------------------
  // Requires originator to be FundingHub owner
  modifier OriginatorIsFundingHubOwner {
    require (tx.origin == hubOwnerA);
    _;
  }

  // Events
  // ------
  // All events are in FundingHub

  // no external functions

  // Constant Public functions
  // =========================
  // ProjectOwner()
  // ------------
  // Returns the project owner's address. Used only as part of the "Mine" project browsing case
  // Requires: Sender is Ok {sender is FundingHub, tx.origin is not FundingHub, tx.origin is set}
  // constant NOT payable
  // Return var not named here as this fn is not called directly from the UI re possible event names use
  function ProjectOwner() IsSenderOk constant returns (address) {
    return projOwnerA;
  } // End ProjectOwner()

  // ProjectInfo()
  // -----------
  // Returns info about the project
  // Requires: Sender is Ok {sender is FundingHub, tx.origin is not FundingHub, tx.origin is set}
  // constant NOT payable
  // Return vars not named here as this fn is not called directly from the UI re possible event names use
  function ProjectInfo() IsSenderOk constant returns (
      address,   // projOwnerA       Address of the owner of the project
      uint,      // targetWei        Target amount to be raised
      uint,      // deadlineT        Deadline time
      uint,      // contributedWei   Total amount contributed
      uint,      // this.balance     Current balance - only different from 'Total amount contributed' if refunds have happened
      uint,      //                  Time when target was met = when state changes from Active to TargetMet
      uint,      // fundedT          Time of withdrawal by owner after funding = when state changes from TargetMet to Funded
                 // refundedT        || when refunding of a failed project is completed = when state changed from ReFunding to Closed
                 //                  || or 0 (in refundedT) if project timed out with no contributions and went straight to Closed
      uint,      // numContributions Number of contributions
      uint,      // numContributors  Number of contributors
      uint,      //                  Refund available to originator (logged in visitor) if state is Refunding and this visitor's refund has not been withdrawn or sent yet (i.e. contribsMR[tx.origin].refundT == 0)
      NState,    // stateN           State { 0:Null | 1:Active | 2:TargetMet | 3:Funded | 4:Refunding | 5:Closed }
      bytes32) { // nameS            Name bytes32 as stored since casting to string for the return is not allowed
    return (projOwnerA, targetWei, deadlineT,
      contributedWei,   this.balance,
      (stateN == NState.TargetMet || stateN == NState.Funded) ? contribsMR[lastContribA].contribT : 0,
      stateN == NState.Funded ? fundedT : (stateN == NState.Closed ? refundedT : 0),  // with refundedT of 0 if there were no contributions
      numContributions, numContributors,
      stateN == NState.Refunding ? (contribsMR[tx.origin].refundT == 0 ? contribsMR[tx.origin].contribWei : 0) : 0,
      stateN, nameS);
  } // End ProjectInfo()

  // NextContributorAndRefund(address vContribA)
  // ------------------------
  // Included so that if necessary e.g. a project is stuck at state Refunding, FundingHub owner can make an expensive pass through contributors
  //  to push the outstanding refunds via use of NextContributorAndRefund() and PushRefund() calls and a UI loop
  // Called from FundingHub.NextContributorAndRefund(uint vId, address vContribA) on a UI loop through the contributors to Project vId
  //        vContribA is 0 for the first one, otherwise is the previous one -> next one here
  // Requires: Sender is ok {sender is FundingHub, tx.origin is not FundingHub, tx.origin is set},
  //           tx.origin is FundingHub owner  (tx.origin is also required to be FundingHub owner by FundingHub.NextContributorAndRefund())
  //           state is Refunding or Closed (Can be Closed if the previous PushRefund() call finished the refunding and changed the state to Closed)
  // constant NOT payable
  // Returns the address of the next contributor if any and the refund due to that contributor, if any, otherwise 0s
  function NextContributorAndRefund(address vContribA) constant IsSenderOk OriginatorIsFundingHubOwner returns (address contribA, uint refundDueWei) {
    require (stateN >= NState.Refunding); // state is Refunding or Closed
    if (stateN == NState.Refunding) {
      // state is Refunding so do our thing
      if (vContribA == address(0)) {
        // First one
        contribA = firstContribA;
      }else
        contribA  = contribsMR[vContribA].nextContribA;
      if (contribA > address(0)) {
        R_Contrib rContribR = contribsMR[contribA]; // reference to the contribution entry - all 0 if none
        refundDueWei = rContribR.refundT > 0 ? 0 : rContribR.contribWei;
      }
      // else there is no next contributor so return 0s
    }
    // else the state is Closed (Can be Closed if the previous PushRefund() call finished the refunding and changed the state to Closed) so return 0s
  } // End NextContributorAndRefund()

  // Public functions
  // ================
  // Fund()
  // ----
  // This is the function called when the FundingHub receives a contribution.
  // The function must keep track of each contributor and the individual amounts contributed.
  // If the contribution was sent after the deadline of the project passed, or the full amount has been reached, the function must return the value to the originator of the transaction and,
  // left to your own decision, call none or one of the two other functions.
  // If the full funding amount has been reached, the function must either call Payout() or make it possible to do so.
  // If the deadline has passed without the funding goal being reached, the function must either call Refund() or make it possible to do so.
  // Requires: Sender is Ok {sender is FundingHub, tx.origin is not FundingHub, tx.origin is set}, state is Active
  // Parameters: None, with all required info being in the transaction/message data:
  //   tx.origin  is the contributor (the sender of the transaction to FundingHub.Contribute()
  //   msg.sender is the FundingHub contract or should be - checked by IsSenderOk
  //   msg.value is the contribution
  // Returns state
  function Fund() payable IsSenderOk returns (NState retStateN) {
    require (stateN == NState.Active); // Project must be active
    // But the deadline could have passed due to user delay from the project being browsed or transaction propagation time
    if (now > deadlineT) {
      tx.origin.transfer(msg.value); // return the contribution to the contributor, throws on failure
      stateN = NState.Refunding;
      return stateN;
    }
    require(numContributions < cMAX_CONTRIBS); // check that this new contribution won't exceed the limit of number of contributors
    // Has this contribution taken us to or beyond the target?
    uint kContribWei = msg.value;
    if (this.balance >= targetWei) {
      stateN = NState.TargetMet;
      if (this.balance > targetWei) {
        // This contribution has taken us over the target and requires a refund of the excess
        uint kRefundWei = this.balance - targetWei; // refund amount
        tx.origin.transfer(kRefundWei); // refund excess to contributor, throws on failure
        kContribWei -= kRefundWei;
      }
    }
    contributedWei += kContribWei;
    numContributions++;
    // Has this contributor contributed previously? If so, just sum the contributions
    if (contribsMR[tx.origin].contribWei > 0) {
      // Has contributed before
      contribsMR[tx.origin].contribWei += kContribWei; // Wei contributed
      contribsMR[tx.origin].contribT   = uint32(now); // Time of the contribution. Will record the time of the last contribution for a person who makes multiple contributions
    }else{
      // New contributor. No need to check numContributors < cMAX_CONTRIBS as numContributors is <= numContributions which has been checked above
      R_Contrib memory contribR;           // for building the contribution entry
      contribR.contribWei   = kContribWei; // Wei contributed
      //ntribR.nextContribA = address(0);  // Address of the next contributor, 0 for the last one
      contribR.contribT     = uint32(now); // Time of the contribution. Will record the time of the last contribution for a person who makes multiple contributions
      contribsMR[tx.origin] = contribR;    // Contributions by contributor address
      // State updates
      if (firstContribA == address(0))
        firstContribA = tx.origin; // Address of first contributor
      else
        contribsMR[lastContribA].nextContribA = tx.origin;
      lastContribA = tx.origin;    // Address of last or final contributor
      numContributors++;
    }
    return stateN;
  } // End Fund()

  // WithdrawFunds() named that rather than payout() of the spec to emphasise its pull nature
  // -------------
  // Spec: This is the function that sends all funds received in the contract to the owner of the project.
  // Is called from FundingHub.WithdrawFunds(vId) on a pull request from the project owner
  // Requires: Sender is Ok {sender is FundingHub, tx.origin is not FundingHub, tx.origin is set},
  //           state is TargetMet, originator -> FundingHub.WithdrawFunds() -> WithdrawFunds() here is the project owner
  //           contract balance == the funds contributed
  // NOT payable
  // Results in state changing from TargetMet to Funded at time fundedT
  function WithdrawFunds() IsSenderOk returns (uint paidoutWei) {
    require (stateN == NState.TargetMet       // this provides recursive call protection
          && tx.origin == projOwnerA          // originator -> FundingHub.WithdrawFunds() -> WithdrawFunds() here is the project owner
          && this.balance == contributedWei); // at this point the contract balance should == the funds contributed
    stateN = NState.Funded;
    fundedT = uint32(now);
    projOwnerA.transfer(contributedWei);
    return contributedWei;
  } // End WithdrawFunds()

  // SetToRefunding()
  // --------------
  // Called when an active project has gone over time to set its state to Refunding or Closed if no contributions had ever been made to it.
  // Requires: Sender is Ok {sender is FundingHub, tx.origin is not FundingHub, tx.origin is set},
  //           state is Active, project has gone over time
  //           originator is FundingHub owner (only FundingHub owner can initiate the Refunding state),
  // NOT Payable
  function SetToRefunding() IsSenderOk OriginatorIsFundingHubOwner returns (NState retStateN) {
    require (stateN == NState.Active
          && now > deadlineT);
    stateN = this.balance > 0 ? NState.Refunding : NState.Closed;
    return stateN;
  } // End SetToRefunding()

  // WithdrawRefund() named that rather than refund() of the spec to emphasise its pull nature
  // --------------
  // Spec: This function sends part or all individual contributions back to the respective contributors
  // Refunds contributorA's contribution
  // Called from FundingHub.WithdrawRefund(uint vId) on a pull request from the contributor
  // Requires: Sender is ok {sender is FundingHub, tx.origin is not FundingHub, tx.origin is set},
  //           state is Refunding, there is a contribution to refund which is <= the contract balance
  // NOT payable
  // Returns state, which changes to Closed if this refund takes the contract balance to zero
  function WithdrawRefund() IsSenderOk returns (NState retStateN, uint refundWei) {
    require (stateN == NState.Refunding);
    R_Contrib rContribR = contribsMR[tx.origin]; // reference to the contribution entry
    require (rContribR.contribWei > 0 // a contribution had been made
          && rContribR.refundT == 0   // refund hasn't been withdrawn already
          && rContribR.contribWei <= this.balance); // the contract has funds to cover the withdrawal
    rContribR.refundT = uint32(now);          // before the transfer as recursive call protection
    tx.origin.transfer(rContribR.contribWei); // will throw if there is a problem
    if (this.balance == 0) {
      // refunding is complete
      stateN    = NState.Closed;
      refundedT = uint32(now);
    }
    return (stateN, rContribR.contribWei);
  } // End WithdrawRefund()

  // PushRefund(address vContribA)
  // ----------
  // Included so that if necessary e.g. a project is stuck at state Refunding, FundingHub owner can make an expensive pass through contributors
  //  to push the outstanding refunds via use of NextContributorAndRefund() and PushRefund() calls and a UI loop
  // Refunds contributor's contribution
  // Called from FundingHub.PushRefund(uint vId, address vContribA) on a push request from FundingHub owner
  // Requires: Sender is ok {sender is FundingHub, tx.origin is not FundingHub, tx.origin is set},
  //           tx.origin is FundingHub owner (tx.origin is also required to be FundingHub owner by FundingHub.PushRefund())
  //           state is Refunding, there is a contribution to refund which is <= the contract balance
  //           vContribA is set and is different from tx.origin and msg.sender
  // NOT payable
  // Returns state, which changes to Closed if this refund takes the contract balance to zero
  function PushRefund(address vContribA) IsSenderOk OriginatorIsFundingHubOwner returns (NState retStateN, uint refundWei) {
    require (stateN == NState.Refunding // state is Refunding
         && vContribA != address(0)     // vContribA is set
         && vContribA != tx.origin      // and is different from tx.origin [If FundingHub owner is due a refund that is expected to be pulled via WithdrawRefund() before this fn is called]
         && vContribA != msg.sender);   //  and msg.sender
    R_Contrib rContribR = contribsMR[vContribA]; // reference to the contribution entry
    require (rContribR.contribWei > 0 // a contribution had been made
          && rContribR.refundT == 0   // refund hasn't been withdrawn already
          && rContribR.contribWei <= this.balance); // the contract has funds to cover the withdrawal
    rContribR.refundT = uint32(now);          // before the transfer as recursive call protection
    vContribA.transfer(rContribR.contribWei); // will throw if there is a problem
    if (this.balance == 0) {
      // refunding is complete
      stateN    = NState.Closed;
      refundedT = uint32(now);
    }
    return (stateN, rContribR.contribWei);
  } // End PushRefund()

  // no internal functions
  // no private functions
} // End Project contract
