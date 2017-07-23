// 2017.05.14 - 2017.06  .05 Crowdfunding B9Lab Exam Project

// Import the page's CSS. Webpack will know what to do with it.
import '../stylesheets/app.css';

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import fundinghub_artifacts from '../../build/contracts/FundingHub.json'

// FundingHub is our usable abstraction, which we'll use through the code below.
var FundingHub = contract(fundinghub_artifacts);

var Instance,  // FundingHub.deployed()
  FHContractA, // FundingHub Contract address
  FHOwnerA,    // FundingHub Owner address
  FHOwnerB,    // Logged in visitor is FundingHub Owner true/false
  MeA = 0,     // Address of logged in visitor, 0 if none
  Id,          // Id of last browsed project
  PausedB,     // true when FundingHub is paused
  // Buttons that are disabled/enabled
  ZeroBtnEl, PrevBtnEl, NextBtnEl, LastBtnEl, NewProjBtnEl,
  ContribBtnEl, WithdrawFundsBtnEl, WithdrawRefundBtnEl, PushRefundsBtnEl;

function GetEl(elId) {
  return document.getElementById(elId).innerHTML;
}

function SetEl(elId, valueS) {
  document.getElementById(elId).innerHTML = valueS;
}

function GetInput(elId){
  return document.getElementById(elId).value;
}

function SetInput(elId, valueS){
  document.getElementById(elId).value = valueS;
}

function ShowEl(elId) {
  document.getElementById(elId).style.display = 'block';
}

function HideEl(elId) {
  document.getElementById(elId).style.display = 'none';
}

function ShowHideEl(elId, showB) {
  document.getElementById(elId).style.display = showB ? 'block' : 'none';
}

function AddButton(elId, fn) {
  let btnEl = document.getElementById(elId);
  btnEl.addEventListener('click', fn);
  return btnEl;
}

function SetStatus(msgS) {
  SetEl('StatusId', msgS);
}

function SetStatusReady() {
  SetStatus('Ready');
  EnableButtons();
}

function SetError(msgS) {
  ShowEl('ErrorDivId');
  SetEl('ErrorId', msgS);
  console.log('Error: '+msgS);
  SetStatus('Waiting on correction of the error below.');
  EnableButtons();
}

// Called if a contract or web3 error occurs
function WebAccessError(msgS, e) {
  if (e.message.indexOf("unlock") > 0)  // geth: 'authentication needed: password or unlock'  TestRPC: '...could not unlock signer account...'
    msgS += ".<br>It appears that account '"+MeA+"' needs to be unlocked.";
  SetError(msgS);
  console.error(e);
  SetStatus('Waiting on correction of the error below. See the log for more details.');
}

function LogAndSetStatus(msgS) {
  console.log(msgS);
  SetStatus(msgS);
}

// Called at the start of a button click op
function DisableButtons() {
  HideEl('ErrorDivId');
  ZeroBtnEl.disabled=true;
  PrevBtnEl.disabled=true;
  NextBtnEl.disabled=true;
  LastBtnEl.disabled=true;
  ContribBtnEl.disabled=true;
  WithdrawFundsBtnEl.disabled=true;
  WithdrawRefundBtnEl.disabled=true;
  if (FHOwnerB) {
    PushRefundsBtnEl.disabled=true;
    NewProjBtnEl.disabled=true;
  }
}

function EnableButtons() {
  // Enable buttons if logged in
  if (!!MeA) {
    ZeroBtnEl.disabled=false;
    PrevBtnEl.disabled=false;
    NextBtnEl.disabled=false;
    LastBtnEl.disabled=false;
    ContribBtnEl.disabled=false;
    WithdrawFundsBtnEl.disabled=false;
    WithdrawRefundBtnEl.disabled=false;
    if (FHOwnerB) {
      PushRefundsBtnEl.disabled=false;
      NewProjBtnEl.disabled=false;
    }
  }
}

