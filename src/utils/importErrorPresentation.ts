import { IImportErrorDetail, IImportResult } from '../types/upload';

interface ImportErrorPresentation {
  title: string;
  description: string;
  hint: string;
}

const ERROR_TITLES: Record<string, string> = {
  INVALID_FILE_TYPE: 'Arquivo fora do padrão',
  XML_PARSE_ERROR: 'Não foi possível ler o XML',
  MISSING_REQUIRED_FIELD: 'Faltam informações na nota',
  DUPLICATE_INVOICE: 'Nota já cadastrada',
  XML_COMPANY_MISMATCH: 'XML de outra empresa',
  COMPANY_NOT_CONFIGURED: 'Cadastro da empresa incompleto',
  DB_CONSTRAINT_ERROR: 'Conflito com dados já cadastrados',
  UNKNOWN_ERROR: 'Falha ao importar o arquivo',
};

function normalize(value: unknown) {
  return String(value || '').trim();
}

function normalizeLower(value: unknown) {
  return normalize(value).toLocaleLowerCase('pt-BR');
}

export function getImportErrorTitle(error?: IImportErrorDetail | null) {
  const code = normalize(error?.code);
  return ERROR_TITLES[code] || 'Falha ao importar o arquivo';
}

export function getImportErrorDescription(error?: IImportErrorDetail | null) {
  const code = normalize(error?.code);
  const message = normalizeLower(error?.message);

  if (message.includes('arquivo inválido')) {
    return 'O arquivo enviado não é um XML aceito pelo sistema.';
  }

  if (
    code === 'XML_PARSE_ERROR'
    || message.includes('xml inválido')
    || message.includes('estrutura xml inválida')
    || message.includes('corrompido')
  ) {
    return 'O arquivo parece incompleto, corrompido ou fora do padrão esperado.';
  }

  if (message.includes('número da nota fiscal não informado')) {
    return 'O XML veio sem o número da nota.';
  }

  if (message.includes('data/hora da nf-e não informada')) {
    return 'O XML veio sem a data de emissão ou saída da nota.';
  }

  if (message.includes('data de emissão inválida')) {
    return 'A data da nota está preenchida de forma inválida no XML.';
  }

  if (message.includes('documento do emitente não informado')) {
    return 'O XML veio sem o documento da empresa emissora.';
  }

  if (message.includes('empresa autenticada sem cnpj/cpf configurado')) {
    return 'O cadastro da empresa está incompleto para fazer esta importação.';
  }

  if (code === 'XML_COMPANY_MISMATCH' || message.includes('não pertence a empresa')) {
    return 'Esse XML pertence a outra empresa e não pode ser importado neste acesso.';
  }

  if (message.includes('destinatário não informado')) {
    return 'O XML veio sem os dados do cliente.';
  }

  if (message.includes('documento do cliente não informado')) {
    return 'O XML veio sem o CPF ou CNPJ do cliente.';
  }

  if (message.includes('nome do cliente não informado')) {
    return 'O XML veio sem o nome do cliente.';
  }

  if (message.includes('nenhum produto encontrado')) {
    return 'O XML veio sem os produtos da nota.';
  }

  if (message.includes('código de barras da nf-e não informado')) {
    return 'O XML veio sem um identificador principal da nota.';
  }

  if (message.includes('código de barras já vinculado')) {
    return 'Essa nota usa um identificador que já está ligado a outra nota no sistema.';
  }

  if (code === 'DUPLICATE_INVOICE' || message.includes('conflito de identificacao')) {
    return 'Essa nota já existe no sistema ou usa um identificador já cadastrado.';
  }

  if (code === 'DB_CONSTRAINT_ERROR' || message.includes('falha ao salvar dados no banco')) {
    return 'Os dados deste XML entraram em conflito com um cadastro que já existe.';
  }

  if (code === 'MISSING_REQUIRED_FIELD') {
    return 'Esse XML está sem informações obrigatórias da nota.';
  }

  return 'Não foi possível concluir a importação deste arquivo.';
}

