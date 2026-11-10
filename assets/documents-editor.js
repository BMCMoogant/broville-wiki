/** Article-local document editions; the source catalogue remains untouched. */
export function createDocumentsEditor(root,onChange){
  let value={enabled:true,title:'Original documents',introduction:'',documents:[]};
  const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
  const button=(label,action)=>{const e=node('button',label);e.type='button';e.onclick=()=>{action();render();onChange();};return e;};
  function field(parent,label,text,change,multiline=false){const wrap=node('label',label),input=node(multiline?'textarea':'input');if(multiline)input.rows=4;input.value=text;input.oninput=()=>{change(input.value);onChange();};wrap.append(input);parent.append(wrap);}
  function move(items,index,offset){const next=index+offset;if(next>=0&&next<items.length)[items[index],items[next]]=[items[next],items[index]];}
  function render(){
    const open=new Set([...root.querySelectorAll('details[open]')].map(el=>el.dataset.documentId));
    root.replaceChildren(node('h3','Original documents'));
    const label=node('label','Show original documents'),enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=value.enabled;enabled.onchange=()=>{value.enabled=enabled.checked;onChange();};label.prepend(enabled);root.append(label);
    root.append(node('p','Edit the documents shown on this article. Changes are saved with the article; the original source catalogue is preserved.'));
    field(root,'Section title',value.title,v=>value.title=v);field(root,'Introduction',value.introduction,v=>value.introduction=v,true);
    value.documents.forEach((doc,index)=>{
      const card=node('details');card.className='document-edit-card';card.dataset.documentId=doc.id;card.open=open.has(doc.id);card.append(node('summary',doc.title||'Untitled document'));
      card.append(button('Move up',()=>move(value.documents,index,-1)),button('Move down',()=>move(value.documents,index,1)),button('Remove from article',()=>value.documents.splice(index,1)));
      field(card,'Document title',doc.title,v=>doc.title=v);field(card,'Author',doc.author,v=>doc.author=v);
      const kind=node('label','Document type'),picker=document.createElement('select');picker.append(new Option('Book','book'),new Option('Inscription','sign'));picker.value=doc.kind;picker.onchange=()=>{doc.kind=picker.value;onChange();};kind.append(picker);card.append(kind);
      field(card,'Source',doc.source,v=>doc.source=v);field(card,'Recorded locations (one per line)',doc.locations.join('\n'),v=>doc.locations=v.split('\n').map(x=>x.trim()).filter(Boolean),true);
      const warning=node('label','Contains narrative spoilers'),check=document.createElement('input');check.type='checkbox';check.checked=doc.spoiler;check.onchange=()=>{doc.spoiler=check.checked;onChange();};warning.prepend(check);card.append(warning);
      doc.pages.forEach((page,i)=>{const pageArea=node('div');field(pageArea,'Page '+(i+1),page.text,v=>page.text=v,true);pageArea.append(button('Move page up',()=>move(doc.pages,i,-1)),button('Move page down',()=>move(doc.pages,i,1)),button('Remove page',()=>doc.pages.splice(i,1)));card.append(pageArea);});
      card.append(button('Add page',()=>doc.pages.push({number:doc.pages.length+1,text:''})));root.append(card);
    });
    root.append(button('Add document',()=>{if(value.documents.length<200)value.documents.push({id:'custom-'+crypto.randomUUID(),kind:'book',title:'New document',author:'',source:'',spoiler:false,locations:[],pages:[{number:1,text:''}]});}));
  }
  return {load(settings){value=structuredClone(settings??{enabled:true,title:'Original documents',introduction:'',documents:[]});render();},value(){const copy=structuredClone(value);copy.documents.forEach(doc=>doc.pages.forEach((page,i)=>page.number=i+1));return copy;}};
}

