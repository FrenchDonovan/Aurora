/** Executable acceptance workflow for the documented cua Tab API.
 * Import in cua_repl and pass its actual tab and browser. No hidden app state,
 * injected scripts, external browser driver, or DOM mutations are used.
 */
export async function acceptAurora(tab,browser){
  const p=tab.playwright,results=[];
  const check=(ok,label)=>{if(!ok)throw Error(`Acceptance failed: ${label}`);results.push(label);};
  const observe=()=>tab.getAXState({emit:false});
  const id=id=>p.locator(`#${id}`);
  await id('study-content').waitFor({state:'visible'});await observe();
  check((await id('study-verdict').innerText()).includes('No improvement is claimed'),'Negative result visible');
  await id('study-method').selectOption('learned');await id('study-run').click();await observe();
  check((await id('study-run-summary').innerText()).includes('Experimental logistic'),'Actual learned replay');
  await id('study-example').selectOption('');await observe();
  check(!await id('study-remove-references').isEnabled()&&!await id('study-control').isEnabled(),'Changed example clears stale reference actions');
  await id('study-question').fill('Which domain are the conversations in?');await id('study-run').click();await observe();
  check(await id('study-remove-references').isEnabled(),'Successful matching replay restores reference actions');
  const original=await id('study-paragraphs').innerText();
  await id('study-remove-references').click();await observe();
  check(!(await id('study-removed').innerText()).startsWith('0 paragraphs'),'Reference intervention applied');
  await id('study-restore').click();await observe();
  check(await id('study-paragraphs').innerText()===original,'Restore reproduces original paragraphs');
  await id('study-control').click();await observe();
  check(!(await id('study-removed').innerText()).startsWith('0 paragraphs'),'Matched control applied');
  await id('study-restore').click();
  const studyDownload=p.waitForEvent('download');await id('study-export').click();
  check(!!await(await studyDownload).path(),'Study receipt actually downloaded');await observe();
  await p.getByRole('button',{name:'01 Evidence lab',exact:true}).click();await observe();
  await id('question').fill('How does quantization affect memory and accuracy?');await id('ask-button').click();await observe();
  check(await id('result').isVisible(),'Custom investigation submits');
  await id('question').fill('A changed question');await observe();
  check((await id('app-status').innerText()).includes('edited'),'Editing preserves and labels previous result');
  const inspect=p.getByRole('button',{name:/Open source 1:/});await inspect.click();await observe();
  check(await id('source-dialog').isVisible(),'Provenance modal opens');
  await id('close-dialog').click();await observe();
  check(await id('source-dialog').evaluate(el=>!el.open),'Provenance modal closes');
  check(await inspect.evaluate(el=>el===document.activeElement),'Focus restored to provenance trigger');
  await p.getByRole('button',{name:/^Exclude .* and rerun the same question$/}).first().click();await observe();
  check(await id('exclusions').isVisible(),'Paper exclusion reruns');
  await id('reset-exclusions').click();await observe();
  check(!await id('exclusions').isVisible(),'Paper restoration reruns');
  const receiptDownload=p.waitForEvent('download');await id('export-json').click();
  check(!!await(await receiptDownload).path(),'Investigation receipt actually downloaded');
  await id('reset-investigation').click();await observe();check(!await id('result').isVisible(),'Reset clears result');
  await p.getByRole('button',{name:'02 RL arena',exact:true}).click();await observe();
  check(await id('view-rl').isVisible(),'RL navigation');
  await id('rl-episodes').selectOption('8000');
  await id('rl-train').click();await id('rl-cancel').click();await observe();
  check((await id('rl-status').innerText()).includes('cancelled'),'RL cancellation discards partial policy');
  check(!await id('rl-export').isEnabled(),'Cancelled RL export unavailable');
  await id('rl-episodes').selectOption('500');await id('rl-train').click();
  await id('rl-cancel').waitFor({state:'hidden'});await observe();
  check((await id('rl-status').innerText()).includes('Training complete'),'RL training completes');
  const rlDownload=p.waitForEvent('download');await id('rl-export').click();
  check(!!await(await rlDownload).path(),'RL receipt actually downloaded');await observe();
  await id('rl-seed').fill('42');await observe();
  check(!await id('rl-export').isEnabled(),'RL settings invalidate completed receipt');
  await p.getByText('Exclude sources before training',{exact:true}).click();await observe();
  const sources=await p.locator('[name="rl-exclude"]').all();for(const source of sources)await source.check();
  await id('rl-train').click();await id('rl-cancel').waitFor({state:'hidden'});await observe();
  check((await id('rl-candidate-list').textContent()).includes('STOP is the only action'),'All-excluded RL environment stops');
  for(const source of sources)await source.uncheck();await id('rl-seed').fill('17');
  await p.getByRole('button',{name:'00 Study',exact:true}).click();await observe();
  await tab.back();await observe();check(await id('view-rl').isVisible(),'Back restores previous route');
  await tab.forward();await observe();check(await id('view-study').isVisible(),'Forward restores route');
  const viewport=await browser.capabilities.get('viewport');
  try{
    for(const size of [{width:390,height:844},{width:1280,height:720},{width:640,height:360}]){
      await viewport.set(size);await observe();
      check(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`No page overflow at ${size.width}x${size.height}`);
      check(await id('study-run').isVisible(),`Primary study action reachable at ${size.width}`);
    }
  }finally{await viewport.reset();}
  return {workflow:'Aurora public-UI acceptance v1',passed:results.length,checks:results};
}
