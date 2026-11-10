import {connectEditorLayout} from './editor-layout.js';
import {sections as documentSections} from './wiki-markup.js';
import {createDocumentsEditor} from './documents-editor.js';
import {connectWebsitePublication} from './website-publication.js';
import {connectGitHubWorkspace} from './github-workspace.js';
import {createVisualEditor} from './visual-editor.js';
const $=id=>document.getElementById(id);
const rootUrl=new URL('./',location.href),params=new URLSearchParams(location.search),form=$('article-form');
let session=null,collection={entries:[],revisions:{},metadata:{}},selected=null,working=null,dirty=false,activeView='dashboard',activePanel='text',sectionMode=null,sectionOpened=false,sourceRows=[],relatedIds=[],markers=[],queue=[],users=[],linkedSuggestion=null,previewSequence=0,addressEdited=false;
let setupToken=params.get('setup')??sessionStorage.getItem('broville.setup')??'';
if(params.has('setup')){sessionStorage.setItem('broville.setup',setupToken);params.delete('setup');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);}
const field=name=>form.elements.namedItem(name);
const slugify=text=>text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const say=(id,text)=>{$(id).textContent=text;};
const make=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
const button=(label,action)=>{const node=make('button',label);node.type='button';node.addEventListener('click',action);return node;};
function markDirty(){dirty=true;previewSequence++;const state=document.getElementById('save-state');if(state)state.textContent='Unsaved changes';}
async function api(path,method='GET',payload){
  let response;
  try{response=await fetch(new URL('api/'+path,rootUrl),{method,credentials:'same-origin',headers:{...(payload?{'Content-Type':'application/json'}:{}),...(session?.csrf?{'X-Wiki-CSRF':session.csrf}:{})},body:payload?JSON.stringify(payload):undefined});}catch{throw Error('The wiki server is not available. If you run it locally, open Open Wiki.cmd.');}
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('This is a reading copy. Editing needs the wiki server. Open Open Wiki.cmd on the computer running the wiki.');
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'The request could not be completed.'),{status:response.status});return data;
}
const media=createMediaEditor({root:$('media-editor'),articleRoot:$('article-media-editor'),galleryRoot:$('gallery-media-editor'),request:api,wikiRoot:rootUrl,onChange:()=>{markDirty();if($('visual-body')?.editorView)visualEditor.updateImages();},onRemove:id=>{field('body').value=field('body').value.replaceAll('{{image:'+id+'}}','');visualEditor.refresh();},onInsert:id=>{showPanel('text');visualEditor.insertImage(id);media.showInArticle(id);}});
media.load();
const documentsEditor=createDocumentsEditor($('original-documents-editor'),markDirty);
connectGitHubWorkspace({api,refreshSuggestions});
const websitePublication=connectWebsitePublication({api});
connectEditorLayout();
const visualEditor=createVisualEditor({surface:$('visual-body'),source:field('body'),onChange:markDirty,images:()=>media.value().images,onImageRemoved:id=>media.hide(id)});
$('visual-mode').addEventListener('click',()=>visualEditor.mode(true));
$('source-mode').addEventListener('click',()=>visualEditor.mode(false));
function setBusy(target,busy){for(const control of target.querySelectorAll('button,input,select,textarea'))control.disabled=busy;}
function discard(){return !dirty||confirm('Discard your unsaved changes?');}
function showView(view){
  activeView=view;
  $('workspace-menu').open=false;
  document.querySelector('.workspace-page').classList.toggle('is-editing',view==='article');
  $('workspace-title').textContent=view==='article'?'Edit article':view==='people'?'Manage editors':view==='suggestions'?'Review suggestions':'Editor workspace';
  for(const section of document.querySelectorAll('[data-workspace-view]'))section.hidden=section.dataset.workspaceView!==view;
  for(const control of document.querySelectorAll('[data-view]'))control.setAttribute('aria-current',control.dataset.view===view?'page':'false');
  if(view==='suggestions'){say('github-sync-message','Checking GitHub suggestions…');api('github/sync','POST',{}).then(result=>say('github-sync-message',result.added+' new GitHub suggestions imported.')).catch(error=>say('github-sync-message','Local inbox is available. GitHub sync: '+error.message)).finally(()=>refreshSuggestions().catch(error=>say('suggestion-message',error.message)));}
  if(view==='github')window.dispatchEvent(new Event('github-workspace-open'));
  if(view==='people')loadUsers().catch(error=>say('people-message',error.message));
}
async function showPanel(panel){
  activePanel=panel;
  for(const section of form.querySelectorAll('[data-editing-panel]'))section.hidden=section.dataset.editingPanel!==panel;
  for(const control of form.querySelectorAll('[data-panel]'))control.setAttribute('aria-pressed',String(control.dataset.panel===panel));
  if(panel==='preview')await preview();
  if(panel==='changes')changes();
}
function wholeBody(){return sectionMode?sectionMode.original.slice(0,sectionMode.start)+field('body').value+sectionMode.original.slice(sectionMode.end):field('body').value;}
function collect(status='draft'){const presentation=media.value();for(const image of presentation.images)if(wholeBody().includes('{{image:'+image.id+'}}'))image.placement='article';return {...working,id:field('id').value.trim(),title:field('title').value.trim(),lead:field('lead').value.trim(),body:wholeBody().trim(),category:field('category').value,coordinates:field('coordinates').value.trim(),status,presentation:collectPresentation(),originalDocuments:documentsEditor.value(),sources:structuredClone(sourceRows.filter(source=>source.label.trim()||source.url.trim())),related:[...relatedIds],mapPoints:structuredClone(markers)};}
function updateUrl(id=null){
  const url=new URL(location.href);url.searchParams.delete('section');url.searchParams.delete('panel');
  if(id)url.searchParams.set('page',id);else url.searchParams.delete('page');
  if(linkedSuggestion)url.searchParams.set('suggestion',linkedSuggestion.id);else url.searchParams.delete('suggestion');
  history.replaceState(null,'',url);
}
function openSection(){
  if(sectionOpened||!params.get('section')||selected?.entry.id!==params.get('page'))return;sectionOpened=true;
  const original=field('body').value,headings=documentSections(original).filter(item=>item.level);
  for(let index=0;index<headings.length;index++){
    const section=headings[index];if(section.id!==params.get('section'))continue;
    const next=headings.slice(index+1).find(item=>item.level<=section.level);sectionMode={original,start:section.start,end:next?.start??original.length};field('body').value=original.slice(sectionMode.start,sectionMode.end);
    const notice=$('section-notice');notice.hidden=false;notice.replaceChildren(make('span','Editing section: '+section.title+' '),button('Edit the whole article',()=>{field('body').value=wholeBody();sectionMode=null;notice.hidden=true;visualEditor.refresh();}));return;
  }
}
function loadArticle(id,{snapshot=null,newFromSuggestion=false}={}){
  selected=collection.entries.find(record=>record.entry.id===id)??null;
  working=structuredClone(snapshot??selected?.entry??{id:'',title:'',lead:'',body:'',category:'Concepts',coordinates:'',status:'draft',sources:[],related:[],mapPoints:[]});
  if(newFromSuggestion&&linkedSuggestion){working.title=linkedSuggestion.subject;working.id=slugify(working.title);working.body=linkedSuggestion.proposedText||'';}
  sectionMode=null;$('section-notice').hidden=true;
  for(const key of ['id','title','lead','body','category','coordinates'])field(key).value=working[key]??'';field('id').readOnly=Boolean(selected);field('summary').value='';addressEdited=Boolean(selected);
  sourceRows=structuredClone(working.sources);relatedIds=[...working.related];markers=structuredClone(working.mapPoints);media.load(working.presentation);documentsEditor.load(working.originalDocuments);renderSources();renderRelated();renderMarkers();renderRevisions();
  $('delete-article').hidden=!selected||session?.user.role!=='admin';
  form.hidden=false;$('choose-article-message').hidden=true;$('editing-title').textContent=selected?'Editing '+working.title:'New article';$('return-to-article').hidden=!selected?.published;if(selected?.published)$('return-to-article').href=working.id+'.html';
  dirty=Boolean(snapshot||newFromSuggestion);if($('save-state'))$('save-state').textContent=dirty?'Unsaved changes':'Saved';say('article-message',snapshot?'Earlier version loaded. Preview the changes before publishing.':'');
  openSection();visualEditor.refresh();showView('article');showPanel(params.get('panel')==='media'?'media':'text');renderLinkedSuggestion();updateUrl(selected?.entry.id??null);
}
function renderChooser(){
  const query=$('article-search').value.toLowerCase().trim(),list=$('article-chooser');list.replaceChildren();
  const matches=collection.entries.filter(({entry})=>(entry.title+' '+entry.id+' '+entry.category).toLowerCase().includes(query));
  for(const {entry,draft} of matches.slice(0,query?209:18)){const item=make('li');item.append(button(entry.title,()=>{if(discard()){linkedSuggestion=null;loadArticle(entry.id);}}),make('small',entry.category+(draft?' · Draft saved':'')));list.append(item);}
  if(!matches.length)list.append(make('li','No matching articles. Try a different name.'));
  else if(!query&&matches.length>18)list.append(make('li','Type a name to find more articles.','caption'));
}
function textControl(label,value,changed,{url=false}={}){
  const wrapper=make('label',label),input=document.createElement('input');input.type=url?'url':'text';input.value=value;input.addEventListener('input',()=>{changed(input.value);markDirty();});wrapper.append(input);return wrapper;
}
function renderSources(){
  const area=$('sources-editor');area.replaceChildren();
  sourceRows.forEach((source,index)=>{const row=make('div','','source-edit-row');row.append(textControl('Reference name',source.label,value=>source.label=value),textControl('Link (optional)',source.url,value=>source.url=value,{url:true}),textControl('Source type',source.kind,value=>source.kind=value),button('Remove source',()=>{sourceRows.splice(index,1);renderSources();markDirty();}));area.append(row);});
  if(!sourceRows.length)area.append(make('p','No sources added yet.','caption'));
}
function renderRelated(){
  const list=$('related-list'),picker=$('related-add');list.replaceChildren();picker.replaceChildren(new Option('Choose an article',''));
  for(const {entry} of collection.entries)if(entry.id!==working?.id&&!relatedIds.includes(entry.id))picker.add(new Option(entry.title,entry.id));
  for(const id of relatedIds){const entry=collection.entries.find(record=>record.entry.id===id)?.entry;const item=make('li');item.append(make('span',entry?.title??id),button('Remove',()=>{relatedIds=relatedIds.filter(value=>value!==id);renderRelated();markDirty();}));list.append(item);}
}
function renderMarkers(){
  const area=$('markers-editor');area.replaceChildren();
  markers.forEach((point,index)=>{const row=make('div','','marker-edit-row'),label=make('label','Map'),select=document.createElement('select');for(const [id,name] of [['roads','Roads'],['districts','Districts'],['metro','Metro'],['rail','Regional railway'],['isometric','Isometric']])select.add(new Option(name,id));select.value=point.map;select.addEventListener('change',()=>{point.map=select.value;markDirty();});label.append(select);row.append(label);
    for(const key of ['x','y']){const wrapper=make('label',key.toUpperCase()+' (%)'),input=document.createElement('input');input.type='number';input.min='0';input.max='100';input.step='0.1';input.value=point[key]??'';input.addEventListener('input',()=>{point[key]=input.value===''?null:Number(input.value);markDirty();});wrapper.append(input);row.append(wrapper);}row.append(button('Remove marker',()=>{markers.splice(index,1);renderMarkers();markDirty();}));area.append(row);});
}
function renderRevisions(){
  const list=$('revision-list');list.replaceChildren();const records=selected?collection.revisions[selected.entry.id]??[]:[];
  for(const record of records){const item=make('li');item.append(make('p',(record.at?new Date(record.at).toLocaleString('en'):'Initial edition')+' · '+(record.author||'Author not recorded')+(record.summary?' · '+record.summary:'')),button('Restore into editor',()=>{if(discard())loadArticle(selected.entry.id,{snapshot:record.entry});}));list.append(item);}
  if(!records.length)list.append(make('li','There are no earlier published versions yet.'));
}
async function preview(){
  const version=++previewSequence;say('preview-message','Preparing preview…');
  try{const result=await api('preview','POST',{entry:collect()});if(version!==previewSequence)return;$('preview-content').innerHTML=result.html;say('preview-message','Preview only — publish to apply these changes.');}catch(error){say('preview-message',error.message);}
}
function changes(){
  const before=selected?.publishedEntry??selected?.entry??{title:'',lead:'',body:''},next=collect(),area=$('changes-content');area.replaceChildren();let count=0;
  for(const [key,label] of [['title','Title'],['lead','Introduction'],['body','Article text']])if(before[key]!==next[key]){count++;const section=make('section'),heading=make('h3',label),columns=make('div','','diff-columns');for(const [title,value,kind] of [['Published',before[key]??'','removed'],['Your edit',next[key],'added']]){const column=make('div'),pre=make('pre',value,kind);column.append(make('h4',title),pre);columns.append(column);}section.append(heading,columns);area.append(section);}
  if(JSON.stringify(before.originalDocuments)!==JSON.stringify(next.originalDocuments))area.append(make('p','Original document editions or visibility have changed.'));
  if(JSON.stringify(before.presentation)!==JSON.stringify(next.presentation)){count++;area.append(make('p','Images, gallery or infobox settings have changed. Use Preview to inspect the result.'));}
  if(JSON.stringify([before.sources,before.related,before.mapPoints,before.coordinates,before.category])!==JSON.stringify([next.sources,next.related,next.mapPoints,next.coordinates,next.category])){count++;area.append(make('p','Sources, related articles or location settings have changed.'));}
  if(!count)area.append(make('p','No changes since the published version.'));
}
async function openWorkspace(){
  collection=await api('entries');$('setup-section').hidden=true;$('setup-needed').hidden=true;$('sign-in-section').hidden=true;$('workspace').hidden=false;$('workspace-title').textContent='Your workspace';$('current-user').textContent=session.user.name+' · '+(session.user.role==='admin'?'Administrator':'Editor');document.querySelector('.account-link').textContent='Workspace';
  for(const control of document.querySelectorAll('[data-admin]'))control.hidden=session.user.role!=='admin';
  await websitePublication.load(session.user.role==='admin');
  renderChooser();await media.library();
  if(session.user.role==='admin'){await refreshSuggestions();checkInbox();}
  const suggestion=params.get('suggestion');if(suggestion&&session.user.role==='admin')linkedSuggestion=queue.find(record=>record.id===suggestion&&record.status==='accepted')??null;
  const id=params.get('page');
  if(id&&collection.entries.some(record=>record.entry.id===id))loadArticle(id);
  else if(linkedSuggestion)loadArticle('',{newFromSuggestion:true});
  else showView('dashboard');
  if(params.get('tab')==='history'&&selected)showPanel('history');
  say('workspace-message','');
}
function showSignIn(message='Sign in with an account added by an administrator.'){$('workspace').hidden=true;$('setup-section').hidden=true;$('setup-needed').hidden=true;$('sign-in-section').hidden=false;say('workspace-message',message);$('workspace-title').textContent='Editor workspace';}
$('setup-form').addEventListener('submit',async event=>{
  event.preventDefault();const target=event.currentTarget,values=Object.fromEntries(new FormData(target));
  if(values.password!==values.confirmation){say('workspace-message','The passwords do not match. Please enter them again.');return;}
  setBusy(target,true);
  try{session=(await api('setup','POST',{token:setupToken,name:values.name.trim(),username:values.username.trim().toLowerCase(),password:values.password})).session;target.reset();setupToken='';sessionStorage.removeItem('broville.setup');await openWorkspace();say('workspace-message','Your administrator account is ready. You are signed in.');}catch(error){say('workspace-message',error.message);}finally{setBusy(target,false);}
});
$('sign-in-form').addEventListener('submit',async event=>{
  event.preventDefault();const target=event.currentTarget,values=Object.fromEntries(new FormData(target));setBusy(target,true);
  try{session=(await api('login','POST',{username:values.username,password:values.password,remember:target.elements.remember.checked})).session;target.reset();await openWorkspace();}catch(error){say('workspace-message',error.message);}finally{setBusy(target,false);}
});
$('sign-out').addEventListener('click',async()=>{if(!discard())return;try{await api('logout','POST',{});session=null;dirty=false;document.querySelector('.account-link').textContent='Sign in';showSignIn('You are signed out.');}catch(error){say('workspace-message',error.message);}});
for(const control of document.querySelectorAll('[data-view]'))control.addEventListener('click',()=>showView(control.dataset.view));
for(const control of document.querySelectorAll('[data-panel]'))control.addEventListener('click',()=>showPanel(control.dataset.panel));
$('article-search').addEventListener('input',renderChooser);
$('new-article').addEventListener('click',()=>{if(discard()){linkedSuggestion=null;loadArticle('');}});
$('add-source').addEventListener('click',()=>{sourceRows.push({label:'',url:'',kind:'World record'});renderSources();markDirty();});
$('add-related').addEventListener('click',()=>{const id=$('related-add').value;if(id&&!relatedIds.includes(id)){relatedIds.push(id);renderRelated();markDirty();}});
$('add-marker').addEventListener('click',()=>{if(markers.length<5){markers.push({map:'roads',x:null,y:null});renderMarkers();markDirty();}});
field('title').addEventListener('input',()=>{if(!selected&&!addressEdited)field('id').value=slugify(field('title').value).slice(0,100);});field('id').addEventListener('input',()=>addressEdited=true);
form.addEventListener('input',markDirty);
form.addEventListener('invalid',event=>{const panel=event.target.closest('[data-editing-panel]');if(panel)showPanel(panel.dataset.editingPanel);event.target.closest('details')?.setAttribute('open','');},true);
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
form.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();form.requestSubmit(form.querySelector('[data-status=draft]'));}});
$('preview-button').addEventListener('click',()=>showPanel('preview'));
form.addEventListener('submit',async event=>{
  event.preventDefault();const entry=collect(event.submitter?.dataset.status??'draft'),summary=field('summary').value;setBusy(form,true);say('article-message',entry.status==='published'?'Publishing…':'Saving draft…');
  try{collection=await api('entries','POST',{entry,summary:summary||(linkedSuggestion?'Applied suggestion: '+linkedSuggestion.subject:''),suggestionId:entry.status==='published'?linkedSuggestion?.id:undefined,base:selected?.base??null,draftVersion:selected?.draftVersion??null});if(entry.status==='published'&&linkedSuggestion){linkedSuggestion=null;await refreshSuggestions();}const panel=activePanel;loadArticle(entry.id);renderChooser();showPanel(panel);say('article-message',entry.status==='published'?'Saved on this computer. The article, search and links are up to date.':'Draft saved. The published article is unchanged.');if(entry.status==='published')websitePublication.publish();}
  catch(error){say('article-message',error.message);}finally{setBusy(form,false);}
});
for(const control of document.querySelectorAll('[data-markup]'))control.addEventListener('mousedown',event=>{if(visualEditor.active)event.preventDefault();});
for(const control of document.querySelectorAll('[data-markup]'))control.addEventListener('click',()=>{
  if(visualEditor.active){
    let target=null;
    if(control.dataset.markup==='link'){target=prompt('Article address or HTTPS link:','solar');if(!target)return;if(!/^https?:\/\//.test(target)&&!collection.entries.some(record=>record.entry.id===target)){say('article-message','That article was not found.');return;}}
    visualEditor.format(control.dataset.markup,target);control.closest('.insert-menu')?.removeAttribute('open');return;
  }
  const textarea=field('body'),selectedText=textarea.value.slice(textarea.selectionStart,textarea.selectionEnd),action=control.dataset.markup;
  const values={bold:'**'+(selectedText||'text')+'**',italic:'*'+(selectedText||'text')+'*',quote:'\n> '+(selectedText||'Quoted text').replace(/\n/g,'\n> ')+'\n',code:'\n```\n'+(selectedText||'Code or copyable text')+'\n```\n',inlinecode:'`'+(selectedText||'code')+'`',orderedlist:'\n1. '+(selectedText||'Item')+'\n',rule:'\n---\n',strike:'~~'+(selectedText||'text')+'~~',heading:'\n## '+(selectedText||'New section')+'\n',subheading:'\n### '+(selectedText||'New subsection')+'\n',list:'\n- '+(selectedText||'Item')+'\n',table:'\n| Column | Column |\n| --- | --- |\n| Value | Value |\n',spoilers:'\n:::spoiler Reveal spoiler\n'+(selectedText||'Spoiler content.')+'\n:::\n'};
  if(action==='link'){const id=prompt('Article address (for example, solar):','solar');if(!id)return;const target=collection.entries.find(record=>record.entry.id===id)?.entry;if(/^https?:\/\//.test(id)){values.link='['+(selectedText||id)+']('+id+')';}else if(!target){say('article-message','That article was not found.');return;}else values.link='[['+id+'|'+(selectedText||target.title)+']]';}
  if(!values[action]){say('article-message','This command is available in the Visual editor.');return;}textarea.setRangeText(values[action],textarea.selectionStart,textarea.selectionEnd,'select');textarea.focus();markDirty();
});
async function refreshSuggestions(){queue=(await api('suggestions')).suggestions;updateInboxBadge();$('suggestion-count').textContent='('+queue.filter(record=>['pending','accepted'].includes(record.status)).length+')';if(activeView==='suggestions')renderSuggestions();}
function renderSuggestions(){
  const area=$('suggestion-inbox'),filter=$('suggestion-filter').value;area.replaceChildren();
  const records=queue.filter(record=>filter==='all'||record.status===filter);
  for(const record of records.slice(0,100)){
    const item=make('article','','suggestion-row');item.append(make('h3',record.subject),make('p',record.status.toUpperCase()+' · '+record.name+' · '+new Date(record.submittedAt).toLocaleString('en'),'caption'),make('p',record.explanation));
    if(record.pageId){const title=collection.entries.find(item=>item.entry.id===record.pageId)?.entry.title??record.pageId;const link=make('a',title);link.href=record.pageId+'.html';item.append(link);}
    if(record.evidence)item.append(make('h4','Evidence'),make('p',record.evidence));
    if(record.proposedText){const details=document.createElement('details');details.append(make('summary','Suggested wording'),make('pre',record.proposedText));item.append(details);}
    const controls=make('div','','review-actions');
    if(record.status==='pending')controls.append(button(record.pageId?'Accept and edit article':'Accept and create article',async()=>{try{queue=(await api('suggestions/review','POST',{id:record.id,action:'accept'})).suggestions;await refreshSuggestions();openSuggestion(record.id);}catch(error){say('suggestion-message',error.message);}}),button('Decline',async()=>{const note=prompt('Optional review note:','');if(note===null)return;try{queue=(await api('suggestions/review','POST',{id:record.id,action:'decline',note})).suggestions;await refreshSuggestions();}catch(error){say('suggestion-message',error.message);}}));
    if(record.status==='accepted')controls.append(button('Open in editor',()=>openSuggestion(record.id)),button('Return to pending',async()=>{try{await api('suggestions/review','POST',{id:record.id,action:'reopen'});await refreshSuggestions();}catch(error){say('suggestion-message',error.message);}}));
    if(record.status==='applied'){const link=make('a','Read the updated article');link.href=record.resolution.articleId+'.html';controls.append(link);}
    if(record.github){const link=make('a','GitHub Issue #'+record.github.number);link.href=record.github.url;link.target='_blank';link.rel='noopener noreferrer';controls.append(link);if(['applied','declined'].includes(record.status))controls.append(button('Close GitHub Issue',async()=>{try{await api('github/close','POST',{id:record.id});say('suggestion-message','GitHub Issue closed.');}catch(error){say('suggestion-message',error.message);}}));}
    item.append(controls);area.append(item);
  }
  if(!records.length)area.append(make('p','There are no suggestions in this category.'));
}
function openSuggestion(id){if(!discard())return;linkedSuggestion=queue.find(record=>record.id===id&&record.status==='accepted')??null;if(!linkedSuggestion)return;loadArticle(linkedSuggestion.pageId??'',{newFromSuggestion:!linkedSuggestion.pageId});}
function renderLinkedSuggestion(){
  const area=$('linked-suggestion');area.replaceChildren();area.hidden=!linkedSuggestion;$('publish-button').textContent=linkedSuggestion?'Publish and resolve suggestion':'Publish';
  if(!linkedSuggestion)return;
  area.append(make('h3','Accepted suggestion: '+linkedSuggestion.subject),make('p',linkedSuggestion.explanation));if(linkedSuggestion.evidence)area.append(make('p','Evidence: '+linkedSuggestion.evidence));
  if(linkedSuggestion.proposedText){area.append(make('pre',linkedSuggestion.proposedText),button('Insert suggested wording at the cursor',()=>{showPanel('text');const textarea=field('body'),text=textarea.selectionStart===textarea.selectionEnd?'\n\n'+linkedSuggestion.proposedText+'\n\n':linkedSuggestion.proposedText;textarea.setRangeText(text,textarea.selectionStart,textarea.selectionEnd,'end');visualEditor.refresh();markDirty();}));}
  area.append(make('p','Review the change and its sources. The suggestion is marked as applied when you publish this article.','caption'),button('Continue without resolving this suggestion',()=>{linkedSuggestion=null;renderLinkedSuggestion();updateUrl(selected?.entry.id);}));
}
$('suggestion-filter').addEventListener('change',renderSuggestions);
async function loadUsers(){
  users=(await api('users')).users;const list=$('user-list');list.replaceChildren();
  for(const user of users){const item=make('li');item.append(make('span',user.name+' · '+user.username+' · '+(user.role==='admin'?'Administrator':'Editor')+' · '+(user.enabled?'Active':'Disabled')),button('Edit account',()=>userForm(user)));list.append(item);}
}
function userForm(user=null){
  const target=$('user-form');target.reset();target.hidden=false;$('user-form-title').textContent=user?'Edit account':'Add editor';
  for(const key of ['name','username','role'])target.elements[key].value=user?.[key]??(key==='role'?'editor':'');target.elements.username.readOnly=Boolean(user);target.elements.enabled.checked=user?.enabled??true;target.elements.password.required=!user;target.scrollIntoView({block:'nearest'});
}
$('new-user').addEventListener('click',()=>userForm());$('cancel-user').addEventListener('click',()=>$('user-form').hidden=true);
$('user-form').addEventListener('submit',async event=>{event.preventDefault();const target=event.currentTarget,values=Object.fromEntries(new FormData(target));values.username=values.username.trim().toLowerCase();values.enabled=target.elements.enabled.checked;setBusy(target,true);try{await api('users','POST',values);target.reset();target.hidden=true;say('people-message','Account saved.');if(values.username===session.user.username){session=null;showSignIn('Your account was updated. Sign in again.');}else await loadUsers();}catch(error){say('people-message',error.message);}finally{setBusy(target,false);}});
async function publicHistory(id){
  $('public-history').hidden=false;const list=$('public-history-list');list.replaceChildren();
  try{const history=await api('history?id='+encodeURIComponent(id));for(const [index,record] of [history.current,...history.revisions].entries())list.append(make('li',(index===0?'Current · ':'')+(record.at?new Date(record.at).toLocaleString('en'):'Initial edition')+' · '+(record.author||'Author not recorded')+(record.summary?' · '+record.summary:'')));}catch(error){list.append(make('li',error.message));}
}
if(params.get('tab')==='history'&&params.get('page'))publicHistory(params.get('page'));
if(location.protocol!=='file:')api('status').then(async status=>{
  if(status.editorEngine!=='structured-markdown-v2'){say('workspace-message','The editor has been upgraded. Close the wiki server window, reopen Open Wiki.cmd, then reload this page. Your saved articles are preserved.');$('workspace-title').textContent='Restart the wiki server';return;}
  if(status.setupRequired){if(setupToken){$('workspace-title').textContent='Create your administrator account';$('setup-section').hidden=false;say('workspace-message','First-time setup · choose your account details below.');}else{$('setup-needed').hidden=false;say('workspace-message','This wiki needs its first administrator account.');}return;}
  setupToken='';sessionStorage.removeItem('broville.setup');session=(await api('session')).session;if(session)await openWorkspace();else showSignIn();
}).catch(error=>say('workspace-message',error.message));

let inboxChecking=false,lastInboxCheck=0;
function updateInboxBadge(){
 const pending=queue.filter(item=>item.status==='pending').length,accepted=queue.filter(item=>item.status==='accepted').length,total=pending+accepted;
 $('inbox-total').textContent=String(total);$('inbox-alert').classList.toggle('has-suggestions',total>0);
 $('inbox-summary').textContent=total?pending+' pending suggestions · '+accepted+' accepted and ready to edit.':'No suggestions waiting for review.';
 document.title=(total?'('+total+') ':'')+'Editor workspace · Broville Wiki';
}
async function checkInbox(){
 if(!session||session.user.role!=='admin'||inboxChecking||Date.now()-lastInboxCheck<60000)return;
 inboxChecking=true;lastInboxCheck=Date.now();
 try{await api('github/sync','POST',{});await refreshSuggestions();$('inbox-check-status').textContent='Last checked '+new Date().toLocaleTimeString('en')+'. Checks automatically every minute while this editor is visible.';}
 catch(error){$('inbox-check-status').textContent='GitHub check unavailable: '+error.message+' Your local inbox remains available.';}
 finally{inboxChecking=false;}
}
setInterval(()=>{if(!document.hidden)checkInbox();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkInbox();});
window.addEventListener('focus',checkInbox);

function collectPresentation(){const next=media.value();for(const image of next.images)if(image.placement==='article'&&working.body.includes('{{image:'+image.id+'}}')&&!wholeBody().includes('{{image:'+image.id+'}}'))image.placement='hidden';return next;}

$('delete-article').addEventListener('click',async()=>{
 if(!selected||session?.user.role!=='admin')return;
 if(!confirm('Delete “'+selected.entry.title+'” permanently? Its page, draft and revision history will be removed. Links from other articles will become plain text.'+(dirty?' Unsaved changes will also be discarded.':'')))return;
 const button=$('delete-article');button.disabled=true;
 try{
   collection=await api('entries/delete','POST',{id:selected.entry.id,base:selected.base??null,draftVersion:selected.draftVersion??null});
   dirty=false;selected=null;working=null;linkedSuggestion=null;sectionMode=null;form.hidden=true;button.hidden=true;
   $('choose-article-message').hidden=false;updateUrl(null);renderChooser();showView('dashboard');
   say('workspace-message','Article deleted. References in other articles were kept as plain text.');websitePublication.publish();
 }catch(error){say('article-message',error.message);}finally{button.disabled=false;}
});