function ClearProject() {
  SetEl('TimeNowId', '');
  SetEl('PId', '');
  SetEl('PName', '&nbsp;');
  SetEl('PTarget',  '');
  SetEl('PContrib', '');
  SetEl('PBal',     '');
  SetEl('PRefund',  '');
  SetEl('PNumContributions', '');
  SetEl('PNumContributors',  '');
  SetEl('PDeadline', '');
  SetEl('PTargetMet', '');
  SetEl('PFunded', '');
  SetEl('PState', '');
  SetEl('PMe', '');
  HideEl('ContribDivId');
}

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
// Is called with a number (Id) after Contribute() or a BigNumber after a browse op
function ShowProject(id, doneFn) {
  Id = (typeof id === 'number') ? id : id.toNumber();
  console.log('ShowProject id', Id);
  if (!doneFn)
    doneFn = SetStatusReady;
  // console.log('ShowProject doneFn', doneFn);
  if (!Id) {
    ClearProject();
    SetEl('PName', 'None');
    doneFn();
    return;
  }
  Instance.ProjectInfo.call(Id, {from: MeA})
  .then(res => {
    // console.log(res);
    let nameS = web3.toUtf8(res[11]), // toUtf8() trims the trailing 0s better than toAscii()!
        state = res[10].toNumber();
    SetEl('PId',      Id);
    SetEl('PName',    nameS);
    SetEl('PTarget',  web3.fromWei(res[1], 'ether')); // no decimals as input as integer ether
    SetEl('PContrib', WeiToEtherDec2(res[3]));
    SetEl('PBal',     WeiToEtherDec2(res[4]));
    SetEl('PRefund',  res[9].isZero() ? '' : WeiToEtherDec2(res[9]));
    SetEl('PNumContributions', res[7]);
    SetEl('PNumContributors',  res[8]);
    SetEl('PDeadline',  GmtNixBnDateS(res[2]));
    SetEl('PTargetMet', GmtNixBnDateS(res[5]));
    SetEl('FundedHdgId', state < 4 ? 'Funded' : 'Refunded');
    SetEl('PFunded',    GmtNixBnDateS(res[6])); // Funded or Refunded date or ''
    SetEl('PMe', res[0] == MeA ? 'Yes' : 'No');
    if (state == 1) {
      // Active
      HideEl('WithdrawFundsDivId');
      HideEl('WithdrawRefundDivId');
      // Has the project gone over time?
      if (Date.now() > (new Date(res[2].toNumber()*1000).getTime())) {
        // Project has gone over time
        state = 4; // Refunding
        HideEl('ContribDivId');
        doneFn = SetToRefunding; // which will result in a further call to ShowProject() after the Project has been updated to Refunding or Closed
      }else{
        // Still Active
        SetEl('ContribPName', nameS);
        ShowEl('ContribDivId');
      }
    }else{
      // All other than Active
      HideEl('ContribDivId');
      HideEl('WithdrawRefundDivId');
      if (state == 2 && res[0] == MeA) {
        // TargetMet && it is My project
        SetEl('WithdrawFundsPName', nameS);
        SetEl('WithdrawFundsAmt', GetEl('PTarget'));
        ShowEl('WithdrawFundsDivId');
      }else
        HideEl('WithdrawFundsDivId');
      if (state == 4 && !res[9].isZero()) {
        // For a Refunding project show the Withdraw Refund panel if a refund is available to the logged in visitor
        SetEl('WithdrawRefundPName', nameS);
        SetEl('WithdrawRefundAmt', GetEl('PRefund'));
        ShowEl('WithdrawRefundDivId');
      }
    }
    if (MeA == FHOwnerA)
      // For the FundingHub owner and a Refunding state project without a refund available to FH owner show the Push Refund button div else hide it.
      // (The 'without a refund available to FH owner' condition is because FH Owner should do a Withdraw Refund pull of that first.)
      ShowHideEl('PushRefundsDivId', state == 4 && res[9].isZero());
    SetEl('TimeNowId', (' at ' + GmtDateS(new Date()) + ' GMT'));
    SetEl('PState', StateStr(state));
    doneFn();
  }).catch(e => WebAccessError('Fetching info for project ' + Id, e));
}

// Format dates where T is a BN form of a nix time in secs
// as '' or 'YYYY.MM.DD hh:mm'
function GmtNixBnDateS(T) {
  return T.isZero() ? '' : GmtDateS(new Date(T.toNumber()*1000)); // *1000 for JS date in milliseconds
}

