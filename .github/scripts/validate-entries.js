const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const cheerio = require("cheerio");

const MAX_FILE_SIZE = 1024 * 1024; // 1MB em bytes
const results = {};

// Valida tamanho do arquivo (deve ser < 1MB)
function validateFileSize(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;

  if (fileSizeInBytes >= MAX_FILE_SIZE) {
    return `Tamanho do arquivo (${(fileSizeInBytes / 1024 / 1024).toFixed(
      2
    )}MB) excede o limite de 1MB`;
  }

  return null;
}

// Valida se é um único arquivo HTML
function validateSingleHtmlFile(filePath, content) {
  const issues = [];

  // Verifica a extensão do arquivo
  if (!filePath.match(/\.html?$/i)) {
    issues.push("O arquivo deve ter extensão .html ou .htm");
  }

  // Verifica se tem estrutura básica de HTML
  if (!content.includes("<html") && !content.includes("<!DOCTYPE")) {
    issues.push("O arquivo deve conter uma estrutura HTML válida");
  }

  return issues;
}

// Verifica se uma URL é externa
function isExternalUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch (e) {
    // Se falhar o parsing, provavelmente é caminho relativo
    return false;
  }
}

// Valida ausência de importações externas
function validateNoExternalImports(content) {
  const issues = [];
  const $ = cheerio.load(content);

  // Verifica estilos externos
  $('link[rel="stylesheet"]').each((i, el) => {
    const href = $(el).attr("href");
    if (href && isExternalUrl(href)) {
      issues.push(`Estilo externo encontrado: ${href}`);
    }
  });

  // Verifica scripts externos
  $("script[src]").each((i, el) => {
    const src = $(el).attr("src");
    if (src && isExternalUrl(src)) {
      issues.push(`Script externo encontrado: ${src}`);
    }
  });

  // Verifica imagens externas
  $("img[src]").each((i, el) => {
    const src = $(el).attr("src");
    if (src && isExternalUrl(src) && !src.startsWith("data:")) {
      issues.push(`Imagem externa encontrada: ${src}`);
    }
  });

  // Verifica outros recursos externos
  $("[src], [href]").each((i, el) => {
    const src = $(el).attr("src") || $(el).attr("href");
    if (
      src &&
      isExternalUrl(src) &&
      !src.startsWith("data:") &&
      !src.startsWith("#")
    ) {
      const tagName = el.tagName.toLowerCase();
      if (!["link", "script", "img", "a"].includes(tagName)) {
        issues.push(`Recurso externo encontrado na tag ${tagName}: ${src}`);
      }
    }
  });

  return issues;
}

