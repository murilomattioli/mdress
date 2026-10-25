/** One timeline for document content and design actions. Never stores UI-only transient state. */
const clone=value=>structuredClone(value);
export class DocumentHistory{
 constructor(limit=120){this.limit=limit;this.stack=[];this.cursor=-1;this.last=0;}
 reset(document){this.stack=[{document:clone(document),label:'Estado inicial'}];this.cursor=0;this.last=0;}
 record(document,label='Alteração',merge=false,now=Date.now()){
  if(this.cursor<0){this.reset(document);return false;}
  const next=clone(document);
  if(JSON.stringify(this.stack[this.cursor].document)===JSON.stringify(next))return false;
  this.stack=this.stack.slice(0,this.cursor+1);
  // Merge only consecutive text edits. Never absorb the initial state or non-text actions.
  if(merge&&this.cursor>0&&this.stack[this.cursor].label==='Editar Markdown'&&now-this.last<650){
   this.stack[this.cursor]={document:next,label};
  }else{
   this.stack.push({document:next,label});this.cursor++;
  }
  if(this.stack.length>this.limit){this.stack.shift();this.cursor--;}
  this.last=now;
  return true;
 }
 get canUndo(){return this.cursor>0;}
 get canRedo(){return this.cursor<this.stack.length-1;}
 undo(){return this.canUndo?clone(this.stack[--this.cursor].document):null;}
 redo(){return this.canRedo?clone(this.stack[++this.cursor].document):null;}
 get undoLabel(){return this.canUndo?this.stack[this.cursor].label:'';}
 get redoLabel(){return this.canRedo?this.stack[this.cursor+1].label:'';}
}