function GmtDateS(T) {
  return T.getUTCFullYear() + '.' +
    TwoDigits(T.getUTCMonth()+1) + '.' +
    TwoDigits(T.getUTCDate()) + ' ' +
    TwoDigits(T.getUTCHours()) + ':' +
    TwoDigits(T.getUTCMinutes());
}

// Fn to pad digits in range 0-99 to 2 digits with a leading 0
function TwoDigits(n) {
  return (n+100).toString().substr(1);
}

function StateStr(state) {
  switch (state) {
    case 1: return 'Active';
    case 2: return 'Target Met';
    case 3: return 'Funded';
    case 4: return 'Refunding';
    case 5: return 'Closed';
  }
  return 'Unknown';
}

// Separate fn so that GetAndSetBalance() gets called with doneFn undefined. If the click event goes straight to GetAndSetBalance() doneFn is defined for a mouse action!
function RefreshBalance() {
  GetAndSetBalance();
}

function GetAndSetBalance(doneFn) {
  web3.eth.getBalance(MeA, function(e, res) {
    if (e)
      WebAccessError('Getting balance for ' + MeA, e)
    else{
      SetEl('MeBal', WeiToEtherDec2(res));
      // console.log('doneFn', doneFn);
      if (!doneFn)
        SetStatusReady();
      else
        doneFn();
    }
  })
}

function WeiToEtherDec2(wei) {
  return parseFloat(web3.fromWei(wei, 'ether')).toFixed(2);
}

// Button click fns
function LogIn() {
  DisableButtons();
  SetInput('MeAddrIn', MeA = GetInput('MeAddrIn').toLowerCase()); // convert to lower case and echo it re subsequent address comparisons as addresses returned from the contract come back lower case
  LogAndSetStatus('Logging In '+ MeA);
  if (!web3.isAddress(MeA))
    return SetError('Login address is invalid');
  if (MeA == FHContractA)
    return SetError('Login address is the same as that of the FundingHub contract, which is not a valid user address');
  FHOwnerB = MeA == FHOwnerA;
  SetEl('MeAddr', MeA);
  HideEl('LIInput');
  ShowEl('LIShow');
  if (PausedB) {
    // FH is Paused
    HideEl('FHLiveDivId');
    ShowEl('FHPausedDivId');
    ShowHideEl('FHPausedFHOwnerDivId', FHOwnerB);
  }else{
    // FH is Live
    if (FHOwnerB) {
      ShowEl('FHOwnerDivId');
      ShowEl('FHPausedFHOwnerDivId');
      SetStatus('Logged In as FundingHub Owner');
    }else{
      HideEl('FHOwnerDivId');
      HideEl('FHPausedFHOwnerDivId');
      SetStatus('Logged In as a visitor');
    }
    GetAndSetBalance(FirstProject);
  }
}

function LogOut() {
  MeA = 0;
  FHOwnerB = false;
  SetInput('MeAddrIn', '');
  ShowEl('LIInput');
  HideEl('LIShow');
  HideEl('ContribDivId');
  HideEl('WithdrawFundsDivId');
  HideEl('WithdrawRefundDivId');
  HideEl('FHOwnerDivId');
  ClearProject();
  SetStatus('Logged Out');
}

// Project Browsing functions
function FirstProject() {
  Browse(0, 0);
}

// Browsing
function PrevProject() {
  Browse(Id, 1);
}

function NextProject() {
  Browse(Id, 2);
}

function LastProject() {
  Browse(0, 3);
}

function Browse(id, action) {
  DisableButtons();
  let msgS = 'Browsing Projects';
  SetStatus(msgS);
  // console.log('Instance.BrowseProjects.call(' + id + ', ' + action +', ' + document.getElementById('TypeSelectId').value + ')');
  // BrowseProjects() parameters:
  // - vId      Id of the current project, 0 if none
  // - vActionN { First, Prev, Next, Last}                                                Browse action to be performed
  // - vTypeN   { 1:Active, 2:TargetMet, 3:Funded, 4:Refunding, 5:Closed, 6:All, 7:Mine } Type of project being browsed
  Instance.BrowseProjects.call(id, action, document.getElementById('TypeSelectId').value)
  .then(idBN => ShowProject(idBN)
  ).catch(e => WebAccessError(msgS, e));
}

