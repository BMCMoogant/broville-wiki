import {renderProse,renderInline,documentLinks} from './rich-markup.js';
export const escapeHtml=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const slugify=value=>value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const link=(id,label)=>'<a href="'+escapeHtml(id)+'.html">'+escapeHtml(label)+'</a>';
export const internalLinks=text=>documentLinks(text);
export const inline=text=>renderInline(text);
export function sections(body){
  const blocks=[];let parent='',spoiler=false,fence=null,containers=[],offset=0;const ids=new Map();
  for(const raw of body.split(/\r?\n/)){
    const length=raw.length+(body.slice(offset+raw.length,offset+raw.length+2)==='\r\n'?2:1);
    const marker=/^\s*(`{3,}|~{3,})/.exec(raw);
    if(marker){if(!fence)fence=marker[1][0];else if(fence===marker[1][0])fence=null;}
    const container=/^\s*(:{3,})(.*)$/.exec(raw);if(!fence&&container){if(/^spoiler(?:\s|$)/.test(container[2].trim()))containers.push(container[1].length);else if(!container[2].trim()&&container[1].length>=containers.at(-1))containers.pop();}
    const match=!fence&&!marker&&!containers.length&&!container?/^(##|###) (.+)$/.exec(raw):null;
    if(match){const level=match[1].length,base=level===2?slugify(match[2]):parent+'-'+slugify(match[2]);const count=(ids.get(base)??0)+1;ids.set(base,count);const id=base+(count>1?'-'+count:'');if(level===2){parent=id;spoiler=slugify(match[2])==='spoilers';}blocks.push({title:match[2],id,level,spoiler,start:offset,lines:[]});}
    else{if(!blocks.length)blocks.push({title:'',id:'',level:0,spoiler:false,start:0,lines:[]});blocks.at(-1).lines.push(raw);}
    offset+=length;
  }
  return blocks;
}
export const prose=lines=>renderProse(lines.join('\n'));
export const spoiler=(html,label='Reveal spoiler')=>'<details class="spoiler"><summary><span><small>Spoiler warning</small><strong>'+escapeHtml(label)+'</strong></span></summary><div>'+html+'</div></details>';
export function sectionHtml(section,entryId=''){
  if(!section.level)return prose(section.lines);
  const tag=section.level===3?'h3':'h2';
  return '<section id="'+section.id+'" class="level-'+section.level+'"><'+tag+'>'+inline(section.title)+(entryId?'<a class="section-edit" href="editor.html?page='+entryId+'&amp;section='+section.id+'">edit</a>':'')+'</'+tag+'>'+prose(section.lines)+'</section>';
}
export function renderBody(body,entryId='',options={}){
  const parts=sections(body),hidden=parts.filter(part=>part.spoiler);
  return parts.filter(part=>!part.spoiler).map(part=>sectionHtml(part,entryId)).join('')+(hidden.length?spoiler(hidden.map(part=>part.level===3?sectionHtml(part,entryId):prose(part.lines)).join(''),options.quest?'Reveal solution and ending':'Reveal spoiler'):'');
}
