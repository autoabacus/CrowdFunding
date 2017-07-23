/* FundingHub.sol

B9lab: ETH-8 Certified Online Ethereum Developer Course - January 2017
Exam Project started 2017.05.09

FINAL PROJECT
You are going to build a decentralised crowdfunding application. Please create a Truffle project for this. We are looking at code quality before UI beauty, so focus your efforts on the underlying code.

CONTRACTS
Create two Solidity smart contracts named FundingHub and Project. Name the files FundingHub.sol and Project.sol.

FundingHub
----------
FundingHub is the registry of all Projects to be funded. FundingHub should have a constructor and the following functions:

CreateProject([parameters]) - This function should allow a user to add a new project to the FundingHub. The function should deploy a new Project contract and keep track of its address. The CreateProject() function should accept all constructor values that the Project contract requires.

Contribute([parameters]) - This function allows users to contribute to a Project identified by its address. Contribute calls the Fund() function in the individual Project contract and passes on all Ether value attached to the function call.

In Truffle, create a migration script that calls the CreateProject function after FundingHub has been deployed.

Project
-------
See Project.sol

Notes
=====
• For design decisions in addition to the spec see README.md. The same info is also included as notes in index.html.

• All function call parameters used are checked for validity.

• State variables and struct members have been typed and ordered to minimise storage costs.

• Variable naming is loosely in accordance with \doc\Solidity_Style_Guide.txt
  (Only loosely so as not to be too different from the spec expectations.)

• For browsing active projects, expected to be the most common browsing method, a double linked list is used to speed things up.
  (Browsing projects in the other states involves looping over projects in a different state.)
  The linked list is not strictly necessary as browsing involves no cost calls to constant functions, and thus there is no cost penalty to looping,
  while there is a cost for storing the linked list, but I did it for the exercise....

*/

pragma solidity ^0.4.11;

import "./State.sol";
import "./Owned.sol";
import "./Project.sol";