// The Contribution div is hidden unless an active project is displayed
function Contribute() {
  DisableButtons();
  let contribWeiS = web3.toWei(GetInput('ContribAmt'), 'ether'); // number string
  // Check contribution against MeA's current balance
  web3.eth.getBalance(MeA, function(e, res) {
    if (e)
      WebAccessError('Getting balance for ' + MeA, e)
    else{
      SetEl('MeBal', WeiToEtherDec2(res));
      if (res.lessThan(contribWeiS))
        return SetError('Amount to be contributed is greater than ' + MeA + "'s current balance");
      // Ok to make the contribution
      let msgS = 'Sending ' + GetInput('ContribAmt') + ' ethers to project '+Id+" from '"+MeA+"'";
      LogAndSetStatus(msgS);
      Instance.Contribute(Id, {from: MeA, value: contribWeiS, gas: 200000})
      .then(txObj => {
        //console.log('Contribute Tx Object: ', txObj);
        //console.log('Contribute Tx: ', txObj.tx);
        console.log('Contribute gas used', txObj.receipt.gasUsed); // 140241 as first for a project, 95380 subsequent, 54515 subsequent if a repeat for a contributor, 81528 with target met, 134331 with target met and refund of excess
        msgS = 'Updating project for the contribution';            // 172210 as first for a project and target met exactly on one contribution, 179217 as first with aa=target met anda refund of excess
        ShowProject(Id, GetAndSetBalance);
      }).catch(e => WebAccessError(msgS, e));
    }
  })
}

function WithdrawFunds() {
  DisableButtons();
  let msgS = 'Withdrawing Funds';
  LogAndSetStatus(msgS);
  Instance.WithdrawFunds(Id, {from: MeA, gas: 75000})
  .then(txObj => {
    console.log('Withdraw Funds gas used', txObj.receipt.gasUsed); // 49321
    ShowProject(Id, GetAndSetBalance);
  }).catch(e => WebAccessError(msgS, e));
}

// Called from ShowProject() on showing (browsing to) an active project which has gone over time
// If no contributions were made to the project it will go straight to the Closed state
function SetToRefunding() {
  let msgS = 'Setting Project to Refunding state';
  LogAndSetStatus(msgS);
  Instance.SetToRefunding(Id, {from: FHOwnerA, gas: 100000}) // sender FundingHub owner
  .then(txObj => {
    console.log('Set to refunding state gas used', txObj.receipt.gasUsed); // 56191
    ShowProject(Id);
  }).catch(e => WebAccessError(msgS, e));
}

function WithdrawRefund() {
  DisableButtons();
  let msgS = 'Withdrawing Refund for '+MeA;
  LogAndSetStatus(msgS);
  Instance.WithdrawRefund(Id, {from: MeA, gas: 75000})
  .then(txObj => {
    console.log('Withdraw Refund gas used', txObj.receipt.gasUsed); // 39385
    ShowProject(Id, GetAndSetBalance);
  }).catch(e => WebAccessError(msgS, e));
}

function PushRefunds() {
  DisableButtons();
  LogAndSetStatus('Pushing Refunds');
  PushRefund('0x0000000000000000000000000000000000000000');
}

