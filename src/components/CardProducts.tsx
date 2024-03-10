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
      <td>{product.price}</td>
      <td>{product.type}</td>
    </tr>
  );
}

export default CardProducts;
