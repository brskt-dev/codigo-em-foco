const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

/**
 * Extrai os metadados de um arquivo HTML
 * @param {string} filePath - Caminho para o arquivo HTML
 * @returns {object|null} - Metadados extraídos ou null se inválido
 */
function extractMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const $ = cheerio.load(content);
    const filename = path.basename(filePath);

    // Extrair metadados das meta tags e título
    const title =
      $('meta[name="title"]').attr("content") ||
      $("title").text() ||
      filename.replace(/\.[^/.]+$/, "");
    const description = $('meta[name="description"]').attr("content") || "";
    const author = $('meta[name="author"]').attr("content") || "";
    const github = $('meta[name="github"]').attr("content") || "";

    // Extrair navegadores compatíveis, se especificado
    const compatibleBrowsersContent = $(
      'meta[name="compatible-browsers"]'
    ).attr("content");
    let compatibleBrowsers = [];
    if (compatibleBrowsersContent) {
      compatibleBrowsers = compatibleBrowsersContent
        .split(",")
        .map((b) => b.trim())
        .filter((b) => b);
    }

    // Montar objeto da entrada
    const entry = {
      title: title.trim(),
      filename: filename,
    };

    if (description) entry.description = description.trim();
    if (author) entry.author = author.trim();
    if (github) entry.github = github.trim();
    if (compatibleBrowsers.length > 0)
      entry.compatibleBrowsers = compatibleBrowsers;

    return entry;
  } catch (error) {
    console.error(`Erro ao processar ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Gera o arquivo entries.js com base nos arquivos HTML presentes na pasta entries
 */
function generateEntriesJs() {
  const entriesDir = "entries";

  if (!fs.existsSync(entriesDir)) {
    console.error('Diretório "entries" não encontrado');
    process.exit(1);
  }

  const entries = [];
  const files = fs
    .readdirSync(entriesDir)
    .filter((file) => file.match(/\.html?$/i))
    .sort(); // Ordenar alfabeticamente para consistência

  console.log(`Processando ${files.length} arquivos HTML...`);

  for (const file of files) {
    const filePath = path.join(entriesDir, file);
    const metadata = extractMetadata(filePath);

    if (metadata) {
      entries.push(metadata);
      console.log(`✅ ${file}: ${metadata.title}`);
    } else {
      console.log(`❌ ${file}: Falha ao extrair metadados`);
    }
  }

  // Ordenar entradas por título
  entries.sort((a, b) => a.title.localeCompare(b.title));

  // Gerar conteúdo do JavaScript
  const jsContent = `/**
 * Este arquivo é gerado automaticamente a partir das meta tags dos HTMLs.
 * Última atualização: ${new Date().toISOString()}
 * 
 * NÃO EDITE MANUALMENTE - As alterações serão sobrescritas!
 * Para atualizar as entradas, modifique as meta tags nos arquivos HTML.
 */

const entries = ${JSON.stringify(entries, null, 2)};`;

  const jsOutputFile = "entries.js";
  fs.writeFileSync(jsOutputFile, jsContent, "utf8");

  console.log(`\n✅ ${jsOutputFile} gerado com ${entries.length} entradas`);

  // Listar arquivos com metadados incompletos
  const missingMetadata = files.filter((file) => {
    const filePath = path.join(entriesDir, file);
    const metadata = extractMetadata(filePath);
    return (
      !metadata || !metadata.title || !metadata.description || !metadata.author
    );
  });

  if (missingMetadata.length > 0) {
    console.log(`\n⚠️  Arquivos com metadados incompletos:`);
    missingMetadata.forEach((file) => {
      const filePath = path.join(entriesDir, file);
      const metadata = extractMetadata(filePath);
      const missing = [];
      if (!metadata || !metadata.title) missing.push("title");
      if (!metadata || !metadata.description) missing.push("description");
      if (!metadata || !metadata.author) missing.push("author");
      console.log(`   ${file}: faltando ${missing.join(", ")}`);
    });
  }
}

// Executar gerador
generateEntriesJs();
