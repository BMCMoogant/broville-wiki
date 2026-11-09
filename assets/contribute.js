const form=document.getElementById('contribution-form'),status=document.getElementById('contribution-status');
const pageId=new URLSearchParams(location.search).get('page');if(pageId&&[...form.elements.pageId.options].some(option=>option.value===pageId))form.elements.pageId.value=pageId;
if(window.BROVILLE_PUBLICATION){status.textContent='Prepare a public suggestion, then confirm it on GitHub. A GitHub account is required. Do not include private information.';form.querySelector('button').textContent='Prepare GitHub suggestion';}
if(!window.BROVILLE_PUBLICATION&&location.protocol==='file:')status.textContent='Sending suggestions needs the wiki server. If you run this wiki locally, open Open Wiki.cmd. You can still read the wiki offline.';
form.addEventListener('submit',async event=>{
  event.preventDefault();const values=Object.fromEntries(new FormData(form));values.pageId=values.pageId||null;
  if(window.BROVILLE_PUBLICATION){
    const settings=window.BROVILLE_PUBLICATION;
    if(!/^[a-z0-9-]+\/[a-z0-9_.-]+$/i.test(settings.repository)){status.textContent='The suggestion repository is not configured.';return;}
    const body='<!-- broville-suggestion:v1 -->\n\n### Article\n'+(values.pageId||'General / new article')+'\n\n### Type\n'+values.type+'\n\n### What should change?\n'+values.explanation+'\n\n### Evidence\n'+(values.evidence||'Not supplied')+'\n\n### Suggested wording\n'+(values.proposedText||'')+'\n';
    let prepared=document.getElementById('prepared-issue');if(!prepared){prepared=document.createElement('section');prepared.id='prepared-issue';form.after(prepared);}prepared.replaceChildren();
    const heading=document.createElement('h2');heading.textContent='Review and send on GitHub';
    const text=document.createElement('textarea');text.value=body;text.readOnly=true;text.rows=9;text.style.width='100%';text.setAttribute('aria-label','Prepared suggestion');
    const copy=document.createElement('button');copy.type='button';copy.textContent='Copy full suggestion';copy.onclick=async()=>{try{await navigator.clipboard.writeText(body);copy.textContent='Copied';}catch{text.focus();text.select();copy.textContent='Selected — copy this text';}};
    const url=new URL('https://github.com/'+settings.repository+'/issues/new');url.searchParams.set('title',values.subject);url.searchParams.set('body',body);
    const note=document.createElement('p');if(url.href.length>7000){url.searchParams.delete('body');note.textContent='This suggestion is long. Copy the full text above and paste it into the GitHub Issue.';}else note.textContent='Your suggestion is prepared, not sent. On GitHub, review it and choose Submit new issue.';
    const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Continue on GitHub';prepared.append(heading,note,text,copy,document.createTextNode(' '),link);prepared.scrollIntoView({block:'start'});status.textContent='Ready for your confirmation on GitHub.';return;
  }
  const button=form.querySelector('button');button.disabled=true;status.textContent='Sending your suggestion…';
  try{const response=await fetch(new URL('api/suggestions',location.href),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});if(!response.headers.get('content-type')?.includes('application/json'))throw Error('This reading copy cannot receive suggestions. Open the wiki through its server.');const data=await response.json();if(!response.ok)throw Error(data.error);form.hidden=true;status.hidden=true;document.getElementById('contribution-success').hidden=false;document.getElementById('contribution-reference').textContent='Your reference: '+data.id;}
  catch(error){status.textContent=location.protocol==='file:'?'Open Open Wiki.cmd to send suggestions, then try again.':error.message;}finally{button.disabled=false;}
});
