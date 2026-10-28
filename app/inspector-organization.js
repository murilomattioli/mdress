/** Arrange existing controls by entity before progressive enhancement. */
export function organizeInspector(){
 const byId=id=>document.getElementById(id);
 const sectionOf=id=>byId(id)?.closest('.property-section');
 const rename=(section,title)=>{const heading=section?.querySelector('.property-section-heading strong');if(heading)heading.textContent=title;};
 const style=byId('inspector-style');
 const theme=sectionOf('resumeTheme'),type=sectionOf('fontChoice'),colors=sectionOf('accentColor');
 style.prepend(type,colors,theme);
 rename(theme,'Temas e variações');
 const blocks=document.querySelector('[data-inspector-tab="sections"] span');
 blocks.textContent='Blocos';
 rename(sectionOf('sectionStyleTarget'),'Seções e elementos');
 const density=document.querySelector('.section-style-density')?.closest('.property-section');
 rename(density,'Densidade de todas as seções');
 // Reset belongs to the selected section, not to global density or elements.
 const reset=byId('sectionStyleReset')?.closest('.section-style-actions');
 if(reset)byId('sectionComposerView').append(reset);
 const geometry=sectionOf('marginMm');
 rename(geometry,'Margens da página');
 const rhythm=document.createElement('div');rhythm.className='property-section';
 const heading=document.createElement('div');heading.className='property-section-heading';
 const title=document.createElement('strong');title.textContent='Ritmo entre seções';heading.append(title);rhythm.append(heading);
 for(const id of ['sectionGapEm','sectionRule'])rhythm.append(byId(id).closest('.property-row'));
 geometry.after(rhythm);
 const background=byId('inspector-background');
 background.prepend(sectionOf('bgKind'));
 const ai=sectionOf('agentBrief');
 rename(ai,'Direção visual');
 const proposal=document.createElement('div');proposal.className='property-section';
 const proposalHeading=document.createElement('div');proposalHeading.className='property-section-heading';
 const proposalTitle=document.createElement('strong');proposalTitle.textContent='Proposta de tema';proposalHeading.append(proposalTitle);proposal.append(proposalHeading);
 proposal.append(byId('agentJSON').closest('.property-field'),byId('previewAgentTheme').closest('.property-actions'));
 ai.after(proposal);
}
