import { IImportErrorDetail, IImportResult } from '../types/upload';

interface ImportErrorPresentation {
  title: string;
  description: string;
  hint: string;
}

const ERROR_TITLES: Record<string, string> = {
  INVALID_FILE_TYPE: 'Arquivo fora do padrão',
  XML_PARSE_ERROR: 'Não foi possível ler o XML',
  XML_STRUCTURE_INVALID: 'Arquivo não é uma NF-e processada',
  XML_INVOICE_NUMBER_MISSING: 'Número da nota ausente',
  XML_ISSUER_DOCUMENT_MISSING: 'CNPJ do emitente ausente',
  XML_CUSTOMER_SECTION_MISSING: 'Dados do cliente ausentes',
  XML_CUSTOMER_DOCUMENT_MISSING: 'CPF/CNPJ do cliente ausente',
  XML_CUSTOMER_NAME_MISSING: 'Nome do cliente ausente',
  XML_PRODUCTS_MISSING: 'Produtos da nota ausentes',
  XML_PRODUCT_CODE_MISSING: 'Produto sem código',
  XML_PRODUCT_DESCRIPTION_MISSING: 'Produto sem descrição',
  XML_PRODUCT_QUANTITY_INVALID: 'Quantidade de produto inválida',
  XML_ACCESS_KEY_MISSING: 'Chave de acesso da NF-e ausente',
  XML_ISSUE_DATE_MISSING: 'Data de emissão ausente',
  XML_ISSUE_DATE_INVALID: 'Data de emissão inválida',
  MISSING_REQUIRED_FIELD: 'Faltam informações na nota',
  DUPLICATE_INVOICE: 'Nota já cadastrada',
  XML_COMPANY_MISMATCH: 'XML de outra empresa',
  COMPANY_NOT_CONFIGURED: 'Cadastro da empresa incompleto',
  XML_COMPANY_UNREGISTERED: 'CNPJ do emitente não cadastrado',
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

  if (code === 'XML_STRUCTURE_INVALID') {
    return 'O arquivo é um XML, mas não contém a estrutura de uma NF-e processada (nfeProc/NFe/infNFe).';
  }

  if (code === 'XML_INVOICE_NUMBER_MISSING' || message.includes('número da nota fiscal não informado')) {
    return 'O XML veio sem o número da nota.';
  }

  if (code === 'XML_ISSUE_DATE_MISSING' || message.includes('data/hora da nf-e não informada')) {
    return 'O XML veio sem a data de emissão ou saída da nota.';
  }

  if (code === 'XML_ISSUE_DATE_INVALID' || message.includes('data de emissão inválida')) {
    return 'A data da nota está preenchida de forma inválida no XML.';
  }

  if (code === 'XML_ISSUER_DOCUMENT_MISSING' || message.includes('documento do emitente não informado')) {
    return 'O XML veio sem o documento da empresa emissora.';
  }

  if (message.includes('empresa autenticada sem cnpj/cpf configurado')) {
    return 'O cadastro da empresa está incompleto para fazer esta importação.';
  }

  if (code === 'XML_COMPANY_MISMATCH' || message.includes('não pertence a empresa')) {
    return 'Esse XML pertence a outra empresa e não pode ser importado neste acesso.';
  }

  if (code === 'XML_COMPANY_UNREGISTERED' || message.includes('emitente do xml ainda nao esta cadastrado')) {
    return 'O CNPJ do emitente deste XML ainda não está autorizado para nenhuma empresa no sistema.';
  }

  if (code === 'XML_CUSTOMER_SECTION_MISSING' || message.includes('destinatário não informado')) {
    return 'O XML veio sem os dados do cliente.';
  }

  if (code === 'XML_CUSTOMER_DOCUMENT_MISSING' || message.includes('documento do cliente não informado')) {
    return 'O XML veio sem o CPF ou CNPJ do cliente.';
  }

  if (code === 'XML_CUSTOMER_NAME_MISSING' || message.includes('nome do cliente não informado')) {
    return 'O XML veio sem o nome do cliente.';
  }

  if (code === 'XML_PRODUCTS_MISSING' || message.includes('nenhum produto encontrado')) {
    return 'O XML veio sem os produtos da nota.';
  }

  if (code === 'XML_PRODUCT_CODE_MISSING') {
    return 'Um dos produtos do XML está sem o código obrigatório (cProd).';
  }

  if (code === 'XML_PRODUCT_DESCRIPTION_MISSING') {
    return 'Um dos produtos do XML está sem a descrição obrigatória (xProd).';
  }

  if (code === 'XML_PRODUCT_QUANTITY_INVALID') {
    return 'Um dos produtos do XML está sem quantidade válida (qCom).';
  }

  if (code === 'XML_ACCESS_KEY_MISSING' || message.includes('código de barras da nf-e não informado')) {
    return 'O XML veio sem a chave de acesso da NF-e no campo infNFe.Id.';
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
    case 'XML_STRUCTURE_INVALID':
      return 'Baixe o XML processado/autorizado da NF-e no sistema emissor e tente novamente.';
    case 'XML_INVOICE_NUMBER_MISSING':
    case 'XML_ISSUER_DOCUMENT_MISSING':
    case 'XML_CUSTOMER_SECTION_MISSING':
    case 'XML_CUSTOMER_DOCUMENT_MISSING':
    case 'XML_CUSTOMER_NAME_MISSING':
    case 'XML_PRODUCTS_MISSING':
    case 'XML_PRODUCT_CODE_MISSING':
    case 'XML_PRODUCT_DESCRIPTION_MISSING':
    case 'XML_PRODUCT_QUANTITY_INVALID':
    case 'XML_ACCESS_KEY_MISSING':
    case 'XML_ISSUE_DATE_MISSING':
    case 'XML_ISSUE_DATE_INVALID':
      return 'Corrija essa informação no sistema emissor, gere o XML novamente e reenvie o arquivo.';
    case 'MISSING_REQUIRED_FIELD':
      return 'Revise os dados da nota no arquivo original e gere o XML novamente.';
    case 'DUPLICATE_INVOICE':
      return 'Antes de reenviar, confira se essa nota já foi importada.';
    case 'XML_COMPANY_MISMATCH':
      return 'Use o acesso da empresa correta para importar esse XML.';
    case 'COMPANY_NOT_CONFIGURED':
      return 'Peça para ajustar o cadastro da empresa antes de tentar novamente.';
    case 'XML_COMPANY_UNREGISTERED':
      return 'Se este CNPJ pertence a uma empresa autorizada, cadastre-o e reenvie apenas este arquivo.';
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

export function getDuplicateInvoiceResults(results: IImportResult[]) {
  return results.filter((item) => (
    Array.isArray(item.warnings)
    && item.warnings.some((warning) => String(warning.code || '').trim().toUpperCase() === 'DUPLICATE_INVOICE')
  ));
}

export function hasDuplicateInvoiceWarning(result: IImportResult) {
  return getDuplicateInvoiceResults([result]).length > 0;
}
