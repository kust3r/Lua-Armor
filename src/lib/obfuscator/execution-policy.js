const VM_SAMPLE_INTERVAL = 4096;
const VM_CHECK_INTERVAL = 262144;
const VM_EXECUTION_BUDGET_SECONDS = 8e-3;
function emitExecutionPolicy(name, environment, check, cooperativeYield, diagnostic = false) {
  return `${name}={};do
local threads=setmetatable({},{__mode='k'});local main={};
${cooperativeYield ? `local owner=coroutine.running() or main;local clock=${diagnostic ? "function() _lpyDiag.clockCalls+=1;return " + environment + ".os.clock() end" : environment + ".os.clock"};local wait=(${environment}.task or {}).wait;` : ""}
${name}.get=function()
 local key=coroutine.running() or main;local state=threads[key];
 if not state then state={remaining=${VM_SAMPLE_INTERVAL},checks=0${cooperativeYield ? ",spent=0,at=clock(),depth=0,authorized=key==owner" : ""}};threads[key]=state end;
 return state
end;
${cooperativeYield ? `${name}.enter=function() local state=${name}.get();if state.depth==0 then state.at=clock() end;state.depth+=1;return state end;
${name}.leave=function(state) state.depth-=1;if state.depth==0 then local now=clock();state.spent+=now-state.at;state.at=now end end;` : ""}
${name}.step=function(state,executed)
 state.checks=state.checks+(executed or ${VM_SAMPLE_INTERVAL});
 if state.checks>=${VM_CHECK_INTERVAL} then state.checks=state.checks%${VM_CHECK_INTERVAL};${check}() end;
${cooperativeYield ? `local now=clock();state.spent=state.spent+now-state.at;state.at=now;
 if state.authorized and wait and state.spent>=${VM_EXECUTION_BUDGET_SECONDS} then ${diagnostic ? "local _yt=clock();_lpyDiag.yields+=1;" : ""}wait();${diagnostic ? "_lpyDiag.yieldSeconds+=clock()-_yt;" : ""}state.at=clock();state.spent=0 end;` : ""}
end;
${cooperativeYield ? `${name}.waitRef=wait;
${name}.pause=function(state) local now=clock();state.spent=state.spent+now-state.at;state.at=now end;
${name}.resume=function(state,yielded) if yielded==true then state.spent=0 end;state.at=clock() end;` : ""}
end;`;
}
export {
  VM_CHECK_INTERVAL,
  VM_EXECUTION_BUDGET_SECONDS,
  VM_SAMPLE_INTERVAL,
  emitExecutionPolicy
};