// Loops through contributors until a 0 return, which occurs at the end of the list or when refunding has finished and the state has changed to Closed
function PushRefund(contribA) {
  let msgS = 'Getting info for next contributor after ' + contribA;
  LogAndSetStatus(msgS);
  Instance.NextContributorAndRefund.call(Id, contribA, {from: FHOwnerA})
  .then(res => {
    // address contribA, uint refundDueWei
    contribA = res[0];
    console.log('ContribA', contribA, 'Refund', WeiToEtherDec2(res[1]));
  //if (!web3.toDecimal(contribA))
    if (contribA == '0x0000000000000000000000000000000000000000')
      return 0; // finished
    if (res[1].isZero())
      return 1; // no refund for this one but continue looping
    // Got a refund to push
    // <p>Pushing <span id=PushRefundAmtId></span> ethers refund to contributor '<span id=PushRefundContribId></span>'</p>
    SetEl('PushRefundAmtId', WeiToEtherDec2(res[1]));
    SetEl('PushRefundContribId', contribA);
    msgS = 'Pushing '+GetEl('PushRefundAmtId')+' ethers refund to ' + contribA;
    LogAndSetStatus(msgS);
    return Instance.PushRefund(Id, contribA, {from: FHOwnerA, gas: 75000});
  }).then(txObj => {
    // console.log('txObj', txObj);
    // Cases:
    // 0 - finished looping
    // 1 - still looping, no refund for this contributor
    // object - PushRefund() return
    if (typeof txObj == 'object')
      console.log('Push Refund gas used', txObj.receipt.gasUsed); // 41586, 52164 when state changed to Closed
    if (txObj === 0)
      // Finished. Project state should now be Closed
      ShowProject(Id);
    else
      // still looping - either 1 or object cases
      PushRefund(contribA);
  }).catch(e => WebAccessError(msgS, e));
}

// Only FundingHub owner can add new projects. Div is hidden if not logged in as FH owner
function NewProj() {
  // console.log('In NewProj()');
  DisableButtons();
  let nameS  = GetInput('PNameIn'),
  projOwnerA = GetInput('POwnerAddrIn').toLowerCase(), // to lc for consistency
  targetEth  = parseInt(GetInput('PTargetIn')),   // ethers number with decimals chopped
  deadlineT  = new Date(GetInput('PDeadlineIn')), // in browser tz
  nowT       = new Date();
  SetInput('POwnerAddrIn', projOwnerA); // echo it in case of case conversion
  if (!nameS.length)
    return SetError('No name entered');
  if (!web3.isAddress(projOwnerA))
    return SetError('Owner address is invalid');
  if (!targetEth)
    return SetError('No target ethers entered');
  if (isNaN(deadlineT.getTime()))
    return SetError('Invalid Deadline date entered. Enter a date in the YYYY.MM.DD {hh:mm} format.');
  // console.log('nowT', nowT);
  // console.log('deadlineT', deadlineT);
  deadlineT.setTime(deadlineT.getTime() - nowT.getTimezoneOffset() * 60000); // convert to UTC
  // console.log('deadlineT', deadlineT);
  if (deadlineT <= nowT)
    return SetError('Deadline date entered is not in the future. (It is now ' + GmtDateS(nowT)  + ' GMT.)');
  let deadLineMsecs = deadlineT.getTime();
  if ((deadLineMsecs - nowT.getTime()) > 31*24*3600000)
    return SetError('Deadline date entered is too far in the future. It can only be up to 31 days from now ' + GmtDateS(nowT)  + ' GMT.');
  let msgS = "Adding New Project '"+nameS+"' owned by "+projOwnerA+' deadline '+GmtDateS(deadlineT);
  LogAndSetStatus(msgS);
  // console.log('CreateProject("'+nameS+'",'+ projOwnerA+', '+web3.toWei(targetEth, 'ether')+', '+deadLineMsecs/1000.0+', '+'{from: '+MeA+', +gas: '+1000000+'})');
  Instance.CreateProject(nameS, projOwnerA, web3.toWei(targetEth, 'ether'), deadLineMsecs/1000.0, {from: FHOwnerA, gas: 1100000}) // MeA will be FH owner
  .then(txObj => {
    // sole.log('New Project Tx: ', txObj);
    console.log('New project added. Gas used', txObj.receipt.gasUsed); // 1002480, 1017480
    msgS = 'Fetching new project info';
    // Browse to the newly added Project
    return Instance.BrowseProjects.call(0, 3, 1); // last active
  }).then(idBN => ShowProject(idBN)
  ).catch(e => WebAccessError(msgS, e));
}

function PauseFundingHub() {
  let msgS = 'Pausing FundingHub';
  LogAndSetStatus(msgS);
  Instance.Pause({from: FHOwnerA})
  .then(txObj => {
    console.log('Pause gas used', txObj.receipt.gasUsed); // 26776
    PausedB = true;
    HideEl('FHLiveDivId');
    ShowEl('FHPausedDivId');
    ShowHideEl('FHPausedFHOwnerDivId', FHOwnerB);
   }).catch(e => WebAccessError(msgS, e));
}

