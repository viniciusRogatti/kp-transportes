import React from 'react';
import { IProduct } from '../types/types';

interface CardProductsProps {
  product: IProduct;
}

const CardProducts = ({ product } : CardProductsProps) => {
  return (
    <tr key={product.code}>
      <td>{product.code}</td>
      <td>{product.description}</td>
      <td className="max-[768px]:hidden">{product.price}</td>
      <td className="max-[768px]:hidden">{product.type}</td>
    </tr>
  );
}

export default CardProducts;
