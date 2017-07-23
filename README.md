<h3>B9lab: ETH-8 Certified Online Ethereum Developer Course - January 2017<br>
Exam Project by AutoAbacus (David Hartley) started 2017.05.09, completed 2017.06.05</h3>

<h3>Versions</h3>
<p>Ubuntu 17.4 as guest running under Windows 10 host<br>
Truffle: 3.2.4 with webpack 2.2.1 as installed by truffle init webpack<br>
solc:    0.4.11<br>
web3:    0.18.4<br>
npm:     3.10.10<br>
nodejs: v6.10.3<br>
TestRPC v3.0.3<br>
geth    1.6.5-stable-cf87713d</p>

<h3>Files Uploaded</h3>
<ul>
  <li>all Truffle source and generated files</li>
  <li>extra doc (text and image) files in \doc</li>
</ul>

<h3>Files Not Uploaded</h3>
<ul>
  <li>the thousands of node and webpack files in \node_modules that arrived via truffle init webpack</li>
  <li>the root "." files</li>
</ul>

<h3>Design Decisions Additional to Those of the Exam Specification</h3>
<ul>
  <li>Projects have an Id from 1 upwards and a name of up to 32 characters, in addition to the specified target and deadline date/time.</li>
  <li>Projects can be in of one of 5 States as follows:
  <ul>
     <li><em>Active:</em> The project is active i.e. it is ready for contributions to be made</li>
     <li><em>TargetMet:</em> The project target was met within the deadline time and the target amount is available for withdrawal by the project owner</li>
     <li><em>Funded:</em> The project target was met within the deadline time and the target amount has been withdrawn by the project owner</li>
     <li><em>Refunding:</em> The project had some contribution made but went over time without the target being met and is waiting for refunding to be completed either by contributor withdrawals (pulls) or by FundingHub owner pushes. (If no contributions at all were made to the project on time out it goes straight to a final state of Closed.)</li>
     <li><em>Closed:</em> The project has been fully refunded after timing out, or it timed out with no contributions</li>
  </ul>
  <li>Visitors must 'login' (no password) via their address to be able to do anything.</li>
  <li>Separate panels or buttons are shown/hidden according to the state of the browsed project and the logged in user for:
  <ul>
    <li>Anyone to make a contribution to an active project</li>
    <li>Project owner to withdraw the payout from a successful project</li>
    <li>Contributor to withdraw a refund from a project which failed to make its target in time</li>
    <li>FundingHub Owner to:
    <ul>
      <li>Add a new project</li>
      <li>Push remaining refunds due on a 'Refunding' project</li>
      <li>Start/Stop Event Logging</li>
      <li>Pause/Resume FundingHub</li>
    </ul>
    </li>
  </ul>
  </li>
  <li>Project browsing by type, not just active projects, has been included.</li>
  <li>Browsing to an active project which is now over time causes the project to change state to 'Refunding'.</li>
  <li>Dates of each contribution and refund are kept, as well as when a project hits target and is funded.</li>
  <li>The number of contributions and contributors are counted. (Multiple contributions by the same contributor are aggregated.)</li>
  <li>Projects and contributors are limited to 65,535 in number.</li>
  <li>Payout is a withdraw (pull) operation.</li>
  <li>Refunding of projects which didn't reach target within the deadline is a withdraw (pull) operation, with the option in the case of refund withdrawals stalling for FundingHub owner to push the remaining refunds via a loop through the contributors from the web front end.</li>
  <li>All inputs are checked for validity with appropriate error messages given in the event of a fail.</li>
  <li>Visible buttons are disabled while an operation is in progress.</li>
  <li>All operations involving the contracts are asynchronous.</li>
  <li>A status field shows what is happening.</li>
  <li>An error field appears when an error has happened with more details in the log. If the error appears to be due to an Ethereum account being locked, extra advice is added to the error field.</li>
</ul>

<h3>Testing</h3>
<ul>
  <li>Run locally with TestRPC and lots of logging plus UI visual checks to test the many cases.</li>
  <li>Ditto with geth and 'B9Lab' network, which showed up locked account issues -> extra handling of errors re this</li>
  <li>14 tests via Truffle test with TestRPC</li>
</ul>
