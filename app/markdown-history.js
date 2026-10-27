
export class MarkdownHistory{
 constructor(limit=120){this.limit=limit;this.reset('');}
 reset(text,selectionStart=0,selectionEnd=selectionStart){
  this.stack=[{text,selectionStart,selectionEnd}];this.cursor=0;this.last=0;
 }
 record(text,selectionStart,selectionEnd,force=false,now=Date.now()){
  if(this.stack[this.cursor]?.text===text)return;
  this.stack=this.stack.slice(0,this.cursor+1);
  const next={text,selectionStart,selectionEnd};
  if(!force&&this.stack.length>1&&now-this.last<650){this.stack[this.cursor]=next;}
  else{this.stack.push(next);this.cursor++;}
  if(this.stack.length>this.limit){this.stack.shift();this.cursor--;}
  this.last=now;
 }
 get canUndo(){return this.cursor>0;}
 get canRedo(){return this.cursor<this.stack.length-1;}
 undo(){if(!this.canUndo)return null;return this.stack[--this.cursor];}
 redo(){if(!this.canRedo)return null;return this.stack[++this.cursor];}
}
