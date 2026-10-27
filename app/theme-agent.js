import {defaults,validateTheme} from './resume-themes.js';
export const themeAgentSchemaVersion=1;
/** Future adapter: provider.generateTheme({system,user,schemaVersion}): Promise<string>.
 * Never forward authored Markdown or personal data without explicit consent.
 */
export function createThemeAgentPrompt(brief,base=defaults){
 if(typeof brief!=='string'||brief.trim().length<3||brief.length>1600)throw Error('Descreva o tema em até 1600 caracteres');
 const theme=validateTheme(base);
 return [
 'Você é designer de documentos Markdown convertidos para PDF.',
 'Gere somente um objeto JSON válido, sem Markdown fences, sem código CSS/JS/HTML, sem URLs e sem imagens.',
 'O tema é decoração. NÃO gere conteúdo textual do documento, não altere Markdown e não inclua dados pessoais.',
 'Use estas chaves: theme, accent, background, text, font, size, paper, layout, backgroundStyle.',
 'theme: minimal|swiss|technical|oled|graphite|sand|neon; cores: #RRGGBB; font: system|serif|mono; size: 9 a 14; paper: a4|letter.',
 'layout: marginMm 8..35; lineHeight 1.1..2.2; titleScale 1.4..3.4; sectionGapEm 0.4..3; sectionRule line|none|block.',
 'backgroundStyle: kind solid|gradient|dots|lines|grid|radial|mesh|crosshatch|checker; secondary #RRGGBB; angle 0..360; patternSize 8..64; softness 0..100; opacity 0.02..0.6; points [] for non-mesh or 2..6 mesh points {color:#RRGGBB,x:0..100,y:0..100,radius:15..120,strength:0.05..1}.',
 'Considere contraste adequado para texto normal e uso no PDF; prefira elementos vetoriais leves.',
 'Tema atual: '+JSON.stringify(theme),
 'Pedido: '+brief.trim(),
 'Resposta: SOMENTE JSON.'
 ].join('\n');
}
export function parseThemeAgentResponse(raw){
 if(typeof raw!=='string'||raw.length>20000)throw Error('Resposta vazia ou excessiva');
 const cleaned=raw.trim().replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}$/,'');
 let value;try{value=JSON.parse(cleaned);}catch{throw Error('Resposta do agente não é JSON válido');}
 return validateTheme(value);
}
export async function requestThemeFromProvider(brief,provider,base=defaults){
 if(!provider||typeof provider.generateTheme!=='function')throw Error('Integração LLM não configurada');
 const user=createThemeAgentPrompt(brief,base);
 const raw=await provider.generateTheme({system:'Você gera apenas tokens de apresentação validados.',user,schemaVersion:themeAgentSchemaVersion});
 return parseThemeAgentResponse(raw);
}
