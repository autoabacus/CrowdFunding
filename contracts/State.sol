/* State.sol

B9lab: ETH-8 Certified Online Ethereum Developer Course - January 2017
Exam Project started 2017.05.09
*/

pragma solidity ^0.4.11;

// Contract to enable use of the state enum in both FundingHub and Project since casts between enums declared in different contracts are not allowed.
// The alternative to this would have been to use a fundamental type e.g. uint8 for state
// This is also used as a central location for the declaration of constants though no constants are used across contacts.
contract State {
  enum NState { // Project state enum
    Null,      // 0 Not a valid project
    Active,    // 1 Project is active i.e. ready for contributions to be made
    TargetMet, // 2 Project target was met within the deadline time and the target amount is available for withdrawal by the project owner
    Funded,    // 3 Project target was met within the deadline time and the target amount has been withdrawn by the project owner
    Refunding, // 4 Project had some contribution made but went over time without the target being met and is waiting for refunding to be completed either by contributor withdrawals (pulls) or by FundingHub owner pushes. (If no contributions at all were made to the project on time out it goes straight to a final state of Closed.
    Closed}    // 5 Project has been fully refunded, or it timed out with no contributions

  string constant cVER = "1.00";         // Version
  uint16 constant cMAX_PROJECTS = 65535; // Maximum number of projects allowed for in this simple system re overflow of uint16 Id vars used in the index and in Projects
  uint16 constant cMAX_CONTRIBS = 65535; // Maximum number of contributions per project allowed for in this simple system
} // End State Contract