function ResumeFundingHub() {
  let msgS = 'Resuming FundingHub';
  LogAndSetStatus(msgS);
  Instance.Resume({from: FHOwnerA})
  .then(txObj => {
    console.log('Resume gas used', txObj.receipt.gasUsed); // 26681
    PausedB = false;
    ShowEl('FHLiveDivId');
    HideEl('FHPausedDivId');
    SetStatusReady();
    ShowHideEl('FHOwnerDivId', FHOwnerB);
    GetAndSetBalance(FirstProject);
   }).catch(e => WebAccessError(msgS, e));
}

window.onload = function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    console.warn("Using web3 detected from external source. If you find that the page doesn't load correctly, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://localhost:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }
  // Start
  // Bootstrap the FundingHub abstraction for Use.
  FundingHub.setProvider(web3.currentProvider);

  // Add the buttons
  AddButton('LIBtnId',  LogIn);
  AddButton('LOBtnId',  LogOut);
  AddButton('ReBtnId',  RefreshBalance);
  AddButton('PFHBtnId', PauseFundingHub);
  AddButton('RFHBtnId', ResumeFundingHub);
  AddButton('SSEBtnId', StartStopEventLogging);
  ZeroBtnEl    = AddButton('ZeroBtnId',   FirstProject);
  PrevBtnEl    = AddButton('PrevBtnId',   PrevProject);
  NextBtnEl    = AddButton('NextBtnId',   NextProject);
  LastBtnEl    = AddButton('LastBtnId',   LastProject);
  NewProjBtnEl = AddButton('NPBtnId',     NewProj);
  ContribBtnEl = AddButton('ContribBtnId',Contribute);
  WithdrawFundsBtnEl  = AddButton('WithdrawFundsBtnId',  WithdrawFunds);
  WithdrawRefundBtnEl = AddButton('WithdrawRefundBtnId', WithdrawRefund);
  PushRefundsBtnEl    = AddButton('PushRefundsBtnId',    PushRefunds);
  ClearProject();
  DisableButtons();
  // Get Instance
  let msgS = 'Getting FundingHub Instance';
  FundingHub.deployed()
  .then(instance => {
    Instance = instance;
    // console.log('Instance', Instance)
    FHContractA = FundingHub.address.toLowerCase(); // probably will always be lc but convert to be sure re address comparisons
    console.log('FundingHub Contract address:', FHContractA);
    msgS = 'Getting contract name';
    return Instance.GetVersion.call();
  }).then(res => {
    console.log('FundingHub Version', res);
    msgS = 'Getting Owner address';
    return Instance.OwnerAddress.call();
  }).then(res => {
    FHOwnerA = res;
    console.log('FundingHub Owner address: '+FHOwnerA);
    // SetInput('MeAddrIn', FHOwnerA); // For testing convenience set login address to FH owner. Should be removed for real use.
    msgS = 'Getting FundingHub Paused state';
    return Instance.IsPaused.call();
  }).then(pausedB => {
    PausedB = pausedB;
    console.log('FundingHub IsPaused', PausedB);
    if (PausedB) {
      HideEl('FHLiveDivId');
      ShowEl('FHPausedDivId');
    }else{
      ShowEl('FHLiveDivId');
      HideEl('FHPausedDivId');
    }
    SetStatusReady();
  }).catch(e => WebAccessError(msgS, e));
}

function StartStopEventLogging() {
  SetEl('SSEBtnId', GetEl('SSEBtnId') == 'Start Event Logging' ? 'Stop Event Logging' : 'Start Event Logging'); // toggle the button
  LogNewProjects();
  LogContributions();
  LogPayouts();
  LogPullRefunds();
  LogPushRefunds();
}