// Verificação básica se o trecho está em comentário ou string (não é 100% precisa)
function isInCommentOrString(content, match) {
  const index = content.indexOf(match);
  if (index === -1) return false;

  const beforeMatch = content.substring(0, index);
  const lines = beforeMatch.split("\n");
  const currentLine = lines[lines.length - 1];

  // Verifica se está em comentário de linha
  if (currentLine.includes("//")) {
    const commentIndex = currentLine.indexOf("//");
    const matchIndex = currentLine.length - (content.length - index);
    if (matchIndex > commentIndex) return true;
  }

  // Verificação básica de string (pode falhar com aspas aninhadas)
  const inString =
    (currentLine.match(/"/g) || []).length % 2 === 1 ||
    (currentLine.match(/'/g) || []).length % 2 === 1;

  return inString;
}

// Valida ausência de requisições de rede em scripts JS
function validateNoNetworkRequests(content) {
  const issues = [];

  // Padrões comuns de chamadas de rede
  const networkPatterns = [
    /fetch\s*\(/gi,
    /XMLHttpRequest/gi,
    /\.ajax\s*\(/gi,
    /axios\./gi,
    /\$\.get\s*\(/gi,
    /\$\.post\s*\(/gi,
    /new\s+WebSocket\s*\(/gi,
    /navigator\.sendBeacon\s*\(/gi,
    /import\s*\(/gi, // imports dinâmicos
  ];

  networkPatterns.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        // Ignora se estiver em comentário ou string
        if (!isInCommentOrString(content, match)) {
          issues.push(`Possível requisição de rede detectada: ${match.trim()}`);
        }
      });
    }
  });

  return issues;
}

// Valida existência de meta tags obrigatórias
function validateRequiredMetaTags(content) {
  const issues = [];
  const $ = cheerio.load(content);

  // Verifica <title> ou <meta name="title">
  const metaTitle = $('meta[name="title"]').attr("content");
  const titleElement = $("title").text();

  if (!metaTitle && !titleElement) {
    issues.push(
      'Título ausente: Adicione <meta name="title" content="Seu Título"> ou <title>Seu Título</title>'
    );
  }

  // Verifica <meta name="description">
  const description = $('meta[name="description"]').attr("content");
  if (!description) {
    issues.push(
      'Descrição ausente: Adicione <meta name="description" content="Breve descrição do seu projeto">'
    );
  }

  // Verifica <meta name="author">
  const author = $('meta[name="author"]').attr("content");
  if (!author) {
    issues.push(
      'Autor ausente: Adicione <meta name="author" content="Seu Nome">'
    );
  }

  // GitHub é opcional, mas recomendado
  const github = $('meta[name="github"]').attr("content");
  if (!github) {
    issues.push(
      'Recomendado: Adicione <meta name="github" content="seu-usuario-github"> para linkar seu perfil'
    );
  }

  return issues;
}

// Valida estrutura e sintaxe do HTML
function validateHtmlSyntax(content) {
  const issues = [];

  try {
    const dom = new JSDOM(content);
    // Se o JSDOM conseguir parsear, o HTML provavelmente é válido
  } catch (error) {
    issues.push(`Erro de sintaxe HTML: ${error.message}`);
  }

  // Verifica tags <script> não fechadas
  const scriptMatches = content.match(/<script[^>]*>/gi) || [];
  const scriptCloses = content.match(/<\/script>/gi) || [];

  if (scriptMatches.length !== scriptCloses.length) {
    issues.push("Tags <script> não fechadas detectadas");
  }

  // Verifica tags <style> não fechadas
  const styleMatches = content.match(/<style[^>]*>/gi) || [];
  const styleCloses = content.match(/<\/style>/gi) || [];

  if (styleMatches.length !== styleCloses.length) {
    issues.push("Tags <style> não fechadas detectadas");
  }

  return issues;
}

// Função principal de validação
function validateEntry(filePath) {
  const issues = [];
  const filename = path.basename(filePath);

  console.log(`Validando: ${filename}`);

  // Verifica se o arquivo existe
  if (!fs.existsSync(filePath)) {
    return [`Arquivo não existe: ${filePath}`];
  }

  // Lê o conteúdo do arquivo
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return [`Erro ao ler o arquivo: ${error.message}`];
  }

  // 1. Valida tamanho
  const sizeIssue = validateFileSize(filePath);
  if (sizeIssue) issues.push(sizeIssue);

  // 2. Valida extensão e estrutura
  issues.push(...validateSingleHtmlFile(filePath, content));

  // 3. Valida sintaxe HTML
  issues.push(...validateHtmlSyntax(content));

  // 4. Valida ausência de importações externas
  issues.push(...validateNoExternalImports(content));

  // 5. Valida ausência de requisições de rede
  issues.push(...validateNoNetworkRequests(content));

  // 6. Valida metatags obrigatórias
  issues.push(...validateRequiredMetaTags(content));

  return issues;
}

// Executa validação em todos os arquivos modificados
function validateChangedFiles() {
  const changedFiles = process.env.CHANGED_FILES
    ? process.env.CHANGED_FILES.trim().split(" ")
    : [];

  console.log("Arquivos modificados:", changedFiles);

  let hasErrors = false;

  for (const file of changedFiles) {
    if (!file) continue;

    if (file.startsWith("entries/") && file.match(/\.html?$/)) {
      const issues = validateEntry(file);
      results[file] = issues;

      if (issues.length > 0) {
        hasErrors = true;
        console.log(`❌ ${file}: ${issues.length} problemas encontrados`);
        issues.forEach((issue) => console.log(`   - ${issue}`));
      } else {
        console.log(`✅ ${file}: Nenhum problema encontrado`);
      }
    }
  }

  // Salva resultado para uso na GitHub Action
  fs.writeFileSync("validation-results.json", JSON.stringify(results, null, 2));

  if (hasErrors) {
    console.log("\n❌ Validação falhou");
    process.exit(1);
  } else {
    console.log("\n✅ Todas as validações passaram");
    process.exit(0);
  }
}

// Executa validação
validateChangedFiles();