contract FundingHub is Owned, State {
  // FundingHub data
  enum   NBrowseType   { Null, Active, TargetMet, Funded, Refunding, Closed, All, Mine } // For type of project being browsed
  enum   NBrowseAction { First, Prev, Next, Last}                                        // For browse action to be performed
  uint16 firstActiveProjId; // Id of first active project - starts at 1 /- to speed up first/last browsing for active projects
  uint16 lastActiveProjId;  // Id of last active project                |
  uint16 numProjects;       // Total number of projects
  uint16 numActiveProjects; // Number of active projects
  // Project data
  // Struct for project index map, allowing for a doubly linked list of active projects to permit low cost forwards and backwards browsing of active projects, the most common browsing case.
  // Each member requires 2 storage slots.
  struct R_ProjectIndex {  // Bytes Storage slot #  Comment
    Project projA;            // 20 0 Address of the project contract
    uint16  id;               //  2 1 Id of the project from 1 upwards
    uint16  nextActiveProjId; //  2 1 Id of the next project     - Would always be 0 for the last  one or id+1 before any projects are funded or refunded.
    uint16  prevActiveProjId; //  2 1 Id of the previous project - Would always be 0 for the first one or id-1 before any projects are funded or refunded.
    uint32  deadlineT;        //  4 1 Project deadline
    NState  stateN;           //  1 1 State { 0:Null | 1:Active | 2:TargetMet | 3:Funded | 4:Refunding | 5:Closed }
  }
  mapping (uint => R_ProjectIndex) private projectsIndexMR; // the Project Contracts indexed by id

  // Constructor NOT payable
  // -----------
  // All the constructor does is set ownerA = msg.sender via Owned's constructor
  function FundingHub() {}

  // Fallback function
  // -----------------
  function() {
    throw; // reject any attempt to access the contract other than via the methods with their require testing for valid access
  }

  // Modifier functions
  // ------------------
  // FHisActiveAndSenderIsOk throws if Funding Hub has been paused or the sender is not ok
  // Requires: FundingHub is Active, sender is not self (FundingHub), tx.origin and msg.sender are the same, msg.sender and tx.origin are set
  modifier FHisActiveAndSenderIsOk {
    require(!pausedB                    // FundingHub is Active
         && msg.sender != address(this) // sender != this FundingHub contract
         && tx.origin == msg.sender     // tx.origin and msg.sender are expected to be the same i.e. person -> this FundingHub function, not via another contract
         && msg.sender > address(0));   // msg.sender and tx.origin are expected to be non zero
    _;
  }

  // Events
  // ------
  event OnNewProject(uint indexed Id, address indexed OwnerA, bytes32 NameS, uint TargetWei, uint DeadlineT, address CreatorA, uint WhenT);
  event OnContribute(uint indexed Id, address indexed ContributorA, uint ContributedWei, uint WhenT, NState StateN);
  event     OnPayout(uint indexed Id, address indexed OwnerA,       uint PaidoutWei,     uint WhenT, NState StateN);
  event OnPullRefund(uint indexed Id, address indexed ContributorA, uint RefundWei,      uint WhenT, NState StateN);
  event OnPushRefund(uint indexed Id, address indexed ContributorA, uint RefundWei,      uint WhenT, NState StateN, address PushedByA);

  // no external functions

  // Constant Public functions
  // =========================
  // GetVersion()
  // ----------
  function GetVersion() constant returns (string NameS) {
    return cVER;
  }

  // FundingHubAddress()
  // -----------------
  // Not needed or used by UI. Is used only as part of the Project constructor checks.
  function FundingHubAddress() constant returns (address) {
    return this;
  }

  // FundingHubOwner()
  // ---------------
  // Not needed or used by UI. Is used only as part of the Project constructor checks.
  function FundingHubOwner() constant returns (address) {
    return ownerA;
  }

  // BrowseProjects(uint vId, NBrowseAction vActionN, NBrowseType vTypeN)
  // --------------
  // Finds Id of the project being browsed to
  // Requires: FundingHub is Active, sender is ok {sender is not self (FundingHub), tx.origin and msg.sender are the same, msg.sender and tx.origin are set}
  // Parameters:
  // - vId      Id of the current project, 0 if none
  // - vActionN { First, Prev, Next, Last}                                                Browse action to be performed
  // - vTypeN   { 1:Active, 2:TargetMet, 3:Funded, 4:Refunding, 5:Closed, 6:All, 7:Mine } Type of project being browsed
  // Returns Id which is 0 if there is no project which matches
  // When this fn was combined with ProjectInfo() to return the project info rather than just the Id, "Stack too deep, try removing local variables." errors resulted.
  // The limit of local variables appears to be 16, which includes the arguments, and the return variables, and for the combined fn the arguments and return vars were 16.
  function BrowseProjects(uint vId, NBrowseAction vActionN, NBrowseType vTypeN) constant FHisActiveAndSenderIsOk returns (uint id) {
    if (vActionN == NBrowseAction.First) {
      if (vTypeN == NBrowseType.Active)
        return firstActiveProjId; // 0 if none yet
      // First for all but Active
      if (numProjects > 0) id = 1;
      vActionN = NBrowseAction.Next;
    }else if (vActionN == NBrowseAction.Last) {
      if (vTypeN == NBrowseType.Active)
        return lastActiveProjId;
      // Last for all but Active
      id = numProjects;
      vActionN = NBrowseAction.Prev;
    }else{
      // Prev | Next
      if (vTypeN == NBrowseType.Active) {
        // Prev | Next for Active Projects. No looping involved.
        if (numActiveProjects > 0) {
          // There are active projects. It is ok to use vId in next line with no check of id first as an undefined or invalid id will give a zero mapping result
          if ((id = vActionN == NBrowseAction.Next ? projectsIndexMR[vId].nextActiveProjId : projectsIndexMR[vId].prevActiveProjId) == 0)
            id = vActionN == NBrowseAction.Next ? firstActiveProjId : lastActiveProjId; // wrap if no next or prev
        }
        return id;
      }
      // Prev | Next for all but Active
      id = vId;
      if (vActionN == NBrowseAction.Next) {
        // Next
        if (++id > numProjects) // wrap to first if past last
          id = 1;
      }else{
        // Prev
        // Must avoid doing id-1 when id is 0 re unsigned int arithmetic
        if (id <= 1) // wrap to last if id is 0 or 1
          id = numProjects;
        else
          id--;
      }
    }
    // Prev | Next for all but Active with
    // vAction set to Next for First or Prev for Last
    // There could be no matching project
    uint kStartId; // for checking for a complete loop without a match, initially 0
    if (vActionN == NBrowseAction.Next) {
      // Next
      // Move forwards to a project of the correct type if necessary
      while (!TypeMatch(id, vTypeN)) {
        if (kStartId == 0)
          kStartId = id; // first attempt for a match
        if (++id > numProjects) // wrap to first if past last
          id = 1;
        if (id == kStartId) {
          // complete loop so break out with no result
          id = 0;
          break;
        }
      }
    }else{
      // Prev
      // Must avoid doing id-1 when id is 0 re unsigned int arithmetic
      // Move back to a project of the correct type if necessary
      while (!TypeMatch(id, vTypeN)) {
        if (kStartId == 0)
          kStartId = id; // first attempt for a match
        if (id <= 1) // no prev so wrap to last
          id == numProjects;
        else
          id--;
        if (id == kStartId) {
          // complete loop so break out with no result
          id = 0;
          break;
        }
      }
    }
    return id;
  } // End BrowseProjects

  // ProjectInfo(uint vId)
  // -----------
  // Fetches info for the Project with Id of vId
  // Requires: FundingHub is Active, sender is ok {sender is not self (FundingHub), tx.origin and msg.sender are the same, msg.sender and tx.origin are set},
  //           vId > 0 and is the Id of a defined project
  // Parameters:
  // - vId      Id of the project for which info is required
  // Returns project info as below
  // This is close to hitting the "stack too deep" error. Just one more local variable would do it - 16 is the limit. Initially I had it returning Id also. With that it gave the "stack too deep" error.
  function ProjectInfo(uint vId) constant FHisActiveAndSenderIsOk returns (
      address projOwnerA,       // Address of the owner of the project
      uint    targetWei,        // Target amount to be raised
      uint    deadlineT,        // Deadline time
      uint    contributedWei,   // Total amount contributed
      uint    currentBalWei,    // Project.this.balance which is only different from 'Total amount contributed' if payout or refunds have happened
      uint    targetMetT,       // Time when target was met = when state changes from Active to TargetMet
      uint    fundedT,          // Time of withdrawal by owner after funding = when state changes from TargetMet to Funded || when refunding of a failed project is completed = when state changes from ReFunding to Closed
      uint    numContributions, // Number of contributions
      uint    numContributors,  // Number of contributors
      uint    refundAvailWei,   // Refund available to logged in visitor if state is Refunding and this visitor's refund has not been withdrawn or sent yet
      NState  stateN,           // State { 0:Null | 1:Active | 2:TargetMet | 3:Funded | 4:Refunding | 5:Closed }
      bytes32 nameS) {          // Name bytes32 as stored since casting to string for the return is not allowed
    require(vId > 0
         && projectsIndexMR[vId].id == uint16(vId));
    return (projectsIndexMR[vId].projA.ProjectInfo());
  } // End ProjectInfo()

  // NextContributorAndRefund(uint vId, address vContribA)
  // ------------------------
  // This function is included so that if necessary e.g. a project is stuck at state Refunding, FundingHub owner can make an expensive pass through contributors
  //  to push the outstanding refunds via use of NextContributorAndRefund() and PushRefund() calls and a UI loop
  // Called on a UI loop through the contributors to Project vId, vContribA is 0 for the first one, otherwise is the previous one -> next one here
  // Requires: FundingHub is Active, sender is ok {sender is not self (FundingHub), tx.origin and msg.sender are the same, msg.sender and tx.origin are set},
  //           sender is FundingHub owner (only FundingHub owner can make a pass through a project's contributors),
  //           vId > 0 and is the Id of a defined project
  //           state is Refunding or Closed (Can be Closed if the previous PushRefund() call finished the refunding and changed the state to Closed)
  // constant NOT payable
  // Returns the address of the next contributor if any and the refund due to that contributor, if any
  function NextContributorAndRefund(uint vId, address vContribA) constant FHisActiveAndSenderIsOk IsOwner returns (address contribA, uint refundDueWei) {
    require(vId > 0
         && projectsIndexMR[vId].id == uint16(vId)
         && projectsIndexMR[vId].stateN >= NState.Refunding);  // state is Refunding or Closed
    return (projectsIndexMR[vId].projA.NextContributorAndRefund(vContribA));
  } // End NextContributorAndRefund()


  // Public functions
  // ================

  // CreateProject([parameters])
  // -------------
  // This function should allow a user to add a new project to the FundingHub.
  // The function should deploy a new Project contract and keep track of its address.
  // The CreateProject() function should accept all constructor values that the Project contract requires.
  // NOT Payable
  // Requires: FundingHub is Active, sender is ok {sender is not self (FundingHub), tx.origin and msg.sender are the same, msg.sender and tx.origin are set},
  //           sender is FundingHub owner (only FundingHub owner can add new Projects),
  //           vNameS to be set, vOwner to be set, vTargetWei to be set, vDeadlineT to be in the future, numProject to be < limit of cMAX_PROJECTS
  // Gas: Initially this caused an OOG exception. Could not find a way to send gas to the Project constructor.
  //      (new Project).gas(600000)(++numProjects, vTargetWei, vDeadlineT, vNameS)
  //      like (new B).value(10)(); //construct a new B with 10 wei from http://solidity.readthedocs.io/en/develop/frequently-asked-questions.html#how-do-i-initialize-a-contract-with-only-a-specific-amount-of-wei
  //      was rejected by the compiler with method gas not available. Other tries were also rejected.
  //      The solution was to add gas: 3500000 to truffle.js which is much more than the Project constructor needs, yet values closer to the actual usage failed.
  //      The course notes talk about this and Xavier posted about it here: https://github.com/trufflesuite/truffle/issues/271
  function CreateProject(bytes32 vNameS, address vOwnerA, uint vTargetWei, uint vDeadlineT) FHisActiveAndSenderIsOk IsOwner returns (uint Id) { // meA will be FH owner
    require (vNameS.length > 0           // name is defined
          && vOwnerA    >= address(0)    // owner is set
          && vTargetWei > 0              // target is set
          && numProjects < cMAX_PROJECTS // have not reached the limit of number of Projects
          && vDeadlineT > now);          // deadline is in the future
    // Add the index struct to the mapping
    projectsIndexMR[numProjects] = R_ProjectIndex(
      new Project(++numProjects, vNameS, vOwnerA, vTargetWei, vDeadlineT), // Project projA, could throw. ++ prefix as Id starts from 1
      numProjects,        // Id
      0,                  // nextActiveProjId
      lastActiveProjId,   // prevActiveProjId, 0 for the first one
      uint32(vDeadlineT), // deadlineT
      NState.Active);     // state
    // Update other state vars
    if (++numActiveProjects == 1) // Number of active projects
      firstActiveProjId = numProjects; // not 1 because can have active projects return to 0 before increasing again
    else
      projectsIndexMR[lastActiveProjId].nextActiveProjId = uint16(numProjects);
    lastActiveProjId = numProjects;
    // event OnNewProject(uint indexed Id, address indexed OwnerA, bytes32 NameS, uint TargetWei, uint DeadlineT, address CreatorA, uint WhenT);
    OnNewProject(numProjects, vOwnerA, vNameS, vTargetWei, vDeadlineT, msg.sender, now);
    return numProjects;
  }

  // Contribute(uint vId)
  // ----------
  // This function allows users to contribute to a Project identified by its address.
  // Contribute calls the Fund() function in the individual Project contract and passes on all Ether value attached to the function call.
  // Parameter: vId id of the project the contribution is for
  // Requires: FundingHub is Active, sender is ok {sender is not self (FundingHub), tx.origin and msg.sender are the same, msg.sender and tx.origin are set},
  //           vId > 0 and is the Id of a defined project, project vId is Active
  // Returns state of project after the contribution, which can change from Active to TargetMet or Refunding
  function Contribute(uint vId) payable FHisActiveAndSenderIsOk returns (NState retStateN) {
    require(vId > 0
         && projectsIndexMR[vId].id == uint16(vId)
         && projectsIndexMR[vId].stateN == NState.Active);
    NState kStateN = projectsIndexMR[vId].projA.Fund.value(msg.value)(); // this forwards all available gas
    if (kStateN != NState.Active) // either this contribution hit the target, or it was over time
      ChangeState(vId, kStateN);
    // event OnContribute(uint indexed Id, address indexed ContributorA, uint ContributedWei, uint WhenT, NState StateN);
    OnContribute(vId, msg.sender, msg.value, now, kStateN);
    return kStateN;
  }

  // WithdrawFunds(uint vId)
  // -------------
  // Called by owner of project to withdraw funds once it has met its target with state TargetMet = Payout
  // Parameters:
  // - vId     Id of the project for which the wwithdrawal is to be performed
  // Requires: FundingHub is Active, sender is ok {sender is not self (FundingHub), tx.origin and msg.sender are the same, msg.sender and tx.origin are set},
  //           vId > 0 and is the Id of a defined project, project vId is in TargetMet state
  //           (originator is owner of project vId is a Project.WithdrawFunds() requirement.)
  // Returns true
  function WithdrawFunds(uint vId) FHisActiveAndSenderIsOk returns (bool okB) {
    require(vId > 0
         && projectsIndexMR[vId].id == uint16(vId)
         && projectsIndexMR[vId].stateN == NState.TargetMet);
    uint kPaidoutWei = projectsIndexMR[vId].projA.WithdrawFunds(); // WithdrawFunds() changes project state to Funded if it doesn't throw
    ChangeState(vId, NState.Funded);
    // OnPayout(uint indexed Id, address indexed OwnerA, uint PaidoutWei, uint WhenT, NState StateN);
    OnPayout(vId, tx.origin, kPaidoutWei, now, NState.Funded);
    return true;
  }

  // SetToRefunding(uint vId)
  // --------------
  // Called when an active project has gone over time to set its state to Refunding or, if no contributions had been made to it, to Closed
  // Requires: FundingHub is Active, sender is ok {sender is not self (FundingHub), tx.origin and msg.sender are the same, msg.sender and tx.origin are set},
  //           sender is FundingHub owner (only FundingHub owner can initiate the Refunding state),
  //           vId > 0 and is the Id of a defined project, project vId is in Active state
  //           (project has gone over time is a Project.SetToRefunding() requirement.)
  // NOT Payable
  // Returns true
  function SetToRefunding(uint vId) FHisActiveAndSenderIsOk IsOwner returns (NState retStateN) {
    require(vId > 0
         && projectsIndexMR[vId].id == uint16(vId)
         && projectsIndexMR[vId].stateN == NState.Active);
    NState kStateN = projectsIndexMR[vId].projA.SetToRefunding(); // Refunding or Closed
    ChangeState(vId, kStateN);
    return kStateN;
  }

  // WithdrawRefund(uint vId)
  // --------------
  // Withdraw originator's contribution to project vId
  // Requires: FundingHub is Active, sender is ok {sender is not self (FundingHub), tx.origin and msg.sender are the same, msg.sender and tx.origin are set},
  //           vId > 0 and is the Id of a defined project, project vId is in Refunding state
  //           (originator has a refund available is a Project.WithdrawRefund() requirement.)
  // NOT Payable
  // This results in a transfer() by Project.WithdrawRefund()
  // Returns state, which changes to Closed if this refund completes refunding i.e. if the contract balance goes to zero
  function WithdrawRefund(uint vId) FHisActiveAndSenderIsOk returns (NState retStateN) {
    require(vId > 0
         && projectsIndexMR[vId].id == uint16(vId)
         && projectsIndexMR[vId].stateN == NState.Refunding);
    NState kStateN;
    uint   kRefundWei;
    (kStateN, kRefundWei) = projectsIndexMR[vId].projA.WithdrawRefund();
    if (kStateN == NState.Closed) // Balance went to zero == all refunds are complete
      ChangeState(vId, kStateN);
    // OnPullRefund(uint indexed Id, address indexed ContributorA, uint RefundWei, uint WhenT, NState StateN);
    OnPullRefund(vId, tx.origin, kRefundWei, now, kStateN);
    return kStateN;
  }

  // PushRefund(uint vId, address vContribA)
  // ----------
  // Included so that if necessary e.g. a project is stuck at state Refunding, FundingHub owner can make an expensive pass through contributors
  //  to push the outstanding refunds via use of NextContributorAndRefund() and PushRefund() calls and a UI loop
  // Refunds contributor's contribution
  // Called from UI by FundingHub owner
  // Requires: FundingHub is Active, sender is ok {sender is not self (FundingHub), tx.origin and msg.sender are the same, msg.sender and tx.origin are set},
  //           sender is FundingHub owner (only FundingHub owner can make a pass through a project's contributors to push refunds),
  //           vId > 0 and is the Id of a defined project, project vId is in Refunding state
  //           vContribA is set and is different from msg.sender
  //           (vContribA has a refund available is a Project.PushRefund() requirement.)
  // NOT payable
  // Returns state, which changes to Closed if this refund completes refunding i.e. if the contract balance goes to zero
  function PushRefund(uint vId, address vContribA) FHisActiveAndSenderIsOk IsOwner returns (NState retStateN) {
    require(vId > 0
         && projectsIndexMR[vId].id == uint16(vId)
         && projectsIndexMR[vId].stateN == NState.Refunding
         && vContribA != address(0)    // vContribA is set
         && vContribA != msg.sender);  // and is different from sender [If FundingHub owner is due a refund that is expected to be pulled via WithdrawRefund() rather than via a push UI loop]
    NState kStateN;
    uint   kRefundWei;
    (kStateN, kRefundWei) = projectsIndexMR[vId].projA.PushRefund(vContribA);
    if (kStateN == NState.Closed) // Balance went to zero == all refunds are complete
      ChangeState(vId, kStateN);
    // OnPushRefund(uint indexed Id, address indexed ContributorA, uint RefundWei, uint WhenT, NState StateN, address PushedByA);
    OnPushRefund(vId, vContribA, kRefundWei, now, kStateN, tx.origin);
    return kStateN;
  } // End PushRefund()


  // internal functions
  // ==================

  // ChangeState()
  // -----------
  // Changes the state of a project in the index after a change of state, and adjusts the active projects linked list and count if the project was Active before this change
  // i.e.the target has been met, the project owner has withdrawn the funds, the project has gone over time, or project refunding is complete
  function ChangeState(uint vId, NState vStateN) internal {
    R_ProjectIndex rIndexR = projectsIndexMR[vId]; // reference to the index entry
    if (rIndexR.stateN == NState.Active) {
      // If the project was active fix the active links
      if (rIndexR.nextActiveProjId > 0) projectsIndexMR[rIndexR.nextActiveProjId].prevActiveProjId = rIndexR.prevActiveProjId;
      if (rIndexR.prevActiveProjId > 0) projectsIndexMR[rIndexR.prevActiveProjId].nextActiveProjId = rIndexR.nextActiveProjId;
      if (vId == firstActiveProjId)
        firstActiveProjId = rIndexR.nextActiveProjId;
      if (vId == lastActiveProjId)
        lastActiveProjId = rIndexR.prevActiveProjId;
      rIndexR.nextActiveProjId =
      rIndexR.prevActiveProjId = 0;
      numActiveProjects--;
    }
    rIndexR.stateN = vStateN;
  }

  // TypeMatch(uint vId, NBrowseType vTypeN) internal returns (bool)
  // ---------
  // Returns true if project vId matches vType { 2:TargetMet, 3:Funded, 4:Refunding, 5:Closed, 6:All, 7:Mine }, otherwise false
  // Is not called for a match on type Active
  function TypeMatch(uint vId, NBrowseType vTypeN) internal returns (bool) {
    if (vTypeN == NBrowseType.All)         // 6:All
      return true;
    if (vTypeN == NBrowseType.Mine)        // 7:Mine
      return msg.sender == projectsIndexMR[vId].projA.ProjectOwner();
    NState kStateN = projectsIndexMR[vId].stateN;
    if (vTypeN == NBrowseType.TargetMet)   // 2:TargetMet
      return kStateN == NState.TargetMet;
    if (vTypeN == NBrowseType.Funded)      // 3:Funded
      return kStateN == NState.Funded;
    if (vTypeN == NBrowseType.Refunding)   // 4:Refunding
      return kStateN == NState.Refunding;
    if (vTypeN == NBrowseType.Closed)      // 5:Closed
      return kStateN == NState.Closed;
    return false;
  }

  // no private functions
} // End FundingHub Contract
