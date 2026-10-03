import { IInvoiceReturnItem } from '../../types/types';

type Props = {
  label: string;
  returnTypeLabel: string;
  items: IInvoiceReturnItem[];
  changeStatusToReturned?: boolean;
};

/** Review the existing selection; never infer a return or stock decision. */
export default function ReturnNoteReview({ label, returnTypeLabel, items, changeStatusToReturned }: Props) {
  return (
    <section aria-label={`Conferência de ${label}`} className="mt-3 min-w-0 rounded-lg border border-border bg-card p-3 text-sm text-text">
      <h3 className="font-bold">{label} · {returnTypeLabel}</h3>
      <p className="mt-1 text-xs text-muted">{items.length} item(ns) selecionado(s). Confira quantidade, unidade e tratamento.</p>
      {changeStatusToReturned && <p className="mt-2 text-sm text-text-accent">Você autorizou alterar o status da NF para devolvida ao salvar.</p>}
      <ul className="mt-2 divide-y divide-border">
        {items.map((item, index) => (
          <li key={`${item.product_id}:${item.product_type}:${index}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-3">
            <span className="min-w-0 break-words"><strong>{item.product_id}</strong> · {item.product_description || 'Descrição não informada'}</span>
            <strong className="whitespace-nowrap tabular-nums">{item.quantity != null && Number.isFinite(Number(item.quantity)) ? Number(item.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : 'Não informada'} {item.product_type || '(sem unidade)'}</strong>
            <span className="col-span-2 text-xs font-semibold text-muted">{item.is_missing ? 'Faltante — não acompanha o retorno' : item.keep_in_stock ? 'Fica em estoque' : 'Sem marcação de faltante ou estoque'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
