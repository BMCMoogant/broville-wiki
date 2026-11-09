import {renderBody,prose,escapeHtml as esc} from './wiki-markup.js';

/** Visual editing for the wiki's supported headings, links, lists and tables. */
export function createVisualEditor({surface,source,onChange,images}){
  let visual=true;
  let savedRange=null;
  document.addEventListener('selectionchange',()=>{const selection=getSelection();if(selection.rangeCount&&surface.contains(selection.anchorNode))savedRange=selection.getRangeAt(0).cloneRange();});
  const inline=node=>[...node.childNodes].map(child=>{
    if(child.nodeType===Node.TEXT_NODE)return child.textContent;
    if(child.nodeType!==Node.ELEMENT_NODE)return '';
    const text=inline(child);
    if(['STRONG','B'].includes(child.tagName))return '**'+text+'**';
    if(child.tagName==='A'){
      const id=child.getAttribute('href')?.match(/^(?:\.\/)?([a-z0-9-]+)\.html$/)?.[1];
      return id?'[['+id+'|'+text+']]':text;
    }
    return child.tagName==='BR'?'\n':text;
  }).join('');
  function blocks(parent){
    return [...parent.childNodes].map(node=>{
      if(node.nodeType===Node.TEXT_NODE)return node.textContent.trim();
      if(node.nodeType!==Node.ELEMENT_NODE)return '';
      if(node.dataset.imageId)return '{{image:'+node.dataset.imageId+'}}';
      if(node.tagName==='SUMMARY')return '';
      if(node.matches('h2,h3'))return (node.tagName==='H2'?'## ':'### ')+inline(node);
      if(node.tagName==='DETAILS')return '## Spoilers\n'+blocks(node.querySelector(':scope > div')??node);
      if(node.matches('ul,ol'))return [...node.children].map(item=>'- '+inline(item)).join('\n');
      if(node.tagName==='TABLE'){
        const rows=[...node.rows].map(row=>'| '+[...row.cells].map(cell=>inline(cell).replace(/\n/g,' ')).join(' | ')+' |');
        if(rows.length)rows.splice(1,0,'| '+[...node.rows[0].cells].map(()=>'---').join(' | ')+' |');
        return rows.join('\n');
      }
      if(node.matches('section,div')&&node.querySelector('h2,h3,p,ul,table,div'))return blocks(node);
      return inline(node);
    }).filter(Boolean).join('\n\n');
  }
  function imageWidget(id){const image=images().find(item=>item.id===id);return '<figure contenteditable="false" data-image-id="'+esc(id)+'">'+(image?'<img src="assets/'+esc(image.file)+'" alt="'+esc(image.alt)+'"><figcaption>'+esc(image.caption||image.file)+'</figcaption>':'Image not found')+'</figure>';}
  function refresh(){savedRange=null;surface.innerHTML=renderBody(source.value).replace(/<p>\{\{image:([a-z0-9-]+)\}\}<\/p>/g,(_,id)=>imageWidget(id));surface.querySelectorAll('details').forEach(item=>item.open=true);}
  function sync(){source.value=blocks(surface);onChange();}
  surface.addEventListener('input',sync);
  surface.addEventListener('click',event=>{
    if(event.target.closest('a'))event.preventDefault();
    const image=event.target.closest('[data-image-id]');
    if(image){const card=[...document.querySelectorAll('.editable-image')].find(item=>item.dataset.imageId===image.dataset.imageId);if(card){card.open=true;card.scrollIntoView({block:'center'});}}
  });
  surface.addEventListener('paste',event=>{
    event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));
  });
  return {
    refresh,
    insertImage(id){
      if(visual){surface.focus();const selection=getSelection();if(savedRange&&surface.contains(savedRange.startContainer)){selection.removeAllRanges();selection.addRange(savedRange);}else{const range=document.createRange();range.selectNodeContents(surface);range.collapse(false);selection.removeAllRanges();selection.addRange(range);}document.execCommand('insertHTML',false,imageWidget(id)+'<p><br></p>');sync();}
      else{source.setRangeText('\n\n{{image:'+id+'}}\n\n',source.selectionStart,source.selectionEnd,'end');source.focus();onChange();}
    },
    get active(){return visual;},
    mode(enabled){visual=enabled;surface.hidden=!enabled;document.getElementById('source-editor').hidden=enabled;if(enabled)refresh();document.getElementById('visual-mode').setAttribute('aria-pressed',String(enabled));document.getElementById('source-mode').setAttribute('aria-pressed',String(!enabled));},
    format(action,target){
      surface.focus();
      if(action==='bold')document.execCommand('bold');
      else if(action==='heading'||action==='subheading')document.execCommand('formatBlock',false,action==='heading'?'h2':'h3');
      else if(action==='list')document.execCommand('insertUnorderedList');
      else if(action==='link')document.execCommand('createLink',false,target+'.html');
      else if(action==='table')document.execCommand('insertHTML',false,prose(['| Column | Column |','| --- | --- |','| Value | Value |'])+'<p><br></p>');
      else if(action==='spoilers')document.execCommand('insertHTML',false,'<h2>Spoilers</h2><p>Spoiler content.</p>');
      sync();
    }
  };
}

