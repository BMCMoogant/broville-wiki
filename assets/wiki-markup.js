export const escapeHtml=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const slugify=value=>value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const link=(id,label)=>'<a href="'+escapeHtml(id)+'.html">'+escapeHtml(label)+'</a>';
export const internalLinks=text=>[...text.matchAll(/\[\[([a-z0-9-]+)\|[^\]]+\]\]/g)].map(match=>match[1]);
export function inline(text){return text.split(/(\[\[[a-z0-9-]+\|[^\]]+\]\]|\*\*[^*]+\*\*)/g).map(part=>{const match=part.match(/^\[\[([a-z0-9-]+)\|([^\]]+)\]\]$/);return match?link(match[1],match[2]):part.startsWith('**')&&part.endsWith('**')?'<strong>'+escapeHtml(part.slice(2,-2))+'</strong>':escapeHtml(part);}).join('');}
export function sections(body){
  const blocks=[];let parent='',spoiler=false;
  for(const line of body.split(/\r?\n/).map(line=>line.trim()).filter(Boolean)){
    const match=/^(##|###) (.+)$/.exec(line);
    if(match){const level=match[1].length;if(level===2){parent=slugify(match[2]);spoiler=parent==='spoilers';}blocks.push({title:match[2],id:level===2?parent:parent+'-'+slugify(match[2]),level,spoiler,lines:[]});}
    else{if(!blocks.length)blocks.push({title:'',id:'',level:0,spoiler:false,lines:[]});blocks.at(-1).lines.push(line);}
  }
  return blocks;
}
export function prose(lines){
  let html='',list=false;
  const cells=line=>line.replace(/^\||\|$/g,'').split(/\|(?![^\[]*\]\])/).map(cell=>cell.trim());
  for(let index=0;index<lines.length;index++){
    const line=lines[index];
    if(line.startsWith('|')&&lines[index+1]?.match(/^\|?[\s:|\-]+$/)){
      if(list){html+='</ul>';list=false;}const headings=cells(line);index++;
      html+='<div class="table-wrap"><table><thead><tr>'+headings.map(cell=>'<th scope="col">'+inline(cell)+'</th>').join('')+'</tr></thead><tbody>';
      while(lines[index+1]?.startsWith('|'))html+='<tr>'+cells(lines[++index]).map(cell=>'<td>'+inline(cell)+'</td>').join('')+'</tr>';
      html+='</tbody></table></div>';
    }else if(line.startsWith('- ')){if(!list){html+='<ul>';list=true;}html+='<li>'+inline(line.slice(2))+'</li>';}
    else{if(list){html+='</ul>';list=false;}html+='<p>'+inline(line)+'</p>';}
  }
  return html+(list?'</ul>':'');
}
export const spoiler=(html,label='Reveal spoiler')=>'<details class="spoiler"><summary><span><small>Spoiler warning</small><strong>'+escapeHtml(label)+'</strong></span></summary><div>'+html+'</div></details>';
export function sectionHtml(section,entryId=''){
  if(!section.level)return prose(section.lines);
  const tag=section.level===3?'h3':'h2';
  return '<section id="'+section.id+'" class="level-'+section.level+'"><'+tag+'>'+escapeHtml(section.title)+(entryId?'<a class="section-edit" href="editor.html?page='+entryId+'&amp;section='+section.id+'">edit</a>':'')+'</'+tag+'>'+prose(section.lines)+'</section>';
}
export function renderBody(body,entryId='',options={}){
  const parts=sections(body.replace(/\{\{image:[a-z0-9-]+\}\}/g,'\n$&\n')),hidden=parts.filter(part=>part.spoiler);
  return parts.filter(part=>!part.spoiler).map(part=>sectionHtml(part,entryId)).join('')+(hidden.length?spoiler(hidden.map(part=>part.level===3?sectionHtml(part,entryId):prose(part.lines)).join(''),options.quest?'Reveal solution and ending':'Reveal spoiler'):'');
}