// Event logging functions.
// Could have made one function. Kept separate to make it easy to do selective event logging if desired.
function LogNewProjects() {
  // Check state of play by using LogNewProjects.event as a 'static' variable for our event
  if (typeof LogNewProjects.event == 'undefined' ) {
    // Start the watch
    (LogNewProjects.event = Instance.OnNewProject()).watch(function(e, res) {
      if (e)
        console.error(e);
      else{
        // OnNewProject(uint indexed Id, address indexed OwnerA, bytes32 NameS, uint TargetWei, uint DeadlineT, address CreatorA, uint WhenT);
        console.log('NewProject: Project '+res.args.Id.toNumber()+' '+web3.toUtf8(res.args.NameS)+', owned by '+res.args.OwnerA+', target '+ WeiToEtherDec2(res.args.TargetWei, "ether")
                   +', deadline '+GmtNixBnDateS(res.args.DeadlineT)+' GMT, created by '+res.args.CreatorA+' @ '+GmtNixBnDateS(res.args.WhenT)+' GMT');
      }
    });
  }else{
    // Watch is running. Stop it and delete the 'static'
    LogNewProjects.event.stopWatching();
    delete LogNewProjects.event;
  }
}

function LogContributions() {
  if (typeof LogContributions.event == 'undefined' ) {
    (LogContributions.event = Instance.OnContribute()).watch(function(e, res) {
      if (e)
        console.error(e);
      else{
      // OnContribute(uint indexed Id, address indexed ContributorA, uint ContributedWei, uint WhenT, NState StateN);
        console.log('Contribution to project '+res.args.Id.toNumber()+' of '+ WeiToEtherDec2(res.args.ContributedWei, "ether")+' from '+res.args.ContributorA
                  + ' @ '+GmtNixBnDateS(res.args.WhenT)+' GMT, with state afterwards: '+StateStr(res.args.StateN.toNumber()));
      }
    });
  }else{
    LogContributions.event.stopWatching();
    delete LogContributions.event;
  }
}

function LogPayouts() {
  if (typeof LogPayouts.event == 'undefined' ) {
    (LogPayouts.event = Instance.OnPayout()).watch(function(e, res) {
      if (e)
        console.error(e);
      else{
      // OnPayout(uint indexed Id, address indexed OwnerA, uint PaidoutWei, uint WhenT, NState StateN);
        console.log('Payout from project '+res.args.Id.toNumber()+' of '+ WeiToEtherDec2(res.args.PaidoutWei, "ether")+' withdrawn by owner '+res.args.OwnerA
                  + ' @ '+GmtNixBnDateS(res.args.WhenT)+' GMT, with state afterwards: '+StateStr(res.args.StateN.toNumber()));
      }
    });
  }else{
    LogPayouts.event.stopWatching();
    delete LogPayouts.event;
  }
}

function LogPullRefunds() {
  if (typeof LogPullRefunds.event == 'undefined' ) {
    (LogPullRefunds.event = Instance.OnPullRefund()).watch(function(e, res) {
      if (e)
        console.error(e);
      else{
      // OnPullRefund(uint indexed Id, address indexed ContributorA, uint RefundWei, uint WhenT, NState StateN);
        console.log('Refund from project '+res.args.Id.toNumber()+' of '+ WeiToEtherDec2(res.args.RefundWei, "ether")+' withdrawn by '+res.args.ContributorA
                  + ' @ '+GmtNixBnDateS(res.args.WhenT)+' GMT, with state afterwards: '+StateStr(res.args.StateN.toNumber()));
      }
    });
  }else{
    LogPullRefunds.event.stopWatching();
    delete LogPullRefunds.event;
  }
}

function LogPushRefunds() {
  if (typeof LogPushRefunds.event == 'undefined' ) {
    (LogPushRefunds.event = Instance.OnPushRefund()).watch(function(e, res) {
      if (e)
        console.error(e);
      else{
      // OnPushRefund(uint indexed Id, address indexed ContributorA, uint RefundWei, uint WhenT, NState StateN, address PushedByA);
        console.log('Refund from project '+res.args.Id.toNumber()+' of '+ WeiToEtherDec2(res.args.RefundWei, "ether")+' pushed to '+res.args.ContributorA+' by '+res.args.PushedByA
                  + ' @ '+GmtNixBnDateS(res.args.WhenT)+' GMT, with state afterwards: '+StateStr(res.args.StateN.toNumber()));
      }
    });
  }else{
    LogPushRefunds.event.stopWatching();
    delete LogPushRefunds.event;
  }
}
