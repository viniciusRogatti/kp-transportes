import { IDanfe } from '../types/types'
import { CardsDanfe, ContainerCards, ContainerItems, DescriptionColumns, ListItems, TitleCard, TotalQuantity } from '../style/CardDanfes';

interface CardDanfesProps {
  danfes: IDanfe[];
}

function CardDanfes({ danfes } : CardDanfesProps) {
  return (
    <ContainerCards>
      { danfes.map((danfe) => (
        <CardsDanfe key={danfe.barcode}>
          <TitleCard>
            <h1>{danfe.invoice_number }</h1>
            <h4>{danfe.invoice_date}</h4>
          </TitleCard>
          <h4>{danfe.Customer.name_or_legal_entity}</h4>
          <p>{danfe.Customer.address}</p>
          <p>{danfe.Customer.city}</p>
            <ContainerItems>
            <DescriptionColumns>
              <span>Código</span>
              <span>Descrição</span>
              <span>Quantidade</span>
            </DescriptionColumns>
            {danfe.DanfeProducts.map((item, index) => (
              <ListItems key={ `${danfe.invoice_number}-${item.Product.code}` }>
                  <li>{item.Product.code}</li>
                  <li>{item.Product.description}</li>
                  <li>{item.quantity}{item.type}</li>
              </ListItems>
            ))}
            </ContainerItems>
          <TotalQuantity><p>{danfe.total_quantity}</p></TotalQuantity>
        </CardsDanfe>
      ))}
    </ContainerCards>
  )
}

export default CardDanfes;