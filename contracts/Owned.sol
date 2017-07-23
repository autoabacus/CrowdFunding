/* Owned.sol

2017.03.04 Created. On 72nd birthday!!

Owned is a Base Contract for contracts that are:
• "owned"
• can have their owner changed by a call to changeOwner() by the owner
• can be paused  from an active state by a call to pause() by the owner
• can be resumed from a paused state by a call to resume() by the owner

Modifier functions available for use here and in child contracts are:
• IsOwner()  which throws if called by other than the current owner
• IsActive() which throws if called when the contract is paused

Provides helper functions:
AddressIsSetAndIsNotContractB(vA) - Returns true if vA is set and is not the address of the contract, otherwise false

Changes of owner are logged via: event OnOwnerChanged(address indexed previousOwner, address newOwner)

*/

pragma solidity ^0.4.11;

contract Owned {
  address internal ownerA; // Contract owner
  bool    internal pausedB;

  // Constructor NOT payable
  // -----------
  function Owned() {
    ownerA = msg.sender;
  }

  // Modifier functions
  // ------------------
  modifier IsOwner {
    require(msg.sender == ownerA);
    _;
  }

  modifier IsActive() {
    require(!pausedB);
    _;
  }

  // Constant Public functions
  // =========================
  // OwnerAddress()
  // ------------
  // Returns the owner's address
  function OwnerAddress() constant returns (address) {
    return ownerA;
  }

  // IsPaused()
  // --------
  // Return the contract paused state true/false
  function IsPaused() constant returns (bool) {
    return pausedB;
  }

  // Events
  // ------
  // event OnOwnerChanged(address indexed previousOwner, address newOwner);

  // // Public functions
  // // ----------------
  // // Change owner
  // function ChangeOwner(address vNewOwnerA) IsOwner {
  //   OnOwnerChanged(ownerA, vNewOwnerA);
  //   ownerA = vNewOwnerA;
  // }

  // Pause
  function Pause() IsOwner {
    pausedB = true; // contract has been paused
  }

  // Resume
  function Resume() IsOwner {
    pausedB = false; // contract has been resumed
  }

  // Internal Functions
  // ------------------
  // AddressIsSetAndIsNotContractB(vA)
  // Returns true if vA is set and is not the address of the contract, otherwise false
  function AddressIsSetAndIsNotContractB(address vA) returns (bool) {
    if (vA == address(this)             // == contract
     || vA == address(0)) return false; // address not set
    return true;
  }
} // End Owned contract
