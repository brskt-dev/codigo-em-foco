const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Lê e interpreta o arquivo entries.js original para obter os metadados
function getOriginalEntries() {
  try {
    const entriesContent = fs.readFileSync('entries.js', 'utf8');
    
    // Extrai o array de entradas usando regex
    const entriesMatch = entriesContent.match(/const\s+entries\s*=\s*(\[[\s\S]*?\]);/);
    if (!entriesMatch) {
      throw new Error('Não foi possível encontrar o array de entries no entries.js');
    }
    
    // Usa o construtor Function para avaliar com segurança o array
    const entriesArrayString = entriesMatch[1];
    const entries = new Function('return ' + entriesArrayString)();
    
    return entries;
  } catch (error) {
    console.error('Erro ao ler o entries.js:', error.message);
    return [];
  }
}

// Adiciona meta tags ao conteúdo HTML usando manipulação de string precisa
function addMetaTags(content, entry) {
  // Primeiro verifica o que está faltando usando cheerio apenas para parsing
  const $ = cheerio.load(content);
  
  const hasTitle = $('title').length > 0;
  const hasMetaTitle = $('meta[name="title"]').length > 0;
  const hasDescription = $('meta[name="description"]').length > 0;
  const hasAuthor = $('meta[name="author"]').length > 0;
  const hasGithub = $('meta[name="github"]').length > 0;
  const hasCompatibleBrowsers = $('meta[name="compatible-browsers"]').length > 0;
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const hasHead = $('head').length > 0;
  
  // Monta lista de meta tags a serem adicionadas
  const metaTags = [];
  
  // Adiciona comentário explicando a adição
  metaTags.push('    <!-- Meta tags adicionadas devido à descontinuação do entries.js em 8 de julho de 2025 -->');
  
  // Adiciona viewport se estiver ausente (boa prática)
  if (!hasViewport) {
    metaTags.push('    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  }
  
  // Não adiciona meta title se já houver título
  if (entry.title && !hasTitle && !hasMetaTitle) {
    metaTags.push(`    <meta name="title" content="${escapeHtml(entry.title)}">`);
  }
  
  // Adiciona descrição se estiver ausente
  if (entry.description && !hasDescription) {
    metaTags.push(`    <meta name="description" content="${escapeHtml(entry.description)}">`);
  }
  
  // Adiciona author se estiver ausente
  if (entry.author && !hasAuthor) {
    metaTags.push(`    <meta name="author" content="${escapeHtml(entry.author)}">`);
  }
  
  // Adiciona github se estiver ausente
  if (entry.github && !hasGithub) {
    metaTags.push(`    <meta name="github" content="${escapeHtml(entry.github)}">`);
  }
  
  // Adiciona navegadores compatíveis se estiverem ausentes
  if (entry.compatibleBrowsers && entry.compatibleBrowsers.length > 0 && !hasCompatibleBrowsers) {
    const browsers = entry.compatibleBrowsers.join(', ');
    metaTags.push(`    <meta name="compatible-browsers" content="${escapeHtml(browsers)}">`);
  }
  
  // Se nada for adicionado, retorna o conteúdo original
  if (metaTags.length <= 1) { // Apenas o comentário, sem meta tags reais
    return content;
  }
  
  let updatedContent = content;
  
  if (!hasHead) {
    // Cria a seção <head> após a tag <html> ou no início do documento
    const htmlTagMatch = updatedContent.match(/(<html[^>]*>)/i);
    if (htmlTagMatch) {
      const insertPos = htmlTagMatch.index + htmlTagMatch[0].length;
      const headSection = `\n<head>\n${metaTags.join('\n')}\n</head>`;
      updatedContent = updatedContent.slice(0, insertPos) + headSection + updatedContent.slice(insertPos);
    } else {
      // Nenhuma tag <html>, insere head no início
      const headSection = `<head>\n${metaTags.join('\n')}\n</head>\n`;
      updatedContent = headSection + updatedContent;
    }
  } else {
    // Encontra a tag <head> e insere após ela
    const headTagMatch = updatedContent.match(/(<head[^>]*>)/i);
    if (headTagMatch) {
      const insertPos = headTagMatch.index + headTagMatch[0].length;
      const insertion = `\n${metaTags.join('\n')}`;
      updatedContent = updatedContent.slice(0, insertPos) + insertion + updatedContent.slice(insertPos);
    }
  }
  
  return updatedContent;
}

// Função simples para escapar HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Atualiza todos os arquivos de entrada com as meta tags necessárias
function updateAllEntries() {
  const originalEntries = getOriginalEntries();
  if (originalEntries.length === 0) {
    console.error('Nenhuma entrada encontrada no entries.js');
    return;
  }
  
  console.log(`Encontradas ${originalEntries.length} entradas no entries.js`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  
  for (const entry of originalEntries) {
    const filePath = path.join('entries', entry.filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Arquivo não encontrado: ${entry.filename}`);
      continue;
    }
    
    try {
      const originalContent = fs.readFileSync(filePath, 'utf8');
      const updatedContent = addMetaTags(originalContent, entry);
      
      // Só grava se o conteúdo foi alterado
      if (originalContent !== updatedContent) {
        fs.writeFileSync(filePath, updatedContent, 'utf8');
        console.log(`✅ Atualizado: ${entry.filename}`);
        updatedCount++;
      } else {
        console.log(`⏭️  Ignorado: ${entry.filename} (já possui meta tags)`);
        skippedCount++;
      }
    } catch (error) {
      console.error(`❌ Erro ao atualizar ${entry.filename}:`, error.message);
    }
  }
  
  console.log(`\n📊 Resumo:`);
  console.log(`   Atualizados: ${updatedCount} arquivos`);
  console.log(`   Ignorados:  ${skippedCount} arquivos`);
  console.log(`   Total:      ${originalEntries.length} arquivos`);
}

// Executa a atualização
updateAllEntries();