export function getImportErrorHint(error?: IImportErrorDetail | null) {
  const code = normalize(error?.code);

  switch (code) {
    case 'INVALID_FILE_TYPE':
      return 'Escolha um arquivo XML e tente novamente.';
    case 'XML_PARSE_ERROR':
      return 'Confira se o XML foi gerado corretamente e tente reenviar só esse arquivo.';
    case 'MISSING_REQUIRED_FIELD':
      return 'Revise os dados da nota no arquivo original e gere o XML novamente.';
    case 'DUPLICATE_INVOICE':
      return 'Antes de reenviar, confira se essa nota já foi importada.';
    case 'XML_COMPANY_MISMATCH':
      return 'Use o acesso da empresa correta para importar esse XML.';
    case 'COMPANY_NOT_CONFIGURED':
      return 'Peça para ajustar o cadastro da empresa antes de tentar novamente.';
    case 'DB_CONSTRAINT_ERROR':
      return 'Se continuar falhando, envie os detalhes para o suporte.';
    default:
      return 'Abra a aba Erros para ver o motivo e tente reenviar apenas os arquivos com problema.';
  }
}

export function getImportErrorPresentation(error?: IImportErrorDetail | null): ImportErrorPresentation {
  return {
    title: getImportErrorTitle(error),
    description: getImportErrorDescription(error),
    hint: getImportErrorHint(error),
  };
}

export function getImportErrorQueueMessage(error?: IImportErrorDetail | null) {
  return getImportErrorDescription(error);
}

export function buildImportFailureAlertMessage(results: IImportResult[]) {
  const failures = results.filter((item) => item.status === 'error');
  if (!failures.length) return '';

  const visibleLines = failures.slice(0, 3).map((item) => (
    `- ${item.fileName}: ${getImportErrorDescription(item.error)}`
  ));
  const remaining = failures.length - visibleLines.length;

  return [
    failures.length === 1
      ? '1 XML teve erro e não pôde ser importado.'
      : `${failures.length} XMLs tiveram erro e não puderam ser importados.`,
    '',
    ...visibleLines,
    remaining > 0 ? `- E mais ${remaining} arquivo(s) com erro.` : '',
    '',
    'Você pode abrir a aba "Erros" para ver o motivo de cada arquivo.',
    'Se quiser tentar novamente, use o botão "Reenviar apenas com erro".',
  ].filter(Boolean).join('\n');
}

export function getDuplicateInvoiceResults(results: IImportResult[]) {
  return results.filter((item) => (
    Array.isArray(item.warnings)
    && item.warnings.some((warning) => String(warning.code || '').trim().toUpperCase() === 'DUPLICATE_INVOICE')
  ));
}

export function hasDuplicateInvoiceWarning(result: IImportResult) {
  return getDuplicateInvoiceResults([result]).length > 0;
}

export function buildDuplicateInvoiceAlertMessage(results: IImportResult[]) {
  const duplicates = getDuplicateInvoiceResults(results);
  if (!duplicates.length) return '';

  const visibleLines = duplicates.slice(0, 3).map((item) => {
    const invoiceNumber = String(item.meta?.invoiceNumber || '').trim();
    return `- ${item.fileName}${invoiceNumber ? ` (NF ${invoiceNumber})` : ''}: já estava no banco e não foi importado novamente.`;
  });
  const remaining = duplicates.length - visibleLines.length;

  return [
    duplicates.length === 1
      ? '1 XML corresponde a uma nota que já estava cadastrada.'
      : `${duplicates.length} XMLs correspondem a notas que já estavam cadastradas.`,
    '',
    ...visibleLines,
    remaining > 0 ? `- E mais ${remaining} arquivo(s) já cadastrados.` : '',
    '',
    'Esses arquivos foram reconhecidos, mas não precisaram ser importados de novo.',
    'Confira os avisos na aba "Sucessos" para ver quais notas já existiam.',
  ].filter(Boolean).join('\n');
}
